import QuotationForm from '@/components/QuotationForm';

export default function EditQuotationPage({ params }: { params: { id: string } }) {
  return <QuotationForm editId={params.id} />;
}
