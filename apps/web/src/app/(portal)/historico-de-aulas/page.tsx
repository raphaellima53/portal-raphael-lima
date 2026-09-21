'use client';

import { SearchIcon } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { PRESENCA } from '@/components/agenda/aula-comum';
import { Aviso, PageHead, Stat } from '@/components/ds';
import { Escolha } from '@/components/escolha';
import { usePaginacao } from '@/components/paginacao';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TBody, Td, THead, Th, Tr } from '@/components/ui/table';
import { type Historico, useHistoricoAulas } from '@/lib/agenda';
import { corLegivel } from '@/lib/cor';
import { cn } from '@/lib/utils';

const norm = (s: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

const CHIPS: [string, string][] = [
  ['', 'Todas'],
  ['executada', 'Executadas'],
  ['substituida', 'Substituídas'],
  ['naoFinalizada', 'Não finalizadas'],
  ['cancelada', 'Canceladas'],
];

export default function HistoricoPage() {
  return (
    <Suspense>
      <HistoricoDeAulas />
    </Suspense>
  );
}

/** Histórico de aulas do aluno ou do professor: as aulas passadas, só para consulta. ?visao=aluno = as aulas como aluno. */
function HistoricoDeAulas() {
  const [dias, setDias] = useState(60);
  const [est, setEst] = useState('');
  const [busca, setBusca] = useState('');
  const [prod, setProd] = useState('');
  const visao = useSearchParams().get('visao') === 'aluno' ? 'aluno' : undefined;
  const q = useHistoricoAulas(dias, visao);
  const todas: Historico['aulas'][number][] = q.data?.aulas ?? [];
  const n = norm(busca);
  const doRecorte = todas.filter(
    (x) => (!prod || x.prod === prod) && (!n || norm(`${x.data} ${x.rotulo} ${x.prod} ${x.prof}`).includes(n)),
  );
  const ls = est ? doRecorte.filter((x) => x.estado === est) : doRecorte;
  const produtos = [...new Set(todas.map((x) => x.prod))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
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
  const d = q.data;
  const prof = d?.modo === 'professor';
  const s = d?.modo === 'aluno' ? d.stats : undefined;
  return (
    <>
      <PageHead titulo="Histórico de aulas" />
      {d?.modo === 'professor' && (
        <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          <Stat valor={d.stats.aulas} rotulo="aulas no período" />
          <Stat valor={d.stats.executadas} rotulo="executadas" tom="green" />
          <Stat valor={d.stats.substituidas} rotulo="substituídas" />
          <Stat
            valor={d.stats.naoFinalizadas}
            rotulo="não finalizadas"
            tom={d.stats.naoFinalizadas ? 'red' : undefined}
          />
          <Stat valor={d.stats.canceladas} rotulo="canceladas" />
        </div>
      )}
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
        <div className="relative w-[320px] max-w-full">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-apagado" />
          <Input
            type="search"
            aria-label="Pesquisar no histórico"
            placeholder="Pesquisar por aula, produto ou professor…"
            className="pl-9"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPag(1);
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Escolha
            rotulo="Produto"
            todos="Todos os produtos"
            valor={prod}
            aoMudar={(v) => {
              setProd(v);
              setPag(1);
            }}
            opcoes={produtos.map((p) => ({ v: p, l: p }))}
            className="w-[220px]"
          />
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
      </div>
      <div className="mb-3.5">
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
              {l} · {k ? doRecorte.filter((x) => x.estado === k).length : doRecorte.length}
            </button>
          ))}
        </div>
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
              <Th>{prof ? 'Alunos' : 'Presença'}</Th>
            </Tr>
          </THead>
          <TBody>
            {fatia.length ? (
              fatia.map((x) => (
                <Tr key={x.k}>
                  <Td className="font-medium text-texto">{x.data}</Td>
                  <Td>{x.horario}</Td>
                  <Td>
                    <b style={{ color: corLegivel(x.cor) }}>{x.rotulo}</b>
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
                    {'alunos' in x ? (
                      x.alunos
                    ) : x.presenca ? (
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
