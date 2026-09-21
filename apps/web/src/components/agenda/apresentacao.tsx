'use client';

import {
  BookOpenIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  MailIcon,
  PencilIcon,
  UserCheckIcon,
  VideoIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Aviso, PageHead } from '@/components/ds';
import { Escolha } from '@/components/escolha';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { type Slide, useAcaoAula, useAula } from '@/lib/agenda';
import { corSobreEscuro } from '@/lib/cor';
import { cn } from '@/lib/utils';
import { iniciais, PRESENCA, TagsAula } from './aula-comum';
import { FolhaBloco, PresencaBotoes, voltaSegura } from './aula-pagina';

function SlideVista({ s, cor }: { s: Slide; cor: string }) {
  const rot = (
    <small
      className="text-[clamp(14px,1.1vw,15px)] font-bold tracking-[.14em] uppercase"
      style={{ color: corSobreEscuro(cor) }}
    >
      {s.rot}
    </small>
  );
  return (
    <div
      role="region"
      aria-roledescription="slide"
      aria-label={s.rot}
      className="relative flex aspect-video w-full flex-col justify-center gap-3 overflow-hidden rounded-[12px] bg-[#0f172a] p-[clamp(18px,5%,56px)] text-white"
      style={{ borderTop: `6px solid ${cor}` }}
    >
      {rot}
      {s.k === 'capa' && (
        <>
          <h2 className="text-[clamp(22px,3.2vw,46px)] leading-[1.1] font-extrabold text-balance">{s.titulo}</h2>
          <p className="text-[clamp(14px,1.3vw,18px)] text-[#cbd5e1]">{s.sub}</p>
          <p className="text-[clamp(14px,1vw,15px)] text-[#94a3b8]">{s.meta}</p>
        </>
      )}
      {(s.k === 'aq' || s.k === 'pr' || s.k === 'fim') && (
        <h3 className="text-[clamp(18px,2.2vw,32px)] leading-[1.25] font-semibold text-balance">{s.texto}</h3>
      )}
      {s.k === 'voc' && (
        <>
          <div className="flex flex-wrap gap-2.5">
            {s.palavras.map((p) => (
              <span key={p.w} className="flex flex-col rounded-[10px] border border-white/20 bg-white/8 px-3.5 py-2">
                <b className="text-[clamp(15px,1.7vw,24px)]">{p.w}</b>
                {p.classe && <i className="text-sm text-[#94a3b8] not-italic">{p.classe}</i>}
              </span>
            ))}
          </div>
          <p className="text-[clamp(14px,1.3vw,18px)] text-[#cbd5e1]">{s.texto}</p>
        </>
      )}
      {s.k === 'gram' && (
        <>
          <h2 className="text-[clamp(22px,3.2vw,46px)] leading-[1.1] font-extrabold">{s.titulo}</h2>
          <p className="text-[clamp(14px,1.3vw,18px)] text-[#cbd5e1]">{s.texto}</p>
        </>
      )}
      {s.k === 'mat' && (
        <>
          <h3 className="text-[clamp(18px,2.2vw,32px)] font-semibold">{s.titulo}</h3>
          <Button asChild variant="primary" className="self-start">
            <a href={s.url} target="_blank" rel="noopener noreferrer">
              <BookOpenIcon /> Abrir material In-class
            </a>
          </Button>
          <p className="break-all text-[#94a3b8]">{s.url}</p>
        </>
      )}
    </div>
  );
}

