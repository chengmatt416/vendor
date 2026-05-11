export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(req: Request) {
  try {
    const { username, response } = await req.json();

    if (!username || !response) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const challengeDoc = await adminDb.collection('webauthnChallenges').doc(username).get();
    if (!challengeDoc.exists) {
        return NextResponse.json({ error: 'Challenge not found' }, { status: 400 });
    }

    const expectedChallenge = challengeDoc.data()?.challenge;

    const rpID = process.env.NEXT_PUBLIC_RP_ID || 'localhost';
    const expectedOrigin = process.env.EXPECTED_ORIGIN || 'http://localhost:3000';

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
    });

    if (verification.verified && verification.registrationInfo) {
      const { credentialPublicKey, credentialID, counter, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

      const userRef = adminDb.collection('employees').doc(username);
      const userDoc = await userRef.get();
      const authenticators = userDoc.data()?.authenticators || [];

      const newAuthenticator = {
        credentialID: Buffer.from(credentialID).toString('base64url'),
        credentialPublicKey: Buffer.from(credentialPublicKey).toString('base64url'),
        counter,
        credentialDeviceType,
        credentialBackedUp,
        transports: response.response.transports || [],
      };

      await userRef.update({
        authenticators: [...authenticators, newAuthenticator]
      });

      // Clear challenge
      await adminDb.collection('webauthnChallenges').doc(username).delete();

      return NextResponse.json({ verified: true });
    } else {
        return NextResponse.json({ verified: false }, { status: 400 });
    }

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
