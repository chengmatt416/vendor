export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(req: Request) {
  try {
    const { username, response } = await req.json();

    if (!username || !response) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const userDoc = await adminDb.collection('employees').doc(username).get();
    if (!userDoc.exists) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const challengeDoc = await adminDb.collection('webauthnChallenges').doc(username).get();
    if (!challengeDoc.exists) {
        return NextResponse.json({ error: 'Challenge not found' }, { status: 400 });
    }

    const expectedChallenge = challengeDoc.data()?.challenge;
    const rpID = process.env.NEXT_PUBLIC_RP_ID || 'localhost';
    const expectedOrigin = process.env.EXPECTED_ORIGIN || 'http://localhost:3000';

    const authenticators = userDoc.data()?.authenticators || [];
    const authenticator = authenticators.find(
        (auth: any) => auth.credentialID === response.id
    );

    if (!authenticator) {
        return NextResponse.json({ error: 'Authenticator not found' }, { status: 400 });
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: new Uint8Array(Buffer.from(authenticator.credentialID, 'base64url')),
        credentialPublicKey: new Uint8Array(Buffer.from(authenticator.credentialPublicKey, 'base64url')),
        counter: authenticator.counter,
        transports: authenticator.transports,
      },
    });

    if (verification.verified) {
      const { authenticationInfo } = verification;

      // Update counter
      const updatedAuthenticators = authenticators.map((auth: any) => {
          if (auth.credentialID === response.id) {
              return { ...auth, counter: authenticationInfo.newCounter };
          }
          return auth;
      });

      await adminDb.collection('employees').doc(username).update({
          authenticators: updatedAuthenticators
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
