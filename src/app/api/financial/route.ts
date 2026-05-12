export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET() {
    try {
        // Fetch financial records
        const finSnapshot = await adminDb.collection('financialRecords').orderBy('createdAt', 'desc').limit(100).get();
        let records: any[] = [];
        let income = 0;
        let expense = 0;
        let empUsage = 0;

        finSnapshot.forEach(doc => {
            const data = doc.data();
            const amt = Number(data.amount) || 0;
            if (data.type === '收入') income += amt;
            else if (data.type === '支出') expense += amt;
            else if (data.type === '員工核銷') empUsage += amt;

            records.push({
                id: doc.id,
                date: new Date(data.createdAt).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }),
                type: data.type,
                amount: amt,
                note: data.note,
                recorder: data.recorder
            });
        });

        // Fetch products for inventory
        const pSnapshot = await adminDb.collection('products').get();
        let products: any[] = [];
        let inventoryValue = 0;

        pSnapshot.forEach(doc => {
            const pData = doc.data();
            const stock = Number(pData.stock) || 0;
            const cost = Number(pData.cost) || 0;
            inventoryValue += (stock * cost);
            products.push({
                id: doc.id,
                name: pData.name,
                stock,
                cost,
                price: Number(pData.price) || 0,
                image: pData.image || ''
            });
        });

        return NextResponse.json({
            records,
            stats: { income, expense, empUsage, inventoryValue },
            products
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const data = await req.json();
        // Assuming role check has been done or passed in (ideally verify token)
        if (data.role !== 'admin' && data.role !== 'manager') {
             return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
        }

        const newRec = {
            createdAt: new Date().getTime(),
            type: data.type,
            amount: Number(data.amount),
            note: data.note,
            recorder: data.recorder
        };

        const docRef = await adminDb.collection('financialRecords').add(newRec);
        return NextResponse.json({ success: true, id: docRef.id });
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

        await adminDb.collection('financialRecords').doc(id).delete();
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
