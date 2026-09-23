'use client';

import Link from 'next/link';
import type * as React from 'react';
import { Stat } from '@/components/ds';
import { usePaginacao } from '@/components/paginacao';
import { Badge } from '@/components/ui/badge';
import { Card, CardHead, CardTitle } from '@/components/ui/card';
import { Table, TBody, Td, THead, Th, Tr } from '@/components/ui/table';
import type { Sit, StatD } from '@/lib/deal';
import { cn } from '@/lib/utils';

/** números do alto da tela (dlStats do protótipo) */
export function Stats({ itens }: { itens: StatD[] }) {
  return (
    <div
      className={cn(
        'mb-4 grid grid-cols-2 gap-3',
        itens.length >= 5 ? 'md:grid-cols-3 xl:grid-cols-5' : itens.length === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3',
      )}
    >
      {itens.map((s) => (
        <Stat key={s.l} valor={s.v} rotulo={s.l} tom={s.tom} />
      ))}
    </div>
  );
}

export const SitB = ({ s }: { s: Sit }) => <Badge tom={s[1]}>{s[0]}</Badge>;

/** link de texto do DS para outra ficha */
export const Lk = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="font-medium text-azul hover:underline">
    {children}
  </Link>
);
export const Sub = ({ children }: { children: React.ReactNode }) => (
  <span className="mt-0.5 block text-apagado">{children}</span>
);
export const Nada = () => <span className="text-apagado-2">—</span>;

export type Col<T> = { t: string; num?: boolean; r: (x: T) => React.ReactNode; cls?: string };

/** tabela do Deal: cartão com título opcional, paginada acima de 10 linhas */
export function TabelaDeal<T>({
  cols,
  linhas,
  vazio,
  rotulo,
  titulo,
  direita,
  chave,
}: {
  cols: Col<T>[];
  linhas: T[];
  vazio: string;
  rotulo: string;
  titulo?: string;
  direita?: React.ReactNode;
  chave: (x: T, i: number) => string | number;
}) {
  const { fatia, rodape } = usePaginacao(linhas);
  return (
    <Card className="overflow-hidden">
      {titulo && (
        <CardHead>
          <CardTitle>{titulo}</CardTitle>
          <Badge tom="blue">{linhas.length}</Badge>
          {direita && <div className="ml-auto flex items-center gap-2">{direita}</div>}
        </CardHead>
      )}
      <Table aria-label={rotulo}>
        <THead>
          <Tr>
            {cols.map((c) => (
              <Th key={c.t} className={cn(c.num && 'text-right')}>
                {c.t}
              </Th>
            ))}
          </Tr>
        </THead>
        <TBody>
          {fatia.length ? (
            fatia.map((x, i) => (
              <Tr key={chave(x, i)}>
                {cols.map((c, j) => (
                  <Td
                    key={c.t}
                    className={cn(
                      c.num && 'text-right tabular-nums whitespace-nowrap',
                      j === 0 && 'font-medium text-texto',
                      c.cls,
                    )}
                  >
                    {c.r(x)}
                  </Td>
                ))}
              </Tr>
            ))
          ) : (
            <Tr>
              <Td colSpan={cols.length} className="py-8 text-center text-apagado">
                {vazio}
              </Td>
            </Tr>
          )}
        </TBody>
      </Table>
      {rodape}
    </Card>
  );
}

/** quadro de chave e valor (cardBox + fxKv do protótipo) */
export function Quadro({ titulo, itens }: { titulo: string; itens: [string, React.ReactNode][] }) {
  return (
    <Card className="p-5">
      <h2 className="mb-3 text-md font-bold text-texto">{titulo}</h2>
      <dl className="grid grid-cols-[minmax(110px,auto)_1fr] gap-x-4 gap-y-2.5">
        {itens.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-apagado">{k}</dt>
            <dd className="m-0 text-texto">{v ?? <Nada />}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
