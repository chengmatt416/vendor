export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { generateReceiptPDF } from '@/lib/services/pdf';
import { uploadToDrive } from '@/lib/services/drive';
import { sendEmailWithAttachment } from '@/lib/services/email';

export async function POST(req: Request) {
    try {
        const data = await req.json();

        const ids = data.orders.map((o: any) => o.orderId);

        // Update order status in Firestore
        const batch = adminDb.batch();
        ids.forEach((id: string) => {
             const ref = adminDb.collection('orders').doc(id);
             batch.update(ref, { status: '已簽收' });
        });
        await batch.commit();

        let itemsString = data.orders.map((o: any) => `[已簽收] ${o.product} x${o.qty}`).join("\n");
        let targetEmail = "";
        for(let i=0; i<data.orders.length; i++){
          if(data.orders[i].email && data.orders[i].email.includes('@')){
            targetEmail = data.orders[i].email;
            break;
          }
        }

        let downloadUrl = "";
        let emailStatus = "未寄信 (無 Email)";

        const pdfPayload: any = {
            orderId: `SIGNOFF-${Date.now()}`,
            userName: data.signerName,
            type: 'Signoff',
            itemsString: itemsString,
            qty: data.orders.length,
            total: data.orders.reduce((a:number, b:any)=>a+Number(b.total), 0),
            date: new Date().toLocaleDateString('zh-TW') + ' ' + new Date().toLocaleTimeString('zh-TW'),
            signatureBase64: data.signature,
            userEmail: targetEmail
        };

        try {
            const pdfBuffer = await generateReceiptPDF(pdfPayload);
            const fileName = `Signoffs_${Date.now()}_${data.signerName}.pdf`;

            downloadUrl = await uploadToDrive(fileName, pdfBuffer);

            if (targetEmail && targetEmail.includes('@')) {
                const sent = await sendEmailWithAttachment(
                    targetEmail,
                    `【訂單通知】Signoff - ${data.signerName}`,
                    `您好，附件為您的簽收文件。\n時間：${pdfPayload.date}`,
                    fileName,
                    pdfBuffer
                );
                emailStatus = sent ? `已寄出至 ${targetEmail}` : "寄信失敗";
            }
        } catch (extErr: any) {
             console.error("External service error:", extErr);
             emailStatus = "服務錯誤: " + extErr.message;
        }

        return NextResponse.json({ success: true, downloadUrl, message: emailStatus });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
