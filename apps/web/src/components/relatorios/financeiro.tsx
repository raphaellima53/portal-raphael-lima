'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Bar, BarChart, LabelList, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Busca, normaliza } from '@/components/acoes/alocacao';
import { Segmento } from '@/components/alunos/abas-aluno';
import type { Msg } from '@/components/alunos/comum';
import { Aviso, corTom, PageHead, Stat } from '@/components/ds';
import { Escolha } from '@/components/escolha';
import { usePaginacao } from '@/components/paginacao';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHead, CardTitle } from '@/components/ui/card';
import { Table, TBody, Td, THead, Th, Tr } from '@/components/ui/table';
import { type CobLinha, type Financeiro, useFinanceiro, usePagar } from '@/lib/relatorios';
import { cn } from '@/lib/utils';
import { Barra, Recorte } from './comum';

const Cabeca = ({ titulo, sub, children }: { titulo: string; sub: string; children?: React.ReactNode }) => (
  <CardHead className="flex-wrap">
    <CardTitle>{titulo}</CardTitle>
    <span className="text-apagado-2">{sub}</span>
    {children}
  </CardHead>
);
const Nome = ({ href, children }: { href: string | null; children: React.ReactNode }) =>
  href ? (
    <Link href={href} className="text-azul hover:underline">
      {children}
    </Link>
  ) : (
    children
  );

/** valor em cima da barra, numa linha só (o LabelList padrão quebra no espaço) */
const Rotulo = (p: { x?: number | string; y?: number | string; width?: number | string; value?: unknown }) => (
  <text
    x={Number(p.x) + Number(p.width) / 2}
    y={Number(p.y) - 6}
    textAnchor="middle"
    className="fill-texto-2 text-sm tabular-nums"
  >
    {String(p.value ?? '').replace('R$ ', '')}
  </text>
);

/** Relatórios › Financeiro › Dashboard financeiro: receita, custo, margem, cobranças e carteira, lidos da base */
export function TelaFinanceiro({ abas }: { abas: React.ReactNode }) {
  const sp = useSearchParams();
  const caminho = usePathname();
  const router = useRouter();
  const p = { mes: sp.get('mes') ?? '', curso: sp.get('curso') ?? '' };
  const q = useFinanceiro(p);
  const d = q.data;
  const [msg, setMsg] = useState<Msg>(null);
  const muda = (k: keyof typeof p, v: string) => {
    const n = new URLSearchParams(sp.toString());
    if (v) n.set(k, v);
    else n.delete(k);
    setMsg(null);
    router.replace(`${caminho}${n.size ? `?${n}` : ''}`, { scroll: false });
  };

  return (
    <>
      <PageHead titulo="Dashboard financeiro" />
      {abas}
      {msg && (
        <Aviso tom={msg.erro ? 'red' : 'blue'} icone={msg.erro ? 'alerta' : 'ok'}>
          {msg.txt}
        </Aviso>
      )}
      {q.isError && (
        <Aviso tom="red" icone="alerta">
          {q.error.message}
        </Aviso>
      )}
      {d && (
        <>
          <Barra>
            <Escolha
              rotulo="Competência"
              destacar={false}
              valor={d.ym}
              aoMudar={(v) => muda('mes', v === d.meses[0].v ? '' : v)}
              opcoes={d.meses}
              className="w-[220px]"
            />
            <Escolha
              rotulo="Curso"
              todos="todos os cursos"
              valor={d.curso}
              aoMudar={(v) => muda('curso', v)}
              opcoes={d.cursos.map((c) => ({ v: c, l: c }))}
              className="w-[230px]"
            />
            <Recorte>{d.recorte}</Recorte>
          </Barra>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            {d.kpis.map((k) => (
              <Stat
                key={k.t}
                valor={k.v}
                rotulo={k.t}
                tom={k.tom}
                detalhe={
                  k.var ? (
                    <>
                      <span className={cn('font-semibold', corTom[k.var.tom])}>{k.var.pct}</span>
                      {k.var.vs}
                    </>
                  ) : (
                    k.detalhe
                  )
                }
              />
            ))}
          </div>
          <Grafico d={d} aoEscolher={(ym) => muda('mes', ym === d.meses[0].v ? '' : ym)} />
          <PorCurso d={d} />
          <PorProfessor d={d} />
          <Cobrancas key={`${d.ym}|${d.curso}`} d={d} setMsg={setMsg} />
        </>
      )}
    </>
  );
}

