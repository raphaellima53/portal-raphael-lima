import { Suspense } from 'react';
import { NovoContrato } from '@/components/deal/contratos';

export default function NovoContratoPage() {
  return (
    <Suspense>
      <NovoContrato />
    </Suspense>
  );
}
