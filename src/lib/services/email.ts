import nodemailer from 'nodemailer';

export async function sendEmailWithAttachment(
  to: string,
  subject: string,
  text: string,
  fileName: string,
  pdfBuffer: Buffer
) {
  const user = process.env.GMAIL_SENDER_EMAIL;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    console.warn("Email credentials not configured. Skipping email sending.");
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user,
      pass,
    },
  });

  const mailOptions = {
    from: user,
    to,
    subject,
    text,
    attachments: [
      {
        filename: fileName,
        content: pdfBuffer,
      },
    ],
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Error sending email: ", error);
    return false;
  }
}
