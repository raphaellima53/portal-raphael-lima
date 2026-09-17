'use client';

import { useEffect, useState } from 'react';
import { PRESENCA } from '@/components/agenda/aula-comum';
import { Aviso, PageHead, Stat } from '@/components/ds';
import { Escolha } from '@/components/escolha';
import { usePaginacao } from '@/components/paginacao';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TBody, Td, THead, Th, Tr } from '@/components/ui/table';
import { useHistoricoAulas } from '@/lib/agenda';
import { cn } from '@/lib/utils';

const CHIPS: [string, string][] = [
  ['', 'Todas'],
  ['executada', 'Executadas'],
  ['substituida', 'Substituídas'],
  ['naoFinalizada', 'Não finalizadas'],
  ['cancelada', 'Canceladas'],
];

/** Histórico de aulas do aluno: as aulas passadas, só para consulta. */
export default function HistoricoDeAulas() {
  const [dias, setDias] = useState(60);
  const [est, setEst] = useState('');
  const q = useHistoricoAulas(dias);
  const todas = q.data?.aulas ?? [];
  const ls = est ? todas.filter((x) => x.estado === est) : todas;
  const { fatia, rodape, setPag } = usePaginacao(ls);
  useEffect(() => {
    document.title = 'Histórico de aulas · Portal Raphael Lima';
  }, []);

  if (q.isError)
    return (
      <>
        <PageHead titulo="Histórico de aulas" />
        <Aviso icone="info">{q.error.message}</Aviso>
      </>
    );
  const s = q.data?.stats;
  return (
    <>
      <PageHead titulo="Histórico de aulas" />
      {s && (
        <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          <Stat valor={s.aulas} rotulo="aulas no período" />
          <Stat valor={s.presencas} rotulo="presenças" tom="green" />
          <Stat valor={s.faltas} rotulo="faltas" tom={s.faltas ? 'red' : undefined} />
          <Stat valor={s.pct != null ? `${s.pct}%` : '—'} rotulo="de presença" />
          <Stat valor={s.canceladas} rotulo="canceladas" />
        </div>
      )}
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Estado da aula" className="flex flex-wrap gap-2">
          {CHIPS.map(([k, l]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={est === k}
              onClick={() => {
                setEst(k);
                setPag(1);
              }}
              className={cn(
                'h-9 cursor-pointer rounded-full bg-[#eceff5] px-3.5 text-[#4b5568] transition-shadow hover:bg-card hover:shadow-el-2 dark:bg-hover dark:text-texto-2',
                est === k && 'bg-azul-suave font-semibold text-azul shadow-[inset_0_0_0_1px_#cfdcfa]',
              )}
            >
              {l} · {k ? todas.filter((x) => x.estado === k).length : todas.length}
            </button>
          ))}
        </div>
        <Escolha
          rotulo="Período"
          valor={String(dias)}
          destacar={false}
          aoMudar={(v) => setDias(Number(v))}
          opcoes={[
            { v: '30', l: 'últimos 30 dias' },
            { v: '60', l: 'últimos 60 dias' },
            { v: '90', l: 'últimos 90 dias' },
          ]}
          className="w-[180px]"
        />
      </div>
      <Card className="overflow-hidden">
        <Table>
          <THead>
            <Tr>
              <Th>Data</Th>
              <Th>Horário</Th>
              <Th>Aula</Th>
              <Th>Professor</Th>
              <Th>Estado</Th>
              <Th>Presença</Th>
            </Tr>
          </THead>
          <TBody>
            {fatia.length ? (
              fatia.map((x) => (
                <Tr key={x.k}>
                  <Td className="font-medium text-texto">{x.data}</Td>
                  <Td>{x.horario}</Td>
                  <Td>
                    <b style={{ color: x.cor }}>{x.rotulo}</b>
                    <div className="text-apagado">{x.prod}</div>
                  </Td>
                  <Td>
                    {x.prof === '—' ? <span className="text-apagado">sem professor</span> : x.prof}
                    {x.sub && <div className="text-apagado">no lugar de {x.sub}</div>}
                  </Td>
                  <Td>
                    <Badge tom={x.estadoTag[1]}>{x.estadoTag[0]}</Badge>
                  </Td>
                  <Td>
                    {x.presenca ? (
                      <Badge tom={PRESENCA[x.presenca][1] === 'gray' ? 'amber' : PRESENCA[x.presenca][1]}>
                        {PRESENCA[x.presenca][0]}
                      </Badge>
                    ) : (
                      <span className="text-apagado">—</span>
                    )}
                  </Td>
                </Tr>
              ))
            ) : (
              <Tr>
                <Td colSpan={6} className="py-7 text-center text-apagado">
                  {q.isPending ? 'Carregando…' : 'nenhuma aula neste recorte'}
                </Td>
              </Tr>
            )}
          </TBody>
        </Table>
        {rodape}
      </Card>
    </>
  );
}
