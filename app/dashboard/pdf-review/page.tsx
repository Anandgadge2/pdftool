import { redirect } from 'next/navigation';

export default function DashboardPdfReviewRedirect() {
  redirect('/?tab=review');
}