/** Modo apresentação: Zoom, conteúdo em slides e presença numa página só. */
export function Apresentacao() {
  const sp = useSearchParams();
  const k = sp.get('k');
  const volta = voltaSegura(sp.get('volta'));
  const q = useAula(k);
  const acao = useAcaoAula(k);
  const [slide, setSlide] = useState(0);
  const [msg, setMsg] = useState<{ txt: string; erro?: boolean } | null>(null);
  const [notas, setNotas] = useState<string | null>(null);
  const [notasOk, setNotasOk] = useState(false);
  const a = q.data;
  const total = a?.apresentacao.slides.length ?? 0;

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (
        e.altKey ||
        e.ctrlKey ||
        e.metaKey ||
        /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) ||
        t.isContentEditable ||
        document.querySelector('[role=dialog]')
      )
        return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        setSlide((s) => Math.min(total - 1, s + 1));
      }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setSlide((s) => Math.max(0, s - 1));
      }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [total]);

  const sair = (
    <Button asChild>
      <Link href={volta}>
        <ChevronLeftIcon /> Sair da apresentação
      </Link>
    </Button>
  );
  if (q.isError || !k) {
    return (
      <>
        <PageHead titulo="Aula não encontrada" acoes={sair} />
        <Aviso icone="info">{q.error?.message ?? 'Esta aula não existe mais na agenda.'}</Aviso>
      </>
    );
  }
  if (!a) return <p className="text-apagado">Carregando…</p>;
  const ap = a.apresentacao;
  const z = ap.zoom;
  const si = Math.min(slide, ap.slides.length - 1);
  const s = ap.slides[si];
  const faz = (d: Parameters<typeof acao.mutate>[0], depois?: () => void) =>
    acao.mutate(d, {
      onSuccess: (r) => {
        if (r.msg) setMsg({ txt: r.msg });
        depois?.();
      },
      onError: (e) => setMsg({ txt: e.message, erro: true }),
    });
  const mat = (url: string, rot: string) =>
    url ? (
      <Button asChild size="sm">
        <a href={url} target="_blank" rel="noopener noreferrer">
          {rot}
        </a>
      </Button>
    ) : (
      <Button size="sm" disabled>
        {rot} · sem link
      </Button>
    );
  const lista = a.pagina.lista;
  const marcados = a.pagina.marcados;

  return (
    <>
      <PageHead
        titulo={a.titulo}
        acoes={
          <>
            {sair}
            <Button asChild>
              <Link href={`/agenda/aula?k=${encodeURIComponent(a.k)}&volta=${encodeURIComponent(volta)}`}>
                Página da aula
              </Link>
            </Button>
          </>
        }
      />
      {msg && (
        <Aviso tom={msg.erro ? 'red' : 'blue'} icone={msg.erro ? 'alerta' : 'ok'}>
          {msg.txt}
        </Aviso>
      )}
      <div className="mb-3.5 flex flex-wrap items-center gap-3">
        <TagsAula a={a} est={ap.est} semTipo />
        <span className="text-apagado">
          {a.dataTxt} · {a.horario} · {a.prof === '—' ? 'professor a definir' : a.prof}
          {ap.emAulaHa != null ? ` · em aula há ${ap.emAulaHa} min` : ''}
        </span>
      </div>
      {ap.trava && (
        <Aviso icone="trava" tom="gray">
          {ap.trava}
        </Aviso>
      )}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
        <Card className="min-w-0 px-4 py-3.5">
          <section aria-label="Conteúdo">
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <b className="text-md">Conteúdo</b>
              <span className="text-apagado">{ap.curriculo}</span>
              <span className="flex-1" />
              <Escolha
                rotulo="Conteúdo da aula"
                todos="sequência do currículo"
                destacar={false}
                valor={ap.conteudoAtual}
                disabled={!ap.podeConteudo || acao.isPending}
                aoMudar={(v) => faz({ acao: 'conteudo', conteudo: v }, () => setSlide(0))}
                grupos={ap.conteudos.map((g) => ({ rot: g.grupo, opcoes: g.itens.map((i) => ({ v: i.v, l: i.l })) }))}
                className="w-[320px] max-w-full"
              />
            </div>
            {s && <SlideVista s={s} cor={a.corCurso} />}
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <Button disabled={!si} onClick={() => setSlide(si - 1)}>
                <ChevronLeftIcon /> Anterior
              </Button>
              <div role="group" aria-label="Slides" className="flex flex-1 flex-wrap justify-center gap-1.5">
                {ap.slides.map((x, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Slide ${i + 1}: ${x.rot}`}
                    aria-current={i === si}
                    onClick={() => setSlide(i)}
                    className={cn(
                      'size-[30px] cursor-pointer rounded-full border border-borda bg-card text-texto-2',
                      i === si && 'border-azul bg-azul text-white',
                    )}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <Button variant="primary" disabled={si >= ap.slides.length - 1} onClick={() => setSlide(si + 1)}>
                Próximo <ChevronRightIcon />
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-borda-suave pt-3">
              <span className="text-apagado">
                {si + 1} de {ap.slides.length} · {s?.rot} · setas ← → do teclado trocam o slide
              </span>
              <span className="flex-1" />
              {mat(a.materiais.pre, 'Pre-class')}
              {mat(a.materiais.in, 'In-class')}
              {mat(a.materiais.post, 'Post-class')}
            </div>
          </section>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          <Card className="px-4 py-3.5">
            <section aria-label="Zoom">
              <div className="mb-2.5 flex items-center gap-2">
                <VideoIcon className="size-4 text-apagado" />
                <b className="text-md">Zoom</b>
                <span className="flex-1" />
                {a.sala.zoom ? (
                  z.aberta ? (
                    <span className="inline-flex items-center gap-1.5 font-bold text-vermelho">
                      <i className="size-2 rounded-full bg-vermelho" />
                      ao vivo · {z.minutos} min
                    </span>
                  ) : (
                    <Badge tom={z.durou != null ? 'gray' : 'amber'}>
                      {z.durou != null ? `encerrada · ${z.durou} min` : 'não iniciada'}
                    </Badge>
                  )
                ) : (
                  <Badge tom="purple">presencial</Badge>
                )}
              </div>
              {!a.sala.zoom ? (
                <p className="text-texto-2">Aula presencial na {a.sala.nome}: não há reunião no Zoom.</p>
              ) : (
                <>
                  <p className="mb-2.5 break-all text-texto-2">
                    {a.sala.nome} · <span className="text-apagado">{a.sala.url}</span>
                  </p>
                  {ap.podeOperar && (
                    <div className="mb-2.5 flex flex-wrap gap-2">
                      <Button asChild variant="primary">
                        <a
                          href={a.sala.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => faz({ acao: 'zoomAbrir' })}
                        >
                          <VideoIcon /> {z.aberta ? 'Voltar para a reunião' : 'Iniciar reunião no Zoom'}
                        </a>
                      </Button>
                      <Button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(a.sala.url);
                            setMsg({ txt: 'Link da sala copiado.' });
                          } catch {
                            setMsg({ txt: `Link: ${a.sala.url}` });
                          }
                        }}
                      >
                        <CopyIcon /> Copiar link
                      </Button>
                      <Button disabled={acao.isPending} onClick={() => faz({ acao: 'zoomEnviar' })}>
                        <MailIcon /> Enviar link aos alunos
                      </Button>
                      {z.aberta && (
                        <>
                          <Button
                            aria-pressed={z.gravando}
                            className={cn(z.gravando && 'border-vermelho text-vermelho')}
                            onClick={() => faz({ acao: 'zoomGravar' })}
                          >
                            {z.gravando ? '● Pausar gravação' : 'Gravar aula'}
                          </Button>
                          <Button onClick={() => faz({ acao: 'zoomEncerrar' })}>Encerrar reunião</Button>
                        </>
                      )}
                    </div>
                  )}
                  <p className="text-apagado">
                    {z.enviado ? `link enviado às ${z.enviado} · ` : ''}
                    {z.gravou ? 'aula com gravação · ' : ''}a reunião abre numa aba do Zoom; o portal marca o início e o
                    fim
                  </p>
                </>
              )}
            </section>
          </Card>

          <Card className="px-4 py-3.5">
            <section aria-label="Presença">
              <div className="mb-2.5 flex items-center gap-2">
                <UserCheckIcon className="size-4 text-apagado" />
                <b className="text-md">Presença</b>
                <span className="flex-1" />
                <b className="text-texto-2">
                  {ap.presentes} {ap.presentes === 1 ? 'presente' : 'presentes'} · {marcados} de {lista.length} marcados
                </b>
              </div>
              {ap.podeOperar && lista.length > 0 && (
                <div className="mb-2.5 flex flex-wrap gap-2">
                  <Button disabled={acao.isPending} onClick={() => faz({ acao: 'todosPresentes' })}>
                    Marcar todos presentes
                  </Button>
                  <Button
                    variant="primary"
                    disabled={acao.isPending}
                    onClick={() => faz({ acao: 'concluir', apresentacao: true })}
                  >
                    Concluir aula
                  </Button>
                </div>
              )}
              <ul>
                {lista.map((x) => (
                  <li key={x.nome} className="flex flex-wrap items-center gap-2.5 border-t border-borda-suave py-2">
                    <span
                      aria-hidden
                      className="grid size-9 place-items-center rounded-full bg-cinza-suave font-bold text-texto-2"
                    >
                      {iniciais(x.nome)}
                    </span>
                    <b className="min-w-[120px] flex-1">{x.nome}</b>
                    {ap.podeOperar ? (
                      <PresencaBotoes
                        nome={x.nome}
                        p={x.p}
                        desabilitado={acao.isPending}
                        aoMarcar={(v) => faz({ acao: 'presenca', aluno: x.nome, valor: v })}
                      />
                    ) : (
                      <Badge tom={x.p && x.p !== 'pendente' ? PRESENCA[x.p][1] : 'gray'}>
                        {x.p && x.p !== 'pendente' ? PRESENCA[x.p][0] : '—'}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
              {a.pagina.semCadastro > 0 && (
                <p className="text-apagado">
                  + {a.pagina.semCadastro} alunos da turma sem cadastro no portal — a presença deles é lançada na turma
                </p>
              )}
              {!lista.length && <p className="text-apagado">nenhum aluno com cadastro no portal nesta aula</p>}
            </section>
          </Card>

          {a.folha && (
            <Card className="px-4 py-3.5">
              <section aria-label="Suporte">
                <FolhaBloco a={a} aoMsg={setMsg} />
              </section>
            </Card>
          )}

          <Card className="px-4 py-3.5">
            <section aria-label="Anotações">
              <div className="mb-2.5 flex items-center gap-2">
                <PencilIcon className="size-4 text-apagado" />
                <b className="text-md">Anotações da aula</b>
                <span className="flex-1" />
                <span className="text-apagado" aria-live="polite">
                  {notasOk || ap.notas ? 'anotações salvas' : ''}
                </span>
              </div>
              <textarea
                aria-label="Anotações da aula"
                disabled={!ap.podeNotas}
                value={notas ?? ap.notas}
                onChange={(e) => {
                  setNotas(e.target.value);
                  setNotasOk(false);
                }}
                onBlur={() => {
                  if (notas != null && notas !== ap.notas) faz({ acao: 'notas', texto: notas }, () => setNotasOk(true));
                }}
                placeholder="O que ficou para a próxima aula, dúvidas dos alunos, ocorrências…"
                className="min-h-24 w-full resize-y rounded-md border border-borda-forte bg-card px-3 py-2 focus:border-azul focus:shadow-anel focus-visible:outline-none disabled:opacity-60"
              />
            </section>
          </Card>
        </div>
      </div>
    </>
  );
}
