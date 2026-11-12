import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  EmailAuthProvider,
  getAuth,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  verifyBeforeUpdateEmail,
} from 'firebase/auth';
import {
  getFirestore,
  Firestore,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  getDocFromServer,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { StoreSettings } from './storeSettings';
import { Look, Product } from '../types';

let cachedApp: FirebaseApp | null = null;
let cachedDb: Firestore | null = null;

export function getFirebaseInstance(): { app: FirebaseApp | null; db: Firestore | null } {
  // Firebase configuration is supplied by Vercel environment variables, never editable in Admin.
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY || '';
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || '';
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`;
  const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`;
  const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '';
  const appId = import.meta.env.VITE_FIREBASE_APP_ID || '';

  if (!apiKey || !projectId) {
    return { app: null, db: null };
  }

  try {
    if (!getApps().length) {
      cachedApp = initializeApp({
        apiKey,
        authDomain,
        projectId,
        storageBucket,
        messagingSenderId,
        appId,
      });
    } else {
      cachedApp = getApp();
    }
    cachedDb = getFirestore(cachedApp);
    return { app: cachedApp, db: cachedDb };
  } catch (err) {
    console.error('Failed to initialize Firebase SDK:', err);
    return { app: null, db: null };
  }
}

export function isFirebaseConfigured(): boolean {
  return Boolean(import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID);
}

export function subscribeStoreAdminAuth(onAuthenticated: (authenticated: boolean) => void): () => void {
  const { app } = getFirebaseInstance();
  if (!app) {
    onAuthenticated(false);
    return () => undefined;
  }
  return onAuthStateChanged(getAuth(app), (user) => onAuthenticated(Boolean(user)));
}

export async function testFirestoreConnection(): Promise<{ success: boolean; message: string }> {
  const { db } = getFirebaseInstance();
  if (!db) {
    return {
      success: false,
      message: 'Firebase is not configured yet. Please enter your Firebase Console credentials in Admin Settings.',
    };
  }

  try {
    // Try pinging test collection doc
    await getDocFromServer(doc(db, 'system', 'connection_test'));
    return { success: true, message: 'Successfully connected to Firebase Firestore database!' };
  } catch (error: any) {
    // If doc doesn't exist, connection still succeeded unless permission or network error
    if (error?.code === 'permission-denied') {
      return {
        success: false,
        message: 'Connected to Firebase, but permission denied. Check your Firestore Security Rules in Firebase Console.',
      };
    }
    if (error?.message?.includes('the client is offline') || error?.code === 'unavailable') {
      return {
        success: false,
        message: 'Could not reach Firestore. Check your network or Firebase project configuration.',
      };
    }
    // Any other error
    return {
      success: true,
      message: 'Firestore responded: ' + (error?.message || 'Ready to read/write'),
    };
  }
}

export async function syncCatalogToFirestore(
  products: Product[],
  looks: Look[],
  settings?: StoreSettings
): Promise<{ success: boolean; message: string }> {
  const { db } = getFirebaseInstance();
  if (!db) {
    return { success: false, message: 'Firebase not configured.' };
  }

  try {
    const oversizedRecord = [...products, ...looks].find((record) => new Blob([JSON.stringify(record)]).size > 900_000);
    if (oversizedRecord) {
      return {
        success: false,
        message: `Could not sync "${oversizedRecord.name}": its image or details exceed Firestore's document size limit. Use a smaller image and retry.`,
      };
    }

    // Sync products
    for (const prod of products) {
      await setDoc(doc(db, 'products', prod.id), {
        ...prod,
        updatedAt: serverTimestamp(),
      });
    }

    // Sync looks
    for (const look of looks) {
      await setDoc(doc(db, 'looks', look.id), {
        ...look,
        updatedAt: serverTimestamp(),
      });
    }

    // Sync settings
    if (settings) {
      await setDoc(doc(db, 'settings', 'general'), {
        shopName: settings.shopName,
        shopTagline: settings.shopTagline,
        whatsappNumber: settings.whatsappNumber,
        currencySymbol: settings.currencySymbol,
        updatedAt: serverTimestamp(),
      });
    }

    return {
      success: true,
      message: `Synced ${products.length} products and ${looks.length} models to Firebase Firestore!`,
    };
  } catch (error: any) {
    console.error('Error syncing to Firestore:', error);
    return {
      success: false,
      message: `Failed to sync to Firestore: ${error.message || String(error)}`,
    };
  }
}

export async function fetchCatalogFromFirestore(): Promise<{
  products: Product[];
  looks: Look[];
  settings?: Partial<StoreSettings>;
} | null> {
  const { db } = getFirebaseInstance();
  if (!db) return null;

  try {
    const productsSnap = await getDocs(collection(db, 'products'));
    const firestoreProducts: Product[] = [];
    productsSnap.forEach((docSnap) => {
      firestoreProducts.push(docSnap.data() as Product);
    });

    const looksSnap = await getDocs(collection(db, 'looks'));
    const firestoreLooks: Look[] = [];
    looksSnap.forEach((docSnap) => {
      firestoreLooks.push(docSnap.data() as Look);
    });

    return {
      products: firestoreProducts,
      looks: firestoreLooks,
    };
  } catch (error) {
    console.error('Error reading from Firestore:', error);
    return null;
  }
}


export interface PublicOrderShare {
  orderId: string;
  date: string;
  shopName: string;
  items: Array<{ id: string; name: string; size: string; quantity: number; price: number; url?: string; crop?: { x: number; y: number; w: number; h: number; sheetW: number; sheetH: number } }>;
  total: number;
  currencySymbol: string;
}

/** Public order pages are addressed by an unguessable token, separate from private orders. */
export async function saveOrderShareToFirestore(
  token: string,
  share: PublicOrderShare
): Promise<{ success: boolean; message: string }> {
  const { db } = getFirebaseInstance();
  if (!db) return { success: false, message: 'Firebase is not configured.' };
  try {
    await setDoc(doc(db, 'orderShares', token), share);
    return { success: true, message: 'Shareable order page saved.' };
  } catch (error: any) {
    console.error('Failed to save shareable order page:', error);
    return { success: false, message: error?.message || 'Could not save the shareable order page.' };
  }
}

export async function fetchOrderShareFromFirestore(token: string): Promise<PublicOrderShare | null> {
  const { db } = getFirebaseInstance();
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, 'orderShares', token));
    return snap.exists() ? snap.data() as PublicOrderShare : null;
  } catch (error) {
    console.error('Could not load shareable order page:', error);
    return null;
  }
}

