import type * as React from 'react';
import { cn } from '@/lib/utils';

/** cartão do DS: fundo branco, borda suave, raio 14 e sombra el-1 */
function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn('rounded-lg border border-borda bg-card text-texto shadow-el-1', className)}
      {...props}
    />
  );
}

/** cabeçalho do painel (pane-head): título à esquerda, ações à direita */
function CardHead({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-head"
      className={cn('flex min-h-14 items-center gap-2.5 border-b border-borda-suave px-5 py-3.5', className)}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return <h2 data-slot="card-title" className={cn('text-md font-bold text-texto', className)} {...props} />;
}

export { Card, CardHead, CardTitle };
