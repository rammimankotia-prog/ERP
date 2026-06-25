
'use client';

import QuotationForm from '@/components/QuotationForm';
import { useParams } from 'next/navigation';

export default function EditQuotationPage() {
  const params = useParams();
  const id = params.id as string;

  return <QuotationForm editId={id} />;
}