/**
 * Shared storefront sections use settings documents so all devices read the same data.
 * Writes require the signed-in Firebase store admin; reads follow the public settings rule.
 */
export async function saveSharedSectionToFirestore(
  sectionId: string,
  data: Record<string, unknown>
): Promise<{ success: boolean; message: string }> {
  const { app, db } = getFirebaseInstance();
  if (!app || !db) return { success: false, message: 'Firebase is not configured.' };
  if (!getAuth(app).currentUser) return { success: false, message: 'Sign in as the store admin before saving shared catalog data.' };
  try {
    const serialized = JSON.stringify(data);
    if (new Blob([serialized]).size > 900_000) {
      return { success: false, message: 'This section is too large for Firestore. Reduce uploaded image sizes and try again.' };
    }
    await setDoc(doc(db, 'settings', sectionId), { ...data, updatedAt: serverTimestamp() });
    return { success: true, message: 'Shared section saved.' };
  } catch (error: any) {
    console.error('Failed to save shared section:', sectionId, error);
    return { success: false, message: error?.message || 'Could not save shared section.' };
  }
}

export async function fetchSharedSectionFromFirestore<T> (sectionId: string): Promise<T | null> {
  const { db } = getFirebaseInstance();
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, 'settings', sectionId));
    return snap.exists() ? snap.data() as T : null;
  } catch (error) {
    console.error('Failed to fetch shared section:', sectionId, error);
    return null;
  }
}

/** Keep a Firestore collection in step with the admin's current catalog. */
export async function syncCatalogCollectionToFirestore<T extends { id: string }>(
  name: 'products' | 'looks',
  rows: T[]
): Promise<{ success: boolean; message: string }> {
  const { app, db } = getFirebaseInstance();
  if (!app || !db) return { success: false, message: 'Firebase is not configured.' };
  if (!getAuth(app).currentUser) return { success: false, message: 'Sign in as the store admin before saving the catalog.' };
  try {
    const existing = await getDocs(collection(db, name));
    const ids = new Set(rows.map((row) => row.id));
    for (const row of rows) {
      const serialized = JSON.stringify(row);
      if (new Blob([serialized]).size > 900_000) {
        return { success: false, message: 'A product photo is too large for Firestore. Use a smaller image and save again.' };
      }
      await setDoc(doc(db, name, row.id), { ...row, updatedAt: serverTimestamp() });
    }
    for (const item of existing.docs) {
      if (!ids.has(item.id)) await deleteDoc(item.ref);
    }
    return { success: true, message: `Saved ${rows.length} ${name} to Firebase.` };
  } catch (error: any) {
    console.error(`Failed to sync ${name} to Firestore:`, error);
    return { success: false, message: error?.message || `Failed to save ${name}.` };
  }
}

