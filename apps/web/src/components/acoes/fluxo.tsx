'use client';

import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Segmento } from '@/components/alunos/abas-aluno';
import type { Msg } from '@/components/alunos/comum';
import { CampoData } from '@/components/campos-data';
import { Aviso, PageHead } from '@/components/ds';
import { Escolha } from '@/components/escolha';
import { usePaginacao } from '@/components/paginacao';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogBody, DialogContent, DialogFoot, DialogHead } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TBody, Td, THead, Th, Tr } from '@/components/ui/table';
import {
  type CampoFluxo,
  type CardFluxo,
  camposFluxo,
  type FluxoTela,
  useAcao,
  useFluxo,
  type Valores,
} from '@/lib/acoes';
import { corLegivel } from '@/lib/cor';
import { cn } from '@/lib/utils';
import { Busca, normaliza } from './alocacao';

type Abre = { card: CardFluxo | null } | null;

/** Ações por departamento: cada fluxo tem kanban (arrastar, ou o botão da próxima etapa), lista e formulário */
export function TelaFluxo({ chave, abas }: { chave: string; abas: React.ReactNode }) {
  const q = useFluxo(chave);
  const acao = useAcao();
  const [vis, setVis] = useState('kanban');
  const [busca, setBusca] = useState('');
  const [msg, setMsg] = useState<Msg>(null);
  const [abre, setAbre] = useState<Abre>(null);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const F = q.data;
  const cards = (F?.cards ?? []).filter((c) => !busca || normaliza(`${c.titulo} ${c.sub}`).includes(normaliza(busca)));
  const op = !!F?.podeOperar;

  const mover = (c: CardFluxo, etapa: string, v?: Valores, depois?: () => void) =>
    acao.mutate(
      { caminho: `/fluxos/${chave}/${c.id}/mover`, json: { etapa, v } },
      {
        onSuccess: (r) => {
          setMsg({ txt: r.msg });
          depois?.();
        },
        onError: (e) => {
          setMsg({ txt: e.message, erro: true });
          if (!v) setAbre({ card: c });
        },
      },
    );

  return (
    <>
      <PageHead
        titulo={F?.t ?? 'Ações'}
        acoes={
          op && F ? (
            <Button variant="primary" onClick={() => setAbre({ card: null })}>
              <PlusIcon /> {F.novo}
            </Button>
          ) : null
        }
      />
      {abas}
      {msg && !abre && (
        <Aviso tom={msg.erro ? 'red' : 'blue'} icone={msg.erro ? 'alerta' : 'ok'}>
          {msg.txt}
        </Aviso>
      )}
      {q.isError && (
        <Aviso tom="red" icone="alerta">
          {q.error.message}
        </Aviso>
      )}
      {F && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Busca rotulo={`Buscar ${F.um}`} valor={busca} aoMudar={setBusca} />
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-apagado">{F.como}</span>
              <Segmento
                rotulo="Visualização"
                valor={vis}
                aoMudar={setVis}
                opcoes={[
                  ['kanban', 'Kanban'],
                  ['lista', 'Lista'],
                ]}
              />
            </div>
          </div>
          {vis === 'kanban' ? (
            <div className="grid auto-cols-[minmax(240px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2">
              {F.etapas.map((e) => {
                const cs = cards.filter((c) => c.etapa === e.k);
                return (
                  <section
                    key={e.k}
                    aria-label={e.t}
                    onDragOver={(ev) => op && ev.preventDefault()}
                    onDrop={(ev) => {
                      ev.preventDefault();
                      const c = F.cards.find((x) => x.id === arrastando);
                      setArrastando(null);
                      if (c && c.etapa !== e.k) mover(c, e.k);
                    }}
                    className={cn(
                      'flex min-h-[160px] flex-col gap-2 rounded-lg border border-borda p-2.5',
                      e.fim ? 'bg-transparent' : 'bg-bg',
                    )}
                  >
                    <div className="flex items-center gap-2 px-1">
                      <i className="size-2.5 rounded-full" style={{ background: e.cor }} aria-hidden />
                      <b className="text-texto">{e.t}</b>
                      <span className="ml-auto tabular-nums text-apagado">{cs.length}</span>
                    </div>
                    <p className="px-1 text-apagado">{e.d}</p>
                    {cs.length ? (
                      cs.map((c) => (
                        <article
                          key={c.id}
                          draggable={op && !c.fim}
                          onDragStart={() => setArrastando(c.id)}
                          className="flex flex-col gap-1 rounded-md border border-borda bg-card p-3 shadow-el-1 transition-shadow hover:shadow-el-2"
                        >
                          <button
                            type="button"
                            onClick={() => setAbre({ card: c })}
                            className="cursor-pointer text-left font-semibold text-texto hover:text-azul hover:underline"
                          >
                            {c.titulo}
                          </button>
                          <span className="text-texto-2">{c.sub}</span>
                          <span className="text-apagado">{c.dias}</span>
                          {op && c.prox && (
                            <Button
                              size="sm"
                              className="mt-1.5 self-start"
                              disabled={acao.isPending}
                              onClick={() => mover(c, c.prox!.k)}
                            >
                              <ChevronRightIcon /> {c.prox.t}
                            </Button>
                          )}
                        </article>
                      ))
                    ) : (
                      <p className="py-3 text-center text-apagado-2">nada nesta etapa</p>
                    )}
                  </section>
                );
              })}
            </div>
          ) : (
            <Lista F={F} cards={cards} abrir={(c) => setAbre({ card: c })} />
          )}
          <CardDialog
            F={F}
            abre={abre}
            aoFechar={() => setAbre(null)}
            aoMsg={(m) => setMsg(m)}
            erroInicial={abre && msg?.erro ? msg.txt : ''}
          />
        </>
      )}
    </>
  );
}

