import { Suspense } from 'react';
import { AgendaTela } from '@/components/agenda/agenda-tela';

/** Minha agenda: a agenda presa no aluno (o aluno e o colaborador que também estuda). */
export default function MinhaAgendaPage() {
  return (
    <Suspense>
      <AgendaTela minha />
    </Suspense>
  );
}