export async function signInStoreAdmin(email: string, password: string): Promise<{ success: boolean; message: string }> {
  const { app } = getFirebaseInstance();
  if (!app) return { success: false, message: 'Firebase is not configured. Check the Vercel Firebase environment variables.' };
  if (!email.trim()) return { success: false, message: 'Enter the Firebase Authentication admin email.' };
  try {
    await signInWithEmailAndPassword(getAuth(app), email.trim(), password);
    return { success: true, message: 'Signed in to the Firebase admin account.' };
  } catch (error: any) {
    return { success: false, message: error?.message || 'Firebase admin sign-in failed.' };
  }
}

export async function updateStoreAdminCredentials(
  currentPassword: string,
  newEmail: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  const { app } = getFirebaseInstance();
  if (!app) return { success: false, message: 'Firebase is not configured.' };
  const auth = getAuth(app);
  const user = auth.currentUser;
  if (!user?.email) return { success: false, message: 'Sign in with the Firebase admin email before changing credentials.' };
  if (!currentPassword) return { success: false, message: 'Enter your current Firebase password to confirm this change.' };

  try {
    await reauthenticateWithCredential(
      user,
      EmailAuthProvider.credential(user.email, currentPassword)
    );

    const emailChanged = Boolean(newEmail.trim() && newEmail.trim().toLowerCase() !== user.email.toLowerCase());
    if (emailChanged) {
      await verifyBeforeUpdateEmail(user, newEmail.trim());
    }
    if (newPassword) {
      await updatePassword(user, newPassword);
    }

    const changes = [
      emailChanged ? 'A verification link was sent to the new email. The login email changes after you confirm it.' : '',
      newPassword ? 'The Firebase password was updated.' : '',
    ].filter(Boolean);
    return { success: true, message: changes.join(' ') || 'No credential changes were requested.' };
  } catch (error: any) {
    const message = error?.code === 'auth/requires-recent-login'
      ? 'Please sign out and sign in again, then retry the credential change.'
      : error?.message || 'Could not update Firebase credentials.';
    return { success: false, message };
  }
}

export async function signOutStoreAdmin(): Promise<void> {
  const { app } = getFirebaseInstance();
  if (!app) return;
  try {
    await signOut(getAuth(app));
  } catch (error) {
    console.error('Firebase admin sign-out failed:', error);
  }
}

export async function saveStoreSettingsToFirestore(
  settings: StoreSettings
): Promise<{ success: boolean; message: string }> {
  const { app, db } = getFirebaseInstance();
  if (!app || !db) return { success: false, message: 'Firebase is not configured.' };
  if (!getAuth(app).currentUser) {
    return { success: false, message: 'Sign in to Firebase as the store admin before saving shared settings.' };
  }
  try {
    await setDoc(doc(db, 'settings', 'general'), {
      shopName: settings.shopName,
      shopTagline: settings.shopTagline,
      whatsappNumber: settings.whatsappNumber.replace(/[^0-9]/g, ''),
      currencySymbol: settings.currencySymbol,
      updatedAt: serverTimestamp(),
    });
    return { success: true, message: 'Shared store settings saved. All devices will use the new WhatsApp number.' };
  } catch (error: any) {
    console.error('Failed to save shared store settings:', error);
    return { success: false, message: error?.message || 'Could not save shared settings.' };
  }
}

export async function fetchStoreSettingsFromFirestore(): Promise<Partial<StoreSettings> | null> {
  const { db } = getFirebaseInstance();
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, 'settings', 'general'));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      ...(typeof data.shopName === 'string' ? { shopName: data.shopName } : {}),
      ...(typeof data.shopTagline === 'string' ? { shopTagline: data.shopTagline } : {}),
      ...(typeof data.whatsappNumber === 'string' ? { whatsappNumber: data.whatsappNumber } : {}),
      ...(typeof data.currencySymbol === 'string' ? { currencySymbol: data.currencySymbol } : {}),
    };
  } catch (error) {
    console.error('Error reading store settings from Firestore:', error);
    return null;
  }
}

export async function saveOrderToFirestore(orderData: {
  orderId: string;
  items: any[];
  total: number;
  channel: 'whatsapp' | 'web';
  phone?: string;
  customerName?: string;
  notes?: string;
  orderUrl?: string;
}): Promise<void> {
  const { db } = getFirebaseInstance();
  if (!db) return;

  try {
    // Firestore rejects `undefined` values -> strip them
    const clean = Object.fromEntries(
      Object.entries(orderData).filter(([, v]) => v !== undefined)
    );
    await setDoc(doc(db, 'orders', orderData.orderId), {
      ...clean,
      createdAt: serverTimestamp(),
      status: 'pending',
    });
  } catch (e) {
    console.error('Failed to log order to Firestore:', e);
  }
}
