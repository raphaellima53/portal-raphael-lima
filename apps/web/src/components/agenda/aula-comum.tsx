'use client';

import { CalendarIcon, ClockIcon, LockIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { AulaModelo } from '@/lib/agenda';
import { corLegivel } from '@/lib/cor';

export const iniciais = (n: string) =>
  String(n || '?')
    .split(/\s+/)
    .filter(Boolean)
    .map((x) => x[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

export const Avatar = ({ nome }: { nome: string }) => (
  <span
    aria-hidden
    className="grid size-9 shrink-0 place-items-center rounded-full bg-cinza-suave font-bold text-texto-2"
  >
    {nome === '—' ? '?' : iniciais(nome)}
  </span>
);

/** estado, tipo, curso e módulo da aula */
export function TagsAula({
  a,
  est,
  trava,
  semTipo,
}: {
  a: AulaModelo;
  est?: AulaModelo['est'];
  trava?: string;
  semTipo?: boolean;
}) {
  const e = est ?? a.est;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge tom={e[1]}>{e[0]}</Badge>
      {!semTipo && <Badge>{a.tipo}</Badge>}
      <span
        className="inline-flex h-[26px] items-center rounded-full px-2.5 font-semibold text-white"
        style={{ background: corLegivel(a.corCurso) }}
      >
        {a.prod}
      </span>
      {a.mod && (
        <span className="inline-flex h-[26px] items-center rounded-full bg-[#1e2b5a] px-2.5 font-semibold text-white">
          {a.mod}
        </span>
      )}
      {trava && (
        <span className="inline-flex items-center gap-1 text-vermelho">
          <LockIcon className="size-3.5" />
          {trava}
        </span>
      )}
    </div>
  );
}

export const QuandoAula = ({ a }: { a: AulaModelo }) => (
  <div className="flex flex-wrap gap-x-5 gap-y-1 text-texto-2">
    <span className="inline-flex items-center gap-1.5">
      <CalendarIcon className="size-4 text-apagado" />
      {a.dataTxt}
    </span>
    <span className="inline-flex items-center gap-1.5">
      <ClockIcon className="size-4 text-apagado" />
      {a.horario}
    </span>
  </div>
);

export const cursoTxt = (a: AulaModelo) => `Curso: ${a.prod}${a.mod ? ` · ${a.modRot}: ${a.mod}` : ''}`;

export const PRESENCA: Record<string, [string, 'green' | 'red' | 'amber' | 'gray']> = {
  presente: ['Presente', 'green'],
  falta: ['Falta', 'red'],
  pendente: ['Sem registro', 'gray'],
};
