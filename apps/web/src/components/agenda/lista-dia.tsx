'use client';

import { CheckIcon, DownloadIcon, VideoIcon } from 'lucide-react';
import { useState } from 'react';
import { usePaginacao } from '@/components/paginacao';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHead, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TBody, Td, THead, Th, Tr } from '@/components/ui/table';
import type { AulaItem } from '@/lib/agenda';
import { useZoomDia } from '@/lib/agenda';

const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

/** Lista do dia (Diária): é nela que mora a ação em massa, o Zoom do dia e a exportação. */
export function ListaDia({
  aulas,
  data,
  aoDetalhe,
  aoMassa,
  aoMsg,
}: {
  aulas: AulaItem[];
  data: string;
  aoDetalhe: (k: string) => void;
  aoMassa: (ks: string[]) => void;
  aoMsg: (m: { txt: string; erro?: boolean }) => void;
}) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const { fatia, rodape } = usePaginacao(aulas);
  const zoom = useZoomDia();
  const marca = (k: string, on: boolean) =>
    setSel((s) => {
      const n = new Set(s);
      if (on) n.add(k);
      else n.delete(k);
      return n;
    });
  const todosNaPagina = fatia.length > 0 && fatia.every((a) => sel.has(a.k));

  const exportar = () => {
    const cab = ['Hora', 'Produto / Módulo', 'Turma / Aluno', 'Professor', 'Sala', 'Alunos'];
    const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const linhas = aulas.map((a) => [
      hh(a.hora),
      a.mod ? `${a.prod} / ${a.mod}` : a.prod,
      a.quem,
      a.prof === '—' ? 'a definir' : a.prof,
      a.sala,
      `${a.n}/${a.vagas}`,
    ]);
    const csv = `﻿${[cab, ...linhas].map((l) => l.map(esc).join(';')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const el = document.createElement('a');
    el.href = url;
    el.download = `agenda-${data}.csv`;
    el.click();
    URL.revokeObjectURL(url);
    aoMsg({ txt: `Lista do dia exportada: ${aulas.length} ${aulas.length === 1 ? 'aula' : 'aulas'}.` });
  };

  let horaAnterior = -1;
  return (
    <Card className="mt-4 overflow-hidden">
      <CardHead className="flex-wrap">
        <CardTitle>Lista do dia</CardTitle>
        <Badge tom="blue">{aulas.length}</Badge>
        <span className="flex-1" />
        <Button size="sm" onClick={exportar}>
          <DownloadIcon /> Exportar dia
        </Button>
        <Button
          size="sm"
          disabled={zoom.isPending}
          onClick={() =>
            zoom.mutate(data, {
              onSuccess: (r) => aoMsg({ txt: r.msg }),
              onError: (e) => aoMsg({ txt: e.message, erro: true }),
            })
          }
        >
          <VideoIcon /> Gerar todos os Zoom do dia
        </Button>
        <Button
          size="sm"
          onClick={() =>
            sel.size ? aoMassa([...sel]) : aoMsg({ txt: 'Marque as aulas na lista do dia para usar a ação em massa.' })
          }
        >
          <CheckIcon /> Ação em massa
        </Button>
      </CardHead>
      <Table>
        <THead>
          <Tr>
            <Th className="w-12">
              <Checkbox
                aria-label="Marcar todas desta página"
                checked={todosNaPagina}
                onCheckedChange={(v) => {
                  for (const a of fatia) marca(a.k, v === true);
                }}
              />
            </Th>
            <Th>Hora</Th>
            <Th>Produto / Módulo</Th>
            <Th>Turma / Aluno</Th>
            <Th>Professor</Th>
            <Th>Sala</Th>
            <Th className="text-right">Alunos</Th>
            <Th>
              <span className="sr-only">Ações</span>
            </Th>
          </Tr>
        </THead>
        <TBody>
          {fatia.map((a) => {
            const grupo = a.hora !== horaAnterior;
            horaAnterior = a.hora;
            const n = aulas.filter((x) => x.hora === a.hora).length;
            return (
              <FragmentoLinha key={a.k} grupo={grupo ? `${hh(a.hora)} — ${n} ${n === 1 ? 'aula' : 'aulas'}` : null}>
                <Tr>
                  <Td>
                    <Checkbox
                      aria-label={`Marcar ${a.rotulo} às ${hh(a.hora)}`}
                      checked={sel.has(a.k)}
                      onCheckedChange={(v) => marca(a.k, v === true)}
                    />
                  </Td>
                  <Td>{hh(a.hora)}</Td>
                  <Td className="font-semibold text-texto">{a.mod ? `${a.prod} / ${a.mod}` : a.prod}</Td>
                  <Td>{a.quem}</Td>
                  <Td>{a.prof === '—' ? 'a definir' : a.prof}</Td>
                  <Td>{a.sala}</Td>
                  <Td className="text-right tabular-nums">
                    {a.n}/{a.vagas}
                  </Td>
                  <Td className="text-right">
                    <Button size="sm" onClick={() => aoDetalhe(a.k)}>
                      Detalhes
                    </Button>
                  </Td>
                </Tr>
              </FragmentoLinha>
            );
          })}
        </TBody>
      </Table>
      {rodape}
    </Card>
  );
}

function FragmentoLinha({ grupo, children }: { grupo: string | null; children: React.ReactNode }) {
  return (
    <>
      {grupo && (
        <Tr className="bg-[#fafbfd] dark:bg-hover">
          <Td colSpan={8} className="py-2 font-bold text-texto-2">
            {grupo}
          </Td>
        </Tr>
      )}
      {children}
    </>
  );
}
