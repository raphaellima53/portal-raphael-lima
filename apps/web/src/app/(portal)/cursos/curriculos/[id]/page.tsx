'use client';

import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  CopyIcon,
  FileTextIcon,
  PencilIcon,
  PlusIcon,
  XIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Confirma, ConteudoDialog, CurriculoFormDialog, MOMENTOS } from '@/components/cursos/curriculo-forms';
import { Aviso, PageHead } from '@/components/ds';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { type Conteudo, useAcaoCurriculo, useCurriculo } from '@/lib/cursos';
import { cn } from '@/lib/utils';

const CLASSE: Record<string, string> = { n: 'n', v: 'v', adj: 'adj', col: 'col', id: 'id' };

function Linha({ k, d, children }: { k: string; d: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 border-b border-dashed border-borda-suave py-3 last:border-0 md:grid-cols-[250px_1fr] md:gap-6">
      <div>
        <b className="block text-texto">{k}</b>
        <span className="text-apagado">{d}</span>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Editor() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const router = useRouter();
  const volta = sp.get('volta')?.startsWith('/') && !sp.get('volta')?.startsWith('//') ? sp.get('volta')! : '/cursos';
  const q = useCurriculo(id);
  const acao = useAcaoCurriculo();
  const [ver, setVer] = useState<number | null>(null);
  const [aberto, setAberto] = useState<Set<number>>(new Set([0]));
  const [msg, setMsg] = useState<{ txt: string; erro?: boolean } | null>(
    sp.get('msg') ? { txt: sp.get('msg')! } : null,
  );
  const [form, setForm] = useState(false);
  const [conteudo, setConteudo] = useState<{ k: number | null; soLinks?: boolean } | null>(null);
  const [remover, setRemover] = useState<number | null>(null);
  const [excluir, setExcluir] = useState(false);
  const c = q.data;
  useEffect(() => {
    if (c) document.title = `${c.nome} · Portal Raphael Lima`;
  }, [c]);

  if (q.isError)
    return (
      <>
        <PageHead
          titulo="Currículo não encontrado"
          acoes={
            <Button asChild>
              <Link href={volta}>Voltar</Link>
            </Button>
          }
        />
        <Aviso icone="info">{q.error.message}</Aviso>
      </>
    );
  if (!c) return <p className="text-apagado">Carregando…</p>;

  const vs = c.versoes;
  const vi = ver == null ? vs.length - 1 : Math.min(ver, vs.length - 1);
  const v = vs[vi];
  const lista = v.conteudos;
  const n = lista.length;
  const rasc = vs.find((x) => x.ehRascunho);
  const pub = vs.find((x) => x.ehPublicada);
  const antiga = !v.ehRascunho && !v.ehPublicada;
  const ed = c.pode.editar;
  const podeMexer = ed && !antiga;
  const prod = c.tipo === 'produto';

  /** toda mudança cai no rascunho: depois de gravar, mostra a versão que a API devolveu */
  const faz = (caminho: string, method = 'POST', json?: unknown, abrir?: number) =>
    acao.mutate(
      { caminho: `/${c.id}${caminho}`, method, json },
      {
        onSuccess: (r) => {
          if (r.versao != null) setVer(r.versao);
          if (abrir != null) setAberto(new Set([abrir]));
          setMsg(r.msg ? { txt: r.msg } : null);
        },
        onError: (e) => setMsg({ txt: e.message, erro: true }),
      },
    );
  const alterna = (k: number) =>
    setAberto((s) => {
      const x = new Set(s);
      if (x.has(k)) x.delete(k);
      else x.add(k);
      return x;
    });
  const links = (x: Conteudo, m: keyof Conteudo['links']) => x.links[m];

  return (
    <>
      <PageHead
        titulo={c.nome}
        acoes={
          <>
            <Button asChild>
              <Link href={volta}>
                <ChevronLeftIcon /> Voltar
              </Link>
            </Button>
            {ed && (
              <>
                {c.pode.editarItens && (
                  <Button onClick={() => setForm(true)}>
                    <PencilIcon /> Editar currículo
                  </Button>
                )}
                <Button
                  disabled={acao.isPending}
                  onClick={() =>
                    acao.mutate(
                      { caminho: `/${c.id}/duplicar` },
                      {
                        onSuccess: (r) =>
                          router.push(
                            `/cursos/curriculos/${r.id}?volta=${encodeURIComponent(volta)}&msg=${encodeURIComponent(r.msg)}`,
                          ),
                      },
                    )
                  }
                >
                  Duplicar currículo
                </Button>
                {c.pode.excluir && <Button onClick={() => setExcluir(true)}>Excluir currículo</Button>}
                {rasc ? (
                  <>
                    <Button disabled={!pub || acao.isPending} onClick={() => faz('/descartar')}>
                      Descartar rascunho
                    </Button>
                    <Button variant="primary" disabled={acao.isPending} onClick={() => faz('/publicar')}>
                      <CheckIcon /> Publicar {rasc.nome}
                    </Button>
                  </>
                ) : (
                  <Button variant="primary" disabled={acao.isPending} onClick={() => faz('/versao')}>
                    <PlusIcon /> Nova versão
                  </Button>
                )}
              </>
            )}
          </>
        }
      />
      <div className="mb-3.5 flex flex-wrap items-center gap-1.5">
        <Badge tom={prod ? 'blue' : 'purple'}>{prod ? 'De produto' : 'Acervo'}</Badge>
        <span className="inline-flex h-[26px] items-center rounded-full border border-borda-forte px-2.5 text-texto-2">
          {c.idioma}
        </span>
        {c.cor ? (
          <span
            className="inline-flex h-[26px] items-center rounded-full px-2.5 font-semibold"
            style={{ background: `${c.cor}1f`, color: c.cor }}
          >
            {c.grupo}
          </span>
        ) : (
          <span className="inline-flex h-[26px] items-center rounded-full border border-borda-forte px-2.5 text-texto-2">
            {c.grupo}
          </span>
        )}
        {prod && (
          <span className="ml-1.5 text-apagado">
            aplicado em {c.aplicado.length ? c.aplicado.join(', ') : 'nenhum módulo ou turma'}
          </span>
        )}
      </div>
      {msg && (
        <Aviso tom={msg.erro ? 'red' : 'blue'} icone={msg.erro ? 'alerta' : 'ok'}>
          {msg.txt}
        </Aviso>
      )}
      {!ed && (
        <Aviso icone="trava">Só Admin e quem tem Acadêmico ou Pedagógico com acesso Total edita o currículo.</Aviso>
      )}
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        {[
          [
            'Versão',
            'As aulas leem só a versão publicada. A nova nasce como rascunho e vale apenas para aulas geradas depois de publicada — aula já gerada mantém o conteúdo que recebeu.',
          ],
          prod
            ? [
                'Ordem',
                'O conteúdo 1 vai para a 1ª aula, o 2 para a 2ª, e assim por diante. Terminada a lista, a sequência recomeça.',
              ]
            : ['Escolha', 'Nenhuma ordem é aplicada: na aula, o professor busca o conteúdo pelo título e o vincula.'],
          [
            'Momentos',
            'Cada conteúdo tem um link para cada momento — Pre-class, In-class e Post-class —, cada um para um público e num momento da aula.',
          ],
        ].map(([t, d], i) => (
          <Card key={t} className="px-4 py-3.5">
            <b className="mb-1 flex items-center gap-2">
              <em className="grid size-6 place-items-center rounded-full bg-azul-suave text-sm font-bold text-azul not-italic">
                {i + 1}
              </em>
              {t}
            </b>
            <span className="text-apagado">{d}</span>
          </Card>
        ))}
      </div>
      <div role="tablist" aria-label="Versões" className="mb-4 flex flex-wrap gap-3">
        {vs.map((x) => (
          <button
            key={x.k}
            type="button"
            role="tab"
            aria-selected={x.k === vi}
            onClick={() => {
              setVer(x.k);
              setAberto(new Set([0]));
            }}
            className={cn(
              'cursor-pointer rounded-lg border border-borda bg-card px-3.5 py-2.5 text-left shadow-el-1 hover:shadow-el-2',
              x.k === vi && 'border-azul shadow-[0_0_0_1px_var(--blue)]',
            )}
          >
            <span className="flex items-center gap-2">
              <b>{x.nome}</b>
              <Badge tom={x.ehPublicada ? 'green' : x.situacao === 'Substituída' ? 'gray' : 'amber'}>
                {x.situacao}
              </Badge>
            </span>
            <small className="block text-sm text-apagado">
              {x.conteudos.length} conteúdos ·{' '}
              {x.situacao === 'Rascunho' ? 'ainda não vale para nenhuma aula' : `publicada em ${x.data}`}
            </small>
          </button>
        ))}
      </div>
      {v.ehRascunho ? (
        <Aviso tom="blue" icone="info">
          Você está editando a <b>{v.nome} em rascunho</b>.{' '}
          {pub
            ? `As aulas continuam lendo a ${pub.nome} até você publicar.`
            : 'Nenhuma aula lê este currículo até a primeira publicação.'}
        </Aviso>
      ) : antiga ? (
        <Aviso icone="info">
          {v.nome} foi substituída pela {pub ? pub.nome : 'versão atual'} e fica só para consulta.
        </Aviso>
      ) : ed ? (
        <Aviso icone="ok">
          {v.nome} é a versão que as aulas leem. Qualquer mudança abre a {c.proxima} em rascunho — nada muda nas aulas
          até publicar.
        </Aviso>
      ) : null}
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <b className="text-texto">{n} conteúdos</b>
        {lista.filter((x) => !x.links.in).length > 0 && (
          <span className="text-apagado">· {lista.filter((x) => !x.links.in).length} sem link de In-class</span>
        )}
        <span className="flex-1" />
        {podeMexer && (
          <Button size="sm" variant="primary" onClick={() => setConteudo({ k: null })}>
            <PlusIcon /> Novo conteúdo
          </Button>
        )}
      </div>
      {n ? (
        <div className="grid gap-2.5">
          {lista.map((x, k) => {
            const on = aberto.has(k);
            return (
              <Card key={`${vi}-${k}`} className="overflow-hidden">
                <button
                  type="button"
                  aria-expanded={on}
                  onClick={() => alterna(k)}
                  className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-hover"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-sm bg-cinza-suave font-bold text-texto-2">
                    {k + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <b className="block">{x.titulo}</b>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <span className="inline-flex h-[26px] items-center rounded-full border border-borda-forte px-2.5 text-texto-2">
                        {x.formato}
                      </span>
                      {MOMENTOS.map(([m, rot]) => (
                        <Badge key={m} tom={links(x, m) ? 'blue' : 'gray'}>
                          {rot}: {links(x, m) ? 'link' : 'sem link'}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <ChevronDownIcon className={cn('size-4 text-apagado transition-transform', on && 'rotate-180')} />
                </button>
                {on && (
                  <div className="border-t border-borda-suave px-4 pb-3">
                    {prod ? (
                      <Linha
                        k="Posição na sequência"
                        d="Em qual aula do módulo ou turma este conteúdo é aplicado. Reordenar só muda aulas ainda não geradas."
                      >
                        aula {k + 1} de {n}
                        {c.aplicado.length
                          ? ` — em ${c.aplicado.join(', ')}`
                          : ' — ainda não aplicado em nenhum módulo ou turma'}
                      </Linha>
                    ) : (
                      <Linha
                        k="Uso no acervo"
                        d="Sem posição fixa: o professor busca pelo título e vincula a uma aula."
                      >
                        disponível para qualquer aula em {c.idioma.toLowerCase()}
                      </Linha>
                    )}
                    <Linha k="Título" d="Aparece na agenda, no convite da aula e no app do aluno.">
                      {x.titulo}
                    </Linha>
                    <Linha
                      k="Formato da aula"
                      d="Interativa: o aluno participa com atividade na sala. Simples: exposição do professor com prática guiada. Define o modelo de slides aberto na aula."
                    >
                      {x.formato}
                    </Linha>
                    <Linha
                      k="Gramática"
                      d="Foco gramatical da aula. Vai para o plano do professor e para o relatório pedagógico do aluno."
                    >
                      {x.gram || (
                        <span className="text-apagado">sem foco gramatical — aula de vocabulário e conversação</span>
                      )}
                    </Linha>
                    <Linha
                      k="Vocabulário"
                      d="Termos que o aluno deve sair usando; entram no card de revisão do Post-class. Classe: n substantivo · v verbo · adj adjetivo · col colocação · id expressão idiomática."
                    >
                      {x.voc.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {x.voc.map(([w, cl]) => (
                            <span
                              key={w}
                              className="inline-flex items-center gap-1.5 rounded-sm border border-borda bg-bg px-2 py-0.5"
                            >
                              {w}
                              {cl && <i className="text-apagado not-italic">{CLASSE[cl] ?? cl}</i>}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-apagado">sem lista de vocabulário</span>
                      )}
                    </Linha>
                    <Linha
                      k="Materiais"
                      d="Um link para cada momento da aula: o material só aparece para quem deve ver, na hora certa."
                    >
                      <div className="grid gap-2 md:grid-cols-3">
                        {MOMENTOS.map(([m, rot, quem]) => (
                          <div key={m} className="rounded-md border border-borda p-2.5">
                            <b className="block">{rot}</b>
                            <span className="block text-apagado">{quem}</span>
                            {links(x, m) ? (
                              <a
                                href={links(x, m)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1 flex items-center gap-1.5 break-all text-azul hover:underline"
                              >
                                <FileTextIcon className="size-4 shrink-0" />
                                {links(x, m)}
                              </a>
                            ) : (
                              <span className="mt-1 block text-apagado">sem link</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </Linha>
                    {podeMexer && (
                      <div className="flex flex-wrap gap-2 pt-3">
                        {prod && (
                          <>
                            <Button
                              size="sm"
                              disabled={!k || acao.isPending}
                              onClick={() => faz(`/conteudos/${k}/mover`, 'POST', { d: -1 }, k - 1)}
                            >
                              ↑ Subir
                            </Button>
                            <Button
                              size="sm"
                              disabled={k >= n - 1 || acao.isPending}
                              onClick={() => faz(`/conteudos/${k}/mover`, 'POST', { d: 1 }, k + 1)}
                            >
                              ↓ Descer
                            </Button>
                          </>
                        )}
                        {c.pode.editarItens && (
                          <>
                            <Button size="sm" onClick={() => setConteudo({ k, soLinks: true })}>
                              <PencilIcon /> Editar links
                            </Button>
                            <Button size="sm" onClick={() => setConteudo({ k })}>
                              <PencilIcon /> Editar conteúdo
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          disabled={acao.isPending}
                          onClick={() => faz(`/conteudos/${k}/duplicar`, 'POST', {}, k + 1)}
                        >
                          <CopyIcon /> Duplicar
                        </Button>
                        <Button size="sm" onClick={() => setRemover(k)}>
                          <XIcon /> Remover do rascunho
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="px-5 py-5 text-center text-apagado-2">
          nenhum conteúdo nesta versão{podeMexer ? ' — use Novo conteúdo para começar' : ''}
        </Card>
      )}

      <CurriculoFormDialog
        abre={form ? { id: c.id } : null}
        aoFechar={() => setForm(false)}
        aoSalvo={(r) => setMsg({ txt: r.msg })}
      />
      <ConteudoDialog
        abre={conteudo}
        aoFechar={() => setConteudo(null)}
        curId={c.id}
        nomeCur={c.nome}
        lista={lista}
        produto={prod}
        aoOk={(r) => {
          if (r.versao != null) setVer(r.versao);
          setAberto(new Set([r.k]));
          setMsg(r.msg ? { txt: r.msg } : null);
        }}
      />
      <Confirma
        aberto={remover != null}
        titulo="Remover conteúdo do rascunho"
        descricao={c.nome}
        texto={
          <>
            <b>{remover != null ? lista[remover]?.titulo : ''}</b> sai da próxima versão. A versão publicada continua
            igual até você publicar.
          </>
        }
        rotulo="Remover do rascunho"
        aoFechar={() => setRemover(null)}
        ocupado={acao.isPending}
        aoConfirmar={() => {
          const k = remover!;
          setRemover(null);
          faz(`/conteudos/${k}`, 'DELETE', undefined, Math.max(0, k - 1));
        }}
      />
      <Confirma
        aberto={excluir}
        titulo="Excluir currículo"
        descricao={c.nome}
        texto={`${c.aplicado.length && prod ? `As aulas de ${c.aplicado.join(', ')} ficam sem conteúdo definido. ` : ''}O currículo e as ${vs.length} ${vs.length === 1 ? 'versão' : 'versões'} saem da base.`}
        rotulo="Excluir currículo"
        aoFechar={() => setExcluir(false)}
        ocupado={acao.isPending}
        aoConfirmar={() =>
          acao.mutate(
            { caminho: `/${c.id}`, method: 'DELETE' },
            { onSuccess: () => router.push(volta), onError: (e) => setMsg({ txt: e.message, erro: true }) },
          )
        }
      />
    </>
  );
}

export default function CurriculoEditorPage() {
  return (
    <Suspense>
      <Editor />
    </Suspense>
  );
}
