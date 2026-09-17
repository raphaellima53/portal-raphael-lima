'use client';

import { CheckIcon, PlusIcon, XIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Escolha } from '@/components/escolha';
import { usePaginacao } from '@/components/paginacao';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHead, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogBody, DialogContent, DialogFoot, DialogHead } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TBody, Td, THead, Th, Tr } from '@/components/ui/table';
import {
  type AlocCard,
  type Checagem,
  type CursosAba,
  type FichaResp,
  previaAlocacao,
  useAcaoAluno,
  useOpcoesAluno,
} from '@/lib/alunos';
import { cn } from '@/lib/utils';
import { ItemBadge, Modalidade, type Msg } from './comum';

const DIAS: [number, string][] = [
  [1, 'seg'],
  [2, 'ter'],
  [3, 'qua'],
  [4, 'qui'],
  [5, 'sex'],
  [6, 'sáb'],
];
const HORAS = Array.from({ length: 15 }, (_, k) => 7 + k);
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

type Ativa = CursosAba['ativas'][number];

/** Cursos da ficha: matrículas ativas e encerradas e, para quem tem o acesso, a alocação de cada uma. */
export function AbaCursos({ f, d, setMsg }: { f: FichaResp; d: CursosAba; setMsg: (m: Msg) => void }) {
  const acao = useAcaoAluno();
  const [mat, setMat] = useState<{ e: Ativa | null } | null>(null);
  const ativas = usePaginacao(d.ativas);
  const encerradas = usePaginacao(d.encerradas);
  const executa = (caminho: string) =>
    acao.mutate(
      { caminho: `/${f.id}${caminho}` },
      { onSuccess: (r) => setMsg({ txt: r.msg }), onError: (e) => setMsg({ txt: e.message, erro: true }) },
    );
  const op = f.pode.operar;

  return (
    <>
      <Card className="mb-4 overflow-hidden">
        <CardHead>
          <CardTitle>Matrículas ativas</CardTitle>
          <Badge tom="blue">{d.ativas.length}</Badge>
          <span className="flex-1" />
          {op && (
            <Button size="sm" variant="primary" onClick={() => setMat({ e: null })}>
              <PlusIcon /> Nova matrícula
            </Button>
          )}
        </CardHead>
        <Table>
          <THead>
            <Tr>
              <Th>Curso</Th>
              <Th>Módulo ou turma</Th>
              <Th>Modalidade</Th>
              <Th className="text-right">Aulas · usadas/total</Th>
              <Th className="text-right">Saldo</Th>
              <Th>Horário na grade</Th>
              {op && (
                <Th>
                  <span className="sr-only">Ações</span>
                </Th>
              )}
            </Tr>
          </THead>
          <TBody>
            {ativas.fatia.length ? (
              ativas.fatia.map((e) => (
                <Tr key={e.id}>
                  <Td className="font-medium">
                    {e.cursoId != null ? (
                      <Link href={`/cursos/${e.cursoId}/grade`} className="text-azul hover:underline">
                        {e.curso}
                      </Link>
                    ) : (
                      e.curso
                    )}
                  </Td>
                  <Td>
                    <ItemBadge item={e.item} />
                  </Td>
                  <Td>
                    <Modalidade m={e.modalidade} />
                  </Td>
                  <Td className="text-right tabular-nums">
                    {e.usadas}/{e.total}
                  </Td>
                  <Td className="text-right tabular-nums">{e.saldo.toLocaleString('pt-BR')}</Td>
                  <Td>
                    {e.horarios.length ? (
                      e.horarios.map((h) => (
                        <div key={h.txt} className="whitespace-nowrap">
                          {h.txt} · {h.prof ?? <span className="text-vermelho">sem professor</span>}
                        </div>
                      ))
                    ) : (
                      <span className="text-apagado">sem horário na grade</span>
                    )}
                  </Td>
                  {op && (
                    <Td>
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" onClick={() => setMat({ e })}>
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          disabled={acao.isPending}
                          onClick={() => executa(`/matriculas/${e.id}/encerrar`)}
                        >
                          Encerrar
                        </Button>
                      </div>
                    </Td>
                  )}
                </Tr>
              ))
            ) : (
              <Tr>
                <Td colSpan={7} className="py-8 text-center text-apagado-2">
                  {op ? 'nenhuma matrícula ativa — use Nova matrícula' : 'nenhuma matrícula ativa'}
                </Td>
              </Tr>
            )}
          </TBody>
        </Table>
        {ativas.rodape}
      </Card>

      {d.encerradas.length > 0 && (
        <Card className="mb-6 overflow-hidden">
          <CardHead>
            <CardTitle>Matrículas encerradas</CardTitle>
            <Badge>{d.encerradas.length}</Badge>
          </CardHead>
          <Table>
            <THead>
              <Tr>
                <Th>Curso</Th>
                <Th>Módulo ou turma</Th>
                <Th className="text-right">Aulas · usadas/total</Th>
                <Th>Encerrada em</Th>
                {op && (
                  <Th>
                    <span className="sr-only">Ações</span>
                  </Th>
                )}
              </Tr>
            </THead>
            <TBody>
              {encerradas.fatia.map((e) => (
                <Tr key={e.id}>
                  <Td className="font-medium text-texto">{e.curso}</Td>
                  <Td>
                    <ItemBadge item={e.item} />
                  </Td>
                  <Td className="text-right tabular-nums">
                    {e.usadas}/{e.total}
                  </Td>
                  <Td>{e.encerradaEm}</Td>
                  {op && (
                    <Td className="text-right">
                      <Button
                        size="sm"
                        disabled={acao.isPending}
                        onClick={() => executa(`/matriculas/${e.id}/reativar`)}
                      >
                        Reativar
                      </Button>
                    </Td>
                  )}
                </Tr>
              ))}
            </TBody>
          </Table>
          {encerradas.rodape}
        </Card>
      )}

      <h2 className="mt-8 mb-2 text-lg font-bold text-texto">Alocação de cada matrícula</h2>
      {d.alocacao ? (
        <>
          <p className="mb-4 max-w-[900px] text-apagado">
            Onde cada matrícula cai na grade. Turma e módulo em grupo têm horário próprio — troca-se a turma ou o
            módulo. Private FLOW e Alumni Black são individuais: professor, dias e hora são da matrícula e passam por
            disponibilidade e choque de agenda antes de salvar.
          </p>
          {d.alocacao.length ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {d.alocacao.map((c) =>
                c.ind ? <AlocIndividual key={c.mid} f={f} c={c} /> : <AlocGrupo key={c.mid} f={f} c={c} />,
              )}
            </div>
          ) : (
            <Card className="px-5 py-8 text-center text-apagado-2">
              sem matrícula ativa — matricule o aluno para alocar
            </Card>
          )}
        </>
      ) : (
        <p className="text-apagado">
          A alocação de cada matrícula — turma, horário e professor — fica com quem tem o acesso de alocação.
        </p>
      )}

      <MatriculaDialog f={f} abre={mat} aoFechar={() => setMat(null)} aoSalvo={(txt) => setMsg({ txt })} />
    </>
  );
}

