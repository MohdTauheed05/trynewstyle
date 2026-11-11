# Deploy: Vercel + Firebase (Firestore)

## 1. Firebase (5 min)
1. https://console.firebase.google.com -> **Add project** (e.g. `try-the-look`).
2. **Build -> Firestore Database -> Create database** (production mode, pick a region near you).
3. **Project settings (gear) -> General -> Your apps -> `</>` Web** -> register app -> copy the `firebaseConfig` values.
4. **Authentication -> Sign-in method** -> enable **Email/Password**.
5. Create the store admin user in **Authentication -> Users**. Use the same password the owner enters in the site's Admin login.
6. Copy that user's UID. In Firestore, create `admins/{UID}` with fields `role: "admin"` and `active: true`.
7. **Firestore -> Rules** -> paste the contents of `firestore.rules` -> **Publish**.
   (or: `npm i -g firebase-tools && firebase login && firebase deploy --only firestore:rules`)
8. Orders placed through WhatsApp are saved in the `orders` collection with product image URLs and product links.
   The WhatsApp message also includes a shareable order page with item photos and details.

## 2. Environment variables
Copy `.env.example` to `.env.local` for local dev, and add the SAME 6 `VITE_FIREBASE_*` values in
**Vercel -> Project -> Settings -> Environment Variables** (Production + Preview). Add `VITE_FIREBASE_ADMIN_EMAIL` with the email used for the Firebase Auth admin user.

Set `VITE_WHATSAPP_NUMBER` to the shop owner's WhatsApp number in international format using digits only
(no `+`, spaces, or punctuation), for example `971501234567`. Add it to Vercel Production and Preview,
then redeploy. This is a fallback. The value saved in Admin is published to Firestore for all devices after Firebase admin access is configured.

## 3. Vercel
Option A (GitHub): push this folder to a GitHub repo -> vercel.com/new -> import -> Framework "Vite" (auto) -> Deploy.
Option B (CLI): `npm i -g vercel && vercel --prod`

`vercel.json` already contains the build settings and the SPA rewrite (so /admin works).

## 4. After going live
- Open `/#admin` and log in with the admin username/password. The password must match the Firebase Auth admin user's password so the app can sign in to publish shared settings.
- In Admin -> Store Settings, save the WhatsApp number. The app writes it to Firestore; all shoppers load the shared number automatically. If the Firebase login or role setup is missing, Admin will say the settings were saved only on that device.
- If the site's Admin password changes, update the Firebase Auth admin user's password to match.
