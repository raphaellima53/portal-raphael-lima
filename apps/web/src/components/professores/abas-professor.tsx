'use client';

import { CalendarIcon, PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Chips, Segmento, type Vai } from '@/components/alunos/abas-aluno';
import type { Msg } from '@/components/alunos/comum';
import { Stats } from '@/components/cursos/abas-curso';
import { GradeDisponibilidade } from '@/components/disponibilidade';
import { Aviso } from '@/components/ds';
import { Escolha } from '@/components/escolha';
import { usePaginacao } from '@/components/paginacao';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHead, CardTitle } from '@/components/ui/card';
import { Dialog, DialogBody, DialogContent, DialogFoot, DialogHead } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TBody, Td, THead, Th, Tr } from '@/components/ui/table';
import type { DispAba } from '@/lib/alunos';
import { type AgendaProf, type FeedbacksProf, type FichaProf, type HabCurso, useAcaoProf } from '@/lib/professores';
import { cn } from '@/lib/utils';

const Vazio = ({ n, txt }: { n: number; txt: string }) => (
  <Tr>
    <Td colSpan={n} className="py-8 text-center text-apagado-2">
      {txt}
    </Td>
  </Tr>
);
const QuemAula = ({ quem, alunoId, link }: { quem: string; alunoId: number | null; link: boolean }) =>
  alunoId != null && link ? (
    <Link href={`/alunos/${alunoId}/perfil`} className="text-azul hover:underline">
      {quem}
    </Link>
  ) : (
    quem
  );

