'use client';

import { PlusIcon } from 'lucide-react';
import { useState } from 'react';
import type { Msg } from '@/components/alunos/comum';
import { Aviso, PageHead, Stat } from '@/components/ds';
import { Button } from '@/components/ui/button';
import { Card, CardHead, CardTitle } from '@/components/ui/card';
import { Table, TBody, Td, THead, Th, Tr } from '@/components/ui/table';
import { useAtvDash, useAtvOpcoes } from '@/lib/atividades';
import { cn } from '@/lib/utils';
import { DialogoAtividade } from './dialogo';

const Num = ({ n, vermelho }: { n: number; vermelho?: boolean }) => (
  <span className={cn('tabular-nums', vermelho && n > 0 && 'font-semibold text-vermelho')}>{n}</span>
);

/** Atividades › Dashboard › Visão geral: totais, por setor, por responsável, próximos prazos e últimas movimentações */
export function TelaDashAtividades({ abas }: { abas: React.ReactNode }) {
  const q = useAtvDash();
  const op = useAtvOpcoes();
  const [msg, setMsg] = useState<Msg>(null);
  const [aberto, setAberto] = useState<{ id: number | null } | null>(null);
  const d = q.data;
  return (
    <>
      <PageHead
        titulo="Visão geral das atividades"
        acoes={
          op.data?.podeOperar ? (
            <Button variant="primary" onClick={() => setAberto({ id: null })}>
              <PlusIcon /> Nova atividade
            </Button>
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
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Stat valor={d.stats.abertas} rotulo="abertas" />
            <Stat valor={d.stats.andamento} rotulo="em andamento" tom="blue" />
            <Stat valor={d.stats.atrasadas} rotulo="atrasadas" tom={d.stats.atrasadas ? 'red' : undefined} />
            <Stat valor={d.stats.hoje} rotulo="vencem hoje" tom={d.stats.hoje ? 'amber' : undefined} />
            <Stat valor={d.stats.concluidas} rotulo="concluídas em 30 dias" tom="green" />
            <Stat valor={d.stats.naoRealizadas} rotulo="não realizadas em 30 dias" />
          </div>
          <div className="mb-4 grid gap-4 xl:grid-cols-[3fr_2fr]">
            <Card className="overflow-hidden">
              <CardHead>
                <CardTitle>Por setor</CardTitle>
              </CardHead>
              <Table aria-label="Atividades por setor">
                <THead>
                  <Tr>
                    <Th>Setor</Th>
                    <Th className="text-right">A fazer</Th>
                    <Th className="text-right">Em andamento</Th>
                    <Th className="text-right">Atrasadas</Th>
                    <Th className="text-right">Concluídas</Th>
                    <Th className="text-right">Não realizadas</Th>
                  </Tr>
                </THead>
                <TBody>
                  {d.porSetor.map((s) => (
                    <Tr key={s.setor}>
                      <Td className="font-medium text-texto">{s.setor}</Td>
                      <Td className="text-right">
                        <Num n={s.afazer} />
                      </Td>
                      <Td className="text-right">
                        <Num n={s.andamento} />
                      </Td>
                      <Td className="text-right">
                        <Num n={s.atrasadas} vermelho />
                      </Td>
                      <Td className="text-right">
                        <Num n={s.concluidas} />
                      </Td>
                      <Td className="text-right">
                        <Num n={s.naoRealizadas} />
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </Card>
            <Card className="overflow-hidden">
              <CardHead>
                <CardTitle>Por responsável</CardTitle>
              </CardHead>
              <Table aria-label="Atividades abertas por responsável">
                <THead>
                  <Tr>
                    <Th>Responsável</Th>
                    <Th className="text-right">Abertas</Th>
                    <Th className="text-right">Atrasadas</Th>
                  </Tr>
                </THead>
                <TBody>
                  {d.porResponsavel.map((r) => (
                    <Tr key={r.nome}>
                      <Td className={cn('font-medium', r.nome === 'Sem responsável' ? 'text-apagado' : 'text-texto')}>
                        {r.nome}
                      </Td>
                      <Td className="text-right">
                        <Num n={r.abertas} />
                      </Td>
                      <Td className="text-right">
                        <Num n={r.atrasadas} vermelho />
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </Card>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="overflow-hidden">
              <CardHead>
                <CardTitle>Próximos prazos</CardTitle>
                <span className="ml-auto text-apagado">atrasadas primeiro</span>
              </CardHead>
              <Table aria-label="Próximos prazos">
                <THead>
                  <Tr>
                    <Th>Prazo</Th>
                    <Th>Atividade</Th>
                    <Th>Setor</Th>
                    <Th>Responsável</Th>
                  </Tr>
                </THead>
                <TBody>
                  {d.proximos.map((c) => (
                    <Tr key={c.id}>
                      <Td className={cn('whitespace-nowrap', c.atrasada && 'font-semibold text-vermelho')}>
                        {c.prazoIso.split('-').reverse().join('/')} {c.prazoHora}
                      </Td>
                      <Td>
                        <button
                          type="button"
                          className="text-left font-medium text-azul hover:underline"
                          onClick={() => setAberto({ id: c.id })}
                        >
                          {c.titulo}
                        </button>
                      </Td>
                      <Td>{c.setor}</Td>
                      <Td>{c.responsavel || <span className="text-apagado">sem responsável</span>}</Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </Card>
            <Card className="overflow-hidden">
              <CardHead>
                <CardTitle>Últimas movimentações</CardTitle>
              </CardHead>
              <Table aria-label="Últimas movimentações">
                <THead>
                  <Tr>
                    <Th>Quando</Th>
                    <Th>Atividade</Th>
                    <Th>O que mudou</Th>
                    <Th>Quem</Th>
                  </Tr>
                </THead>
                <TBody>
                  {d.ultimas.length ? (
                    d.ultimas.map((u, i) => (
                      <Tr key={i}>
                        <Td className="whitespace-nowrap">{u.quando}</Td>
                        <Td>
                          <button
                            type="button"
                            className="text-left font-medium text-azul hover:underline"
                            onClick={() => setAberto({ id: u.id })}
                          >
                            {u.titulo}
                          </button>
                        </Td>
                        <Td>
                          {u.acao}
                          {u.det && <span className="block text-apagado">{u.det}</span>}
                        </Td>
                        <Td>{u.quem}</Td>
                      </Tr>
                    ))
                  ) : (
                    <Tr>
                      <Td colSpan={4} className="py-6 text-center text-apagado">
                        ninguém mexeu nas atividades ainda
                      </Td>
                    </Tr>
                  )}
                </TBody>
              </Table>
            </Card>
          </div>
        </>
      )}
      {op.data && (
        <DialogoAtividade
          op={op.data}
          aberto={!!aberto}
          id={aberto?.id ?? null}
          aoFechar={() => setAberto(null)}
          aoSalvo={(txt) => setMsg({ txt })}
        />
      )}
    </>
  );
}
