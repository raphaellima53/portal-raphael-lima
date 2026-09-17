'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { EllipsisIcon, PencilIcon, PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Aviso, Stat } from '@/components/ds';
import { usePaginacao } from '@/components/paginacao';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHead, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TBody, Td, THead, Th, Tr } from '@/components/ui/table';
import {
  type AlunoRoster,
  type CurRef,
  type CurriculoAba,
  type CursoResp,
  type Geral,
  type Grade,
  type Regras,
  useSalvarRegras,
} from '@/lib/cursos';
import { cn } from '@/lib/utils';

const TOM_SIT: Record<string, 'green' | 'amber' | 'red' | 'gray'> = {
  Ativo: 'green',
  Suspenso: 'amber',
  Congelado: 'amber',
  Inadimplente: 'red',
  Cancelado: 'red',
  Inativo: 'gray',
};

export const Stats = ({
  s,
}: {
  s: { valor: string; rotulo: string; tom?: 'red' | 'amber' | 'green' | 'blue' | 'purple' | 'gray' }[];
}) => (
  <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
    {s.map((x) => (
      <Stat key={x.rotulo} valor={x.valor} rotulo={x.rotulo} tom={x.tom} />
    ))}
  </div>
);

const LinkCur = ({ c, volta }: { c: CurRef; volta: string }) =>
  c ? (
    <Link
      href={`/cursos/curriculos/${c.id}?volta=${encodeURIComponent(volta)}`}
      className="font-semibold text-azul hover:underline"
    >
      {c.nome}
    </Link>
  ) : (
    <span className="text-apagado">—</span>
  );

const Modalidade = ({ m }: { m: string }) => (
  <Badge tom={m === 'Presencial' ? 'purple' : 'gray'}>{m || 'Online'}</Badge>
);

