export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { generateReceiptPDF } from '@/lib/services/pdf';
import { uploadToDrive } from '@/lib/services/drive';
import { sendEmailWithAttachment } from '@/lib/services/email';

export async function POST(req: Request) {
    try {
        const d = await req.json();
        const isEmp = !!d.employeeCode;

        // Transaction to ensure stock is updated safely
        const result = await adminDb.runTransaction(async (t) => {
            // Find Product
            const pSnapshot = await t.get(adminDb.collection('products').where('name', '==', d.productName).limit(1));
            if (pSnapshot.empty) throw new Error("找不到商品");
            const pDoc = pSnapshot.docs[0];
            const pData = pDoc.data();
            const stock = Number(pData.stock);

            if (stock < d.qty) throw new Error("庫存不足");

            // Update Stock
            t.update(pDoc.ref, { stock: stock - d.qty });

            let emailStatus = "未寄信 (無 Email)";
            let downloadUrl = "";
            let orderId = `ORD${Date.now()}`;

            let pdfPayload: any = {
                orderId,
                date: new Date().toLocaleDateString('zh-TW') + ' ' + new Date().toLocaleTimeString('zh-TW'),
                qty: d.qty,
                total: d.total,
                signatureBase64: d.signature,
                type: isEmp ? 'EmployeeOrder' : 'Order'
            };

            if (isEmp) {
                // Find Employee
                const eSnapshot = await t.get(adminDb.collection('employees').where('code', '==', d.employeeCode).limit(1));
                if (!eSnapshot.empty) {
                    const eDoc = eSnapshot.docs[0];
                    const eData = eDoc.data();
                    const empName = eData.name;

                    t.update(eDoc.ref, { usedCredit: (Number(eData.usedCredit || 0) + d.total) });

                    // Add financial record
                    const fRef = adminDb.collection('financialRecords').doc();
                    t.set(fRef, {
                        createdAt: new Date().getTime(),
                        type: '員工核銷',
                        amount: d.total,
                        note: `員工購: ${d.productName} x${d.qty}`,
                        recorder: empName
                    });

                    pdfPayload.userName = empName + " (員工)";
                    pdfPayload.productName = d.productName;
                }
            } else {
                 pdfPayload.userName = d.userName;
                 pdfPayload.userEmail = d.userEmail;
                 pdfPayload.userDept = d.userDept;
                 pdfPayload.productName = d.productName;

                 const oRef = adminDb.collection('orders').doc(orderId);
                 t.set(oRef, {
                     orderId,
                     userName: d.userName,
                     productName: d.productName,
                     qty: d.qty,
                     total: d.total,
                     userEmail: d.userEmail,
                     userDept: d.userDept,
                     createdAt: new Date().getTime(),
                     status: '', // Not signed off yet
                     pdfUrl: '' // Will update later if needed, or rely on drive link
                 });
            }

            return { pdfPayload, isEmp, emailTo: d.userEmail };
        });

        // Outside transaction, do external API calls (PDF, Drive, Email)
        let downloadUrl = "";
        let emailStatus = "未寄信 (無 Email)";

        try {
            const pdfBuffer = await generateReceiptPDF(result.pdfPayload);
            const fileName = `${result.pdfPayload.type}_${Date.now()}_${result.pdfPayload.userName}.pdf`;

            downloadUrl = await uploadToDrive(fileName, pdfBuffer);

            if (!result.isEmp && result.emailTo && result.emailTo.includes('@')) {
                const sent = await sendEmailWithAttachment(
                    result.emailTo,
                    `【訂單通知】${result.pdfPayload.type} - ${result.pdfPayload.userName}`,
                    `您好，附件為您的文件。\n時間：${result.pdfPayload.date}`,
                    fileName,
                    pdfBuffer
                );
                emailStatus = sent ? `已寄出至 ${result.emailTo}` : "寄信失敗";
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