function Lista({ F, cards, abrir }: { F: FluxoTela; cards: CardFluxo[]; abrir: (c: CardFluxo) => void }) {
  const { fatia, rodape } = usePaginacao(cards);
  return (
    <Card className="overflow-hidden">
      <Table>
        <THead>
          <Tr>
            <Th>{F.um.charAt(0).toUpperCase() + F.um.slice(1)}</Th>
            <Th>Detalhe</Th>
            <Th>Etapa</Th>
            <Th>Última mudança</Th>
            <Th>
              <span className="sr-only">Abrir</span>
            </Th>
          </Tr>
        </THead>
        <TBody>
          {fatia.length ? (
            fatia.map((c) => {
              const e = F.etapas.find((x) => x.k === c.etapa);
              return (
                <Tr key={c.id}>
                  <Td className="font-medium text-texto">{c.titulo}</Td>
                  <Td>{c.sub}</Td>
                  <Td>
                    {e && (
                      <span
                        className="inline-flex h-[26px] items-center rounded-full px-2.5 font-semibold whitespace-nowrap"
                        style={{ background: `${corLegivel(e.cor)}1f`, color: corLegivel(e.cor) }}
                      >
                        {e.t}
                      </span>
                    )}
                  </Td>
                  <Td>{c.mudou}</Td>
                  <Td className="text-right">
                    <Button size="sm" onClick={() => abrir(c)}>
                      Abrir
                    </Button>
                  </Td>
                </Tr>
              );
            })
          ) : (
            <Tr>
              <Td colSpan={5} className="py-8 text-center text-apagado-2">
                nada neste filtro
              </Td>
            </Tr>
          )}
        </TBody>
      </Table>
      {rodape}
    </Card>
  );
}

