import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface ReceiptData {
  orderId: string;
  userName: string;
  userEmail?: string;
  userDept?: string;
  productName?: string;
  itemsString?: string;
  qty: number;
  total: number;
  date: string;
  signatureBase64?: string; // e.g. "data:image/png;base64,..."
  type: 'Order' | 'EmployeeOrder' | 'Signoff';
}

export async function generateReceiptPDF(data: ReceiptData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  const margin = 50;
  let cursorY = height - margin;

  // Title
  const title = `Receipt - ${data.type}`;
  page.drawText(title, { x: margin, y: cursorY, size: 24, font: boldFont });
  cursorY -= 40;

  // Line
  page.drawLine({
    start: { x: margin, y: cursorY },
    end: { x: width - margin, y: cursorY },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });
  cursorY -= 20;

  const drawField = (label: string, value: string) => {
    page.drawText(label, { x: margin, y: cursorY, size: 12, font: boldFont });
    page.drawText(value, { x: margin + 100, y: cursorY, size: 12, font });
    cursorY -= 25;
  };

  drawField('Order ID:', data.orderId);
  drawField('Date:', data.date);
  drawField('Name:', data.userName);
  if (data.userEmail) drawField('Email:', data.userEmail);
  if (data.userDept) drawField('Department:', data.userDept);

  cursorY -= 10;
  page.drawLine({
    start: { x: margin, y: cursorY },
    end: { x: width - margin, y: cursorY },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });
  cursorY -= 20;

  if (data.itemsString) {
      drawField('Items:', '');
      const items = data.itemsString.split('\n');
      items.forEach(item => {
          page.drawText(item, { x: margin + 20, y: cursorY, size: 12, font });
          cursorY -= 20;
      });
  } else {
      drawField('Product:', data.productName || 'N/A');
      drawField('Quantity:', data.qty.toString());
  }

  drawField('Total:', `$${data.total.toFixed(2)}`);

  cursorY -= 20;
  page.drawLine({
    start: { x: margin, y: cursorY },
    end: { x: width - margin, y: cursorY },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });
  cursorY -= 30;

  if (data.signatureBase64) {
    page.drawText('Signature:', { x: margin, y: cursorY, size: 14, font: boldFont });
    cursorY -= 10;

    try {
      const base64Data = data.signatureBase64.replace(/^data:image\/\w+;base64,/, '');
      const signatureImage = await pdfDoc.embedPng(base64Data);
      const imgDims = signatureImage.scale(0.5);

      cursorY -= imgDims.height;
      page.drawImage(signatureImage, {
        x: margin,
        y: cursorY,
        width: imgDims.width,
        height: imgDims.height,
      });
    } catch (e) {
      console.error('Failed to embed signature image', e);
      page.drawText('(Signature Image Error)', { x: margin, y: cursorY - 20, size: 12, font, color: rgb(1,0,0) });
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
