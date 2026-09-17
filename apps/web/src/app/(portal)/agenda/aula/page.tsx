import { Suspense } from 'react';
import { AulaPagina } from '@/components/agenda/aula-pagina';

export default function AulaPage() {
  return (
    <Suspense>
      <AulaPagina />
    </Suspense>
  );
}
