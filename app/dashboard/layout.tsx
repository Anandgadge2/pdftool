import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard | PDF Tools',
  description: 'PDF tools dashboard',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