function ChecagemLista({ l }: { l: Checagem }) {
  if (!l.length) return null;
  return (
    <ul className="mt-3 flex flex-col gap-1.5" aria-label="Checagem do horário">
      {l.map((x) => (
        <li key={x.txt} className={cn('flex items-center gap-2', x.ok ? 'text-verde' : 'text-vermelho')}>
          {x.ok ? <CheckIcon className="size-4 shrink-0" /> : <XIcon className="size-4 shrink-0" />}
          <span>{x.txt}</span>
        </li>
      ))}
    </ul>
  );
}

function Topo({ c }: { c: AlocCard }) {
  return (
    <CardHead className="flex-wrap">
      <i className="size-2.5 shrink-0 rounded-full" style={{ background: c.cor }} aria-hidden />
      <CardTitle>{c.curso}</CardTitle>
      {c.item && <ItemBadge item={c.item} />}
      <span className="flex-1" />
      <Modalidade m={c.modalidade} />
    </CardHead>
  );
}

const Retorno = ({ m }: { m: Msg }) =>
  m ? (
    <span role={m.erro ? 'alert' : 'status'} className={cn('font-medium', m.erro ? 'text-vermelho' : 'text-verde')}>
      {m.txt}
    </span>
  ) : null;

function AlocIndividual({ f, c }: { f: FichaResp; c: Extract<AlocCard, { ind: true }> }) {
  const acao = useAcaoAluno();
  const [prof, setProf] = useState(c.prof === '—' ? (c.profs[0] ?? '') : c.prof);
  const [hora, setHora] = useState(c.hora);
  const [dias, setDias] = useState<number[]>(c.dias);
  const [valor, setValor] = useState(c.valor != null ? String(c.valor) : '');
  const [checagem, setChecagem] = useState<Checagem>(c.checagem);
  const [m, setM] = useState<Msg>(null);
  const primeira = useRef(true);
  const op = f.pode.operar;

  /* a checagem acompanha o que se escolhe, antes de salvar */
  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    let vivo = true;
    previaAlocacao(f.id, c.mid, { prof, dias, hora })
      .then((r) => vivo && setChecagem(r.checagem))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [f.id, c.mid, prof, dias, hora]);

  const salvar = () =>
    acao.mutate(
      {
        caminho: `/${f.id}/matriculas/${c.mid}/alocacao`,
        method: 'PUT',
        json: {
          prof,
          dias,
          hora,
          ...(c.valor != null && valor !== '' ? { valor: Math.max(0, Math.round(Number(valor))) } : {}),
        },
      },
      { onSuccess: (r) => setM({ txt: r.msg }), onError: (e) => setM({ txt: e.message, erro: true }) },
    );
  const limpar = () =>
    acao.mutate(
      { caminho: `/${f.id}/matriculas/${c.mid}/alocacao`, method: 'DELETE' },
      { onSuccess: (r) => setM({ txt: r.msg }), onError: (e) => setM({ txt: e.message, erro: true }) },
    );

  return (
    <Card className="min-w-0">
      <Topo c={c} />
      <div className="px-5 py-4">
        <p className="mb-4 text-apagado">
          Aula individual: professor, dias e hora são desta matrícula.{' '}
          {c.gravada ? 'Alocação gravada na ficha.' : 'Ainda sem alocação gravada — valendo a sugestão da grade.'}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Professor</Label>
            <Escolha
              rotulo={`Professor de ${c.curso}`}
              destacar={false}
              disabled={!op || !c.profs.length}
              todos={c.profs.length ? undefined : 'nenhum professor habilitado'}
              valor={prof}
              aoMudar={setProf}
              opcoes={c.profs.map((x) => ({ v: x, l: x }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Hora</Label>
            <Escolha
              rotulo={`Hora da aula de ${c.curso}`}
              destacar={false}
              disabled={!op}
              valor={String(hora)}
              aoMudar={(v) => setHora(Number(v))}
              opcoes={HORAS.map((h) => ({ v: String(h), l: hh(h) }))}
            />
          </div>
          {c.valor != null && (
            <div className="grid gap-1.5">
              <Label htmlFor={`valor-${c.mid}`}>Valor hora/aula (R$)</Label>
              <Input
                id={`valor-${c.mid}`}
                type="number"
                min={0}
                disabled={!op}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
              <span className="text-apagado">fixo desta alocação; dá para mudar numa aula pela Agenda</span>
            </div>
          )}
          <fieldset className="grid gap-1.5 sm:col-span-2">
            <legend className="mb-1.5 font-semibold text-texto-2">Dias</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {DIAS.map(([d, l]) => {
                const id = `dia-${c.mid}-${d}`;
                return (
                  <div key={d} className="flex items-center gap-2">
                    <Checkbox
                      id={id}
                      disabled={!op}
                      checked={dias.includes(d)}
                      onCheckedChange={(v) => setDias(v ? [...dias, d].sort() : dias.filter((x) => x !== d))}
                    />
                    <Label htmlFor={id} className="font-normal">
                      {l}
                    </Label>
                  </div>
                );
              })}
            </div>
          </fieldset>
        </div>
        <ChecagemLista l={checagem} />
        {op && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="primary" disabled={acao.isPending} onClick={salvar}>
              Salvar alocação
            </Button>
            {c.gravada && (
              <Button size="sm" disabled={acao.isPending} onClick={limpar}>
                Voltar à sugestão da grade
              </Button>
            )}
            <Retorno m={m} />
          </div>
        )}
      </div>
    </Card>
  );
}

function AlocGrupo({ f, c }: { f: FichaResp; c: Extract<AlocCard, { ind: false }> }) {
  const acao = useAcaoAluno();
  const [item, setItem] = useState(c.item?.nome ?? '');
  const [m, setM] = useState<Msg>(null);
  const outro = c.eTurma ? 'outra turma' : 'outro módulo';
  const muda = () =>
    acao.mutate(
      { caminho: `/${f.id}/matriculas/${c.mid}/item`, json: { item } },
      { onSuccess: (r) => setM({ txt: r.msg }), onError: (e) => setM({ txt: e.message, erro: true }) },
    );
  const kv: [string, React.ReactNode][] = [
    [
      'Horário',
      c.horario ?? (
        <span key="h" className="text-vermelho">
          sem horário na grade
        </span>
      ),
    ],
    [
      'Professor',
      c.prof === '—' ? (
        <span key="p" className="text-vermelho">
          sem professor
        </span>
      ) : (
        (c.prof ?? '—')
      ),
    ],
    ['Sala', c.sala ?? '—'],
    ['Ocupação', c.ocupacao ?? '—'],
  ];
  return (
    <Card className="min-w-0">
      <Topo c={c} />
      <div className="px-5 py-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5">
          {kv.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-apagado">{k}</dt>
              <dd className="font-medium text-texto">{v}</dd>
            </div>
          ))}
        </dl>
        <ChecagemLista l={c.checagem} />
        {f.pode.operar && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Escolha
              rotulo={c.eTurma ? 'Turma' : 'Módulo'}
              destacar={false}
              valor={item}
              aoMudar={setItem}
              opcoes={c.opcoes.map((o) => ({ v: o.v, l: o.l, off: o.desabilitada }))}
              className="w-full max-w-[360px]"
            />
            <Button size="sm" disabled={acao.isPending || item === (c.item?.nome ?? '')} onClick={muda}>
              {c.eTurma ? 'Mudar de turma' : 'Mudar de módulo'}
            </Button>
            <Retorno m={m} />
            {item === (c.item?.nome ?? '') && !m && <span className="text-apagado">escolha {outro} na lista</span>}
          </div>
        )}
      </div>
    </Card>
  );
}

