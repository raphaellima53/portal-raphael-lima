'use client';

import { ArrowRightIcon, ChevronLeftIcon, XIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Abas } from '@/components/abas';
import type { Msg } from '@/components/alunos/comum';
import { Aviso, PageHead } from '@/components/ds';
import { Escolha } from '@/components/escolha';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogBody, DialogContent, DialogFoot, DialogHead } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type NotaL, type ParcelaL, type PedidoL, type StatD, useDeal, useDealAcao } from '@/lib/deal';
import { cn } from '@/lib/utils';
import { Lk, Nada, Quadro, SitB, Stats, Sub, TabelaDeal } from './comum';

type Pedido = PedidoL & {
  cancelado: boolean;
  motivoCancel: string;
  podeOperar: boolean;
  motivos: string[];
  stats: StatD[];
  passo: string;
  pagamento: { total: string; forma: string; gateway: string; parcelas: string; cupom: string | null };
  acordo: { preset: string; presetDesc: string; regime: string; renovacao: string };
  contrato: { id: number; nome: string } | null;
  obs: string;
  itens: { tipologia: string; descricao: string; qtd: number; unitario: string; total: string }[];
  cronograma: ParcelaL[];
  notas: NotaL[];
  linha: { quando: string; origem: string; evento: string; detalhe: string }[];
};
const ABAS = [
  ['geral', 'Geral'],
  ['cronograma', 'Cronograma'],
  ['notas', 'Notas fiscais'],
  ['linha', 'Linha do tempo'],
] as const;

export function TabelaNotas({ ls, titulo }: { ls: NotaL[]; titulo?: string }) {
  return (
    <TabelaDeal
      titulo={titulo}
      rotulo="Notas fiscais"
      linhas={ls}
      chave={(n, i) => n.id ?? `fila-${i}`}
      vazio="nenhuma nota"
      cols={[
        { t: 'Número', r: (n) => (n.id ? n.numero : <Nada />) },
        { t: 'Competência', r: (n) => n.competencia },
        { t: 'Pagador', r: (n) => (n.alunoId ? <Lk href={`/alunos/${n.alunoId}/perfil`}>{n.pagador}</Lk> : n.pagador) },
        {
          t: 'Origem',
          r: (n) =>
            n.pedidoId && !n.origem.startsWith('Ordem') ? (
              <Lk href={`/pedidos/${n.pedidoId}/notas`}>{n.origem}</Lk>
            ) : (
              n.origem
            ),
        },
        { t: 'Valor', num: true, r: (n) => n.valor },
        { t: 'Emitida em', r: (n) => n.emitida ?? <Nada /> },
        { t: 'Situação', r: (n) => <SitB s={n.situacao} /> },
      ]}
    />
  );
}