function CampoForm({
  c,
  valor,
  aoMudar,
  dis,
}: {
  c: CampoFluxo;
  valor: Valores[string];
  aoMudar: (v: Valores[string]) => void;
  dis: boolean;
}) {
  const id = `fl-${c.k}`;
  const rot = (
    <Label htmlFor={id}>
      {c.t}
      {c.obrig && <span className="text-vermelho">*</span>}
    </Label>
  );
  let ctrl: React.ReactNode;
  if (c.tipo === 'select')
    ctrl = (
      <Escolha
        rotulo={c.t}
        todos="escolha"
        destacar={false}
        disabled={dis}
        valor={valor == null ? '' : String(valor)}
        aoMudar={aoMudar}
        opcoes={c.ops ?? []}
      />
    );
  else if (c.tipo === 'textarea')
    ctrl = (
      <textarea
        id={id}
        rows={3}
        disabled={dis}
        value={valor == null ? '' : String(valor)}
        onChange={(e) => aoMudar(e.target.value)}
        className="w-full rounded-md border border-borda-forte bg-card px-3 py-2.5 text-sm text-texto placeholder:text-apagado-2 focus:border-azul focus:shadow-anel focus-visible:outline-none disabled:opacity-60"
      />
    );
  else if (c.tipo === 'chips') {
    const sel = Array.isArray(valor) ? valor : [];
    ctrl = (
      <div className="flex flex-wrap gap-2" role="group" aria-label={c.t}>
        {(c.ops ?? []).map((o) => {
          const on = sel.includes(o.v);
          return (
            <button
              key={o.v}
              type="button"
              aria-pressed={on}
              disabled={dis}
              onClick={() => aoMudar(on ? sel.filter((x) => x !== o.v) : [...sel, o.v])}
              className={cn(
                'h-9 cursor-pointer rounded-full bg-[#eceff5] px-3.5 text-[#4b5568] disabled:cursor-default dark:bg-hover dark:text-texto-2',
                on && 'bg-azul-suave font-semibold text-azul shadow-[inset_0_0_0_1px_#cfdcfa]',
              )}
            >
              {o.l}
            </button>
          );
        })}
      </div>
    );
  } else if (c.tipo === 'date')
    ctrl = dis ? (
      <Input id={id} disabled value={valor ? String(valor).split('-').reverse().join('/') : ''} />
    ) : (
      <CampoData id={id} rotulo={c.t} valor={valor == null ? '' : String(valor)} aoMudar={aoMudar} />
    );
  else
    ctrl = (
      <Input
        id={id}
        type={c.tipo === 'number' ? 'number' : c.tipo === 'email' ? 'email' : 'text'}
        placeholder={c.ph}
        disabled={dis}
        value={valor == null ? '' : String(valor)}
        onChange={(e) => aoMudar(e.target.value)}
      />
    );
  return (
    <div className={cn('grid content-start gap-1.5', c.full && 'sm:col-span-2')}>
      {rot}
      {ctrl}
      {c.ajuda && <span className="text-apagado">{c.ajuda}</span>}
    </div>
  );
}

