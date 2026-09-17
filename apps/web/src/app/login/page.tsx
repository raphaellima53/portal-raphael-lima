import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TelaLogin } from './tela-login';

export const metadata: Metadata = { title: 'Entrar' };

export default function LoginPage() {
  return (
    <Suspense>
      <TelaLogin />
    </Suspense>
  );
}
