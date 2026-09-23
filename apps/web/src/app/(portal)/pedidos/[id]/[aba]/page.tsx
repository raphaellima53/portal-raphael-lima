'use client';

import { useParams } from 'next/navigation';
import { FichaPedido } from '@/components/deal/pedido';

/** ficha do pedido (Deal): Geral · Cronograma · Notas fiscais · Linha do tempo; acende Atividades no menu */
export default function PedidoPage() {
  const { id, aba } = useParams<{ id: string; aba: string }>();
  return <FichaPedido id={id} aba={aba} />;
}
