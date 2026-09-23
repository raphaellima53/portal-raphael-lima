import { Suspense } from 'react';
import { NovoPedido } from '@/components/deal/pedido';

export default function NovoPedidoPage() {
  return (
    <Suspense>
      <NovoPedido />
    </Suspense>
  );
}
