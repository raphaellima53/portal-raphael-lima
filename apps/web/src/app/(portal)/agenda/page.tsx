import { Suspense } from 'react';
import { AgendaTela } from '@/components/agenda/agenda-tela';

export default function AgendaPage() {
  return (
    <Suspense>
      <AgendaTela />
    </Suspense>
  );
}
