import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  Firestore,
  collection,
  doc,
  getDocs,
  setDoc,
  getDocFromServer,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { getStoredSettings, StoreSettings } from './storeSettings';
import { Look, Product } from '../types';

let cachedApp: FirebaseApp | null = null;
let cachedDb: Firestore | null = null;

export function getFirebaseInstance(): { app: FirebaseApp | null; db: Firestore | null } {
  const settings = getStoredSettings();
  const cfg = settings.firebaseConfig;

  // Check if API key and project ID are configured
  const apiKey = cfg.apiKey || import.meta.env.VITE_FIREBASE_API_KEY || '';
  const projectId = cfg.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || '';
  const authDomain = cfg.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`;
  const storageBucket = cfg.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`;
  const messagingSenderId = cfg.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '';
  const appId = cfg.appId || import.meta.env.VITE_FIREBASE_APP_ID || '';

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
  const settings = getStoredSettings();
  const cfg = settings.firebaseConfig;
  const apiKey = cfg.apiKey || import.meta.env.VITE_FIREBASE_API_KEY || '';
  const projectId = cfg.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || '';
  return Boolean(apiKey && projectId);
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
