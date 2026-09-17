'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

/** Abas da página (fichas de curso, aluno, professor): links com sublinhado azul na ativa. */
export function Abas({
  itens,
  rotulo,
  className,
}: {
  itens: { href: string; rotulo: string; ativa: boolean }[];
  rotulo: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={rotulo}
      className={cn('mb-5 flex gap-1 overflow-x-auto border-b border-borda [scrollbar-width:none]', className)}
    >
      {itens.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          role="tab"
          aria-selected={a.ativa}
          className={cn(
            'inline-flex h-11 shrink-0 items-center border-b-2 px-3.5 whitespace-nowrap transition-colors',
            a.ativa ? 'border-azul font-semibold text-azul' : 'border-transparent text-apagado hover:text-texto',
          )}
        >
          {a.rotulo}
        </Link>
      ))}
    </div>
  );
}
