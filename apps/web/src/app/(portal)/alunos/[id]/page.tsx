import { redirect } from 'next/navigation';

export default async function AlunoSemAba({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/alunos/${id}/perfil`);
}