function CardDialog({
  F,
  abre,
  aoFechar,
  aoMsg,
  erroInicial,
}: {
  F: FluxoTela;
  abre: Abre;
  aoFechar: () => void;
  aoMsg: (m: Msg) => void;
  erroInicial: string;
}) {
  const acao = useAcao();
  const c = abre?.card ?? null;
  const [v, setV] = useState<Valores>({});
  const [campos, setCampos] = useState<CampoFluxo[]>(F.campos);
  const [erro, setErro] = useState('');

  // biome-ignore lint/correctness/useExhaustiveDependencies: reinicia ao abrir
  useEffect(() => {
    if (!abre) return;
    const ini = c ? { ...c.v } : {};
    setV(ini);
    setErro(erroInicial);
    setCampos(F.campos);
    camposFluxo(F.key, ini)
      .then((r) => setCampos(r.campos))
      .catch(() => {});
  }, [abre]);

  const muda = (campo: CampoFluxo, valor: Valores[string]) => {
    const nv = { ...v, [campo.k]: valor };
    setV(nv);
    setErro('');
    if (campo.recarrega)
      camposFluxo(F.key, nv)
        .then((r) => setCampos(r.campos))
        .catch(() => {});
  };
  const conclui = (r: { msg: string }) => {
    aoMsg({ txt: r.msg });
    aoFechar();
  };
  const falha = (e: Error) => setErro(e.message);
  const criar = () => acao.mutate({ caminho: `/fluxos/${F.key}`, json: { v } }, { onSuccess: conclui, onError: falha });
  const salvar = () =>
    c &&
    acao.mutate(
      { caminho: `/fluxos/${F.key}/${c.id}`, method: 'PUT', json: { v } },
      { onSuccess: conclui, onError: falha },
    );
  const mover = (etapa: string) =>
    c &&
    acao.mutate(
      { caminho: `/fluxos/${F.key}/${c.id}/mover`, json: { etapa, v: c.fim ? undefined : v } },
      { onSuccess: conclui, onError: falha },
    );

  const e = c ? F.etapas.find((x) => x.k === c.etapa) : null;
  const dis = !F.podeOperar || !!c?.fim;
  return (
    <Dialog open={!!abre} onOpenChange={(x) => !x && aoFechar()}>
      <DialogContent tamanho="lg">
        <DialogHead titulo={c ? c.titulo : F.novo} descricao={c ? `${F.t} · ${c.sub}` : F.t} />
        <DialogBody className="grid gap-4">
          {c && e && (
            <>
              <ol className="flex flex-wrap gap-1.5" aria-label="Etapas">
                {F.etapas
                  .filter((x) => !x.alt || x.k === c.etapa)
                  .map((x) => (
                    <li
                      key={x.k}
                      aria-current={x.k === c.etapa ? 'step' : undefined}
                      className={cn(
                        'rounded-full border border-borda px-2.5 py-0.5 text-apagado',
                        x.k === c.etapa && 'font-bold',
                      )}
                      style={x.k === c.etapa ? { borderColor: corLegivel(x.cor), color: corLegivel(x.cor) } : undefined}
                    >
                      {x.t}
                    </li>
                  ))}
              </ol>
              <p className="text-texto-2">
                {e.d}
                {!c.fim && c.prox && c.exigeProx.length > 0 && ` Para ${c.prox.t}: ${c.exigeProx.join(', ')}.`}
              </p>
            </>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {campos.map((campo) => (
              <CampoForm key={campo.k} c={campo} valor={v[campo.k]} dis={dis} aoMudar={(x) => muda(campo, x)} />
            ))}
          </div>
          {c && (
            <div>
              <h3 className="mb-2 font-bold text-texto">Histórico</h3>
              <ul className="flex flex-col gap-1.5">
                {c.hist.map((h, i) => (
                  <li key={`${h.quando}-${i}`}>
                    <b>{h.para}</b>
                    {h.de && <span className="text-apagado"> de {h.de}</span>} · {h.quem} · {h.quando}
                    {h.nota && <div className="text-apagado">{h.nota}</div>}
                  </li>
                ))}
                {!c.hist.length && <li className="text-apagado">sem movimentação no portal ainda</li>}
                <li className="text-apagado">
                  criado {c.criado} · {c.quem}
                </li>
              </ul>
            </div>
          )}
        </DialogBody>
        <DialogFoot>
          {erro && (
            <span role="alert" className="mr-auto font-medium text-vermelho">
              {erro}
            </span>
          )}
          <Button onClick={aoFechar}>Fechar</Button>
          {!c && F.podeOperar && (
            <Button variant="primary" disabled={acao.isPending} onClick={criar}>
              Criar
            </Button>
          )}
          {c && F.podeOperar && c.fim && (
            <Button disabled={acao.isPending} onClick={() => mover(F.etapas[0].k)}>
              Reabrir em {F.etapas[0].t}
            </Button>
          )}
          {c && F.podeOperar && !c.fim && (
            <>
              {c.ant && (
                <Button disabled={acao.isPending} onClick={() => mover(c.ant!.k)}>
                  <ChevronLeftIcon /> {c.ant.t}
                </Button>
              )}
              {c.alts.map((x) => (
                <Button key={x.k} disabled={acao.isPending} onClick={() => mover(x.k)}>
                  {x.t}
                </Button>
              ))}
              <Button disabled={acao.isPending} onClick={salvar}>
                Salvar
              </Button>
              {c.prox && (
                <Button variant="primary" disabled={acao.isPending} onClick={() => mover(c.prox!.k)}>
                  {c.prox.t} <ChevronRightIcon />
                </Button>
              )}
            </>
          )}
        </DialogFoot>
      </DialogContent>
    </Dialog>
  );
}
