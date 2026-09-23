import { redirect } from 'next/navigation';

export default async function ContratoSemAba({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/contratos/${id}/geral`);
}
