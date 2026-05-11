export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const keyword = searchParams.get('keyword') || '';

        if (!keyword) return NextResponse.json([]);

        // In Firestore, substring search is tricky.
        // We will fetch all non-signed-off orders and filter in memory if small enough,
        // or just match exact username/email.
        // For simplicity and matching old logic, let's fetch orders with status == '' and filter.

        const snapshot = await adminDb.collection('orders').where('status', '==', '').get();
        let orders: any[] = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            // Filter by keyword in userEmail or userName
            if ((data.userEmail && data.userEmail.includes(keyword)) || (data.userName && data.userName.includes(keyword))) {
                orders.push({
                    orderId: doc.id,
                    product: data.productName,
                    qty: data.qty,
                    total: data.total,
                    email: data.userEmail || "",
                    date: new Date(data.createdAt).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })
                });
            }
        });

        return NextResponse.json(orders);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
