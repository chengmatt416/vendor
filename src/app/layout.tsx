import '@/app/globals.css';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Company POS System',
  description: 'Modern POS, Finance, and Signoff System',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'POS System',
  },
};

export const viewport = {
  themeColor: '#ffffff',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW">
      <body className={`${inter.className} bg-gray-50 text-gray-900`}>
        {children}
      </body>
    </html>
  );
}
