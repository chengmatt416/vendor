import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        let key = process.env.FIREBASE_PRIVATE_KEY;
        try {
            // Attempt to JSON parse in case it was stringified by Vercel
            key = JSON.parse(key);
        } catch(e) {
            // Not JSON parseable, fallback to standard regex replacement
            if (key.startsWith('"') && key.endsWith('"')) {
                key = key.slice(1, -1);
            }
            key = key.replace(/\\n/g, '\n');
        }

        try {
            admin.initializeApp({
              credential: admin.credential.cert({
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: key,
              }),
            });
        } catch (innerError) {
            console.warn("Firebase Admin primary initialization failed.", innerError);
        }
    } else {
        // Use application default if specific vars aren't provided
        try {
            admin.initializeApp();
        } catch (innerError) {
            console.warn("Firebase Admin default initialization failed.", innerError);
        }
    }
  } catch (error) {
    console.warn("Firebase Admin failed to initialize", error);
  }
}

export const adminDb = new Proxy({} as admin.firestore.Firestore, {
    get: (target, prop) => admin.firestore()[prop as keyof admin.firestore.Firestore]
});
export const adminAuth = new Proxy({} as admin.auth.Auth, {
    get: (target, prop) => admin.auth()[prop as keyof admin.auth.Auth]
});
