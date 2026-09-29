'use client';

import { AlertTriangleIcon, ArrowDownIcon, ArrowUpIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Stats } from '@/components/cursos/abas-curso';
import { ModuloDialog } from '@/components/cursos/curso-form';
import { nomeCurto } from '@/components/cursos/grade-modulo';
import { Aviso } from '@/components/ds';
import { usePaginacao } from '@/components/paginacao';
import { Button } from '@/components/ui/button';
import { Card, CardHead, CardTitle } from '@/components/ui/card';
import { Dialog, DialogBody, DialogContent, DialogFoot, DialogHead } from '@/components/ui/dialog';
import { Table, TBody, Td, THead, Th, Tr } from '@/components/ui/table';
import { corLegivel } from '@/lib/cor';
import { type CursoResp, type ModulosAba, useExcluirModulo, useOrdemModulos } from '@/lib/cursos';

/**
 * Aba Módulos do curso Open-Entry (24/09/2026): cada módulo com CEFR, vagas, regras de agenda, grade (professor por
 * horário), alunos e currículo; Novo módulo, Editar, Excluir (só o Admin, vai para a Lixeira) e subir/descer na ordem.
 */
export function AbaModulos({ c, d, aoMsg }: { c: CursoResp; d: ModulosAba; aoMsg: (m: string) => void }) {
  const [editar, setEditar] = useState<{ nome: string | null } | null>(null);
  const [excluir, setExcluir] = useState<string | null>(null);
  const ordem = useOrdemModulos(c.id);
  const { fatia, rodape } = usePaginacao(d.modulos);
  const pode = c.pode.editar;
  const nomes = d.modulos.map((m) => m.nome);
  const move = (i: number, passo: -1 | 1) => {
    const l = [...nomes];
    [l[i], l[i + passo]] = [l[i + passo], l[i]];
    ordem.mutate(l, { onSuccess: () => aoMsg(`${nomes[i]} foi para a posição ${i + passo + 1}.`) });
  };
  const volta = `/cursos/${c.id}/modulos`;

  return (
    <>
      <Stats s={d.stats} />
      {ordem.isError && (
        <Aviso tom="red" icone="alerta">
          {ordem.error.message}
        </Aviso>
      )}
      <Card className="overflow-hidden">
        <CardHead>
          <CardTitle>Módulos</CardTitle>
          {pode && (
            <Button variant="primary" className="ml-auto" onClick={() => setEditar({ nome: null })}>
              <PlusIcon /> Novo módulo
            </Button>
          )}
        </CardHead>
        {d.modulos.length ? (
          <>
            <Table>
              <THead>
                <Tr>
                  <Th>Ordem</Th>
                  <Th>Módulo</Th>
                  <Th>Regras de agenda</Th>
                  <Th>Grade</Th>
                  <Th className="text-right">Alunos</Th>
                  <Th>Currículo</Th>
                  {pode && (
                    <Th>
                      <span className="sr-only">Ações</span>
                    </Th>
                  )}
                </Tr>
              </THead>
              <TBody>
                {fatia.map((m) => {
                  const i = nomes.indexOf(m.nome);
                  return (
                    <Tr key={m.nome}>
                      <Td>
                        <div className="flex items-center gap-1">
                          <span className="w-6 text-right tabular-nums">{i + 1}</span>
                          {pode && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Subir ${m.nome}`}
                                disabled={i === 0 || ordem.isPending}
                                onClick={() => move(i, -1)}
                              >
                                <ArrowUpIcon />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Descer ${m.nome}`}
                                disabled={i === nomes.length - 1 || ordem.isPending}
                                onClick={() => move(i, 1)}
                              >
                                <ArrowDownIcon />
                              </Button>
                            </>
                          )}
                        </div>
                      </Td>
                      <Td>
                        <span
                          className="inline-flex h-[26px] items-center rounded-full px-2.5 font-semibold"
                          style={{ background: `${corLegivel(m.cor)}1f`, color: corLegivel(m.cor) }}
                        >
                          {m.nome}
                        </span>
                        <span className="mt-1 block text-apagado">
                          {[m.sigla, m.cefr || 'sem CEFR', m.vagas ? `${m.vagas} vagas por aula` : 'vagas do curso']
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </Td>
                      <Td className="whitespace-nowrap">
                        {m.agendamento ? `agendar até ${m.agendamento} antes` : 'agendar: regra do curso'}
                        <span className="block text-apagado">
                          {m.cancelamento ? `cancelar até ${m.cancelamento} antes` : 'cancelar: regra do curso'}
                        </span>
                      </Td>
                      <Td className="min-w-[220px]">
                        {m.horarios.length ? (
                          <div className="flex flex-wrap gap-1">
                            {m.horarios.map((h) =>
                              h.prof ? (
                                <span
                                  key={h.txt}
                                  className="inline-flex h-6 items-center rounded-[5px] bg-azul-suave px-1.5 text-sm font-medium text-azul"
                                >
                                  {h.txt} · {nomeCurto(h.prof)}
                                </span>
                              ) : (
                                <span
                                  key={h.txt}
                                  className="inline-flex h-6 items-center gap-1 rounded-[5px] border border-[#f1d9a6] bg-ambar-suave px-1.5 text-sm font-medium text-texto"
                                >
                                  <AlertTriangleIcon className="size-3.5 text-ambar" aria-hidden />
                                  {h.txt} · sem professor
                                </span>
                              ),
                            )}
                          </div>
                        ) : (
                          <span className="text-apagado">sem grade no módulo</span>
                        )}
                      </Td>
                      <Td className="text-right tabular-nums">{m.alunos}</Td>
                      <Td>
                        {m.curriculo ? (
                          <Link
                            href={`/cursos/curriculos/${m.curriculo.id}?volta=${encodeURIComponent(volta)}`}
                            className="font-semibold text-azul hover:underline"
                          >
                            {m.curriculo.nome}
                          </Link>
                        ) : (
                          <span className="text-apagado">sem currículo</span>
                        )}
                      </Td>
                      {pode && (
                        <Td className="text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Editar ${m.nome}`}
                            onClick={() => setEditar({ nome: m.nome })}
                          >
                            <PencilIcon />
                          </Button>
                          {c.pode.excluir && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Excluir ${m.nome}`}
                              onClick={() => setExcluir(m.nome)}
                            >
                              <Trash2Icon />
                            </Button>
                          )}
                        </Td>
                      )}
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
            {rodape}
          </>
        ) : (
          <div className="px-5 py-10 text-center text-apagado">
            nenhum módulo ainda{pode ? ' — use Novo módulo para criar o primeiro' : ''}
          </div>
        )}
      </Card>

      <ModuloDialog
        aberto={!!editar}
        aoFechar={() => setEditar(null)}
        cursoId={c.id}
        curso={c.form}
        nome={editar?.nome ?? null}
        aoSalvo={aoMsg}
      />
      <ExcluirModulo cursoId={c.id} nome={excluir} aoFechar={() => setExcluir(null)} aoMsg={aoMsg} />
    </>
  );
}

function ExcluirModulo({
  cursoId,
  nome,
  aoFechar,
  aoMsg,
}: {
  cursoId: number;
  nome: string | null;
  aoFechar: () => void;
  aoMsg: (m: string) => void;
}) {
  const excluir = useExcluirModulo(cursoId);
  const fecha = () => {
    excluir.reset();
    aoFechar();
  };
  return (
    <Dialog open={!!nome} onOpenChange={(v) => !v && fecha()}>
      <DialogContent>
        <DialogHead titulo={`Excluir ${nome ?? ''}?`} descricao="Módulo · vai para Configurações › Lixeira" />
        <DialogBody>
          <p className="m-0">
            O módulo e a grade dele saem da Agenda. Matrículas, currículos e professores continuam com o nome do módulo
            e voltam a valer se ele for restaurado da Lixeira.
          </p>
        </DialogBody>
        <DialogFoot>
          {excluir.isError && (
            <span role="alert" className="mr-auto font-medium text-vermelho">
              {excluir.error.message}
            </span>
          )}
          <Button type="button" onClick={fecha}>
            Cancelar
          </Button>
          <Button
            variant="perigo"
            disabled={excluir.isPending}
            onClick={() =>
              nome &&
              excluir.mutate(nome, {
                onSuccess: (r) => {
                  fecha();
                  aoMsg(r.msg);
                },
              })
            }
          >
            Mover para a Lixeira
          </Button>
        </DialogFoot>
      </DialogContent>
    </Dialog>
  );
}
