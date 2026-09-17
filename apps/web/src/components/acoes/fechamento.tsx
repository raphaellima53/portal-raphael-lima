'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { Msg } from '@/components/alunos/comum';
import { Aviso, PageHead } from '@/components/ds';
import { Escolha } from '@/components/escolha';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogBody, DialogContent, DialogFoot, DialogHead } from '@/components/ui/dialog';
import { Table, TBody, Td, THead, Th, Tr } from '@/components/ui/table';
import { useAcao, useAulasFolha, useFechamento } from '@/lib/acoes';
import type { Tom } from '@/lib/tipos';
import { cn } from '@/lib/utils';
import { Busca, normaliza } from './alocacao';

const TOM_FOLHA: Record<string, Tom> = { 'b-green': 'green', 'b-red': 'red', 'b-amber': 'amber', 'b-gray': 'gray' };
const tomDe = (c: string): Tom => TOM_FOLHA[c] ?? (c as Tom);

/** Administrativo › Fechamento: a folha da competência lida da agenda, com fechar e reabrir */
export function TelaFechamento({ abas }: { abas: React.ReactNode }) {
  const sp = useSearchParams();
  const caminho = usePathname();
  const router = useRouter();
  const mes = sp.get('mes') ?? '';
  const q = useFechamento(mes);
  const acao = useAcao();
  const [msg, setMsg] = useState<Msg>(null);
  const [busca, setBusca] = useState('');
  const [prof, setProf] = useState<string | null>(null);
  const d = q.data;

  const faz = (caminhoAcao: string) =>
    acao.mutate(
      { caminho: caminhoAcao },
      { onSuccess: (r) => setMsg({ txt: r.msg }), onError: (e) => setMsg({ txt: e.message, erro: true }) },
    );
  const linhas = (d?.linhas ?? []).filter((p) => !busca || normaliza(p.nome).includes(normaliza(busca)));

  return (
    <>
      <PageHead
        titulo="Fechamento"
        acoes={
          d?.podeOperar ? (
            d.fechada ? (
              <Button disabled={acao.isPending} onClick={() => faz(`/fechamento/${d.ym}/reabrir`)}>
                Reabrir competência
              </Button>
            ) : (
              <Button
                variant="primary"
                disabled={acao.isPending || d.parcial || d.naoFin > 0}
                onClick={() => faz(`/fechamento/${d.ym}/fechar`)}
              >
                Fechar competência
              </Button>
            )
          ) : null
        }
      />
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
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Escolha
                rotulo="Competência"
                destacar={false}
                valor={d.ym}
                aoMudar={(v) => {
                  setMsg(null);
                  router.push(`${caminho}?mes=${v}`, { scroll: false });
                }}
                opcoes={d.meses}
                className="w-[220px]"
              />
              <Badge tom={d.situacao.tom}>{d.situacao.t}</Badge>
            </div>
            <Busca rotulo="Buscar professor" valor={busca} aoMudar={setBusca} />
          </div>
          <Aviso tom="blue" icone="info">
            Entram todas as alocações dadas no mês. <b>Aula com presença e aula com falta do aluno são pagas</b>; aula
            em que o professor <b>pediu suporte é descontada</b>; não finalizada fica pendente. Alumni Black paga o
            valor hora/aula da alocação (ou o alterado na aula); os demais cursos, o valor hora do professor.
          </Aviso>
          {d.fechada ? (
            <Aviso icone="ok">{d.fechada.txt}</Aviso>
          ) : d.parcial ? (
            <Aviso icone="info">
              {d.rotulo} está em andamento: as aulas vão até hoje e a competência só fecha depois do último dia do mês.
            </Aviso>
          ) : d.naoFin ? (
            <Aviso tom="amber" icone="trava">
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex-1">
                  {d.naoFin} {d.naoFin === 1 ? 'aula não finalizada trava' : 'aulas não finalizadas travam'} o
                  fechamento de {d.rotulo}.
                </span>
                <Button asChild size="sm">
                  <Link href="/agenda?vista=kanban&periodo=mes&qual=naoFin">Ver no Kanban</Link>
                </Button>
              </div>
            </Aviso>
          ) : null}
          <Card className="overflow-hidden">
            <Table>
              <THead>
                <Tr>
                  <Th>Professor</Th>
                  <Th className="text-right">Aulas pagas</Th>
                  <Th className="text-right">Com presença</Th>
                  <Th className="text-right">Com falta</Th>
                  <Th className="text-right">Descontadas · suporte</Th>
                  <Th className="text-right">Não finalizadas</Th>
                  <Th className="text-right">Horas</Th>
                  <Th className="text-right">Bruto</Th>
                  <Th className="text-right">Descontos</Th>
                  <Th className="text-right">A pagar</Th>
                  <Th>
                    <span className="sr-only">Aulas</span>
                  </Th>
                </Tr>
              </THead>
              <TBody>
                {linhas.length ? (
                  linhas.map((p) => (
                    <Tr key={p.nome}>
                      <Td className="font-medium whitespace-nowrap">
                        {p.profId ? (
                          <Link
                            href={`/professores/${p.profId}/agenda?quando=passadas`}
                            className="text-azul hover:underline"
                          >
                            {p.nome}
                          </Link>
                        ) : (
                          p.nome
                        )}
                      </Td>
                      <Td className="text-right tabular-nums">{p.pagas}</Td>
                      <Td className="text-right tabular-nums">{p.presenca}</Td>
                      <Td className="text-right tabular-nums">{p.falta || '—'}</Td>
                      <Td className={cn('text-right tabular-nums', p.descontadas && 'font-bold text-vermelho')}>
                        {p.descontadas || '—'}
                      </Td>
                      <Td className={cn('text-right tabular-nums', p.pendentes && 'font-bold text-ambar')}>
                        {p.pendentes || '—'}
                      </Td>
                      <Td className="text-right whitespace-nowrap tabular-nums">{p.horas}</Td>
                      <Td className="text-right whitespace-nowrap tabular-nums">{p.bruto}</Td>
                      <Td
                        className={cn(
                          'text-right whitespace-nowrap tabular-nums',
                          p.desconto !== '—' && 'text-vermelho',
                        )}
                      >
                        {p.desconto}
                      </Td>
                      <Td className="text-right font-bold whitespace-nowrap tabular-nums text-texto">{p.liquido}</Td>
                      <Td className="text-right">
                        <Button size="sm" onClick={() => setProf(p.nome)}>
                          Ver aulas
                        </Button>
                      </Td>
                    </Tr>
                  ))
                ) : (
                  <Tr>
                    <Td colSpan={11} className="py-10 text-center text-apagado-2">
                      nenhuma aula dada nesta competência
                    </Td>
                  </Tr>
                )}
                {d.total && !busca && (
                  <Tr className="bg-bg font-bold">
                    <Td className="text-texto">Total</Td>
                    <Td className="text-right tabular-nums">{d.total.pagas}</Td>
                    <Td className="text-right tabular-nums">{d.total.presenca}</Td>
                    <Td className="text-right tabular-nums">{d.total.falta}</Td>
                    <Td className="text-right tabular-nums">{d.total.descontadas}</Td>
                    <Td className="text-right tabular-nums">{d.total.pendentes}</Td>
                    <Td className="text-right whitespace-nowrap tabular-nums">{d.total.horas}</Td>
                    <Td className="text-right whitespace-nowrap tabular-nums">{d.total.bruto}</Td>
                    <Td className="text-right whitespace-nowrap tabular-nums">{d.total.desconto}</Td>
                    <Td className="text-right whitespace-nowrap tabular-nums text-texto">{d.total.liquido}</Td>
                    <Td />
                  </Tr>
                )}
              </TBody>
            </Table>
          </Card>
          <AulasDialog mes={d.ym} prof={prof} aoFechar={() => setProf(null)} />
        </>
      )}
    </>
  );
}

