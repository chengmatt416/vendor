This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Setup Instructions

To run this application locally or in production, you will need to set up the following environment variables in a `.env` or `.env.local` file:

### WebAuthn Configuration
- `NEXT_PUBLIC_RP_ID`: The Relying Party ID (usually your domain name, e.g., `localhost` or `example.com`).
- `NEXT_PUBLIC_RP_NAME`: The Relying Party Name (e.g., `Finance System POS`).
- `EXPECTED_ORIGIN`: The expected origin for WebAuthn requests (e.g., `http://localhost:3000` or `https://yourdomain.com`).

### Email (Nodemailer) Configuration
- `GMAIL_SENDER_EMAIL`: The email address used to send emails.
- `GMAIL_APP_PASSWORD`: The app-specific password for your Gmail account.

### Google Drive Service Account Configuration
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: The email address of your Google Service Account.
- `GOOGLE_PRIVATE_KEY`: The private key of your Google Service Account (can contain `\n`).

### Firebase Configuration
- `NEXT_PUBLIC_FIREBASE_API_KEY`: Firebase API Key.
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`: Firebase Auth Domain.
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`: Firebase Project ID.
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`: Firebase Storage Bucket.
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`: Firebase Messaging Sender ID.
- `NEXT_PUBLIC_FIREBASE_APP_ID`: Firebase App ID.
- `FIREBASE_CLIENT_EMAIL`: Firebase Admin client email.
- `FIREBASE_PRIVATE_KEY`: Firebase Admin private key.
