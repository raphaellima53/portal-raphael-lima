'use client';

import { DownloadIcon } from 'lucide-react';
import Link from 'next/link';
import { Stat } from '@/components/ds';
import { usePaginacao } from '@/components/paginacao';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TBody, Td, THead, Th, Tr } from '@/components/ui/table';
import type { Valor } from '@/lib/relatorios';
import type { Tom } from '@/lib/tipos';
import { cn } from '@/lib/utils';

export type Col = { k: string; t: string; num: boolean };

export const BotaoCsv = ({ aoClicar, disabled }: { aoClicar: () => void; disabled?: boolean }) => (
  <Button onClick={aoClicar} disabled={disabled}>
    <DownloadIcon /> Exportar CSV
  </Button>
);

/** o recorte escrito por extenso, à direita da barra de filtros */
export const Recorte = ({ children }: { children: React.ReactNode }) => (
  <span className="ml-auto text-apagado">{children}</span>
);

export const Barra = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-4 flex flex-wrap items-center gap-3">{children}</div>
);

export function Resumo({ itens }: { itens: { v: string; t: string; tom?: Tom }[] }) {
  return (
    <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
      {itens.map((s) => (
        <Stat key={s.t} valor={s.v} rotulo={s.t} tom={s.tom} />
      ))}
    </div>
  );
}

/** tabela de relatório: a primeira coluna leva à ficha de origem; números à direita; paginada acima de 10 linhas */
export function TabelaRel({
  cols,
  linhas,
  vazio,
  rotulo,
}: {
  cols: Col[];
  linhas: { href: string | null; v: Record<string, Valor> }[];
  vazio: string;
  rotulo: string;
}) {
  const { fatia, rodape } = usePaginacao(linhas);
  return (
    <Card className="overflow-hidden">
      <Table aria-label={rotulo}>
        <THead>
          <Tr>
            {cols.map((c) => (
              <Th key={c.k} className={cn(c.num && 'text-right')}>
                {c.t}
              </Th>
            ))}
          </Tr>
        </THead>
        <TBody>
          {fatia.length ? (
            fatia.map((l, i) => (
              <Tr key={i}>
                {cols.map((c, j) => {
                  const v = l.v[c.k] ?? '—';
                  return (
                    <Td
                      key={c.k}
                      className={cn(c.num && 'text-right tabular-nums', j === 0 && 'font-medium whitespace-nowrap')}
                    >
                      {j === 0 && l.href ? (
                        <Link href={l.href} className="text-azul hover:underline">
                          {v}
                        </Link>
                      ) : (
                        v
                      )}
                    </Td>
                  );
                })}
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
