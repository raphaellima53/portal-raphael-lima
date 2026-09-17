import { Suspense } from 'react';
import { FichaProfessor } from '@/components/professores/ficha-professor';

export default function ProfessorPage() {
  return (
    <Suspense>
      <FichaProfessor />
    </Suspense>
  );
}
