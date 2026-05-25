import { redirect } from 'next/navigation';

export default function PdfReviewRedirect() {
  redirect('/?tab=review');
}