function AulasDialog({ mes, prof, aoFechar }: { mes: string; prof: string | null; aoFechar: () => void }) {
  const q = useAulasFolha(mes, prof);
  const d = q.data;
  return (
    <Dialog open={!!prof} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent tamanho="lg">
        <DialogHead titulo={d?.titulo ?? `Aulas de ${prof ?? ''}`} descricao={d?.sub} />
        <DialogBody className="p-0">
          <Table>
            <THead>
              <Tr>
                <Th>Quando</Th>
                <Th>Aula</Th>
                <Th>Aluno</Th>
                <Th>Situação na folha</Th>
                <Th className="text-right">Valor</Th>
              </Tr>
            </THead>
            <TBody>
              {(d?.aulas ?? []).map((a) => (
                <Tr key={a.k}>
                  <Td className="font-medium whitespace-nowrap">
                    <Link href={`/agenda/aula?k=${encodeURIComponent(a.k)}`} className="text-azul hover:underline">
                      {a.quando}
                    </Link>
                  </Td>
                  <Td>
                    {a.aula}
                    {a.noLugar && <div className="text-apagado">no lugar de {a.noLugar}</div>}
                  </Td>
                  <Td>{a.presenca}</Td>
                  <Td>
                    <Badge tom={tomDe(a.situacao[1])}>{a.situacao[0]}</Badge>
                    {a.suporte && <div className="mt-1 text-apagado">{a.suporte}</div>}
                  </Td>
                  <Td className="text-right whitespace-nowrap tabular-nums">
                    {a.valor}
                    {a.marca && <div className="text-apagado">{a.marca}</div>}
                  </Td>
                </Tr>
              ))}
              {q.isPending && (
                <Tr>
                  <Td colSpan={5} className="py-8 text-center text-apagado">
                    Carregando…
                  </Td>
                </Tr>
              )}
            </TBody>
          </Table>
        </DialogBody>
        <DialogFoot>
          <span className="mr-auto text-apagado">abra uma aula para registrar presença, suporte ou valor</span>
          <Button onClick={aoFechar}>Fechar</Button>
        </DialogFoot>
      </DialogContent>
    </Dialog>
  );
}
