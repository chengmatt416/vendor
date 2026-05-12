
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const snapshot = await adminDb.collection('products').get();
    const products: any[] = [];
    snapshot.forEach(doc => {
      products.push({ id: doc.id, ...doc.data() });
    });
    return NextResponse.json(products);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const docRef = await adminDb.collection('products').add({
            name: body.name || '',
            price: Number(body.price || 0),
            cost: Number(body.cost || 0),
            stock: Number(body.stock || 0),
            image: body.image || '',
        });
        return NextResponse.json({ success: true, id: docRef.id });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const { id, ...data } = body;

        // Convert string fields to numbers where appropriate
        const updateData: any = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.price !== undefined) updateData.price = Number(data.price);
        if (data.cost !== undefined) updateData.cost = Number(data.cost);
        if (data.stock !== undefined) updateData.stock = Number(data.stock);
        if (data.image !== undefined) updateData.image = data.image;

        await adminDb.collection('products').doc(id).update(updateData);
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

        await adminDb.collection('products').doc(id).delete();
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