/** ficha do pedido: Geral · Cronograma · Notas fiscais · Linha do tempo */
export function FichaPedido({ id, aba }: { id: string; aba: string }) {
  const q = useDeal<Pedido>(`/pedidos/${id}`);
  const acao = useDealAcao();
  const [msg, setMsg] = useState<Msg>(null);
  const [cancelar, setCancelar] = useState(false);
  const p = q.data;
  const voltar = (
    <Button asChild>
      <Link href="/acoes/dlPedidos">
        <ChevronLeftIcon /> Pedidos
      </Link>
    </Button>
  );
  if (q.isError)
    return (
      <>
        <PageHead titulo="Pedido" acoes={voltar} />
        <Aviso tom="red" icone="alerta">
          {q.error.message}
        </Aviso>
      </>
    );
  if (!p) return null;
  const baixa = (key: string) =>
    acao.mutate(
      { caminho: '/baixa', json: { key } },
      { onSuccess: (r) => setMsg({ txt: r.msg }), onError: (e) => setMsg({ txt: e.message, erro: true }) },
    );
  return (
    <>
      <PageHead
        titulo={
          <>
            Pedido #{p.id} <span className="font-normal text-apagado">· {p.cliente}</span>
          </>
        }
        acoes={
          <>
            {voltar}
            {!p.cancelado && p.podeOperar && (
              <Button onClick={() => setCancelar(true)}>
                <XIcon /> Cancelar pedido
              </Button>
            )}
          </>
        }
      />
      <Abas
        rotulo="Abas do pedido"
        itens={ABAS.map(([k, l]) => ({ href: `/pedidos/${p.id}/${k}`, rotulo: l, ativa: k === aba }))}
      />
      {msg && (
        <Aviso tom={msg.erro ? 'red' : 'blue'} icone={msg.erro ? 'alerta' : 'ok'}>
          {msg.txt}
        </Aviso>
      )}
      {aba === 'geral' && (
        <>
          <Stats itens={p.stats} />
          <Aviso tom={p.cancelado ? 'gray' : 'blue'} icone="info">
            <b>Próximo passo:</b> {p.passo}
            {p.cancelado && p.motivoCancel ? ` · motivo: ${p.motivoCancel}` : ''}
          </Aviso>
          <div className="mb-4 grid gap-4 lg:grid-cols-3">
            <Quadro
              titulo="Cliente"
              itens={[
                [
                  'Cliente',
                  p.alunoId ? (
                    <Lk key="cli" href={`/alunos/${p.alunoId}/contratos`}>
                      {p.cliente}
                    </Lk>
                  ) : (
                    p.cliente
                  ),
                ],
                [
                  'Tipo de venda',
                  <Badge key="tipo" tom={p.tipo === 'B2C' ? 'gray' : 'blue'}>
                    {p.tipo}
                  </Badge>,
                ],
                [
                  'Contrato',
                  p.contrato ? (
                    <Lk key="ct" href={`/contratos/${p.contrato.id}/geral`}>
                      {p.contrato.nome}
                    </Lk>
                  ) : null,
                ],
                ['Vendedor', p.vendedor],
              ]}
            />
            <Quadro
              titulo="Pagamento"
              itens={[
                ['Total', p.pagamento.total],
                ['Forma', p.pagamento.forma],
                ['Gateway', p.pagamento.gateway],
                ['Parcelas', p.pagamento.parcelas],
                ['Cupom', p.pagamento.cupom],
              ]}
            />
            <Quadro
              titulo="Acordo"
              itens={[
                [
                  'Preset',
                  <>
                    {p.acordo.preset}
                    <Sub>{p.acordo.presetDesc}</Sub>
                  </>,
                ],
                ['Regime · forma', p.acordo.regime],
                ['Renovação', p.acordo.renovacao],
                ['Criado em', p.data],
                ['Situação', <SitB key="sit" s={p.situacao} />],
              ]}
            />
          </div>
          <TabelaDeal
            titulo="Itens"
            rotulo="Itens do pedido"
            linhas={p.itens}
            chave={(_x, i) => i}
            vazio="sem itens"
            cols={[
              { t: 'Tipo', r: (x) => <Badge tom="gray">{x.tipologia === 'Serviço' ? 'S' : 'P'}</Badge> },
              { t: 'Descrição', r: (x) => x.descricao },
              { t: 'Qtd.', num: true, r: (x) => x.qtd },
              { t: 'Unitário', num: true, r: (x) => x.unitario },
              { t: 'Total', num: true, r: (x) => x.total },
            ]}
          />
          {p.obs && <p className="mt-3 text-apagado">Observação: {p.obs}</p>}
        </>
      )}
      {aba === 'cronograma' && (
        <Cronograma
          ls={p.cronograma}
          podeOperar={p.podeOperar && !p.cancelado}
          baixa={baixa}
          ocupado={acao.isPending}
        />
      )}
      {aba === 'notas' && <TabelaNotas ls={p.notas} titulo="Notas fiscais" />}
      {aba === 'linha' && (
        <TabelaDeal
          titulo="Linha do tempo"
          rotulo="Linha do tempo do pedido"
          linhas={p.linha}
          chave={(_e, i) => i}
          vazio="sem eventos"
          cols={[
            { t: 'Quando', r: (e) => e.quando },
            { t: 'Origem', r: (e) => e.origem },
            { t: 'Evento', r: (e) => e.evento },
            { t: 'Detalhe', r: (e) => <span className="text-apagado">{e.detalhe}</span> },
          ]}
        />
      )}
      <CancelarDialog
        aberto={cancelar}
        motivos={p.motivos}
        id={p.id}
        aoFechar={() => setCancelar(false)}
        aoSalvo={(txt) => setMsg({ txt })}
      />
    </>
  );
}

