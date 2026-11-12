# Deploy: Vercel + Firebase (Firestore)

## 1. Firebase (5 min)
1. https://console.firebase.google.com -> **Add project** (e.g. `try-the-look`).
2. **Build -> Firestore Database -> Create database** (production mode, pick a region near you).
3. **Project settings (gear) -> General -> Your apps -> `</>` Web** -> register app -> copy the `firebaseConfig` values.
4. **Authentication -> Sign-in method** -> enable **Email/Password**.
5. Create the store admin user in **Authentication -> Users**. The Admin login uses this Firebase Auth user's email and password.
6. Copy that user's UID. In Firestore, create `admins/{UID}` with fields `role: "admin"` and `active: true`.
7. **Firestore -> Rules** -> paste the contents of `firestore.rules` -> **Publish**.
   (or: `npm i -g firebase-tools && firebase login && firebase deploy --only firestore:rules`)
8. Orders placed through WhatsApp are saved in the `orders` collection with product image URLs and product links.
   The WhatsApp message also includes a shareable order page with item photos and details.

## 2. Environment variables
Copy `.env.example` to `.env.local` for local dev, and add the SAME 6 `VITE_FIREBASE_*` values in
**Vercel -> Project -> Settings -> Environment Variables** (Production + Preview). No admin email environment variable is required.

Set `VITE_WHATSAPP_NUMBER` to the shop owner's WhatsApp number in international format using digits only
(no `+`, spaces, or punctuation), for example `971501234567`. Add it to Vercel Production and Preview,
then redeploy. This is a fallback. The value saved in Admin is published to Firestore for all devices after Firebase admin access is configured.

## 3. Vercel
Option A (GitHub): push this folder to a GitHub repo -> vercel.com/new -> import -> Framework "Vite" (auto) -> Deploy.
Option B (CLI): `npm i -g vercel && vercel --prod`

`vercel.json` already contains the build settings and the SPA rewrite (so /admin works).

## 4. After going live
- Open `/#admin` and sign in with the Firebase Auth admin email and password.
- In Admin -> Shop Settings, save the WhatsApp number. The app writes it to Firestore; all shoppers load the shared number automatically. If the Firebase login or role setup is missing, Admin will say the settings were saved only on that device.
- In Admin -> Shop Settings -> Firebase Admin Login, enter the current Firebase password and the new password to change it in Firebase Auth. To change the login email, enter the new email and confirm the verification email Firebase sends.
