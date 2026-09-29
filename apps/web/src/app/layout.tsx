import type { Metadata, Viewport } from 'next';
import { Inter, Jost, Manrope } from 'next/font/google';
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
  themeColor: '#062967',
};

/* 24/09/2026: Manrope é a fonte de sistema oficial (Manual de Identidade Visual Alumni, 2025); Jost e Inter são as
   do Alumni Black (títulos e corpo), usadas só no tema Black do aluno Black */
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });
const jost = Jost({ subsets: ['latin'], variable: '--font-jost', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      data-theme="light"
      className={`${manrope.variable} ${jost.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
