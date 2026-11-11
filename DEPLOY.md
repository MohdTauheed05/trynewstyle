# Deploy: Vercel + Firebase (Firestore)

## 1. Firebase (5 min)
1. https://console.firebase.google.com -> **Add project** (e.g. `try-the-look`).
2. **Build -> Firestore Database -> Create database** (production mode, pick a region near you).
3. **Project settings (gear) -> General -> Your apps -> `</>` Web** -> register app -> copy the `firebaseConfig` values.
4. **Firestore -> Rules** -> paste the contents of `firestore.rules` -> **Publish**.
   (or: `npm i -g firebase-tools && firebase login && firebase deploy --only firestore:rules`)
5. Orders placed through WhatsApp are saved in the `orders` collection with product image URLs and product links.
   The WhatsApp message also includes a shareable order page with item photos and details.

## 2. Environment variables
Copy `.env.example` to `.env.local` for local dev, and add the SAME 6 `VITE_FIREBASE_*` values in
**Vercel -> Project -> Settings -> Environment Variables** (Production + Preview).

Set `VITE_WHATSAPP_NUMBER` to the shop owner's WhatsApp number in international format using digits only
(no `+`, spaces, or punctuation), for example `971501234567`. Add it to Vercel Production and Preview,
then redeploy. This deployment setting is shared by phones and computers; the demo number is no longer used.

## 3. Vercel
Option A (GitHub): push this folder to a GitHub repo -> vercel.com/new -> import -> Framework "Vite" (auto) -> Deploy.
Option B (CLI): `npm i -g vercel && vercel --prod`

`vercel.json` already contains the build settings and the SPA rewrite (so /admin works).

## 4. After going live
- Open `/#admin` and change the default admin password (default is admin / password123).
- Admin "Sync to Firebase" writes to products/looks/settings, which the rules only allow for signed-in
  Firebase Auth users. Enable Authentication (Email/Password) and sign the admin in, or ask to have
  that login added.
