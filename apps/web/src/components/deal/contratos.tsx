'use client';

import { ArrowRightIcon, ChevronLeftIcon, PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Abas } from '@/components/abas';
import type { Msg } from '@/components/alunos/comum';
import { CampoData } from '@/components/campos-data';
import { Aviso, PageHead } from '@/components/ds';
import { Escolha } from '@/components/escolha';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogBody, DialogContent, DialogFoot, DialogHead } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type ContratoL, type ParcelaL, type PedidoL, type StatD, useDeal, useDealAcao } from '@/lib/deal';
import { idCadastro } from '@/lib/ids';
import { cn } from '@/lib/utils';
import { Lk, Nada, Quadro, SitB, Stats, Sub, TabelaDeal } from './comum';
import { Cronograma } from './pedido';

/** leva à ficha do contrato lembrando de onde veio (ficha do aluno ou da empresa) */
const hrefContrato = (id: number, volta: string, rot: string, aba = 'geral') =>
  `/contratos/${id}/${aba}?volta=${encodeURIComponent(volta)}&rot=${encodeURIComponent(rot)}`;

export function TabelaContratos({ ls, volta, rot }: { ls: ContratoL[]; volta: string; rot: string }) {
  return (
    <TabelaDeal
      rotulo="Contratos empresariais"
      linhas={ls}
      chave={(c) => c.id}
      vazio="nenhum contrato empresarial"
      cols={[
        {
          t: 'Contrato',
          r: (c) => (
            <>
              <Lk href={hrefContrato(c.id, volta, rot)}>{c.nome}</Lk>
              <Sub>#{c.id}</Sub>
            </>
          ),
        },
        {
          t: 'Empresa',
          r: (c) => (
            <>
              {c.empresa}
              <Sub>{c.cnpj}</Sub>
            </>
          ),
        },
        { t: 'Preset', r: (c) => c.preset },
        {
          t: 'Vigência',
          r: (c) => (
            <>
              {c.vigencia}
              <div className="mt-1">
                <SitB s={c.vig} />
              </div>
            </>
          ),
        },
        { t: 'Beneficiários', num: true, r: (c) => c.beneficiarios },
        { t: 'Vendido', num: true, r: (c) => c.vendido },
        {
          t: 'Vencido',
          num: true,
          r: (c) => <span className={c.temVencido ? 'font-semibold text-vermelho' : ''}>{c.vencido}</span>,
        },
        { t: 'Situação', r: (c) => <SitB s={[c.status, c.status === 'Ativo' ? 'green' : 'gray']} /> },
      ]}
    />
  );
}

/**
 * Aba Contratos das fichas (23/09/2026): no aluno, os contratos da empresa dele (ou em que é beneficiário) e os pedidos;
 * na empresa, os contratos dela. O Novo contrato nasce com a empresa escolhida.
 */
