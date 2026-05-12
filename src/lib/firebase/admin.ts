import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        try {
            let key = process.env.FIREBASE_PRIVATE_KEY;
            if (key.startsWith('"') && key.endsWith('"')) {
                key = key.slice(1, -1);
            }
            key = key.replace(/\\n/g, '\n');

            admin.initializeApp({
              credential: admin.credential.cert({
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: key,
              }),
            });
        } catch (innerError) {
            console.warn("Firebase Admin primary initialization failed, falling back to demo project.", innerError);
            admin.initializeApp({
                projectId: 'demo-project-id',
            });
        }
    } else {
        // Fallback for build phase
        admin.initializeApp({
            projectId: 'demo-project-id',
        });
    }
  } catch (error) {
    console.warn("Firebase Admin failed to initialize", error);
  }
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