/* ---------------- Cursos: habilitação ---------------- */
export function AbaHabilitacao({ f, cursos, setMsg }: { f: FichaProf; cursos: HabCurso[]; setMsg: (m: Msg) => void }) {
  const acao = useAcaoProf();
  const op = f.pode.operar;
  const faz = (caminho: string, json: unknown) =>
    acao.mutate(
      { caminho: `/${f.id}${caminho}`, method: 'PUT', json },
      {
        onSuccess: (r) => setMsg(r.msg ? { txt: r.msg } : null),
        onError: (e) => setMsg({ txt: e.message, erro: true }),
      },
    );
  return (
    <>
      <p className="mb-4 max-w-[900px] text-apagado">
        Habilitar é matricular o professor para ministrar: a agenda só escala quem está habilitado no curso e no módulo
        ou turma. Ligue o curso e, se precisar, clique nos módulos ou turmas para recortar — a grade e a agenda mudam na
        hora.
      </p>
      <div className="grid gap-4 xl:grid-cols-2">
        {cursos.map((c) => (
          <Card key={c.id} className={cn('min-w-0 p-5', c.on && 'shadow-el-2')}>
            <div className="flex items-center gap-2.5">
              <i className="size-2.5 shrink-0 rounded-full" style={{ background: c.cor }} aria-hidden />
              <b className="text-texto">{c.curso}</b>
              {!c.ativo && <Badge>inativo</Badge>}
              <span className="flex-1" />
              <Switch
                checked={c.on}
                disabled={!op || acao.isPending}
                aria-label={`Habilitado em ${c.curso}`}
                onCheckedChange={() => faz('/habilitacao/curso', { curso: c.curso })}
              />
            </div>
            <p className="mt-1.5 mb-3 text-apagado">{c.resumo}</p>
            {c.itens.length > 0 && (
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label={`${c.eTurma ? 'Turmas' : 'Módulos'} de ${c.curso}`}
              >
                {c.itens.map((x) => (
                  <button
                    key={x.nome}
                    type="button"
                    aria-pressed={x.on}
                    disabled={!op || acao.isPending}
                    onClick={() => faz('/habilitacao/item', { curso: c.curso, item: x.nome })}
                    className={cn(
                      'h-9 cursor-pointer rounded-full bg-[#eceff5] px-3.5 text-[#4b5568] disabled:cursor-default dark:bg-hover dark:text-texto-2',
                      x.on && 'bg-azul-suave font-semibold text-azul shadow-[inset_0_0_0_1px_#cfdcfa]',
                    )}
                  >
                    {x.nome}
                    {x.titular ? ' · titular' : ''}
                  </button>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}

/* ---------------- Disponibilidade ---------------- */
export function AbaDispProf({ f, d, setMsg }: { f: FichaProf; d: DispAba; setMsg: (m: Msg) => void }) {
  const acao = useAcaoProf();
  const troca = (k: string) =>
    acao.mutate(
      { caminho: `/${f.id}/disponibilidade`, method: 'PUT', json: { k } },
      { onSuccess: () => setMsg(null), onError: (e) => setMsg({ txt: e.message, erro: true }) },
    );
  return (
    <>
      <Stats s={d.stats} />
      <Card className="mb-4 overflow-hidden">
        <CardHead className="flex-wrap">
          <CardTitle>Disponibilidade semanal</CardTitle>
          <span className="flex-1" />
          <span className="text-apagado">
            {f.pode.operar
              ? 'clique numa hora para marcar ou desmarcar · no dia ou na hora do cabeçalho, a coluna ou a linha · grava na hora'
              : 'seu acesso é só de leitura'}
          </span>
        </CardHead>
        <div className="pt-4">
          <GradeDisponibilidade g={d} troca={troca} ocupado={acao.isPending} soLeitura={!f.pode.operar} />
        </div>
      </Card>
      {d.conflitos.length ? (
        <Aviso tom="red" icone="alerta">
          <b>
            {d.conflitos.length} {d.conflitos.length === 1 ? 'aula está' : 'aulas estão'} fora da disponibilidade:
          </b>{' '}
          {d.conflitos.join('; ')}. Marque a hora como disponível ou troque o professor na alocação do aluno ou na
          turma.
        </Aviso>
      ) : (
        <Aviso tom="blue" icone="ok">
          Todas as aulas da grade estão dentro da disponibilidade.
        </Aviso>
      )}
    </>
  );
}

/* ---------------- Agenda ---------------- */
const CHIPS: [string, string][] = [
  ['', 'Todas'],
  ['executada', 'Executadas'],
  ['substituida', 'Substituídas'],
  ['naoFinalizada', 'Não finalizadas'],
  ['cancelada', 'Canceladas'],
];
export function AbaAgendaProf({ f, d, vai }: { f: FichaProf; d: AgendaProf; vai: Vai }) {
  return (
    <>
      <div className="mb-4">
        <Segmento
          rotulo="Aulas"
          valor={d.quando}
          aoMudar={(v) => vai({ quando: v === 'passadas' ? 'passadas' : undefined, dias: undefined })}
          opcoes={[
            ['proximas', 'Próximas'],
            ['passadas', 'Passadas'],
          ]}
        />
      </div>
      {d.quando === 'proximas' ? <Proximas f={f} d={d} vai={vai} /> : <Passadas f={f} d={d} vai={vai} />}
    </>
  );
}

function Proximas({ f, d, vai }: { f: FichaProf; d: Extract<AgendaProf, { quando: 'proximas' }>; vai: Vai }) {
  const { fatia, rodape } = usePaginacao(d.aulas);
  return (
    <>
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <Escolha
          rotulo="Período"
          destacar={false}
          valor={String(d.dias)}
          aoMudar={(v) => vai({ dias: v === '14' ? undefined : v })}
          opcoes={[
            { v: '7', l: 'próximos 7 dias' },
            { v: '14', l: 'próximos 14 dias' },
            { v: '30', l: 'próximos 30 dias' },
          ]}
          className="w-[190px]"
        />
        {f.pode.agenda && (
          <Button asChild>
            <Link href={`/agenda?vista=semanal&prof=${encodeURIComponent(f.nome)}`}>
              <CalendarIcon /> Abrir na Agenda
            </Link>
          </Button>
        )}
      </div>
      <Card className="overflow-hidden">
        <CardHead>
          <CardTitle>Próximas aulas</CardTitle>
          <Badge tom="blue">{d.aulas.length}</Badge>
        </CardHead>
        <Table>
          <THead>
            <Tr>
              <Th>Data</Th>
              <Th>Horário</Th>
              <Th>Aula</Th>
              <Th>Turma ou aluno</Th>
              <Th>Sala</Th>
              <Th className="text-right">Alunos</Th>
              <Th>Situação</Th>
            </Tr>
          </THead>
          <TBody>
            {fatia.length ? (
              fatia.map((x) => (
                <Tr key={x.k}>
                  <Td className="font-medium whitespace-nowrap text-texto">{x.data}</Td>
                  <Td className="whitespace-nowrap">{x.horario}</Td>
                  <Td>
                    <b style={{ color: x.cor }}>{x.rotulo}</b>
                    <div className="text-apagado">{x.prod}</div>
                  </Td>
                  <Td>
                    <QuemAula quem={x.quem} alunoId={x.alunoId} link={f.pode.alunos} />
                  </Td>
                  <Td>{x.sala}</Td>
                  <Td className="text-right tabular-nums">{x.alunos}</Td>
                  <Td>
                    <Badge tom={x.estadoTag[1]}>{x.estadoTag[0]}</Badge>
                  </Td>
                </Tr>
              ))
            ) : (
              <Vazio n={7} txt="nenhuma aula no período" />
            )}
          </TBody>
        </Table>
        {rodape}
      </Card>
    </>
  );
}

function Passadas({ f, d, vai }: { f: FichaProf; d: Extract<AgendaProf, { quando: 'passadas' }>; vai: Vai }) {
  const [est, setEst] = useState('');
  const ls = est ? d.aulas.filter((x) => x.estado === est) : d.aulas;
  const { fatia, rodape, setPag } = usePaginacao(ls);
  return (
    <>
      <Stats s={d.stats} />
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <Chips
          rotulo="Estado da aula"
          valor={est}
          aoMudar={(v) => {
            setEst(v);
            setPag(1);
          }}
          opcoes={CHIPS.map(([k, l]) => ({
            k,
            l,
            n: k ? d.aulas.filter((x) => x.estado === k).length : d.aulas.length,
          }))}
        />
        <Escolha
          rotulo="Período"
          destacar={false}
          valor={String(d.dias)}
          aoMudar={(v) => vai({ hist: v === '60' ? undefined : v })}
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
              <Th>Turma ou aluno</Th>
              <Th className="text-right">Alunos</Th>
              <Th>Estado</Th>
            </Tr>
          </THead>
          <TBody>
            {fatia.length ? (
              fatia.map((x) => (
                <Tr key={x.k}>
                  <Td className="font-medium whitespace-nowrap text-texto">{x.data}</Td>
                  <Td className="whitespace-nowrap">{x.horario}</Td>
                  <Td>
                    <b style={{ color: x.cor }}>{x.rotulo}</b>
                    <div className="text-apagado">{x.prod}</div>
                  </Td>
                  <Td>
                    <QuemAula quem={x.quem} alunoId={x.alunoId} link={f.pode.alunos} />
                  </Td>
                  <Td className="text-right tabular-nums">{x.alunos}</Td>
                  <Td>
                    <Badge tom={x.estadoTag[1]}>{x.estadoTag[0]}</Badge>
                  </Td>
                </Tr>
              ))
            ) : (
              <Vazio n={6} txt="nenhuma aula neste recorte" />
            )}
          </TBody>
        </Table>
        {rodape}
      </Card>
    </>
  );
}

/* ---------------- Feedbacks: a avaliação dos alunos ---------------- */
const Estrelas = ({ n }: { n: number }) => (
  <span role="img" aria-label={`nota ${n} de 5`} className="whitespace-nowrap text-ambar">
    {'★'.repeat(n)}
    <span className="text-borda-forte">{'★'.repeat(5 - n)}</span>
  </span>
);
export function AbaFeedbacksProf({
  f,
  d,
  vai,
  setMsg,
}: {
  f: FichaProf;
  d: FeedbacksProf;
  vai: Vai;
  setMsg: (m: Msg) => void;
}) {
  const [nota, setNota] = useState('');
  const [novo, setNovo] = useState(false);
  const ls = d.lista.filter((x) => !nota || (nota === 'baixa' ? x.nota <= 2 : x.nota === Number(nota)));
  const { fatia, rodape, setPag } = usePaginacao(ls);
  const baixas = d.lista.filter((x) => x.nota <= 2).length;
  return (
    <>
      <Stats s={d.stats} />
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <Chips
          rotulo="Nota"
          valor={nota}
          aoMudar={(v) => {
            setNota(v);
            setPag(1);
          }}
          opcoes={[
            { k: '', l: 'Todas', n: d.lista.length },
            ...[5, 4, 3].map((n) => ({
              k: String(n),
              l: `${n} estrelas`,
              n: d.lista.filter((x) => x.nota === n).length,
            })),
            { k: 'baixa', l: '1 e 2 estrelas', n: baixas },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Escolha
            rotulo="Período"
            destacar={false}
            valor={String(d.dias)}
            aoMudar={(v) => vai({ hist: v === '60' ? undefined : v })}
            opcoes={[
              { v: '30', l: 'últimos 30 dias' },
              { v: '60', l: 'últimos 60 dias' },
              { v: '90', l: 'últimos 90 dias' },
            ]}
            className="w-[180px]"
          />
          {f.pode.operar && (
            <Button variant="primary" onClick={() => setNovo(true)}>
              <PlusIcon /> Novo feedback
            </Button>
          )}
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="min-w-0 overflow-hidden">
          <Table>
            <THead>
              <Tr>
                <Th>Data</Th>
                <Th>Aula</Th>
                <Th>Aluno</Th>
                <Th>Nota</Th>
                <Th>Comentário</Th>
              </Tr>
            </THead>
            <TBody>
              {fatia.length ? (
                fatia.map((x, i) => (
                  <Tr key={`${x.quando}-${x.aluno}-${i}`}>
                    <Td className="font-medium whitespace-nowrap text-texto">{x.quando}</Td>
                    <Td>
                      <b className="text-texto">{x.aula}</b>
                      <div className="text-apagado">{x.curso}</div>
                    </Td>
                    <Td className="whitespace-nowrap">{x.aluno}</Td>
                    <Td>
                      <Estrelas n={x.nota} />
                    </Td>
                    <Td className="min-w-[220px]">
                      {x.texto}
                      {x.registrada && <div className="text-apagado">registrada no portal</div>}
                    </Td>
                  </Tr>
                ))
              ) : (
                <Vazio
                  n={5}
                  txt={d.lista.length ? 'nenhuma avaliação com essa nota' : 'nenhuma avaliação no período'}
                />
              )}
            </TBody>
          </Table>
          {rodape}
        </Card>
        <Card className="h-fit min-w-0 overflow-hidden">
          <CardHead>
            <CardTitle>Média por curso</CardTitle>
          </CardHead>
          <Table>
            <THead>
              <Tr>
                <Th>Curso</Th>
                <Th className="text-right">Avaliações</Th>
                <Th className="text-right">Média</Th>
              </Tr>
            </THead>
            <TBody>
              {d.porCurso.length ? (
                d.porCurso.map((x) => (
                  <Tr key={x.curso}>
                    <Td className="font-medium text-texto">{x.curso}</Td>
                    <Td className="text-right tabular-nums">{x.n}</Td>
                    <Td className="text-right tabular-nums">{x.media}</Td>
                  </Tr>
                ))
              ) : (
                <Vazio n={3} txt="sem avaliação no período" />
              )}
            </TBody>
          </Table>
        </Card>
      </div>
      <AvaliacaoDialog f={f} d={d} aberto={novo} aoFechar={() => setNovo(false)} aoSalvo={(txt) => setMsg({ txt })} />
    </>
  );
}

function AvaliacaoDialog({
  f,
  d,
  aberto,
  aoFechar,
  aoSalvo,
}: {
  f: FichaProf;
  d: FeedbacksProf;
  aberto: boolean;
  aoFechar: () => void;
  aoSalvo: (txt: string) => void;
}) {
  const acao = useAcaoProf();
  const [aula, setAula] = useState('');
  const [aluno, setAluno] = useState('');
  const [nota, setNota] = useState('');
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState('');
  // biome-ignore lint/correctness/useExhaustiveDependencies: reinicia ao abrir
  useEffect(() => {
    if (!aberto) return;
    setAula(d.aulas[0]?.k ?? '');
    setAluno('');
    setNota('');
    setTexto('');
    setErro('');
  }, [aberto]);
  const enviar = () => {
    if (!aula) return setErro('Não há aula dada no período para avaliar.');
    if (!aluno) return setErro('Escolha o aluno.');
    if (!nota) return setErro('Dê a nota.');
    acao.mutate(
      { caminho: `/${f.id}/avaliacoes?hist=${d.dias}`, json: { aula, aluno, nota: Number(nota), texto } },
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
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent tamanho="md">
        <DialogHead titulo="Novo feedback" descricao={`${f.nome} · avaliação de aluno`} />
        <DialogBody className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2">
            <Label>
              Aula<span className="text-vermelho">*</span>
            </Label>
            <Escolha
              rotulo="Aula"
              destacar={false}
              disabled={!d.aulas.length}
              todos={d.aulas.length ? undefined : 'sem aula dada no período'}
              valor={aula}
              aoMudar={setAula}
              opcoes={d.aulas.map((x) => ({ v: x.k, l: x.rotulo }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>
              Aluno<span className="text-vermelho">*</span>
            </Label>
            <Escolha
              rotulo="Aluno"
              todos="escolha o aluno"
              destacar={false}
              valor={aluno}
              aoMudar={setAluno}
              opcoes={d.alunos.map((x) => ({ v: x, l: x }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>
              Nota<span className="text-vermelho">*</span>
            </Label>
            <Escolha
              rotulo="Nota"
              todos="escolha a nota"
              destacar={false}
              valor={nota}
              aoMudar={setNota}
              opcoes={d.notas}
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="av-texto">Comentário</Label>
            <textarea
              id="av-texto"
              rows={3}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="o que o aluno escreveu"
              className="w-full rounded-md border border-borda-forte bg-card px-3 py-2.5 text-sm text-texto placeholder:text-apagado-2 focus:border-azul focus:shadow-anel focus-visible:outline-none"
            />
          </div>
        </DialogBody>
        <DialogFoot>
          {erro && (
            <span role="alert" className="mr-auto font-medium text-vermelho">
              {erro}
            </span>
          )}
          <Button onClick={aoFechar}>Cancelar</Button>
          <Button variant="primary" disabled={acao.isPending} onClick={enviar}>
            Registrar avaliação
          </Button>
        </DialogFoot>
      </DialogContent>
    </Dialog>
  );
}