export function Cronograma({
  ls,
  podeOperar,
  baixa,
  ocupado,
}: {
  ls: ParcelaL[];
  podeOperar: boolean;
  baixa?: (k: string) => void;
  ocupado?: boolean;
}) {
  return (
    <TabelaDeal
      titulo="Cronograma de parcelas"
      rotulo="Cronograma de parcelas"
      linhas={ls}
      chave={(x) => x.key}
      vazio="sem cronograma"
      cols={[
        {
          t: 'Parcela',
          r: (x) => (
            <>
              {x.parcela}
              {x.item && <Sub>{x.item}</Sub>}
            </>
          ),
        },
        { t: 'Competência', r: (x) => x.competencia },
        { t: 'Vencimento', r: (x) => x.venc },
        { t: 'Valor', num: true, r: (x) => x.valor },
        { t: 'Pago em', r: (x) => x.pago ?? <Nada /> },
        { t: 'Nota', r: (x) => (x.nota === 'na fila' ? <Badge tom="amber">na fila</Badge> : (x.nota ?? <Nada />)) },
        {
          t: 'Situação',
          r: (x) => (
            <>
              <SitB s={x.situacao} />
              {x.atraso ? <span className="ml-1.5 text-apagado">{x.atraso} dias</span> : null}
            </>
          ),
        },
        ...(podeOperar && baixa
          ? [
              {
                t: 'Ações',
                r: (x: ParcelaL) =>
                  x.pago ? (
                    <Nada />
                  ) : (
                    <Button size="sm" disabled={ocupado} onClick={() => baixa(x.key)}>
                      Dar baixa
                    </Button>
                  ),
              },
            ]
          : []),
      ]}
    />
  );
}

