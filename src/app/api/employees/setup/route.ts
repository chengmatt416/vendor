export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(req: Request) {
    try {
        const checkSnapshot = await adminDb.collection('employees').limit(1).get();
        if (!checkSnapshot.empty) {
            return NextResponse.json({ success: false, error: "Setup already completed. Forbidden." }, { status: 403 });
        }

        const { name, code } = await req.json();

        if (!name || !code) {
             return NextResponse.json({ success: false, error: "Name and code required." }, { status: 400 });
        }

        const username = `admin_${Date.now()}`;
        const docRef = adminDb.collection('employees').doc(username);

        await docRef.set({
            username: username,
            name: name,
            code: code,
            role: 'admin',
            creditLimit: 0,
            usedCredit: 0,
            createdAt: new Date().toISOString()
        });

        return NextResponse.json({ success: true, role: 'admin', name, username });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
