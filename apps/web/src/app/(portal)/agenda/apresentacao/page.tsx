import { Suspense } from 'react';
import { Apresentacao } from '@/components/agenda/apresentacao';

export default function ApresentacaoPage() {
  return (
    <Suspense>
      <Apresentacao />
    </Suspense>
  );
}
