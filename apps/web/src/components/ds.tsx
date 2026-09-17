/** Peças do design system do portal usadas em várias telas: cabeçalho, aviso, número, trilho. */
import { AlertTriangleIcon, CheckIcon, InfoIcon, LockIcon } from 'lucide-react';
import type * as React from 'react';
import type { Tom } from '@/lib/tipos';
import { cn } from '@/lib/utils';

export const corTom: Record<Tom, string> = {
  red: 'text-vermelho',
  amber: 'text-ambar',
  green: 'text-verde',
  blue: 'text-azul',
  purple: 'text-roxo',
  gray: 'text-apagado',
};

/** Cabeçalho da página: só o título e as ações (sem trilha nem subtítulo — pedido do usuário). */
export function PageHead({ titulo, acoes }: { titulo: React.ReactNode; acoes?: React.ReactNode }) {
  return (
    <div className="mb-6 flex min-h-10 flex-wrap items-center gap-4">
      <h1 className="grow basis-auto">{titulo}</h1>
      {acoes ? <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{acoes}</div> : null}
    </div>
  );
}

export function Aviso({
  tom = 'gray',
  icone,
  children,
}: {
  tom?: 'gray' | 'blue' | 'red' | 'amber';
  icone?: 'ok' | 'alerta' | 'trava' | 'info';
  children: React.ReactNode;
}) {
  const Icone =
    icone === 'ok' ? CheckIcon : icone === 'alerta' ? AlertTriangleIcon : icone === 'trava' ? LockIcon : InfoIcon;
  return (
    <div
      role={tom === 'red' ? 'alert' : 'status'}
      className={cn(
        'mb-4 flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm',
        tom === 'blue' && 'border-azul-linha bg-azul-suave text-texto-2',
        tom === 'red' && 'border-[#f5c2c7] bg-vermelho-suave text-texto-2',
        tom === 'amber' && 'border-[#f1d9a6] bg-ambar-suave text-texto-2',
        tom === 'gray' && 'border-borda bg-card text-texto-2 shadow-el-1',
      )}
    >
      <Icone
        className={cn(
          'mt-0.5 size-4 shrink-0',
          tom === 'red' ? 'text-vermelho' : tom === 'amber' ? 'text-ambar' : 'text-azul',
        )}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** número grande com rótulo embaixo (statTop) */
export function Stat({
  valor,
  rotulo,
  tom,
  detalhe,
}: {
  valor: React.ReactNode;
  rotulo: string;
  tom?: Tom;
  /** linha de apoio embaixo do rótulo (ex.: 42 de 288) */
  detalhe?: React.ReactNode;
}) {
  return (
    <div className="flex rounded-lg border border-borda bg-card px-[18px] py-4 shadow-el-1">
      <div>
        <div className={cn('text-[27px] leading-[1.05] font-extrabold tracking-[-1px] text-texto', tom && corTom[tom])}>
          {valor}
        </div>
        <div className="mt-1 text-apagado">{rotulo}</div>
        {detalhe ? <div className="mt-0.5 text-apagado">{detalhe}</div> : null}
      </div>
    </div>
  );
}

/** barra de progresso (track) */
export function Trilho({
  pct,
  cor,
  className,
  rotulo,
}: {
  pct: number;
  cor: string;
  className?: string;
  rotulo?: string;
}) {
  const v = Math.max(0, Math.min(100, pct));
  return (
    <span
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={rotulo}
      className={cn('block h-[7px] w-full overflow-hidden rounded-[5px] bg-trilho', className)}
    >
      <i className="block h-full rounded-[5px]" style={{ width: `${v}%`, background: cor }} />
    </span>
  );
}
