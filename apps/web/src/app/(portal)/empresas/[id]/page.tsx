import { redirect } from 'next/navigation';

export default async function EmpresaSemAba({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/empresas/${id}/geral`);
}