function Roster({ titulo, lista, vazio }: { titulo: string; lista: AlunoRoster[]; vazio: string }) {
  const { fatia, rodape } = usePaginacao(lista);
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHead>
        <CardTitle>{titulo}</CardTitle>
        <Badge tom="blue">{lista.length}</Badge>
      </CardHead>
      <Table>
        <THead>
          <Tr>
            <Th>Aluno</Th>
            <Th className="text-right">Aulas · usadas/total</Th>
            <Th>Modalidade</Th>
            <Th>Situação</Th>
            <Th>
              <span className="sr-only">Abrir</span>
            </Th>
          </Tr>
        </THead>
        <TBody>
          {fatia.length ? (
            fatia.map((a, i) => (
              <Tr key={`${a.alunoId}-${i}`}>
                <Td className="font-medium text-texto">{a.nome}</Td>
                <Td className="text-right tabular-nums">
                  {a.usadas}/{a.total}
                </Td>
                <Td>
                  <Modalidade m={a.modalidade} />
                </Td>
                <Td>
                  <Badge tom={TOM_SIT[a.situacao] ?? 'gray'}>{a.situacao}</Badge>
                </Td>
                <Td className="text-right">
                  <Button asChild variant="ghost" size="icon-sm" aria-label={`Abrir a ficha de ${a.nome}`}>
                    <Link href={`/alunos/${a.alunoId}/perfil`}>
                      <EllipsisIcon />
                    </Link>
                  </Button>
                </Td>
              </Tr>
            ))
          ) : (
            <Tr>
              <Td colSpan={5} className="py-7 text-center text-apagado-2">
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

/* ---------------- Visão geral ---------------- */
export function AbaGeral({ c, g, editar }: { c: CursoResp; g: Geral; editar: () => void }) {
  const volta = `/cursos/${c.id}/geral`;
  const [turma, setTurma] = useState(0);
  const profs = (
    <Card className="mt-4 px-5 py-[18px]">
      <h2 className="text-lg font-bold">Professores habilitados · {g.profs.length}</h2>
      <p className="mb-2.5 text-apagado">
        Quem pode ministrar aulas deste curso. A habilitação se edita na ficha de cada professor.
      </p>
      <div className="flex flex-wrap gap-2">
        {g.profs.length ? (
          g.profs.map((p) => (
            <Link
              key={p.id}
              href={`/professores/${p.id}/cursos`}
              className="inline-flex h-9 items-center rounded-full bg-[#eceff5] px-3.5 text-[#4b5568] transition-shadow hover:bg-card hover:shadow-el-2 dark:bg-hover dark:text-texto-2"
            >
              {p.nome}
              {p.recorte ? ` · ${p.recorte}` : ''}
            </Link>
          ))
        ) : (
          <span className="text-apagado">nenhum professor habilitado</span>
        )}
      </div>
    </Card>
  );

  if (g.estrutura === 'turmas') {
    const t = g.turmas[Math.min(turma, g.turmas.length - 1)];
    return (
      <>
        <Stats s={g.stats} />
        <Card className="overflow-hidden">
          <CardHead>
            <CardTitle>Turmas</CardTitle>
            <Badge tom="blue">{g.turmas.length}</Badge>
            <span className="flex-1" />
            {c.pode.editar && (
              <Button size="sm" variant="primary" onClick={editar}>
                <PlusIcon /> Nova turma
              </Button>
            )}
          </CardHead>
          <Table>
            <THead>
              <Tr>
                {['#', 'Turma', 'Grupo', 'Professor', 'Grade', 'Sala', 'Modalidade'].map((x) => (
                  <Th key={x}>{x}</Th>
                ))}
                <Th className="text-right">Vagas</Th>
              </Tr>
            </THead>
            <TBody>
              {g.turmas.map((x, j) => (
                <Tr
                  key={x.nome}
                  tabIndex={0}
                  aria-selected={x === t}
                  onClick={() => setTurma(j)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return;
                    e.preventDefault();
                    setTurma(j);
                  }}
                  className={cn('cursor-pointer hover:bg-hover', x === t && 'bg-azul-suave/60')}
                >
                  <Td>{x.n}</Td>
                  <Td className="font-semibold text-texto">{x.nome}</Td>
                  <Td>{x.grupo}</Td>
                  <Td>{x.professor}</Td>
                  <Td>{x.grade}</Td>
                  <Td>{x.sala}</Td>
                  <Td>
                    <Modalidade m={x.modalidade} />
                  </Td>
                  <Td className="text-right tabular-nums">
                    {x.ocupadas}/{x.vagas}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </Card>
        {t && (
          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <Card className="px-5 py-[18px]">
              <h2 className="text-lg font-bold">
                {t.nome} · {c.nome}
              </h2>
              <p className="mb-3 text-apagado">{t.grupo}</p>
              <dl className="grid grid-cols-[110px_1fr] gap-x-4 gap-y-2">
                <dt className="text-apagado">Período</dt>
                <dd>{t.periodo}</dd>
                <dt className="text-apagado">Grade</dt>
                <dd>{t.grade}</dd>
                <dt className="text-apagado">Professor</dt>
                <dd>{t.professor}</dd>
                <dt className="text-apagado">Sala</dt>
                <dd>
                  {t.sala} · {t.modalidade}
                </dd>
                <dt className="text-apagado">Vagas</dt>
                <dd>
                  {t.ocupadas} ocupadas de {t.vagas} contratadas
                </dd>
                <dt className="text-apagado">Currículo</dt>
                <dd>
                  <LinkCur c={t.curriculo} volta={volta} />
                </dd>
              </dl>
            </Card>
            <Roster
              key={t.nome}
              titulo={`Alunos com matrícula · ${t.nome}`}
              lista={t.alunos}
              vazio="nenhum aluno desta turma tem matrícula no portal ainda"
            />
          </div>
        )}
        {profs}
      </>
    );
  }
  if (g.estrutura === 'modulos') {
    return (
      <>
        <Stats s={g.stats} />
        <div className="grid items-start gap-4 xl:grid-cols-2">
          <Card className="min-w-0 overflow-hidden">
            <CardHead>
              <CardTitle>Módulos</CardTitle>
              <Badge tom="blue">{g.modulos.length}</Badge>
              <span className="flex-1" />
              {c.pode.editar && (
                <Button size="sm" onClick={editar}>
                  <PencilIcon /> Editar módulos
                </Button>
              )}
            </CardHead>
            <Table>
              <THead>
                <Tr>
                  <Th>#</Th>
                  <Th>Módulo</Th>
                  <Th className="text-right">Alunos</Th>
                  <Th className="text-right">Presenciais</Th>
                  <Th>Currículo</Th>
                </Tr>
              </THead>
              <TBody>
                {g.modulos.map((m) => (
                  <Tr key={m.nome}>
                    <Td>{m.n}</Td>
                    <Td>
                      <span
                        className="inline-flex h-[26px] items-center rounded-full px-2.5 font-semibold"
                        style={{ background: `${m.cor}1f`, color: m.cor }}
                      >
                        {m.nome}
                      </span>
                    </Td>
                    <Td className="text-right tabular-nums">{m.alunos}</Td>
                    <Td className="text-right tabular-nums">{m.presenciais}</Td>
                    <Td>
                      <LinkCur c={m.curriculo} volta={volta} />
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </Card>
          <Roster titulo="Alunos do produto" lista={g.alunos} vazio="nenhum aluno com matrícula ativa neste produto" />
        </div>
        {profs}
      </>
    );
  }
  return (
    <>
      <Stats s={g.stats} />
      <Card className="mb-4 px-5 py-4">
        <dl className="grid grid-cols-[110px_1fr] gap-x-4 gap-y-2">
          <dt className="text-apagado">Estrutura</dt>
          <dd>sem módulos nem turmas — cada matrícula é um contrato particular</dd>
          <dt className="text-apagado">Currículo</dt>
          <dd>
            <LinkCur c={g.curriculo} volta={volta} />
          </dd>
        </dl>
      </Card>
      <Roster titulo="Alunos do produto" lista={g.alunos} vazio="nenhum aluno com matrícula ativa neste produto" />
      {profs}
    </>
  );
}

/* ---------------- Regras ---------------- */
const RegrasEsquema = z.object({
  vagas: z.coerce.number<string | number>().int().min(1, 'Vagas precisam ser pelo menos 1.'),
  duracao: z.coerce.number<string | number>().int().min(15, 'A aula precisa ter pelo menos 15 minutos.'),
  modalidades: z.array(z.string()),
  pacote: z.coerce.number<string | number>().int().min(1, 'O pacote precisa ter pelo menos 1 aula.'),
  cancelamento: z.coerce.number<string | number>().int().min(0, 'Use 0 ou mais horas.'),
  autoAgenda: z.boolean(),
  exigeDisp: z.boolean(),
  valorAula: z.coerce.number<string | number>().int().min(1, 'O valor da aula precisa ser pelo menos R$ 1.'),
});
type RegrasEntrada = z.input<typeof RegrasEsquema>;
type RegrasForm = z.output<typeof RegrasEsquema>;

function Campo({ rot, onde, children }: { rot: string; onde: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 border-b border-dashed border-borda-suave py-3.5 last:border-0 md:grid-cols-[250px_1fr] md:gap-6">
      <div>
        <b className="block text-texto">{rot}</b>
        <span className="text-apagado">{onde}</span>
      </div>
      <div className="flex items-center">{children}</div>
    </div>
  );
}

export function AbaRegras({ c, r }: { c: CursoResp; r: Regras }) {
  const salvar = useSalvarRegras(c.id);
  const [msg, setMsg] = useState<{ txt: string; erro?: boolean } | null>(null);
  const f = useForm<RegrasEntrada, unknown, RegrasForm>({
    resolver: zodResolver(RegrasEsquema),
    defaultValues: {
      vagas: r.vagas,
      duracao: r.duracao,
      modalidades: r.modalidades,
      pacote: r.pacote,
      cancelamento: r.cancelamento,
      autoAgenda: r.autoAgenda,
      exigeDisp: r.exigeDisp,
      valorAula: r.valorAula,
    },
  });
  const ro = !c.pode.editar;
  const erros = Object.values(f.formState.errors)
    .map((e) => e?.message)
    .filter(Boolean);
  const num = (k: 'vagas' | 'duracao' | 'pacote' | 'cancelamento' | 'valorAula', suf: string, pre?: string) => (
    <div className="flex items-center gap-2">
      {pre && <span className="text-apagado">{pre}</span>}
      <Input
        type="number"
        inputMode="numeric"
        className="w-[110px]"
        aria-label={suf}
        disabled={ro}
        aria-invalid={!!f.formState.errors[k]}
        {...f.register(k)}
      />
      <span className="text-apagado">{suf}</span>
    </div>
  );
  return (
    <form
      noValidate
      onSubmit={f.handleSubmit((d) =>
        salvar.mutate(
          { ...d, modalidades: d.modalidades.length ? d.modalidades : ['Online'] },
          { onSuccess: (x) => setMsg({ txt: x.msg }), onError: (e) => setMsg({ txt: e.message, erro: true }) },
        ),
      )}
    >
      {msg && (
        <Aviso tom={msg.erro ? 'red' : 'blue'} icone={msg.erro ? 'alerta' : 'ok'}>
          {msg.txt}
        </Aviso>
      )}
      <Card className="px-5 py-2">
        <Campo rot="Estrutura" onde="Se o curso se divide em módulos, em turmas ou em nada. Muda em Editar curso.">
          {r.estruturaTxt}
        </Campo>
        <Campo
          rot="Tipo e idioma"
          onde="O tipo diz o formato da aula; o idioma, quais professores e currículos servem."
        >
          {r.tipoIdioma}
        </Campo>
        {r.estrutura === 'modulos' ? (
          <Campo
            rot="Vagas por aula em grupo"
            onde="Lido pela agenda: o máximo de alunos em cada aula dos módulos em grupo. Private FLOW é sempre 1."
          >
            {num('vagas', 'alunos por aula')}
          </Campo>
        ) : r.estrutura === 'turmas' ? (
          <Campo rot="Vagas" onde="Cada turma tem as vagas do contrato com o cliente.">
            definidas por turma, na Visão geral
          </Campo>
        ) : (
          <Campo rot="Vagas" onde="Aula particular: um aluno por aula.">
            1 aluno por aula
          </Campo>
        )}
        <Campo rot="Duração da aula" onde="Lido pela grade e pelas fichas: fecha o horário de cada aula (início–fim).">
          {num('duracao', 'minutos')}
        </Campo>
        <Campo
          rot="Modalidades aceitas"
          onde="Lido pela matrícula: só estas aparecem ao matricular um aluno neste curso."
        >
          <Controller
            control={f.control}
            name="modalidades"
            render={({ field }) => (
              <div role="group" aria-label="Modalidades aceitas" className="flex gap-2">
                {['Online', 'Presencial'].map((m) => {
                  const on = field.value.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={on}
                      disabled={ro}
                      onClick={() => field.onChange(on ? field.value.filter((x) => x !== m) : [...field.value, m])}
                      className={cn(
                        'h-9 cursor-pointer rounded-full bg-[#eceff5] px-3.5 text-[#4b5568] disabled:cursor-default dark:bg-hover',
                        on && 'bg-azul-suave font-semibold text-azul shadow-[inset_0_0_0_1px_#cfdcfa]',
                      )}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            )}
          />
        </Campo>
        <Campo
          rot="Pacote padrão"
          onde="Lido pela matrícula: vem preenchido como quantidade de aulas da nova matrícula."
        >
          {num('pacote', 'aulas')}
        </Campo>
        <Campo
          rot="Cancelamento sem débito"
          onde="Lido pela agenda do aluno: até quando a aula pode ser cancelada sem consumir crédito."
        >
          {num('cancelamento', 'horas antes da aula')}
        </Campo>
        <Campo
          rot="Auto-agendamento"
          onde="Ligado, o aluno marca a própria aula no app; desligado, só a secretaria agenda."
        >
          <Controller
            control={f.control}
            name="autoAgenda"
            render={({ field }) => (
              // biome-ignore lint/a11y/noLabelWithoutControl: o Switch (botão) dentro do label é o controle
              <label className="flex items-center gap-3">
                <Switch checked={field.value} onCheckedChange={field.onChange} disabled={ro} /> aluno pode auto-agendar
              </label>
            )}
          />
        </Campo>
        {r.estrutura !== 'turmas' && (
          <Campo
            rot="Alocação exige disponibilidade"
            onde="Lido na alocação do aluno: ligado, a alocação fora da disponibilidade do aluno não é salva; desligado, salva com aviso."
          >
            <Controller
              control={f.control}
              name="exigeDisp"
              render={({ field }) => (
                // biome-ignore lint/a11y/noLabelWithoutControl: o Switch (botão) dentro do label é o controle
                <label className="flex items-center gap-3">
                  <Switch checked={field.value} onCheckedChange={field.onChange} disabled={ro} /> bloquear alocação fora
                  da disponibilidade do aluno
                </label>
              )}
            />
          </Campo>
        )}
        <Campo
          rot="Valor da aula"
          onde={
            r.estrutura === 'turmas'
              ? 'Lido pelo Dashboard financeiro: quanto a empresa paga por aula de cada turma. Contrato da turma = pacote × valor da aula.'
              : 'Lido pelo Dashboard financeiro: quanto cada aluno paga por aula. Contrato = pacote × valor da aula.'
          }
        >
          {num('valorAula', r.estrutura === 'turmas' ? 'por turma em cada aula' : 'por aluno em cada aula', 'R$')}
        </Campo>
        <div className="flex flex-wrap items-center gap-3 py-3.5">
          {!ro && (
            <Button type="submit" variant="primary" disabled={salvar.isPending}>
              Salvar regras
            </Button>
          )}
          {erros.length > 0 && (
            <span role="alert" className="font-medium text-vermelho">
              {erros[0]}
            </span>
          )}
          <span className="ml-auto text-apagado">
            {r.horarios} {r.horarios === 1 ? 'horário' : 'horários'} na grade deste curso
          </span>
        </div>
      </Card>
    </form>
  );
}

/* ---------------- Currículo ---------------- */
export function AbaCurriculo({ c, d, novo }: { c: CursoResp; d: CurriculoAba; novo: () => void }) {
  const volta = `/cursos/${c.id}/curriculo`;
  const { fatia, rodape } = usePaginacao(d.lista);
  return (
    <>
      {c.pode.curriculo && (
        <div className="mb-3.5 flex">
          <Button variant="primary" onClick={novo}>
            <PlusIcon /> Novo currículo
          </Button>
        </div>
      )}
      {d.emRascunho.length > 0 && (
        <Aviso tom="amber" icone="info">
          Em rascunho:{' '}
          {d.emRascunho.map((x, i) => (
            <span key={x.id}>
              {i > 0 && ', '}
              <Link
                href={`/cursos/curriculos/${x.id}?volta=${encodeURIComponent(volta)}`}
                className="font-semibold text-azul hover:underline"
              >
                {x.nome} ({x.versao})
              </Link>
            </span>
          ))}{' '}
          — as aulas só leem depois de publicar.
        </Aviso>
      )}
      <Stats s={d.stats} />
      <Card className="overflow-hidden">
        <CardHead>
          <CardTitle>Currículos de {c.nome}</CardTitle>
          <Badge tom="blue">{d.lista.length}</Badge>
        </CardHead>
        <Table>
          <THead>
            <Tr>
              <Th>Currículo</Th>
              <Th>Aplicado em</Th>
              <Th>Versão</Th>
              <Th className="text-right">Conteúdos</Th>
              <Th className="text-right">Sem link de In-class</Th>
              <Th>Publicado em</Th>
            </Tr>
          </THead>
          <TBody>
            {fatia.length ? (
              fatia.map((x) => (
                <Tr key={x.id} className="hover:bg-hover">
                  <Td>
                    <Link
                      href={`/cursos/curriculos/${x.id}?volta=${encodeURIComponent(volta)}`}
                      className="font-semibold text-texto hover:text-azul hover:underline"
                    >
                      {x.nome}
                    </Link>
                  </Td>
                  <Td>{x.aplicado || '—'}</Td>
                  <Td>
                    <span className="flex flex-wrap gap-1.5">
                      {x.publicada && <Badge tom="green">{x.publicada} publicada</Badge>}
                      {x.rascunho && <Badge tom="amber">{x.rascunho} rascunho</Badge>}
                    </span>
                  </Td>
                  <Td className="text-right tabular-nums">{x.conteudos}</Td>
                  <Td className="text-right tabular-nums">{x.semLink || '—'}</Td>
                  <Td>{x.publicadaEm ?? '—'}</Td>
                </Tr>
              ))
            ) : (
              <Tr>
                <Td colSpan={6} className="py-7 text-center text-apagado-2">
                  este curso ainda não tem currículo cadastrado
                </Td>
              </Tr>
            )}
          </TBody>
        </Table>
        {rodape}
      </Card>
      {d.semCurriculo.length > 0 && (
        <div className="mt-3.5">
          <Aviso tom="amber" icone="alerta">
            <b>Sem currículo:</b> {d.semCurriculo.join(', ')}. As aulas {d.eTurma ? 'dessas turmas' : 'desses módulos'}{' '}
            saem sem conteúdo definido.
          </Aviso>
        </div>
      )}
    </>
  );
}

/* ---------------- Grade semanal ---------------- */
export function AbaGrade({ d }: { d: Grade }) {
  const { fatia, rodape } = usePaginacao(d.linhas);
  return (
    <>
      <Stats s={d.stats} />
      <Card className="overflow-hidden">
        <Table>
          <THead>
            <Tr>
              {[d.coluna, 'Quem', 'Dias', 'Horário', 'Professor', 'Sala'].map((x) => (
                <Th key={x}>{x}</Th>
              ))}
              <Th className="text-right">Alunos</Th>
            </Tr>
          </THead>
          <TBody>
            {fatia.length ? (
              fatia.map((l, i) => (
                <Tr key={i}>
                  <Td className="font-semibold text-texto">{l.item}</Td>
                  <Td>
                    {l.alunoId ? (
                      <Link href={`/alunos/${l.alunoId}/perfil`} className="text-azul hover:underline">
                        {l.quem}
                      </Link>
                    ) : (
                      l.quem
                    )}
                  </Td>
                  <Td>{l.dias}</Td>
                  <Td className="tabular-nums">{l.horario}</Td>
                  <Td>
                    {l.prof === '—' ? (
                      <span className="text-vermelho">sem professor</span>
                    ) : l.profId ? (
                      <Link href={`/professores/${l.profId}/perfil`} className="text-azul hover:underline">
                        {l.prof}
                      </Link>
                    ) : (
                      l.prof
                    )}
                  </Td>
                  <Td>{l.sala}</Td>
                  <Td className="text-right tabular-nums">{l.ocupacao}</Td>
                </Tr>
              ))
            ) : (
              <Tr>
                <Td colSpan={7} className="py-7 text-center text-apagado-2">
                  nenhum horário ofertado — o curso não tem aluno nem turma com grade
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
