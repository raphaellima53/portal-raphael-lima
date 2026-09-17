import { Suspense } from 'react';
import { FichaAluno } from '@/components/alunos/ficha-aluno';

export default function AlunoPage() {
  return (
    <Suspense>
      <FichaAluno />
    </Suspense>
  );
}
