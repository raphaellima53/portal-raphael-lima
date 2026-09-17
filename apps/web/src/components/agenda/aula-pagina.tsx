'use client';

import { CheckIcon, ChevronLeftIcon, CopyIcon, HeadphonesIcon, MonitorIcon, VideoIcon, XIcon } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Aviso, PageHead } from '@/components/ds';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { type AulaModelo, useAcaoAula, useAula } from '@/lib/agenda';
import { cn } from '@/lib/utils';
import { Avatar, cursoTxt, PRESENCA, QuandoAula, TagsAula } from './aula-comum';
import { AulaDialog, FormSuporte } from './aula-dialog';

export const voltaSegura = (v: string | null, padrao = '/agenda') =>
  v?.startsWith('/') && !v.startsWith('//') ? v : padrao;

/** botões Presente/Falta de um aluno */
export function PresencaBotoes({
  nome,
  p,
  aoMarcar,
  desabilitado,
}: {
  nome: string;
  p: string | null;
  aoMarcar: (v: 'presente' | 'falta') => void;
  desabilitado?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={`Presença de ${nome}`}
      className="inline-flex overflow-hidden rounded-md border border-borda"
    >
      <button
        type="button"
        aria-pressed={p === 'presente'}
        disabled={desabilitado}
        onClick={() => aoMarcar('presente')}
        className={cn(
          'inline-flex h-9 cursor-pointer items-center gap-1.5 px-3 text-texto-2 hover:bg-hover',
          p === 'presente' && 'bg-verde-suave font-semibold text-verde hover:bg-verde-suave',
        )}
      >
        <CheckIcon className="size-3.5" /> Presente
      </button>
      <button
        type="button"
        aria-pressed={p === 'falta'}
        disabled={desabilitado}
        onClick={() => aoMarcar('falta')}
        className={cn(
          'inline-flex h-9 cursor-pointer items-center gap-1.5 border-l border-borda px-3 text-texto-2 hover:bg-hover',
          p === 'falta' && 'bg-vermelho-suave font-semibold text-vermelho hover:bg-vermelho-suave',
        )}
      >
        <XIcon className="size-3.5" /> Falta
      </button>
    </div>
  );
}

/** bloco "Folha e suporte" da página da aula e do modo apresentação */
export function FolhaBloco({ a, aoMsg }: { a: AulaModelo; aoMsg: (m: { txt: string; erro?: boolean }) => void }) {
  const f = a.folha;
  const acao = useAcaoAula(a.k);
  const [suporte, setSuporte] = useState(false);
  const [valor, setValor] = useState(false);
  if (!f) return null;
  return (
    <>
      <div className="mb-2.5 flex items-center gap-2">
        <HeadphonesIcon className="size-4 text-apagado" />
        <b className="text-md">Folha e suporte</b>
        <span className="flex-1" />
        <Badge tom={f.sit[1]}>{f.sit[0]}</Badge>
      </div>
      <p className="mb-2.5 text-texto-2">
        {f.ve ? `${f.valorTxt} para ` : 'Professor: '}
        {a.prof === '—' ? '—' : a.prof}
        {f.suporte ? ` · suporte pedido: ${f.suporte.motivo}${f.suporte.detalhe ? ` — ${f.suporte.detalhe}` : ''}` : ''}
      </p>
      <div className="flex flex-wrap gap-2">
        {f.podeSuporte && <Button onClick={() => setSuporte(true)}>Pedir suporte</Button>}
        {f.podeTirarSuporte && (
          <Button
            disabled={acao.isPending}
            onClick={() =>
              acao.mutate(
                { acao: 'suporteTirar' },
                { onSuccess: (r) => aoMsg({ txt: r.msg }), onError: (e) => aoMsg({ txt: e.message, erro: true }) },
              )
            }
          >
            Retirar pedido de suporte
          </Button>
        )}
        {f.podeValor && <Button onClick={() => setValor(true)}>Alterar valor</Button>}
      </div>
      <Dialog open={suporte} onOpenChange={setSuporte}>
        <DialogContent tamanho="sm">
          <FormSuporte
            a={a}
            voltar={() => setSuporte(false)}
            aoOk={(t) => {
              setSuporte(false);
              aoMsg({ txt: t });
            }}
          />
        </DialogContent>
      </Dialog>
      {valor && <AulaDialog k={a.k} aoFechar={() => setValor(false)} />}
    </>
  );
}

