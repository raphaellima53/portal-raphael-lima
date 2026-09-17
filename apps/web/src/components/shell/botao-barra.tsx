'use client';

import type { LucideIcon } from 'lucide-react';
import type * as React from 'react';
import { Dica } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type Props = React.ComponentProps<'button'> & {
  icone: LucideIcon;
  texto: string;
  mini: boolean;
  extra?: React.ReactNode;
};

/** Botão da barra lateral (Alertas, Minimizar, Ajuda). Minimizado, mostra só o ícone e ganha o nome em tooltip. */
export function BotaoBarra({ icone: Icone, texto, mini, extra, className, ...props }: Props) {
  const b = (
    <button
      type="button"
      className={cn(
        'relative flex min-h-[42px] w-full cursor-pointer items-center gap-[11px] rounded-md border-0 bg-transparent text-left text-sb-texto transition-colors hover:bg-white/6 hover:text-white aria-expanded:bg-white/6 aria-expanded:text-white',
        mini ? 'justify-center px-0 py-2.5' : 'px-3 py-[9px]',
        className,
      )}
      {...props}
    >
      <Icone className="size-4 shrink-0" strokeWidth={1.8} aria-hidden />
      <span className={cn('min-w-0 flex-1', mini && 'sr-only')}>{texto}</span>
      {extra}
    </button>
  );
  return mini ? <Dica texto={texto}>{b}</Dica> : b;
}
