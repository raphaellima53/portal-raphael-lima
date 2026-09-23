import { redirect } from 'next/navigation';

export default async function PedidoSemAba({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/pedidos/${id}/geral`);
}