function Grafico({ d, aoEscolher }: { d: Financeiro; aoEscolher: (ym: string) => void }) {
  const sel = d.serie.find((s) => s.ym === d.ym);
  const Tick = ({ x, y, index }: { x?: number; y?: number; index?: number }) => {
    const s = d.serie[index ?? 0];
    if (!s) return null;
    return (
      <g
        role="button"
        tabIndex={0}
        aria-label={`Ver ${s.nome}`}
        aria-pressed={s.ym === d.ym}
        className="cursor-pointer outline-none focus-visible:[&_text]:underline"
        onClick={(e) => {
          e.stopPropagation();
          aoEscolher(s.ym);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            aoEscolher(s.ym);
          }
        }}
      >
        <text x={x} y={(y ?? 0) + 14} textAnchor="middle" className="fill-texto text-sm font-semibold">
          {s.rotulo}
        </text>
        <text
          x={x}
          y={(y ?? 0) + 33}
          textAnchor="middle"
          className={cn('text-sm', s.negativa ? 'fill-vermelho' : 'fill-verde')}
        >
          {s.margem}
        </text>
      </g>
    );
  };
  return (
    <Card className="mb-4 overflow-hidden">
      <Cabeca titulo="Receita e custo de professores" sub="últimos 6 meses · clique num mês para abrir a competência" />
      <div className="flex flex-wrap gap-x-5 gap-y-1 px-5 pt-3 text-apagado">
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block size-2.5 rounded-[3px] bg-azul" aria-hidden />
          Receita reconhecida
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block size-2.5 rounded-[3px] bg-ambar" aria-hidden />
          Custo de professores
        </span>
        <span>{d.resumoMes}</span>
      </div>
      <div className="overflow-x-auto px-2 pb-2">
        <div
          className="h-[290px] min-w-[600px]"
          role="group"
          aria-label={`Receita e custo de professores nos últimos 6 meses: ${d.serie
            .map((s) => `${s.nome}, receita ${s.receitaTxt}, custo ${s.custoTxt}`)
            .join('; ')}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={d.serie}
              margin={{ top: 30, right: 12, bottom: 8, left: 12 }}
              barGap={14}
              onClick={(e) => {
                const i = Number(e?.activeTooltipIndex);
                if (e?.isTooltipActive && Number.isInteger(i) && d.serie[i]) aoEscolher(d.serie[i].ym);
              }}
              className="cursor-pointer"
            >
              {sel && <ReferenceArea x1={sel.rotulo} x2={sel.rotulo} fill="var(--blue-soft)" fillOpacity={1} />}
              <XAxis
                dataKey="rotulo"
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
                height={48}
                tick={<Tick />}
                interval={0}
              />
              <YAxis hide domain={[0, 'dataMax']} />
              <Tooltip content={() => null} cursor={{ fill: 'var(--hover, #f3f5f9)' }} />
              <Bar dataKey="receita" fill="var(--blue)" radius={[3, 3, 0, 0]} maxBarSize={40} isAnimationActive={false}>
                <LabelList dataKey="receitaTxt" content={<Rotulo />} />
              </Bar>
              <Bar dataKey="custo" fill="var(--amber)" radius={[3, 3, 0, 0]} maxBarSize={40} isAnimationActive={false}>
                <LabelList dataKey="custoTxt" content={<Rotulo />} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}

function PorCurso({ d }: { d: Financeiro }) {
  const { fatia, rodape } = usePaginacao(d.porCurso);
  const num = 'text-right tabular-nums whitespace-nowrap';
  return (
    <Card className="mb-4 overflow-hidden">
      <Cabeca titulo="Por curso" sub="o valor da aula vem de Cursos › Regras; o curso abre as regras" />
      <Table>
        <THead>
          <Tr>
            <Th>Curso</Th>
            <Th className="text-right">Valor da aula</Th>
            <Th>Cobrado por</Th>
            <Th className="text-right">Aulas dadas</Th>
            <Th className="text-right">Alunos em aula</Th>
            <Th className="text-right">Receita</Th>
            <Th className="text-right">Custo de professores</Th>
            <Th className="text-right">Margem</Th>
            <Th className="text-right">Margem %</Th>
            <Th className="text-right">Canceladas</Th>
          </Tr>
        </THead>
        <TBody>
          {fatia.length ? (
            fatia.map((c) => (
              <Tr key={c.curso}>
                <Td className="font-medium whitespace-nowrap">
                  <Nome href={c.href}>{c.curso}</Nome>
                </Td>
                <Td className={num}>{c.valor}</Td>
                <Td>{c.por}</Td>
                <Td className={num}>{c.dadas}</Td>
                <Td className={num}>{c.alunosAula}</Td>
                <Td className={num}>{c.receita}</Td>
                <Td className={num}>{c.custo}</Td>
                <Td className={cn(num, 'font-bold', c.negativa && 'text-vermelho')}>{c.margem}</Td>
                <Td className={num}>{c.margemPct}</Td>
                <Td className={num}>{c.canc}</Td>
              </Tr>
            ))
          ) : (
            <Tr>
              <Td colSpan={10} className="py-8 text-center text-apagado">
                nenhuma aula dada nesta competência
              </Td>
            </Tr>
          )}
        </TBody>
      </Table>
      {rodape}
    </Card>
  );
}

function PorProfessor({ d }: { d: Financeiro }) {
  const { fatia, rodape } = usePaginacao(d.porProf);
  const num = 'text-right tabular-nums whitespace-nowrap';
  return (
    <Card className="mb-4 overflow-hidden">
      <Cabeca
        titulo="Custo por professor"
        sub="a aula vai para quem deu — o substituto recebe a dele; o nome abre as aulas do professor"
      />
      <Table>
        <THead>
          <Tr>
            <Th>Professor</Th>
            <Th className="text-right">Aulas dadas</Th>
            <Th className="text-right">Horas</Th>
            <Th className="text-right">Valor hora</Th>
            <Th className="text-right">Custo</Th>
            <Th className="text-right">Da folha</Th>
          </Tr>
        </THead>
        <TBody>
          {fatia.length ? (
            fatia.map((p) => (
              <Tr key={p.prof}>
                <Td className="font-medium whitespace-nowrap">
                  <Nome href={p.href}>{p.prof}</Nome>
                </Td>
                <Td className={num}>{p.dadas}</Td>
                <Td className={num}>{p.horas}</Td>
                <Td className={num}>{p.valorHora}</Td>
                <Td className={num}>{p.custo}</Td>
                <Td className={num}>{p.daFolha}</Td>
              </Tr>
            ))
          ) : (
            <Tr>
              <Td colSpan={6} className="py-8 text-center text-apagado">
                nenhuma aula dada nesta competência
              </Td>
            </Tr>
          )}
        </TBody>
      </Table>
      {rodape}
    </Card>
  );
}

function Cobrancas({ d, setMsg }: { d: Financeiro; setMsg: (m: Msg) => void }) {
  const [lista, setLista] = useState<'vencidas' | 'aVencer' | 'pagas'>('vencidas');
  const [busca, setBusca] = useState('');
  const pagar = usePagar();
  const q = normaliza(busca);
  const linhas = d.cobrancas[lista].filter((c) => !q || normaliza(`${c.pagador} ${c.curso} ${c.item}`).includes(q));
  const { fatia, rodape, setPag } = usePaginacao<CobLinha>(linhas);
  const num = 'text-right tabular-nums whitespace-nowrap';
  return (
    <Card className="overflow-hidden">
      <Cabeca
        titulo="Cobranças"
        sub={`cada matrícula ativa — e cada turma dedicada, cobrada da empresa — em ${d.parcelas} parcelas mensais, vencendo no dia 10`}
      />
      <div className="flex flex-wrap items-center gap-3 px-5 py-3">
        <Segmento
          rotulo="Cobranças"
          valor={lista}
          aoMudar={(v) => {
            setLista(v as typeof lista);
            setPag(1);
          }}
          opcoes={[
            ['vencidas', `Vencidas · ${d.cobrancas.vencidas.length}`],
            ['aVencer', `A vencer em ${d.mesCurto} · ${d.cobrancas.aVencer.length}`],
            ['pagas', `Pagas em ${d.mesCurto} · ${d.cobrancas.pagas.length}`],
          ]}
        />
        <span className="flex-1" />
        <Busca
          rotulo="Buscar aluno, empresa ou curso"
          valor={busca}
          aoMudar={(v) => {
            setBusca(v);
            setPag(1);
          }}
        />
      </div>
      <Table>
        <THead>
          <Tr>
            <Th>Aluno ou empresa</Th>
            <Th>Curso</Th>
            <Th>Módulo ou turma</Th>
            <Th className="text-right">Parcela</Th>
            <Th>Vencimento</Th>
            <Th className="text-right">Valor</Th>
            <Th>Situação</Th>
            {d.podePagar && (
              <Th>
                <span className="sr-only">Pagamento</span>
              </Th>
            )}
          </Tr>
        </THead>
        <TBody>
          {fatia.length ? (
            fatia.map((c) => (
              <Tr key={c.key}>
                <Td className="font-medium whitespace-nowrap">
                  <Nome href={c.href}>{c.pagador}</Nome>
                </Td>
                <Td>{c.curso}</Td>
                <Td>{c.item}</Td>
                <Td className={num}>{c.parcela}</Td>
                <Td>{c.venc}</Td>
                <Td className={num}>{c.valor}</Td>
                <Td>
                  <Badge tom={c.situacao.tom}>{c.situacao.t}</Badge>
                </Td>
                {d.podePagar && (
                  <Td className="text-right">
                    {!c.pago && (
                      <Button
                        size="sm"
                        disabled={pagar.isPending}
                        onClick={() =>
                          pagar.mutate(c.key, {
                            onSuccess: (r) => setMsg({ txt: r.msg }),
                            onError: (e) => setMsg({ txt: e.message, erro: true }),
                          })
                        }
                      >
                        Registrar pagamento
                      </Button>
                    )}
                  </Td>
                )}
              </Tr>
            ))
          ) : (
            <Tr>
              <Td colSpan={d.podePagar ? 8 : 7} className="py-8 text-center text-apagado">
                nenhuma parcela nesta lista
              </Td>
            </Tr>
          )}
        </TBody>
      </Table>
      {rodape}
    </Card>
  );
}