/** Página da aula: sala e lista de presença (Marcar todos presentes, Iniciar e Concluir aula). */
export function AulaPagina() {
  const sp = useSearchParams();
  const k = sp.get('k');
  const volta = voltaSegura(sp.get('volta'));
  const q = useAula(k);
  const acao = useAcaoAula(k);
  const [msg, setMsg] = useState<{ txt: string; erro?: boolean } | null>(null);
  const voltar = (
    <Button asChild>
      <Link href={volta}>
        <ChevronLeftIcon /> Voltar
      </Link>
    </Button>
  );
  if (q.isError || !k) {
    return (
      <>
        <PageHead titulo="Aula não encontrada" acoes={voltar} />
        <Aviso icone="info">{q.error?.message ?? 'Esta aula não existe mais na agenda.'}</Aviso>
      </>
    );
  }
  const a = q.data;
  if (!a) return <p className="text-apagado">Carregando…</p>;
  const pg = a.pagina;
  const faz = (d: Parameters<typeof acao.mutate>[0]) =>
    acao.mutate(d, {
      onSuccess: (r) => setMsg(r.msg ? { txt: r.msg } : null),
      onError: (e) => setMsg({ txt: e.message, erro: true }),
    });
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(a.sala.url);
      setMsg({ txt: 'Link da sala copiado.' });
    } catch {
      setMsg({ txt: `Link: ${a.sala.url}` });
    }
  };
  const est: AulaModelo['est'] = pg.iniciada && !pg.concluida && !a.cancelada ? ['Em andamento', 'blue'] : a.est;

  return (
    <>
      <PageHead
        titulo={a.titulo}
        acoes={
          <>
            {voltar}
            {!a.ehAluno && (
              <Button asChild variant="primary">
                <Link href={`/agenda/apresentacao?k=${encodeURIComponent(a.k)}&volta=${encodeURIComponent(volta)}`}>
                  <MonitorIcon /> Modo apresentação
                </Link>
              </Button>
            )}
          </>
        }
      />
      {msg && (
        <Aviso tom={msg.erro ? 'red' : 'blue'} icone={msg.erro ? 'alerta' : 'ok'}>
          {msg.txt}
        </Aviso>
      )}
      <Card className="mb-4 grid gap-2.5 px-5 py-4">
        <TagsAula a={a} est={est} />
        <p className="text-apagado">{cursoTxt(a)}</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <QuandoAula a={a} />
          <span>
            <small className="mr-1 text-sm font-semibold text-azul">Professor</small>
            {a.prof === '—' ? 'a definir' : a.prof}
            {a.sub ? ` (no lugar de ${a.sub})` : ''}
          </span>
        </div>
      </Card>
      <Card className="mb-4 px-5 py-4">
        <div className="mb-2.5 flex items-center gap-2">
          <VideoIcon className="size-4 text-azul" />
          <b>Sala de aula</b>
        </div>
        {a.sala.zoom && !a.cancelada ? (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="primary">
              <a href={a.sala.url} target="_blank" rel="noopener noreferrer">
                <VideoIcon /> Entrar na sala de aula
              </a>
            </Button>
            <Button size="icon" aria-label="Copiar link da sala" onClick={copiar}>
              <CopyIcon />
            </Button>
          </div>
        ) : (
          <p className="text-apagado">{a.cancelada ? 'Aula cancelada.' : `Presencial · ${a.sala.nome}`}</p>
        )}
      </Card>
      {a.folha && (
        <Card className="mb-4 px-5 py-4">
          <FolhaBloco a={a} aoMsg={setMsg} />
        </Card>
      )}
      <Card className="mb-4 px-5 py-4">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div className="flex-1">
            <small className="block text-sm font-semibold text-azul">Lista de presença</small>
            <b className="block">
              {pg.lista.length} {pg.lista.length === 1 ? 'aluno' : 'alunos'}
            </b>
            {pg.podePresenca && (
              <span className="text-apagado">
                {pg.marcados} de {pg.lista.length} marcados
              </span>
            )}
          </div>
          {pg.podePresenca && (
            <div className="flex flex-wrap gap-2">
              <Button disabled={acao.isPending} onClick={() => faz({ acao: 'todosPresentes' })}>
                Marcar todos presentes
              </Button>
              {!pg.iniciada && (
                <Button disabled={acao.isPending} onClick={() => faz({ acao: 'iniciar' })}>
                  Iniciar aula
                </Button>
              )}
              <Button variant="primary" disabled={acao.isPending} onClick={() => faz({ acao: 'concluir' })}>
                Concluir aula
              </Button>
            </div>
          )}
        </div>
        {pg.aviso && (
          <Aviso icone="trava" tom="gray">
            {pg.aviso}
          </Aviso>
        )}
        <ul className="grid gap-2">
          {pg.lista.map((x) => (
            <li key={x.nome} className="flex flex-wrap items-center gap-3 rounded-lg border border-borda px-3.5 py-2.5">
              <Avatar nome={x.nome} />
              <div className="min-w-0 flex-1">
                <b className="block">{x.nome}</b>
                <small className="text-sm text-apagado">{x.email}</small>
              </div>
              {pg.podePresenca ? (
                <PresencaBotoes
                  nome={x.nome}
                  p={x.p}
                  desabilitado={acao.isPending}
                  aoMarcar={(v) => faz({ acao: 'presenca', aluno: x.nome, valor: v })}
                />
              ) : (
                <Badge tom={x.p ? PRESENCA[x.p][1] : 'gray'}>{x.p ? PRESENCA[x.p][0] : '—'}</Badge>
              )}
            </li>
          ))}
        </ul>
        {pg.semCadastro > 0 && (
          <p className="mt-2 text-apagado">
            + {pg.semCadastro} alunos da turma sem cadastro no portal — a presença deles é lançada na turma
          </p>
        )}
        {!pg.lista.length && <p className="text-apagado">nenhum aluno com cadastro no portal nesta aula</p>}
      </Card>
    </>
  );
}
