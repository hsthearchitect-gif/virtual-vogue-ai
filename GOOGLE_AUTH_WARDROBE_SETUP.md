# Google Login and Wardrobe Setup

The app now supports Google login plus a saved wardrobe for each user through Firebase Auth, Firestore, and Cloud Storage.

## Firebase Console

1. Create a Firebase project.
2. Add a Web app and copy its Firebase config.
3. Enable Authentication > Sign-in method > Google.
4. Add these authorized domains in Authentication > Settings:
   - `localhost`
   - `frontend-woad-five-78.vercel.app`
   - your custom domain, if any
5. Create a Firestore database.
6. Create a Cloud Storage bucket.
7. Deploy or paste the rules from:
   - `firestore.rules`
   - `storage.rules`

## Vercel Environment Variables

Add these to the frontend project in Vercel, then redeploy:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

`NEXT_PUBLIC_API_URL` should still point to the Render backend:

```env
NEXT_PUBLIC_API_URL=https://virtual-vogue-ai.onrender.com
```

## Data Layout

Each signed-in user owns:

```text
Firestore: users/{uid}/garments/{garmentId}
Storage:   users/{uid}/wardrobe/{fileName}
```

The frontend reads and writes only through Firebase security rules scoped to the authenticated user's UID.