export function AbaContratos({
  alunoId,
  empresaId,
  volta,
  rot,
}: {
  alunoId?: number;
  empresaId?: string;
  volta: string;
  rot: string;
}) {
  const q = useDeal<{ podeCriar: boolean; empresa: string | null; contratos: ContratoL[]; pedidos: PedidoL[] | null }>(
    alunoId ? `/contratos?alunoId=${alunoId}` : `/contratos?empresaId=${empresaId}`,
  );
  const d = q.data;
  if (q.isError)
    return (
      <Aviso tom="red" icone="alerta">
        {q.error.message}
      </Aviso>
    );
  if (!d) return null;
  const novo =
    d.podeCriar && (empresaId || d.empresa) ? (
      <Button asChild variant="primary" size="sm">
        <Link
          href={`/contratos/novo?${empresaId ? `empresaId=${empresaId}` : `empresa=${encodeURIComponent(d.empresa!)}`}&volta=${encodeURIComponent(volta)}&rot=${encodeURIComponent(rot)}`}
        >
          <PlusIcon /> Novo contrato
        </Link>
      </Button>
    ) : null;
  return (
    <div className="grid gap-4">
      {alunoId && !d.empresa && !d.contratos.length && (
        <Aviso icone="info">
          Aluno B2C: não tem contrato empresarial. O contrato dele é o próprio pedido, abaixo; as parcelas ficam em
          Financeiro › Parcelas.
        </Aviso>
      )}
      {(d.empresa || d.contratos.length > 0 || empresaId) && (
        <section>
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-md font-bold text-texto">Contratos empresariais</h2>
            <Badge tom="blue">{d.contratos.length}</Badge>
            <span className="flex-1" />
            {novo}
          </div>
          <TabelaContratos ls={d.contratos} volta={volta} rot={rot} />
        </section>
      )}
      {d.pedidos && (
        <TabelaDeal
          titulo="Pedidos do aluno"
          rotulo="Pedidos do aluno"
          linhas={d.pedidos}
          chave={(p) => p.id}
          vazio="nenhum pedido"
          direita={
            <Button asChild size="sm">
              <Link href={`/pedidos/novo?aluno=${alunoId}`}>
                <PlusIcon /> Novo pedido
              </Link>
            </Button>
          }
          cols={[
            { t: 'Pedido', r: (p) => <Lk href={`/pedidos/${p.id}/geral`}>#{p.id}</Lk> },
            { t: 'Data', r: (p) => p.data },
            { t: 'Oferta', r: (p) => p.oferta },
            { t: 'Contrato', r: (p) => p.contrato ?? <span className="text-apagado">individual (B2C)</span> },
            { t: 'Pagamento', r: (p) => p.forma },
            { t: 'Valor', num: true, r: (p) => p.total },
            { t: 'Situação', r: (p) => <SitB s={p.situacao} /> },
          ]}
        />
      )}
    </div>
  );
}

/* ---------------- ficha do contrato ---------------- */
type Contrato = ContratoL & {
  podeOperar: boolean;
  kam: string;
  tipoB2B: string;
  retencao: string;
  presetDesc: string;
  regime: string;
  motivoFim: string;
  stats: StatD[];
  passo: string | null;
  pedidosN: number;
  ofertas: { nome: string; curso: string; aulas: number; preco: string; forma: string; matriculas: number }[];
  pedidos: PedidoL[];
  cronograma: ParcelaL[];
  turmas: string[];
  benefLista: { id: number; nome: string; cpf: string; pedidoId: number | null; situacao: string }[];
  historico: { quando: string; quem: string; acao: string; detalhe: string }[];
};
const ABAS = [
  ['geral', 'Visão geral'],
  ['ofertas', 'Ofertas'],
  ['pedidos', 'Pedidos'],
  ['cronograma', 'Cronograma'],
  ['beneficiarios', 'Beneficiários'],
  ['historico', 'Histórico'],
] as const;

export function FichaContrato({ id, aba }: { id: string; aba: string }) {
  const q = useDeal<Contrato>(`/contratos/${id}`);
  const sp = useSearchParams();
  const [msg, setMsg] = useState<Msg>(null);
  const [encerrar, setEncerrar] = useState(false);
  const c = q.data;
  const volta = sp.get('volta') || (c?.empresaId ? `/empresas/${c.empresaId}/contratos` : '/empresas');
  const rot = sp.get('rot') || (c?.empresa ?? 'Empresas');
  const qs = `?volta=${encodeURIComponent(volta)}&rot=${encodeURIComponent(rot)}`;
  const botaoVolta = (
    <Button asChild>
      <Link href={volta}>
        <ChevronLeftIcon /> {rot}
      </Link>
    </Button>
  );
  if (q.isError)
    return (
      <>
        <PageHead titulo="Contrato" acoes={botaoVolta} />
        <Aviso tom="red" icone="alerta">
          {q.error.message}
        </Aviso>
      </>
    );
  if (!c) return null;
  return (
    <>
      <PageHead
        titulo={
          <>
            {c.nome} <span className="font-normal text-apagado">· #{c.id}</span>
          </>
        }
        acoes={
          <>
            {botaoVolta}
            {c.status === 'Ativo' && c.podeOperar && (
              <Button onClick={() => setEncerrar(true)}>Encerrar contrato</Button>
            )}
          </>
        }
      />
      <Abas
        rotulo="Abas do contrato"
        itens={ABAS.map(([k, l]) => ({ href: `/contratos/${c.id}/${k}${qs}`, rotulo: l, ativa: k === aba }))}
      />
      {msg && (
        <Aviso tom={msg.erro ? 'red' : 'blue'} icone={msg.erro ? 'alerta' : 'ok'}>
          {msg.txt}
        </Aviso>
      )}
      {aba === 'geral' && (
        <>
          <Stats itens={c.stats} />
          {c.passo && (
            <Aviso tom="blue" icone="info">
              <b>Próximo passo:</b> {c.passo}{' '}
              <Link href="/financeiro/dlOrdens" className="font-semibold text-azul hover:underline">
                abrir a ordem
              </Link>
            </Aviso>
          )}
          <div className="grid gap-4 lg:grid-cols-3">
            <Quadro
              titulo="Contrato"
              itens={[
                ['Nome', c.nome],
                [
                  'Empresa',
                  c.empresaId ? (
                    <Lk key="emp" href={`/empresas/${c.empresaId}/geral`}>
                      {c.empresa}
                    </Lk>
                  ) : (
                    c.empresa
                  ),
                ],
                ['CNPJ', c.cnpj],
                ['KAM', c.kam],
              ]}
            />
            <Quadro
              titulo="Vigência e limites"
              itens={[
                ['Período', c.vigencia],
                ['Situação', <SitB key="sit" s={c.status === 'Ativo' ? c.vig : ['Encerrado', 'gray']} />],
                ['Beneficiários', c.beneficiarios],
                ['Pedidos', c.pedidosN],
                ...(c.motivoFim ? ([['Motivo do fim', c.motivoFim]] as [string, string][]) : []),
              ]}
            />
            <Quadro
              titulo="Modelo"
              itens={[
                [
                  'Preset',
                  <>
                    {c.preset}
                    <Sub>{c.presetDesc}</Sub>
                  </>,
                ],
                ['Regime · forma', c.regime],
                ['Tipo B2B', c.tipoB2B],
                ['Retenção na fonte', c.retencao],
              ]}
            />
          </div>
        </>
      )}
      {aba === 'ofertas' && (
        <TabelaDeal
          rotulo="Ofertas do contrato"
          linhas={c.ofertas}
          chave={(o) => o.nome}
          vazio="sem ofertas no contrato"
          cols={[
            { t: 'Oferta', r: (o) => o.nome },
            { t: 'Curso', r: (o) => o.curso },
            { t: 'Aulas', num: true, r: (o) => o.aulas },
            { t: 'Preço', num: true, r: (o) => o.preco },
            { t: 'Pagamento', r: (o) => o.forma },
            { t: 'Matrículas', num: true, r: (o) => o.matriculas },
          ]}
        />
      )}
      {aba === 'pedidos' && (
        <TabelaDeal
          rotulo="Pedidos do contrato"
          linhas={c.pedidos}
          chave={(p) => p.id}
          vazio="nenhum pedido"
          cols={[
            { t: 'Pedido', r: (p) => <Lk href={`/pedidos/${p.id}/geral`}>#{p.id}</Lk> },
            { t: 'Data', r: (p) => p.data },
            { t: 'Cliente', r: (p) => p.cliente },
            { t: 'Valor', num: true, r: (p) => p.total },
            { t: 'Situação', r: (p) => <SitB s={p.situacao} /> },
          ]}
        />
      )}
      {aba === 'cronograma' && <Cronograma ls={c.cronograma} podeOperar={false} />}
      {aba === 'beneficiarios' &&
        (c.turmas.length ? (
          <TabelaDeal
            rotulo="Turmas do contrato"
            linhas={c.turmas}
            chave={(t) => t}
            vazio="nenhuma turma"
            cols={[
              { t: 'Turma', r: (t) => t },
              { t: 'Curso', r: () => c.empresa },
            ]}
          />
        ) : (
          <TabelaDeal
            rotulo="Beneficiários"
            linhas={c.benefLista}
            chave={(b) => b.id}
            vazio="nenhum beneficiário"
            cols={[
              { t: 'ID', r: (b) => idCadastro(b.id) },
              { t: 'Beneficiário', r: (b) => <Lk href={`/alunos/${b.id}/contratos`}>{b.nome}</Lk> },
              { t: 'Documento', r: (b) => b.cpf || <Nada /> },
              {
                t: 'Pedido',
                r: (b) => (b.pedidoId ? <Lk href={`/pedidos/${b.pedidoId}/geral`}>#{b.pedidoId}</Lk> : <Nada />),
              },
              { t: 'Situação', r: (b) => <SitB s={[b.situacao, b.situacao === 'Ativo' ? 'green' : 'red']} /> },
            ]}
          />
        ))}
      {aba === 'historico' && (
        <TabelaDeal
          rotulo="Histórico do contrato"
          linhas={c.historico}
          chave={(_h, i) => i}
          vazio="sem histórico"
          cols={[
            { t: 'Quando', r: (h) => h.quando },
            { t: 'Quem', r: (h) => h.quem },
            { t: 'Ação', r: (h) => h.acao },
            { t: 'Detalhe', r: (h) => <span className="text-apagado">{h.detalhe}</span> },
          ]}
        />
      )}
      <Encerrar
        id={c.id}
        nome={c.nome}
        aberto={encerrar}
        aoFechar={() => setEncerrar(false)}
        aoSalvo={(txt) => setMsg({ txt })}
      />
    </>
  );
}

const hojeIso = (dias = 0) => {
  const d = new Date(Date.now() + dias * 864e5);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function Encerrar({
  id,
  nome,
  aberto,
  aoFechar,
  aoSalvo,
}: {
  id: number;
  nome: string;
  aberto: boolean;
  aoFechar: () => void;
  aoSalvo: (t: string) => void;
}) {
  const acao = useDealAcao();
  const [data, setData] = useState(hojeIso());
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  useEffect(() => {
    if (aberto) {
      setData(hojeIso());
      setMotivo('');
      setErro('');
    }
  }, [aberto]);
  return (
    <Dialog open={aberto} onOpenChange={(x) => !x && aoFechar()}>
      <DialogContent tamanho="sm">
        <DialogHead
          titulo={`Encerrar ${nome}`}
          descricao="O contrato para de gerar ordens. Pedidos e notas já emitidos continuam."
        />
        <DialogBody className="grid gap-4">
          <div className="grid content-start gap-1.5">
            <Label htmlFor="enc-data">
              Encerrar em<span className="text-vermelho">*</span>
            </Label>
            <CampoData id="enc-data" rotulo="Encerrar em" valor={data} aoMudar={setData} />
          </div>
          <div className="grid content-start gap-1.5">
            <Label htmlFor="enc-mot">
              Motivo<span className="text-vermelho">*</span>
            </Label>
            <Input id="enc-mot" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
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
              acao.mutate(
                { caminho: `/contratos/${id}/encerrar`, json: { data, motivo } },
                {
                  onSuccess: (r) => {
                    aoFechar();
                    aoSalvo(r.msg);
                  },
                  onError: (e) => setErro(e.message),
                },
              )
            }
          >
            Encerrar
          </Button>
        </DialogFoot>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Novo contrato em 4 passos ---------------- */
type OpNC = {
  empresas: { v: string; l: string }[];
  presets: { code: string; desc: string; regime: string; forma: string; fat: boolean }[];
  ofertas: { id: number; nome: string; preco: string }[];
};
const PASSOS = ['Empresa', 'Tipo e modelo', 'Ofertas', 'Vigência e limites'];

export function NovoContrato() {
  const q = useDeal<OpNC>('/novo-contrato');
  const acao = useDealAcao();
  const router = useRouter();
  const sp = useSearchParams();
  const volta = sp.get('volta') || '/empresas';
  const rot = sp.get('rot') || 'Empresas';
  const [passo, setPasso] = useState(1);
  const [v, setV] = useState({
    empresaId: '',
    nome: '',
    preset: 'B2B_ABERTO_PER_CAPITA',
    ofertas: [] as number[],
    ini: hojeIso(),
    fim: hojeIso(365),
    max: '',
  });
  const [erro, setErro] = useState('');
  const d = q.data;
  // biome-ignore lint/correctness/useExhaustiveDependencies: a empresa da ficha de origem já vem escolhida
  useEffect(() => {
    if (!d) return;
    const e = d.empresas.find((x) => x.v === sp.get('empresaId') || x.l === sp.get('empresa'));
    if (e) {
      setV((o) => ({ ...o, empresaId: e.v, nome: `${e.l} — ${new Date().getFullYear()}` }));
      setPasso(2);
    }
  }, [d]);
  const emp = d?.empresas.find((x) => x.v === v.empresaId);
  const pr = d?.presets.find((p) => p.code === v.preset);
  const ir = (k: number) => {
    if (k > 1 && (!v.empresaId || v.nome.trim().length < 3)) {
      setPasso(1);
      return setErro('Escolha a empresa e dê um nome ao contrato.');
    }
    if (k > 3 && !v.ofertas.length) {
      setPasso(3);
      return setErro('Escolha pelo menos uma oferta.');
    }
    setErro('');
    setPasso(k);
  };
  const criar = () =>
    acao.mutate(
      {
        caminho: '/contratos',
        json: {
          empresaId: v.empresaId,
          nome: v.nome,
          preset: v.preset,
          ofertas: v.ofertas,
          inicio: v.ini,
          fim: v.fim,
          max: v.max ? Number(v.max) : null,
        },
      },
      {
        onSuccess: (r) => router.push(hrefContrato(r.id!, volta, rot)),
        onError: (e) => setErro(e.message),
      },
    );
  if (q.isError)
    return (
      <Aviso tom="red" icone="alerta">
        {q.error.message}
      </Aviso>
    );
  if (!d) return null;
  return (
    <>
      <PageHead titulo="Novo contrato empresarial" />
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
                  <Label>
                    Empresa<span className="text-vermelho">*</span>
                  </Label>
                  <Escolha
                    rotulo="Empresa"
                    todos="Escolha"
                    destacar={false}
                    valor={v.empresaId}
                    aoMudar={(x) =>
                      setV((o) => ({
                        ...o,
                        empresaId: x,
                        nome: o.nome || `${d.empresas.find((e) => e.v === x)?.l ?? ''} — `,
                      }))
                    }
                    opcoes={d.empresas}
                  />
                  <span className="text-apagado">a empresa vem de Usuários › Empresas</span>
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="nc-nome">
                    Nome do contrato<span className="text-vermelho">*</span>
                  </Label>
                  <Input id="nc-nome" value={v.nome} onChange={(e) => setV((o) => ({ ...o, nome: e.target.value }))} />
                  <span className="text-apagado">
                    é assim que ele aparece na venda; diferencie de outros contratos da mesma empresa
                  </span>
                </div>
              </>
            )}
            {passo === 2 && (
              <div className="grid gap-3 sm:col-span-2">
                <Label>Preset</Label>
                <Escolha
                  rotulo="Preset"
                  destacar={false}
                  valor={v.preset}
                  aoMudar={(x) => setV((o) => ({ ...o, preset: x }))}
                  opcoes={d.presets.map((p) => ({ v: p.code, l: p.desc }))}
                />
                {pr && (
                  <p className="m-0 text-apagado">
                    Regime {pr.regime} · forma {pr.forma} · faturamento {pr.fat ? 'contra nota fiscal' : 'pelo gateway'}
                  </p>
                )}
              </div>
            )}
            {passo === 3 && (
              <fieldset className="m-0 grid gap-2 border-0 p-0 sm:col-span-2">
                <legend className="mb-2 font-semibold text-texto">Ofertas do contrato</legend>
                {d.ofertas.map((o) => {
                  const on = v.ofertas.includes(o.id);
                  return (
                    <label
                      key={o.id}
                      htmlFor={`nc-of-${o.id}`}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5',
                        on ? 'border-azul bg-azul-suave' : 'border-borda hover:bg-hover',
                      )}
                    >
                      <Checkbox
                        id={`nc-of-${o.id}`}
                        checked={on}
                        onCheckedChange={() =>
                          setV((x) => ({
                            ...x,
                            ofertas: on ? x.ofertas.filter((y) => y !== o.id) : [...x.ofertas, o.id],
                          }))
                        }
                      />
                      <span className="flex-1 text-texto">{o.nome}</span>
                      <span className="tabular-nums">{o.preco}</span>
                    </label>
                  );
                })}
              </fieldset>
            )}
            {passo === 4 && (
              <>
                <div className="grid content-start gap-1.5">
                  <Label htmlFor="nc-ini">Início</Label>
                  <CampoData
                    id="nc-ini"
                    rotulo="Início"
                    valor={v.ini}
                    aoMudar={(x) => setV((o) => ({ ...o, ini: x }))}
                  />
                </div>
                <div className="grid content-start gap-1.5">
                  <Label htmlFor="nc-fim">Fim</Label>
                  <CampoData id="nc-fim" rotulo="Fim" valor={v.fim} aoMudar={(x) => setV((o) => ({ ...o, fim: x }))} />
                  <span className="text-apagado">em branco = indeterminada</span>
                </div>
                <div className="grid content-start gap-1.5">
                  <Label htmlFor="nc-max">Limite de beneficiários</Label>
                  <Input
                    id="nc-max"
                    type="number"
                    min={1}
                    placeholder="sem limite"
                    value={v.max}
                    onChange={(e) => setV((o) => ({ ...o, max: e.target.value }))}
                  />
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 border-t border-borda-suave px-5 py-3.5">
            {passo > 1 ? (
              <Button onClick={() => ir(passo - 1)}>
                <ChevronLeftIcon /> Voltar
              </Button>
            ) : (
              <Button asChild>
                <Link href={volta}>Cancelar</Link>
              </Button>
            )}
            <span className="flex-1" />
            {passo < 4 ? (
              <Button variant="primary" onClick={() => ir(passo + 1)}>
                Continuar <ArrowRightIcon />
              </Button>
            ) : (
              <Button variant="primary" disabled={acao.isPending} onClick={criar}>
                Criar contrato
              </Button>
            )}
          </div>
        </Card>
        <Quadro
          titulo="Resumo"
          itens={[
            ['Nome', v.nome || null],
            ['Empresa', emp?.l ?? null],
            ['Preset', v.preset],
            ['Ofertas', v.ofertas.length],
            [
              'Vigência',
              `${v.ini.split('-').reverse().join('/')} — ${v.fim ? v.fim.split('-').reverse().join('/') : 'indeterminada'}`,
            ],
            ['Limite', v.max || 'sem limite'],
          ]}
        />
      </div>
    </>
  );
}
