'use client';

import { BookOpenIcon, ChevronRightIcon, CopyIcon, DoorOpenIcon, MonitorIcon, VideoIcon } from 'lucide-react';
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
import { type AulaModelo, useAcaoAula, useAula } from '@/lib/agenda';
import { cn } from '@/lib/utils';
import { Avatar, cursoTxt, QuandoAula, TagsAula } from './aula-comum';

type Modo = '' | 'prof' | 'cancelar' | 'valor' | 'suporte';

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
        <div className="grid gap-1.5 rounded-lg bg-bg px-[18px] py-4">
          <h3 className="text-xl font-bold text-texto">{a.titulo}</h3>
          <p className="text-apagado">{cursoTxt(a)}</p>
          <QuandoAula a={a} />
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
          {a.sala.zoom ? (
            <>
              <Button asChild variant="primary" className="flex-[1_1_220px]">
                <a href={a.sala.url} target="_blank" rel="noopener noreferrer">
                  <VideoIcon /> Abrir sala
                </a>
              </Button>
              <Button size="icon" aria-label="Copiar link da sala" onClick={copiar}>
                <CopyIcon />
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
          {mat(a.materiais.pre, 'Pre class', BookOpenIcon)}
          {mat(a.materiais.in, 'In class', VideoIcon)}
          {mat(a.materiais.post, 'Post class', ChevronRightIcon)}
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-borda px-4 py-3">
          <VideoIcon className="size-4 text-apagado" />
          <b>Gravação</b>
          <Badge>{a.gravacao}</Badge>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <small className="block text-sm font-semibold text-azul">Alunos</small>
            <b>
              {a.n} {a.n === 1 ? 'aluno' : 'alunos'}
            </b>
          </div>
          {a.podeGerenciar && a.alunos.length > 0 && (
            <Button variant="link" onClick={() => setGer(!ger)}>
              {ger ? 'Concluir' : 'Gerenciar'}
            </Button>
          )}
        </div>
        <ul className="grid gap-1">
          {a.alunos.map((x) => (
            <li key={x.nome} className={cn('flex items-center gap-3 py-1', x.fora && 'opacity-60')}>
              <Avatar nome={x.nome} />
              <div className="min-w-0 flex-1">
                <b className="block truncate">{x.nome}</b>
                <small className="block truncate text-sm text-apagado">{x.email}</small>
              </div>
              {ger && a.podeGerenciar ? (
                <Button size="sm" disabled={acao.isPending} onClick={() => faz({ acao: 'agendamento', aluno: x.nome })}>
                  {x.fora ? 'Reagendar' : 'Cancelar agendamento'}
                </Button>
              ) : (
                <Badge tom={x.fora || a.cancelada ? 'gray' : 'blue'}>
                  {x.fora ? 'Cancelado' : a.cancelada ? 'Cancelada' : 'Agendado'}
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
      <DialogFoot className="justify-between">
        {a.podeCancelar ? (
          <Button variant="perigo" onClick={() => setModo('cancelar')}>
            Cancelar aula
          </Button>
        ) : a.podeReabrir ? (
          <Button disabled={acao.isPending} onClick={() => faz({ acao: 'reabrir' })}>
            Desfazer cancelamento
          </Button>
        ) : (
          <span />
        )}
        <Button onClick={aoFechar}>Fechar</Button>
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
