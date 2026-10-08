'use client';

import {
  BookOpenIcon,
  CalendarXIcon,
  ChevronRightIcon,
  CopyIcon,
  DoorOpenIcon,
  FileTextIcon,
  LockIcon,
  LockOpenIcon,
  MonitorIcon,
  UserPlusIcon,
  VideoIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Aviso } from '@/components/ds';
import { Escolha } from '@/components/escolha';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFoot, DialogHead } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type AulaModelo, useAcaoAula, useAula, useTranscricao } from '@/lib/agenda';
import { cn } from '@/lib/utils';
import { Avatar, TagsAula } from './aula-comum';

type Modo =
  | ''
  | 'prof'
  | 'cancelar'
  | 'meuCancelar'
  | 'solCancelar'
  | 'solMudanca'
  | 'valor'
  | 'suporte'
  | 'topico'
  | 'transcricao'
  | 'encerrar';

/** Detalhes da aula (popup): clicar numa aula de qualquer visão da agenda abre aqui. */
export function AulaDialog({ k, aoFechar }: { k: string | null; aoFechar: () => void }) {
  const q = useAula(k);
  const [modo, setModo] = useState<Modo>('');
  const [msg, setMsg] = useState<{ txt: string; erro?: boolean } | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: outra aula volta ao detalhe, sem mensagem
  useEffect(() => {
    setModo('');
    setMsg(null);
  }, [k]);
  const a = q.data;
  return (
    <Dialog open={!!k} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent tamanho="md">
        {!a ? (
          <>
            <DialogHead titulo="Detalhes da aula" />
            <DialogBody>
              {q.isError ? (
                <Aviso tom="red" icone="alerta">
                  {q.error.message}
                </Aviso>
              ) : (
                <p className="text-apagado">Carregando…</p>
              )}
            </DialogBody>
          </>
        ) : modo === 'prof' ? (
          <FormProf
            a={a}
            voltar={() => setModo('')}
            aoOk={(t) => {
              setModo('');
              setMsg({ txt: t });
            }}
          />
        ) : modo === 'cancelar' ? (
          <FormCancelar
            a={a}
            voltar={() => setModo('')}
            aoOk={(t) => {
              setModo('');
              setMsg({ txt: t });
            }}
          />
        ) : modo === 'meuCancelar' ? (
          <FormMeuCancelar
            a={a}
            voltar={() => setModo('')}
            aoOk={(t, saiu) => {
              /* na aula do Community Flow o aluno sai da aula e deixa de vê-la: fecha o popup */
              if (saiu) return aoFechar();
              setModo('');
              setMsg({ txt: t });
            }}
          />
        ) : modo === 'solCancelar' || modo === 'solMudanca' ? (
          <FormSolicitar
            a={a}
            tipo={modo === 'solCancelar' ? 'cancelamento' : 'mudanca'}
            voltar={() => setModo('')}
            aoOk={(t) => {
              setModo('');
              setMsg({ txt: t });
            }}
          />
        ) : modo === 'valor' ? (
          <FormValor
            a={a}
            voltar={() => setModo('')}
            aoOk={(t) => {
              setModo('');
              setMsg({ txt: t });
            }}
          />
        ) : modo === 'suporte' ? (
          <FormSuporte
            a={a}
            voltar={() => setModo('')}
            aoOk={(t) => {
              setModo('');
              setMsg({ txt: t });
            }}
          />
        ) : modo === 'topico' ? (
          <FormTopico
            a={a}
            voltar={() => setModo('')}
            aoOk={(t) => {
              setModo('');
              setMsg({ txt: t });
            }}
          />
        ) : modo === 'transcricao' ? (
          <PainelTranscricao a={a} voltar={() => setModo('')} />
        ) : modo === 'encerrar' ? (
          <FormEncerrar
            a={a}
            voltar={() => setModo('')}
            aoOk={(t) => {
              setModo('');
              setMsg({ txt: t });
            }}
          />
        ) : (
          <Detalhe a={a} msg={msg} setMsg={setMsg} setModo={setModo} aoFechar={aoFechar} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Detalhe({
  a,
  msg,
  setMsg,
  setModo,
  aoFechar,
}: {
  a: AulaModelo;
  msg: { txt: string; erro?: boolean } | null;
  setMsg: (m: { txt: string; erro?: boolean } | null) => void;
  setModo: (m: Modo) => void;
  aoFechar: () => void;
}) {
  const acao = useAcaoAula(a.k);
  const [ger, setGer] = useState(false);
  const caminho = usePathname();
  const sp = useSearchParams();
  const volta = encodeURIComponent(`${caminho}${sp.toString() ? `?${sp.toString()}` : ''}`);
  const faz = (d: Parameters<typeof acao.mutate>[0]) =>
    acao.mutate(d, {
      onSuccess: (r) => r.msg && setMsg({ txt: r.msg }),
      onError: (e) => setMsg({ txt: e.message, erro: true }),
    });
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(a.sala.url);
      setMsg({ txt: 'Link da sala copiado.' });
    } catch {
      setMsg({ txt: `Não deu para copiar. Link: ${a.sala.url}` });
    }
  };
  const f = a.folha;
  const mat = (url: string, rot: string, Icone: typeof VideoIcon) =>
    url ? (
      <Button asChild className="flex-1">
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Icone /> {rot}
        </a>
      </Button>
    ) : (
      <Button disabled className="flex-1">
        <Icone /> {rot} <small className="text-sm text-apagado">sem link</small>
      </Button>
    );

  return (
    <>
      <DialogHead titulo="Detalhes da aula" />
      <DialogBody className="grid gap-3">
        {msg && (
          <Aviso tom={msg.erro ? 'red' : 'blue'} icone={msg.erro ? 'alerta' : 'ok'}>
            {msg.txt}
          </Aviso>
        )}
        <TagsAula a={a} trava={a.trava} />
        {/* campos da aula (24/09/2026): Curso, Módulo, Tópico, Dia, Início, Término */}
        <div className="grid gap-3 rounded-lg bg-bg px-[18px] py-4">
          <h3 className="text-xl font-bold text-texto">{a.titulo}</h3>
          <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            <Campo rotulo="Curso" valor={a.prod} />
            {a.mod && <Campo rotulo={a.modRot ?? 'Módulo'} valor={a.mod} />}
            <div className="col-span-2 sm:col-span-1">
              <dt className="text-sm font-semibold text-azul">Tópico</dt>
              <dd className="m-0 text-texto">
                {a.topico || <span className="text-apagado">sem tópico</span>}
                {a.apresentacao.podeConteudo && a.apresentacao.conteudos.length > 0 && (
                  <Button variant="link" className="ml-2" onClick={() => setModo('topico')}>
                    Alterar tópico
                  </Button>
                )}
              </dd>
            </div>
            <Campo rotulo="Dia" valor={a.dataTxt} />
            <Campo rotulo="Início" valor={a.inicio} />
            <Campo rotulo="Término" valor={a.termino} />
            {a.avulsa?.local && <Campo rotulo="Local ou link" valor={a.avulsa.local} />}
          </dl>
          {a.avulsa?.descricao && <p className="m-0 text-texto-2">{a.avulsa.descricao}</p>}
        </div>
        <div className="flex items-center gap-3">
          <Avatar nome={a.prof} />
          <div className="min-w-0 flex-1">
            <small className="block text-sm font-semibold text-azul">Professor</small>
            <b className="block text-texto">{a.prof === '—' ? 'a definir' : a.prof}</b>
            {a.sub && <em className="block text-apagado not-italic">no lugar de {a.sub}</em>}
          </div>
          {a.podeAlterarProf && (
            <Button variant="link" onClick={() => setModo('prof')}>
              Alterar professor
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {a.sala.zoom && a.sala.semConta ? (
            <span className="inline-flex flex-[1_1_220px] items-center gap-2 rounded-md border border-[#f5c2c7] bg-vermelho-suave px-3 text-texto-2">
              <VideoIcon className="size-4 text-vermelho" /> Sem conta do Zoom livre neste horário
            </span>
          ) : a.sala.zoom && !a.sala.url ? (
            /* 30/09/2026: a sala abre dentro do portal, na página da aula, sem login no Zoom */
            <Button asChild variant="primary" className="flex-[1_1_220px]">
              <Link href={`/agenda/aula?k=${encodeURIComponent(a.k)}&entrar=1&volta=${volta}`}>
                <VideoIcon /> Entrar na sala · {a.sala.nome}
              </Link>
            </Button>
          ) : a.sala.zoom ? (
            <>
              <Button asChild variant="primary" className="flex-[1_1_220px]">
                <a href={a.sala.url} target="_blank" rel="noopener noreferrer">
                  <VideoIcon /> Abrir sala
                </a>
              </Button>
              <Button onClick={copiar}>
                <CopyIcon /> Copiar link
              </Button>
            </>
          ) : (
            <span className="inline-flex flex-[1_1_220px] items-center gap-2 rounded-md border border-borda px-3 text-texto-2">
              <DoorOpenIcon className="size-4 text-apagado" /> Presencial · {a.sala.nome}
            </span>
          )}
          {!a.ehAluno && (
            <Button asChild>
              <Link href={`/agenda/apresentacao?k=${encodeURIComponent(a.k)}&volta=${volta}`} onClick={aoFechar}>
                <MonitorIcon /> Modo apresentação
              </Link>
            </Button>
          )}
          {!a.ehAluno && (
            <Button asChild className="basis-full">
              <Link href={`/agenda/aula?k=${encodeURIComponent(a.k)}&volta=${volta}`} onClick={aoFechar}>
                Detalhes da aula <ChevronRightIcon />
              </Link>
            </Button>
          )}
        </div>
        {f && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-borda px-3 py-2.5">
            <div className="flex min-w-[140px] flex-col">
              <small className="text-sm tracking-[.06em] text-apagado uppercase">Folha do professor</small>
              {f.ve ? (
                <>
                  <span className="text-sm font-semibold text-azul">Valor hora/aula</span>
                  <b className="text-xl">{f.valorTxt}</b>
                  <span className="text-apagado">{f.origem}</span>
                </>
              ) : (
                <b>situação da aula</b>
              )}
            </div>
            <div className="flex min-w-[160px] flex-1 flex-col gap-1">
              <Badge tom={f.sit[1]}>{f.sit[0]}</Badge>
              {f.suporte && (
                <span className="text-apagado">
                  suporte: {f.suporte.motivo}
                  {f.suporte.detalhe ? ` — ${f.suporte.detalhe}` : ''}
                </span>
              )}
              {f.fechada && <span className="text-apagado">competência fechada</span>}
            </div>
            <div className="flex flex-col items-end gap-1">
              {f.podeValor && (
                <Button variant="link" onClick={() => setModo('valor')}>
                  Alterar valor
                </Button>
              )}
              {f.podeSuporte && (
                <Button variant="link" onClick={() => setModo('suporte')}>
                  Pedir suporte
                </Button>
              )}
              {f.podeTirarSuporte && (
                <Button variant="link" disabled={acao.isPending} onClick={() => faz({ acao: 'suporteTirar' })}>
                  Retirar pedido de suporte
                </Button>
              )}
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {mat(a.materiais.pre, 'Pre-Class', BookOpenIcon)}
          {mat(a.materiais.in, 'In-Class', VideoIcon)}
          {mat(a.materiais.post, 'Post-Class', ChevronRightIcon)}
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-borda px-4 py-3">
          <VideoIcon className="size-4 text-apagado" />
          <b>Gravação</b>
          <Badge>{a.gravacao}</Badge>
          {!a.ehAluno && a.sala.zoom && (
            <Button variant="link" className="ml-auto" onClick={() => setModo('transcricao')}>
              <FileTextIcon /> Transcrição
            </Button>
          )}
        </div>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <small className="block text-sm font-semibold text-azul">Alunos</small>
            <b>
              {a.n} {a.n === 1 ? 'aluno' : 'alunos'}
            </b>
          </div>
          {a.podeGerenciar && (
            <Button variant="link" onClick={() => setGer(!ger)}>
              {ger ? 'Concluir' : 'Gerenciar alunos'}
            </Button>
          )}
        </div>
        {ger && a.podeAdicionar && (
          <AdicionarAluno
            candidatos={a.candidatos}
            ocupado={acao.isPending}
            aoAdicionar={(n) => faz({ acao: 'adicionarAluno', aluno: n })}
          />
        )}
        <ul className="grid gap-1">
          {a.alunos.map((x, i) => (
            <li key={`${x.nome}-${i}`} className={cn('flex items-center gap-3 py-1', x.fora && 'opacity-60')}>
              <Avatar nome={x.nome} />
              <div className="min-w-0 flex-1">
                <b className="block truncate">{x.nome}</b>
                <small className="block truncate text-sm text-apagado">
                  {x.email}
                  {x.incluido ? ' · incluído só nesta aula' : ''}
                </small>
              </div>
              {ger && a.podeGerenciar ? (
                <Button
                  size="sm"
                  disabled={acao.isPending}
                  aria-label={`${x.incluido ? 'Remover desta aula' : x.fora ? 'Reagendar' : 'Cancelar agendamento de'} ${x.nome}`}
                  onClick={() => faz({ acao: 'agendamento', aluno: x.nome })}
                >
                  {x.incluido ? 'Remover desta aula' : x.fora ? 'Reagendar' : 'Cancelar'}
                </Button>
              ) : (
                <Badge tom={x.fora || a.cancelada ? 'gray' : 'blue'}>
                  {x.fora ? 'Cancelado' : a.bloqueada ? 'Crédito devolvido' : a.cancelada ? 'Cancelada' : 'Agendado'}
                </Badge>
              )}
            </li>
          ))}
        </ul>
        {a.extra > 0 && (
          <p className="text-apagado">
            + {a.extra} {a.extra === 1 ? 'aluno' : 'alunos'} da turma sem cadastro no portal
          </p>
        )}
        {!a.alunos.length && !a.extra && <p className="text-apagado">nenhum aluno agendado</p>}
      </DialogBody>
      <DialogFoot className="flex-wrap justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {a.podeCancelar ? (
            <Button variant="perigo" onClick={() => setModo('cancelar')}>
              Cancelar aula
            </Button>
          ) : a.podeReabrir ? (
            <Button disabled={acao.isPending} onClick={() => faz({ acao: 'reabrir' })}>
              Desfazer cancelamento
            </Button>
          ) : null}
          {/* 24/09/2026: o professor fica livre, os agendados recebem o crédito e a aula some para os alunos */}
          {a.podeBloquear && (
            <Button disabled={acao.isPending} onClick={() => faz({ acao: 'bloquear' })}>
              {a.bloqueada ? <LockOpenIcon /> : <LockIcon />} {a.bloqueada ? 'Desbloquear horário' : 'Bloquear horário'}
            </Button>
          )}
          {a.encerrarGrade.pode && (
            <Button onClick={() => setModo('encerrar')}>
              <CalendarXIcon /> Encerrar disponibilidade na grade
            </Button>
          )}
          {/* 25/09/2026: o aluno cancela a própria aula até o prazo de cancelamento */}
          {/* 30/09/2026: Regular = solicitar o cancelamento; Particular = também pedir mudança de dias e horários */}
          {a.meuCancelamento &&
            (a.meuCancelamento.modo === 'solicitar' && a.meuCancelamento.pendente ? (
              <span className="self-center text-apagado">Cancelamento pedido — aguardando a equipe pedagógica</span>
            ) : a.meuCancelamento.pode ? (
              <Button
                variant="perigo"
                onClick={() => setModo(a.meuCancelamento?.modo === 'solicitar' ? 'solCancelar' : 'meuCancelar')}
              >
                {a.meuCancelamento.modo === 'solicitar' ? 'Solicitar cancelamento' : 'Cancelar minha aula'}
              </Button>
            ) : (
              <span className="self-center text-apagado">
                Prazo para cancelar terminou em {a.meuCancelamento.ate} ({a.meuCancelamento.regra})
              </span>
            ))}
          {a.meuCancelamento?.mudanca && (
            <Button onClick={() => setModo('solMudanca')}>Solicitar mudança de dias e horários</Button>
          )}
        </div>
        <Button onClick={aoFechar}>Fechar</Button>
      </DialogFoot>
    </>
  );
}

const Campo = ({ rotulo, valor }: { rotulo: string; valor: string }) => (
  <div>
    <dt className="text-sm font-semibold text-azul">{rotulo}</dt>
    <dd className="m-0 break-words text-texto">{valor}</dd>
  </div>
);

/** Gerenciar alunos › Adicionar: aluno com matrícula no curso entra só nesta aula */
function AdicionarAluno({
  candidatos,
  ocupado,
  aoAdicionar,
}: {
  candidatos: string[];
  ocupado: boolean;
  aoAdicionar: (nome: string) => void;
}) {
  const [nome, setNome] = useState('');
  if (!candidatos.length)
    return <p className="m-0 text-apagado">Todos os alunos com matrícula neste curso já estão na aula.</p>;
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="grid min-w-[220px] flex-1 gap-1.5">
        <Label>Adicionar aluno</Label>
        <Escolha
          rotulo="Aluno para adicionar"
          todos="Escolha o aluno…"
          destacar={false}
          valor={nome}
          aoMudar={setNome}
          opcoes={candidatos.map((n) => ({ v: n, l: n }))}
        />
      </div>
      <Button
        disabled={!nome || ocupado}
        onClick={() => {
          aoAdicionar(nome);
          setNome('');
        }}
      >
        <UserPlusIcon /> Adicionar
      </Button>
    </div>
  );
}

/** Alterar tópico: conteúdo do currículo (ou dos acervos do idioma) para esta aula */
function FormTopico({ a, voltar, aoOk }: { a: AulaModelo; voltar: () => void; aoOk: (t: string) => void }) {
  const acao = useAcaoAula(a.k);
  const [v, setV] = useState(a.apresentacao.conteudoAtual);
  return (
    <>
      <DialogHead titulo="Alterar tópico" descricao={a.rot} />
      <DialogBody className="grid gap-3">
        <p className="m-0 text-apagado">Tópico atual: {a.topico || 'sem tópico'}</p>
        <div className="grid gap-1.5">
          <Label>Tópico da aula</Label>
          <Escolha
            rotulo="Tópico da aula"
            todos="Sequência do currículo"
            destacar={false}
            valor={v}
            aoMudar={setV}
            grupos={a.apresentacao.conteudos.map((g) => ({ rot: g.grupo, opcoes: g.itens }))}
          />
        </div>
      </DialogBody>
      <DialogFoot>
        <Erro texto={acao.error?.message} />
        <Button onClick={voltar}>Voltar</Button>
        <Button
          variant="primary"
          disabled={acao.isPending}
          onClick={() => acao.mutate({ acao: 'conteudo', conteudo: v }, { onSuccess: () => aoOk('Tópico alterado.') })}
        >
          Salvar
        </Button>
      </DialogFoot>
    </>
  );
}

/** Transcrição automática do Zoom */
function PainelTranscricao({ a, voltar }: { a: AulaModelo; voltar: () => void }) {
  const q = useTranscricao(a.k);
  const t = q.data;
  return (
    <>
      <DialogHead titulo="Transcrição" descricao={a.rot} />
      <DialogBody className="grid gap-3">
        {q.isPending && <p className="m-0 text-apagado">Buscando a transcrição no Zoom…</p>}
        {q.isError && (
          <Aviso tom="red" icone="alerta">
            {q.error.message}
          </Aviso>
        )}
        {t && !t.ok && <Aviso icone="alerta">{t.motivo}</Aviso>}
        {t?.ok &&
          (t.linhas.length ? (
            <ol className="m-0 grid max-h-[50vh] list-none gap-2 overflow-auto p-0">
              {t.linhas.map((l) => (
                <li key={`${l.tempo}-${l.texto.slice(0, 30)}`} className="flex gap-3">
                  <span className="shrink-0 text-apagado tabular-nums">{l.tempo}</span>
                  <span className="text-texto">{l.texto}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="m-0 text-apagado">A transcrição veio vazia.</p>
          ))}
      </DialogBody>
      <DialogFoot>
        <Button onClick={voltar}>Voltar</Button>
      </DialogFoot>
    </>
  );
}

/** Encerrar disponibilidade na grade: o horário do módulo sai da grade a partir desta aula */
function FormEncerrar({ a, voltar, aoOk }: { a: AulaModelo; voltar: () => void; aoOk: (t: string) => void }) {
  const acao = useAcaoAula(a.k);
  return (
    <>
      <DialogHead titulo="Encerrar disponibilidade na grade" descricao={a.rot} />
      <DialogBody className="grid gap-3">
        <p className="m-0">
          O horário <b>{a.inicio}</b> de <b>{a.dataTxt.split(',')[0]}</b> sai da grade de <b>{a.mod}</b> a partir desta
          aula ({a.dataTxt.split(', ')[1]}): esta e as próximas deixam de existir na Agenda.
        </p>
        <p className="m-0 text-apagado">
          As aulas que já aconteceram continuam no histórico. Para voltar, cadastre o horário de novo em Cursos ›
          Módulos.
        </p>
      </DialogBody>
      <DialogFoot>
        <Erro texto={acao.error?.message} />
        <Button onClick={voltar}>Voltar</Button>
        <Button
          variant="perigo"
          disabled={acao.isPending}
          onClick={() => acao.mutate({ acao: 'encerrarGrade' }, { onSuccess: (r) => aoOk(r.msg) })}
        >
          Encerrar na grade
        </Button>
      </DialogFoot>
    </>
  );
}

function Erro({ texto }: { texto?: string }) {
  return texto ? (
    <span role="alert" className="mr-auto font-medium text-vermelho">
      {texto}
    </span>
  ) : null;
}

function FormProf({ a, voltar, aoOk }: { a: AulaModelo; voltar: () => void; aoOk: (t: string) => void }) {
  const acao = useAcaoAula(a.k);
  const [prof, setProf] = useState(a.prof === '—' ? '' : a.prof);
  const [erro, setErro] = useState('');
  return (
    <>
      <DialogHead titulo="Alterar professor" descricao={a.rot} />
      <DialogBody className="grid gap-1.5">
        <Label>
          Professor<span className="text-vermelho">*</span>
        </Label>
        <Escolha
          rotulo="Professor"
          valor={prof}
          aoMudar={setProf}
          destacar={false}
          opcoes={a.profsHabilitados.map((n) => ({ v: n, l: n }))}
        />
        <span className="text-apagado">
          só aparecem os professores habilitados em {a.prod}
          {a.mod ? ` · ${a.mod}` : ''}; a troca vale só para esta aula
        </span>
      </DialogBody>
      <DialogFoot>
        <Erro texto={erro} />
        <Button onClick={voltar}>Voltar</Button>
        <Button
          variant="primary"
          disabled={acao.isPending}
          onClick={() => {
            if (!prof) return setErro('Escolha o professor.');
            if (prof === a.prof) return voltar();
            acao.mutate(
              { acao: 'professor', prof },
              { onSuccess: (r) => aoOk(r.msg), onError: (e) => setErro(e.message) },
            );
          }}
        >
          Salvar
        </Button>
      </DialogFoot>
    </>
  );
}

function FormCancelar({ a, voltar, aoOk }: { a: AulaModelo; voltar: () => void; aoOk: (t: string) => void }) {
  const acao = useAcaoAula(a.k);
  const [erro, setErro] = useState('');
  return (
    <>
      <DialogHead titulo="Cancelar aula" descricao={a.rot} />
      <DialogBody>
        <div className="rounded-lg border border-[#f5c2c7] bg-vermelho-suave px-4 py-3">
          <p className="mb-2.5">
            A aula sai da agenda e {a.n} {a.n === 1 ? 'aluno agendado perde' : 'alunos agendados perdem'} a aula. O
            crédito volta ao extrato conforme a política de cancelamento.
          </p>
          <p className="text-apagado">Dá para desfazer enquanto a aula não acontecer.</p>
        </div>
      </DialogBody>
      <DialogFoot>
        <Erro texto={erro} />
        <Button onClick={voltar}>Voltar</Button>
        <Button
          variant="perigo"
          disabled={acao.isPending}
          onClick={() =>
            acao.mutate({ acao: 'cancelar' }, { onSuccess: (r) => aoOk(r.msg), onError: (e) => setErro(e.message) })
          }
        >
          Cancelar aula
        </Button>
      </DialogFoot>
    </>
  );
}

function FormMeuCancelar({
  a,
  voltar,
  aoOk,
}: {
  a: AulaModelo;
  voltar: () => void;
  aoOk: (t: string, saiu: boolean) => void;
}) {
  const acao = useAcaoAula(a.k);
  const [erro, setErro] = useState('');
  const m = a.meuCancelamento!;
  return (
    <>
      <DialogHead titulo="Cancelar minha aula" descricao={a.rot} />
      <DialogBody>
        <div className="rounded-lg border border-[#f5c2c7] bg-vermelho-suave px-4 py-3">
          <p className="mb-2.5">
            {m.flow
              ? 'Você sai desta aula particular e o crédito do Community Flow volta para você agendar outro horário.'
              : 'Você sai desta aula e sua presença deixa de ser esperada.'}
          </p>
          <p className="text-apagado">
            Cancelamento {m.regra} da aula: dá para cancelar até {m.ate}.
          </p>
        </div>
      </DialogBody>
      <DialogFoot>
        <Erro texto={erro} />
        <Button onClick={voltar}>Voltar</Button>
        <Button
          variant="perigo"
          disabled={acao.isPending}
          onClick={() =>
            acao.mutate(
              { acao: 'meuCancelamento' },
              { onSuccess: (r) => aoOk(r.msg, m.flow), onError: (e) => setErro(e.message) },
            )
          }
        >
          Cancelar minha aula
        </Button>
      </DialogFoot>
    </>
  );
}

/** 30/09/2026: o aluno pede e a equipe pedagógica decide (cancelamento no Regular, mudança de horário no Particular) */
function FormSolicitar({
  a,
  tipo,
  voltar,
  aoOk,
}: {
  a: AulaModelo;
  tipo: 'cancelamento' | 'mudanca';
  voltar: () => void;
  aoOk: (t: string) => void;
}) {
  const acao = useAcaoAula(a.k);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState('');
  const cancel = tipo === 'cancelamento';
  const m = a.meuCancelamento!;
  return (
    <>
      <DialogHead
        titulo={cancel ? 'Solicitar cancelamento' : 'Solicitar mudança de dias e horários'}
        descricao={a.rot}
      />
      <DialogBody className="grid gap-3">
        <p className="m-0 text-texto-2">
          {cancel
            ? `No curso em turma, quem cancela é a equipe pedagógica: você continua na aula até o pedido ser aprovado. Dá para pedir até ${m.ate}.`
            : 'Sua grade é fixa: diga os dias e horários que você prefere e a equipe pedagógica combina a mudança com você e o professor.'}
        </p>
        <div className="grid gap-1.5">
          <Label htmlFor="sol-texto">
            {cancel ? 'Motivo (opcional)' : 'Dias e horários que você quer'}
            {!cancel && <span className="text-vermelho">*</span>}
          </Label>
          <textarea
            id="sol-texto"
            rows={3}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={cancel ? 'Ex.: viagem a trabalho' : 'Ex.: terças e quintas às 19h, a partir de novembro'}
            className="min-h-20 rounded-md border border-borda-forte bg-card px-3 py-2 text-sm outline-none focus:border-azul focus:ring-2 focus:ring-azul/20"
          />
        </div>
      </DialogBody>
      <DialogFoot>
        <Erro texto={erro} />
        <Button onClick={voltar}>Voltar</Button>
        <Button
          variant={cancel ? 'perigo' : 'primary'}
          disabled={acao.isPending || (!cancel && texto.trim().length < 3)}
          onClick={() =>
            acao.mutate(
              cancel ? { acao: 'solicitarCancelamento', motivo: texto } : { acao: 'solicitarMudanca', pedido: texto },
              {
                onSuccess: (r) => aoOk(r.msg),
                onError: (e) => setErro(e.message),
              },
            )
          }
        >
          Enviar pedido
        </Button>
      </DialogFoot>
    </>
  );
}

function FormValor({ a, voltar, aoOk }: { a: AulaModelo; voltar: () => void; aoOk: (t: string) => void }) {
  const acao = useAcaoAula(a.k);
  const f = a.folha!;
  const [valor, setValor] = useState(String(f.valor ?? ''));
  const [motivo, setMotivo] = useState(f.valorMotivo);
  const [erro, setErro] = useState('');
  return (
    <>
      <DialogHead titulo="Valor desta aula" descricao={a.rot} />
      <DialogBody className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="av-valor">
            Valor hora/aula (R$)<span className="text-vermelho">*</span>
          </Label>
          <Input id="av-valor" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
          <span className="text-apagado">
            da alocação: R$ {f.valorBase?.toLocaleString('pt-BR')} — a troca vale só para esta aula
          </span>
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="av-motivo">
            Motivo<span className="text-vermelho">*</span>
          </Label>
          <Input
            id="av-motivo"
            placeholder="Ex.: aula estendida, deslocamento, feriado"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </div>
      </DialogBody>
      <DialogFoot>
        <Erro texto={erro} />
        {f.alterado && (
          <Button
            disabled={acao.isPending}
            onClick={() =>
              acao.mutate(
                { acao: 'valorVoltar' },
                { onSuccess: (r) => aoOk(r.msg), onError: (e) => setErro(e.message) },
              )
            }
          >
            Voltar ao valor da alocação
          </Button>
        )}
        <Button onClick={voltar}>Voltar</Button>
        <Button
          variant="primary"
          disabled={acao.isPending}
          onClick={() => {
            const n = Number(valor.replace(/\./g, '').replace(',', '.'));
            if (!(n >= 0) || valor.trim() === '') return setErro('Informe o valor em reais.');
            if (!motivo.trim()) return setErro('Diga o motivo da troca.');
            acao.mutate(
              { acao: 'valor', valor: n, motivo },
              { onSuccess: (r) => aoOk(r.msg), onError: (e) => setErro(e.message) },
            );
          }}
        >
          Salvar valor
        </Button>
      </DialogFoot>
    </>
  );
}

export function FormSuporte({ a, voltar, aoOk }: { a: AulaModelo; voltar: () => void; aoOk: (t: string) => void }) {
  const acao = useAcaoAula(a.k);
  const f = a.folha!;
  const [motivo, setMotivo] = useState('');
  const [detalhe, setDetalhe] = useState('');
  const [erro, setErro] = useState('');
  return (
    <>
      <DialogHead titulo="Pedir suporte" descricao={a.rot} />
      <DialogBody className="grid gap-3">
        <div className="grid gap-1.5">
          <Label>
            Motivo<span className="text-vermelho">*</span>
          </Label>
          <Escolha
            rotulo="Motivo"
            todos="escolha o motivo"
            destacar={false}
            valor={motivo}
            aoMudar={setMotivo}
            opcoes={f.motivos.map((m) => ({ v: m, l: m }))}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sup-det">O que aconteceu</Label>
          <textarea
            id="sup-det"
            rows={3}
            value={detalhe}
            onChange={(e) => setDetalhe(e.target.value)}
            placeholder="Ex.: o aluno não conseguiu entrar no Zoom e a coordenação assumiu"
            className="rounded-md border border-borda-forte bg-card px-3 py-2 focus:border-azul focus:shadow-anel focus-visible:outline-none"
          />
        </div>
        <p className="text-apagado">
          A coordenação recebe o pedido. Aula com pedido de suporte é descontada da folha de {a.prof}
          {f.ve ? ` (${f.valorTxt})` : ''}.
        </p>
      </DialogBody>
      <DialogFoot>
        <Erro texto={erro} />
        <Button onClick={voltar}>Voltar</Button>
        <Button
          variant="primary"
          disabled={acao.isPending}
          onClick={() => {
            if (!motivo) return setErro('Escolha o motivo.');
            acao.mutate(
              { acao: 'suporte', motivo, detalhe },
              { onSuccess: (r) => aoOk(r.msg), onError: (e) => setErro(e.message) },
            );
          }}
        >
          Registrar pedido
        </Button>
      </DialogFoot>
    </>
  );
}
