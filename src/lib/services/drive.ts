import { google } from 'googleapis';
import { Readable } from 'stream';

const FOLDER_NAME = 'Finance System Receipts';

async function getAuthClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    throw new Error('Missing Google Service Account credentials.');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  return auth;
}

export async function uploadToDrive(fileName: string, pdfBuffer: Buffer): Promise<string> {
  const auth = await getAuthClient();
  const drive = google.drive({ version: 'v3', auth });

  // 1. Find or create folder
  let folderId: string | null = null;
  const res = await drive.files.list({
    q: `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
  });

  if (res.data.files && res.data.files.length > 0) {
    folderId = res.data.files[0].id!;
  } else {
    const folderRes = await drive.files.create({
      requestBody: {
        name: FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      },
      fields: 'id',
    });
    folderId = folderRes.data.id!;
  }

  // 2. Upload file
  const stream = new Readable();
  stream.push(pdfBuffer);
  stream.push(null);

  const fileRes = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType: 'application/pdf',
      body: stream,
    },
    fields: 'id, webViewLink',
  });

  // 3. Set permissions to anyone with link (optional, if you want public download link)
  if (fileRes.data.id) {
     await drive.permissions.create({
        fileId: fileRes.data.id,
        requestBody: {
            role: 'reader',
            type: 'anyone'
        }
     });
  }

  return fileRes.data.webViewLink || '';
}
