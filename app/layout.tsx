import type { Metadata } from 'next';
import './globals.css';
import './mobile-aesthetic.css';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'PDF Markup Extractor & Issue Tracker',
  description: 'Upload PDFs, extract annotations, track and manage issues with a premium dark-theme dashboard.',
  keywords: ['PDF', 'annotations', 'markup', 'issue tracker', 'Next.js'],
  openGraph: {
    title: 'PDF Markup Extractor & Issue Tracker',
    description: 'Extract and manage PDF annotations with a premium dark-theme dashboard.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