/** Nova matrícula e Editar matrícula: curso, módulo ou turma, modalidade das regras e pacote */
function MatriculaDialog({
  f,
  abre,
  aoFechar,
  aoSalvo,
}: {
  f: FichaResp;
  abre: { e: Ativa | null } | null;
  aoFechar: () => void;
  aoSalvo: (txt: string) => void;
}) {
  const op = useOpcoesAluno(!!abre);
  const acao = useAcaoAluno();
  const e = abre?.e ?? null;
  const [curso, setCurso] = useState('');
  const [item, setItem] = useState('');
  const [modalidade, setModalidade] = useState('Online');
  const [total, setTotal] = useState('');
  const [usadas, setUsadas] = useState('0');
  const [erro, setErro] = useState('');

  // biome-ignore lint/correctness/useExhaustiveDependencies: reinicia ao abrir
  useEffect(() => {
    if (!abre) return;
    setCurso(e?.curso ?? '');
    setItem(e?.item?.nome ?? '');
    setModalidade(e?.modalidade ?? 'Online');
    setTotal(e ? String(e.total) : '');
    setUsadas(e ? String(e.usadas) : '0');
    setErro('');
  }, [abre]);

  const c = op.data?.cursos.find((x) => x.nome === curso);
  const escolheCurso = (v: string) => {
    setCurso(v);
    const n = op.data?.cursos.find((x) => x.nome === v);
    setItem(n?.itens[0] ?? '');
    setModalidade(n?.modalidades[0] ?? 'Online');
    setTotal(n ? String(n.pacote) : '');
    setErro('');
  };
  const enviar = () => {
    if (!curso) return setErro('Escolha o curso.');
    if (c?.itens.length && !item) return setErro('Escolha o módulo ou a turma.');
    if (!(Number(total) > 0)) return setErro('Informe o pacote de aulas.');
    if (e && Number(usadas) > Number(total)) return setErro('Aulas usadas não podem passar do pacote.');
    acao.mutate(
      {
        caminho: e ? `/${f.id}/matriculas/${e.id}` : `/${f.id}/matriculas`,
        method: e ? 'PUT' : 'POST',
        json: { curso, item: item || null, modalidade, total: Number(total), usadas: Number(usadas) || 0 },
      },
      {
        onSuccess: (r) => {
          aoFechar();
          aoSalvo(r.msg);
        },
        onError: (x) => setErro(x.message),
      },
    );
  };

  return (
    <Dialog open={!!abre} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent tamanho="md">
        <DialogHead
          titulo={e ? 'Editar matrícula' : 'Nova matrícula'}
          descricao={f.nome + (e ? ` · ${e.curso}` : '')}
        />
        <DialogBody className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="mat-curso">Curso{!e && <span className="text-vermelho">*</span>}</Label>
            {e ? (
              <>
                <Input id="mat-curso" value={e.curso} readOnly />
                <span className="text-apagado">o curso não muda: encerre esta matrícula e abra outra</span>
              </>
            ) : (
              <Escolha
                rotulo="Curso"
                todos="escolha o curso"
                destacar={false}
                valor={curso}
                aoMudar={escolheCurso}
                opcoes={(op.data?.cursos ?? []).map((x) => ({ v: x.nome, l: x.nome }))}
              />
            )}
          </div>
          <div className="grid gap-1.5">
            <Label>{c?.estrutura === 'turmas' ? 'Turma' : 'Módulo ou turma'}</Label>
            <Escolha
              rotulo="Módulo ou turma"
              destacar={false}
              disabled={!c?.itens.length}
              todos={!c ? 'escolha o curso' : c.itens.length ? undefined : 'sem módulo nem turma'}
              valor={item}
              aoMudar={setItem}
              opcoes={(c?.itens ?? []).map((x) => ({ v: x, l: x }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Modalidade</Label>
            <Escolha
              rotulo="Modalidade"
              destacar={false}
              valor={modalidade}
              aoMudar={setModalidade}
              opcoes={(c?.modalidades ?? ['Online', 'Presencial']).map((x) => ({ v: x, l: x }))}
            />
            <span className="text-apagado">só as modalidades aceitas nas regras do curso</span>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="mat-total">
              Pacote de aulas<span className="text-vermelho">*</span>
            </Label>
            <Input id="mat-total" type="number" min={1} value={total} onChange={(x) => setTotal(x.target.value)} />
            {!e && <span className="text-apagado">vem do pacote padrão do curso</span>}
          </div>
          {e && (
            <div className="grid gap-1.5">
              <Label htmlFor="mat-usadas">Aulas usadas</Label>
              <Input id="mat-usadas" type="number" min={0} value={usadas} onChange={(x) => setUsadas(x.target.value)} />
            </div>
          )}
        </DialogBody>
        <DialogFoot>
          {erro && (
            <span role="alert" className="mr-auto font-medium text-vermelho">
              {erro}
            </span>
          )}
          <Button onClick={aoFechar}>Cancelar</Button>
          <Button variant="primary" disabled={acao.isPending} onClick={enviar}>
            {e ? 'Salvar' : 'Matricular'}
          </Button>
        </DialogFoot>
      </DialogContent>
    </Dialog>
  );
}
