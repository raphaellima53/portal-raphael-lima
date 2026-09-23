'use client';

import { useParams } from 'next/navigation';
import { Suspense } from 'react';
import { FichaContrato } from '@/components/deal/contratos';

/** ficha do contrato (Deal): aberta pela aba Contratos da ficha do aluno ou da empresa; volta para ela */
export default function ContratoPage() {
  const { id, aba } = useParams<{ id: string; aba: string }>();
  return (
    <Suspense>
      <FichaContrato id={id} aba={aba} />
    </Suspense>
  );
}