function CancelarDialog({
  aberto,
  motivos,
  id,
  aoFechar,
  aoSalvo,
}: {
  aberto: boolean;
  motivos: string[];
  id: number;
  aoFechar: () => void;
  aoSalvo: (t: string) => void;
}) {
  const acao = useDealAcao();
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  useEffect(() => {
    if (aberto) {
      setMotivo('');
      setErro('');
    }
  }, [aberto]);
  return (
    <Dialog open={aberto} onOpenChange={(x) => !x && aoFechar()}>
      <DialogContent tamanho="sm">
        <DialogHead
          titulo={`Cancelar o pedido #${id}`}
          descricao="As parcelas em aberto deixam de ser cobradas. As pagas continuam no histórico."
        />
        <DialogBody className="grid content-start gap-1.5">
          <Label>
            Motivo<span className="text-vermelho">*</span>
          </Label>
          <Escolha
            rotulo="Motivo"
            todos="Escolha o motivo"
            destacar={false}
            valor={motivo}
            aoMudar={setMotivo}
            opcoes={motivos.map((m) => ({ v: m, l: m }))}
          />
        </DialogBody>
        <DialogFoot>
          {erro && (
            <span role="alert" className="mr-auto font-medium text-vermelho">
              {erro}
            </span>
          )}
          <Button onClick={aoFechar}>Voltar</Button>
          <Button
            variant="perigo"
            disabled={acao.isPending}
            onClick={() =>
              motivo
                ? acao.mutate(
                    { caminho: `/pedidos/${id}/cancelar`, json: { motivo } },
                    {
                      onSuccess: (r) => {
                        aoFechar();
                        aoSalvo(r.msg);
                      },
                      onError: (e) => setErro(e.message),
                    },
                  )
                : setErro('Escolha o motivo.')
            }
          >
            Cancelar pedido
          </Button>
        </DialogFoot>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Novo pedido em 4 passos ---------------- */
type OpNP = {
  podeOperar: boolean;
  presets: { code: string; desc: string; nivel: string }[];
  vendedores: string[];
  alunos: { v: string; l: string; empresa: string | null }[];
  ofertas: {
    id: number;
    nome: string;
    curso: string;
    aulas: number;
    preco: number;
    precoR: string;
    parcelasMax: number;
    mercado: string;
  }[];
  formas: { id: number; nome: string }[];
  cupons: { codigo: string; tipo: string; valor: number; ofertas: number[] }[];
};
const R = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const PASSOS = ['Cliente', 'Ofertas', 'Pagamento', 'Detalhes'];

export function NovoPedido() {
  const q = useDeal<OpNP>('/novo-pedido');
  const acao = useDealAcao();
  const router = useRouter();
  const sp = useSearchParams();
  const [passo, setPasso] = useState(1);
  const [v, setV] = useState({
    tipo: 'B2C',
    preset: 'B2C_DIRETO',
    vendedor: '',
    alunoId: '',
    ofertaId: '',
    forma: '1',
    parcelas: '6',
    cupom: '',
    obs: '',
  });
  const [erro, setErro] = useState('');
  const d = q.data;
  /* Renovar (Renovações) e Novo pedido da ficha chegam com o aluno escolhido */
  // biome-ignore lint/correctness/useExhaustiveDependencies: preenche uma vez, quando as opções chegam
  useEffect(() => {
    const a = sp.get('aluno');
    if (!d || !a) return;
    const al = d.alunos.find((x) => x.v === a);
    const b2b2c = !!al?.empresa;
    setV((o) => ({
      ...o,
      alunoId: a,
      tipo: b2b2c ? 'B2B2C' : 'B2C',
      preset: b2b2c ? 'B2B2C_REEMBOLSO' : sp.get('renovar') ? 'B2C_RENOVACAO' : 'B2C_DIRETO',
    }));
  }, [d]);
  const set = (k: keyof typeof v) => (x: string) => {
    setErro('');
    setV((o) => ({ ...o, [k]: x }));
  };
  const al = d?.alunos.find((x) => x.v === v.alunoId);
  const of = d?.ofertas.find((o) => String(o.id) === v.ofertaId);
  const cp = useMemo(() => d?.cupons.find((c) => c.codigo === v.cupom.trim().toUpperCase()), [d, v.cupom]);
  const desc = cp && of ? (cp.tipo === '%' ? (of.preco * cp.valor) / 100 : cp.valor) : 0;
  const ir = (k: number) => {
    if (k > 1 && (!v.vendedor || !v.alunoId)) {
      setPasso(1);
      return setErro('Escolha o vendedor e o cliente.');
    }
    if (k > 2 && !v.ofertaId) {
      setPasso(2);
      return setErro('Escolha uma oferta.');
    }
    setErro('');
    setPasso(k);
  };
  const criar = () =>
    acao.mutate(
      {
        caminho: '/pedidos',
        json: {
          tipo: v.tipo,
          preset: v.preset,
          vendedor: v.vendedor,
          alunoId: Number(v.alunoId),
          ofertaId: Number(v.ofertaId),
          forma: Number(v.forma),
          parcelas: Number(v.parcelas),
          cupom: v.cupom,
          obs: v.obs,
        },
      },
      { onSuccess: (r) => router.push(`/pedidos/${r.id}/geral`), onError: (e) => setErro(e.message) },
    );
  if (q.isError)
    return (
      <Aviso tom="red" icone="alerta">
        {q.error.message}
      </Aviso>
    );
  if (!d) return null;
  const presets = d.presets.filter((p) => p.nivel === v.tipo);
  return (
    <>
      <PageHead titulo="Novo pedido" />
      <div role="tablist" aria-label="Passos" className="mb-5 flex gap-1 overflow-x-auto border-b border-borda">
        {PASSOS.map((t, i) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={passo === i + 1}
            onClick={() => ir(i + 1)}
            className={cn(
              'inline-flex h-11 shrink-0 items-center border-b-2 px-3.5 whitespace-nowrap',
              passo === i + 1
                ? 'border-azul font-semibold text-azul'
                : 'border-transparent text-apagado hover:text-texto',
            )}
          >
            {i + 1}. {t}
          </button>
        ))}
      </div>
      {erro && (
        <Aviso tom="red" icone="alerta">
          {erro}
        </Aviso>
      )}
      <div className="grid items-start gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="overflow-hidden">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            {passo === 1 && (
              <>
                <div className="grid content-start gap-1.5">
                  <Label>Tipo de venda</Label>
                  <Escolha
                    rotulo="Tipo de venda"
                    destacar={false}
                    valor={v.tipo}
                    aoMudar={(x) =>
                      setV((o) => ({
                        ...o,
                        tipo: x,
                        preset: x === 'B2B2C' ? 'B2B2C_REEMBOLSO' : 'B2C_DIRETO',
                        ofertaId: '',
                      }))
                    }
                    opcoes={['B2C', 'B2B2C'].map((x) => ({ v: x, l: x }))}
                  />
                </div>
                <div className="grid content-start gap-1.5">
                  <Label>Preset</Label>
                  <Escolha
                    rotulo="Preset"
                    destacar={false}
                    valor={v.preset}
                    aoMudar={set('preset')}
                    opcoes={presets.map((p) => ({ v: p.code, l: p.desc }))}
                  />
                </div>
                <div className="grid content-start gap-1.5">
                  <Label>
                    Vendedor responsável<span className="text-vermelho">*</span>
                  </Label>
                  <Escolha
                    rotulo="Vendedor responsável"
                    todos="Escolha"
                    destacar={false}
                    valor={v.vendedor}
                    aoMudar={set('vendedor')}
                    opcoes={d.vendedores.map((x) => ({ v: x, l: x }))}
                  />
                </div>
                <div className="grid content-start gap-1.5">
                  <Label>
                    Cliente<span className="text-vermelho">*</span>
                  </Label>
                  <Escolha
                    rotulo="Cliente"
                    todos="Escolha o aluno"
                    destacar={false}
                    valor={v.alunoId}
                    aoMudar={set('alunoId')}
                    opcoes={d.alunos}
                  />
                  <span className="text-apagado">o cliente é o aluno de Usuários › Alunos (mesmo ID)</span>
                </div>
              </>
            )}
            {passo === 2 && (
              <fieldset className="m-0 grid gap-2 border-0 p-0 sm:col-span-2">
                <legend className="mb-2 font-semibold text-texto">Ofertas {v.tipo}</legend>
                {d.ofertas
                  .filter((o) => o.mercado === v.tipo)
                  .map((o) => (
                    <label
                      key={o.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition-colors',
                        String(o.id) === v.ofertaId ? 'border-azul bg-azul-suave' : 'border-borda hover:bg-hover',
                      )}
                    >
                      <input
                        type="radio"
                        name="oferta"
                        className="size-4 accent-[var(--color-azul)]"
                        checked={String(o.id) === v.ofertaId}
                        onChange={() =>
                          setV((x) => ({
                            ...x,
                            ofertaId: String(o.id),
                            parcelas: String(Math.min(Number(x.parcelas), o.parcelasMax)),
                          }))
                        }
                      />
                      <span className="flex-1">
                        <b className="text-texto">{o.nome}</b>
                        <Sub>
                          {o.curso} · {o.aulas} aulas
                        </Sub>
                      </span>
                      <span className="tabular-nums">{o.precoR}</span>
                    </label>
                  ))}
              </fieldset>
            )}
            {passo === 3 && (
              <>
                <div className="grid content-start gap-1.5">
                  <Label>Forma de pagamento</Label>
                  <Escolha
                    rotulo="Forma de pagamento"
                    destacar={false}
                    valor={v.forma}
                    aoMudar={set('forma')}
                    opcoes={d.formas.map((f) => ({ v: String(f.id), l: f.nome }))}
                  />
                </div>
                <div className="grid content-start gap-1.5">
                  <Label>Parcelas</Label>
                  <Escolha
                    rotulo="Parcelas"
                    destacar={false}
                    valor={v.parcelas}
                    aoMudar={set('parcelas')}
                    opcoes={Array.from({ length: of?.parcelasMax ?? 6 }, (_, i) => ({
                      v: String(i + 1),
                      l: `${i + 1}x${of ? ` de ${R((of.preco - desc) / (i + 1))}` : ''}`,
                    }))}
                  />
                </div>
                <div className="grid content-start gap-1.5">
                  <Label htmlFor="np-cupom">Cupom</Label>
                  <Input
                    id="np-cupom"
                    value={v.cupom}
                    placeholder="ex.: VOLTA10"
                    onChange={(e) => set('cupom')(e.target.value)}
                  />
                  {v.cupom && (
                    <span className={cp ? 'text-verde' : 'text-vermelho'}>
                      {cp ? `desconto de ${R(desc)}` : 'cupom inválido ou vencido'}
                    </span>
                  )}
                </div>
              </>
            )}
            {passo === 4 && (
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="np-obs">Observação</Label>
                <textarea
                  id="np-obs"
                  rows={4}
                  value={v.obs}
                  onChange={(e) => set('obs')(e.target.value)}
                  className="w-full rounded-md border border-borda-forte bg-card px-3 py-2.5 text-sm text-texto focus:border-azul focus:shadow-anel focus-visible:outline-none"
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 border-t border-borda-suave px-5 py-3.5">
            {passo > 1 ? (
              <Button onClick={() => ir(passo - 1)}>
                <ChevronLeftIcon /> Voltar
              </Button>
            ) : (
              <Button asChild>
                <Link href="/acoes/dlPedidos">Cancelar</Link>
              </Button>
            )}
            <span className="flex-1" />
            {passo < 4 ? (
              <Button variant="primary" onClick={() => ir(passo + 1)}>
                Continuar <ArrowRightIcon />
              </Button>
            ) : (
              <Button variant="primary" disabled={acao.isPending || !d.podeOperar} onClick={criar}>
                Criar pedido
              </Button>
            )}
          </div>
        </Card>
        <Quadro
          titulo="Resumo"
          itens={[
            ['Cliente', al?.l ?? null],
            ['Tipo · preset', `${v.tipo} · ${v.preset}`],
            ['Vendedor', v.vendedor || null],
            ['Oferta', of?.nome ?? null],
            ['Valor', of ? R(of.preco - desc) : null],
            ['Pagamento', `${d.formas.find((f) => String(f.id) === v.forma)?.nome ?? ''} · ${v.parcelas}x`],
          ]}
        />
      </div>
    </>
  );
}
