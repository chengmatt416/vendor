export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(req: Request) {
  try {
    const { username } = await req.json();

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const rpID = process.env.NEXT_PUBLIC_RP_ID || 'localhost';

    const userDoc = await adminDb.collection('employees').doc(username).get();

    if (!userDoc.exists) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const authenticators = userDoc.data()?.authenticators || [];

    if (authenticators.length === 0) {
        return NextResponse.json({ error: 'No authenticators found' }, { status: 400 });
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: authenticators.map((auth: any) => ({
        id: new Uint8Array(Buffer.from(auth.credentialID, 'base64url')),
        type: 'public-key',
        transports: auth.transports,
      })),
      userVerification: 'preferred',
    });

    // Store challenge
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
