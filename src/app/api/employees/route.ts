import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const snapshot = await adminDb.collection('employees').get();
        const employees: any[] = [];
        snapshot.forEach(doc => {
            employees.push({ id: doc.id, ...doc.data() });
        });
        return NextResponse.json(employees);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // Use a generated username if one isn't provided or use code
        const username = body.username || body.code || `emp_${Date.now()}`;

        const docRef = adminDb.collection('employees').doc(username);

        await docRef.set({
            username: username,
            name: body.name || '',
            code: body.code || '',
            role: body.role || 'viewer',
            creditLimit: Number(body.creditLimit || 0),
            usedCredit: Number(body.usedCredit || 0),
            createdAt: new Date().toISOString()
        });
        return NextResponse.json({ success: true, id: username });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const { id, ...data } = body;

        if (!id) {
            return NextResponse.json({ error: "Missing Employee ID" }, { status: 400 });
        }

        const updateData: any = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.code !== undefined) updateData.code = data.code;
        if (data.role !== undefined) updateData.role = data.role;
        if (data.creditLimit !== undefined) updateData.creditLimit = Number(data.creditLimit);
        if (data.usedCredit !== undefined) updateData.usedCredit = Number(data.usedCredit);

        await adminDb.collection('employees').doc(id).update(updateData);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: "Missing ID" }, { status: 400 });
        }

        await adminDb.collection('employees').doc(id).delete();
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
