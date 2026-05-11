
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { code } = await req.json();
        const snapshot = await adminDb.collection('employees').where('code', '==', code).limit(1).get();

        if (snapshot.empty) {
            return NextResponse.json({ success: false, error: "代號錯誤" });
        }

        const doc = snapshot.docs[0];
        const data = doc.data();

        return NextResponse.json({
            success: true,
            name: data.name,
            balance: (Number(data.creditLimit || 0) - Number(data.usedCredit || 0)),
            code: data.code,
            username: data.username || doc.id // For Passkey
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
