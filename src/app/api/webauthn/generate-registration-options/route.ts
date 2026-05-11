export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(req: Request) {
  try {
    const { username } = await req.json();

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const rpID = process.env.NEXT_PUBLIC_RP_ID || 'localhost';
    const rpName = process.env.NEXT_PUBLIC_RP_NAME || 'Finance System POS';

    const userDoc = await adminDb.collection('employees').doc(username).get();

    // Create minimal user if doesn't exist just to hold authenticators
    if (!userDoc.exists) {
        await adminDb.collection('employees').doc(username).set({
            username: username,
            authenticators: [],
            createdAt: new Date().toISOString()
        })
    }

    const user = userDoc.exists ? userDoc.data() : { username, authenticators: [] };
    const authenticators = user?.authenticators || [];

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new Uint8Array(Buffer.from(username)),
      userName: username,
      attestationType: 'none',
      excludeCredentials: authenticators.map((auth: any) => ({
        id: new Uint8Array(Buffer.from(auth.credentialID, 'base64url')),
        type: 'public-key',
        transports: auth.transports,
      })),
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'preferred',
      },
    });

    // Store challenge in the database
    await adminDb.collection('webauthnChallenges').doc(username).set({
      challenge: options.challenge,
      createdAt: new Date().getTime()
    });

    return NextResponse.json(options);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
