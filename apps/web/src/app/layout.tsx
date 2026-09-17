import type { Metadata, Viewport } from 'next';
import type * as React from 'react';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: { default: 'Portal Raphael Lima', template: '%s · Portal Raphael Lima' },
  description:
    'Portal da operação Alumni by Better: agenda, cursos, alunos, professores, ações, relatórios e configurações.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0e1730',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="light" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
