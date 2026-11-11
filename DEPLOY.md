# Deploy: Vercel + Firebase (Firestore)

## 1. Firebase (5 min)
1. https://console.firebase.google.com -> **Add project** (e.g. `try-the-look`).
2. **Build -> Firestore Database -> Create database** (production mode, pick a region near you).
3. **Project settings (gear) -> General -> Your apps -> `</>` Web** -> register app -> copy the `firebaseConfig` values.
4. **Firestore -> Rules** -> paste the contents of `firestore.rules` -> **Publish**.
   (or: `npm i -g firebase-tools && firebase login && firebase deploy --only firestore:rules`)
5. Orders placed through WhatsApp are saved in the `orders` collection.

## 2. Environment variables
Copy `.env.example` to `.env.local` for local dev, and add the SAME 6 `VITE_FIREBASE_*` values in
**Vercel -> Project -> Settings -> Environment Variables** (Production + Preview).

## 3. Vercel
Option A (GitHub): push this folder to a GitHub repo -> vercel.com/new -> import -> Framework "Vite" (auto) -> Deploy.
Option B (CLI): `npm i -g vercel && vercel --prod`

`vercel.json` already contains the build settings and the SPA rewrite (so /admin works).

## 4. After going live
- Open `/#admin` and change the default admin password (default is admin / password123).
- Admin "Sync to Firebase" writes to products/looks/settings, which the rules only allow for signed-in
  Firebase Auth users. Enable Authentication (Email/Password) and sign the admin in, or ask to have
  that login added.
