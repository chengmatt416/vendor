export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(req: Request) {
    try {
        const { code, checkEmpty } = await req.json();

        if (checkEmpty) {
            try {
                const checkSnapshot = await adminDb.collection('employees').limit(1).get();
                return NextResponse.json({ needsSetup: checkSnapshot.empty });
            } catch (e: any) {
                // If the database fails to initialize or cannot be read (e.g. missing credentials),
                // we assume it needs setup.
                return NextResponse.json({ needsSetup: true, error: e.message });
            }
        }

        const snapshot = await adminDb.collection('employees').where('code', '==', code).limit(1).get();

        if (snapshot.empty) {
            return NextResponse.json({ success: false, error: "代號錯誤" });
        }

        const data = snapshot.docs[0].data();
        const role = String(data.role).toLowerCase().trim();

        if (['admin', 'manager', 'viewer'].includes(role)) {
            return NextResponse.json({ success: true, role, name: data.name, username: data.username || snapshot.docs[0].id });
        }

        return NextResponse.json({ success: false, error: "權限不足" });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
