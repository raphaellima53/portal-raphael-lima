'use client';

import { PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Busca, normaliza } from '@/components/acoes/alocacao';
import type { Msg } from '@/components/alunos/comum';
import { CampoData } from '@/components/campos-data';
import { Aviso, PageHead, Trilho } from '@/components/ds';
import { Escolha } from '@/components/escolha';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFoot, DialogHead } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type PedidoL, type Sit, type StatD, useDeal, useDealAcao } from '@/lib/deal';
import { idCadastro } from '@/lib/ids';
import { Lk, Nada, SitB, Stats, Sub, TabelaDeal } from './comum';

const Erro = ({ e }: { e: Error | null }) =>
  e ? (
    <Aviso tom="red" icone="alerta">
      {e.message}
    </Aviso>
  ) : null;
const MsgAviso = ({ m }: { m: Msg }) =>
  m ? (
    <Aviso tom={m.erro ? 'red' : 'blue'} icone={m.erro ? 'alerta' : 'ok'}>
      {m.txt}
    </Aviso>
  ) : null;
const novoPedido = (
  <Button asChild variant="primary">
    <Link href="/pedidos/novo">
      <PlusIcon /> Novo pedido
    </Link>
  </Button>
);

/* ---------------- Painel de vendas ---------------- */
type Painel = {
  stats: StatD[];
  meses: {
    mes: string;
    vendido: number;
    pago: number;
    faturado: number;
    vendidoR: string;
    pagoR: string;
    faturadoR: string;
  }[];
  pendencias: { t: string; n: number; v: string }[];
  ultimas: PedidoL[];
};
export function TelaPainel({ abas }: { abas: React.ReactNode }) {
  const q = useDeal<Painel>('/painel');
  const d = q.data;
  const max = Math.max(1, ...(d?.meses ?? []).flatMap((m) => [m.vendido, m.pago, m.faturado]));
  return (
    <>
      <PageHead titulo="Painel de vendas" acoes={novoPedido} />
      {abas}
      <Erro e={q.error} />
      {d && (
        <>
          <Stats itens={d.stats} />
          <div className="mb-4 grid gap-4 xl:grid-cols-2">
            <TabelaDeal
              titulo="Vendido, pago e faturado · 6 meses"
              rotulo="Vendido, pago e faturado por mês"
              linhas={d.meses}
              chave={(m) => m.mes}
              vazio="sem movimento"
              cols={[
                { t: 'Mês', r: (m) => m.mes },
                { t: 'Vendido', num: true, r: (m) => m.vendidoR },
                { t: 'Pago', num: true, r: (m) => m.pagoR },
                { t: 'Faturado', num: true, r: (m) => m.faturadoR },
                {
                  t: 'Comparativo',
                  r: (m) => (
                    <div className="grid min-w-[120px] gap-1">
                      <Trilho pct={(m.vendido / max) * 100} cor="#003fb0" rotulo={`vendido ${m.vendidoR}`} />
                      <Trilho pct={(m.pago / max) * 100} cor="#0a7a55" rotulo={`pago ${m.pagoR}`} />
                      <Trilho pct={(m.faturado / max) * 100} cor="#5b34b0" rotulo={`faturado ${m.faturadoR}`} />
                    </div>
                  ),
                },
              ]}
            />
            <TabelaDeal
              titulo="Pendências"
              rotulo="Pendências"
              linhas={d.pendencias}
              chave={(p) => p.t}
              vazio="nenhuma pendência"
              direita={
                <Button asChild size="sm">
                  <Link href="/financeiro/dlLiquidacao">Liquidação manual</Link>
                </Button>
              }
              cols={[
                { t: 'Pendência', r: (p) => p.t },
                { t: 'Quantidade', num: true, r: (p) => p.n },
                { t: 'Valor', num: true, r: (p) => p.v },
              ]}
            />
          </div>
          <TabelaDeal
            titulo="Últimas vendas"
            rotulo="Últimas vendas"
            linhas={d.ultimas}
            chave={(p) => p.id}
            vazio="nenhuma venda"
            direita={
              <Button asChild size="sm">
                <Link href="/acoes/dlPedidos">Ver todos os pedidos</Link>
              </Button>
            }
            cols={[
              { t: 'Data', r: (p) => p.data },
              { t: 'Pedido', r: (p) => <Lk href={`/pedidos/${p.id}/geral`}>#{p.id}</Lk> },
              { t: 'Cliente', r: (p) => p.cliente },
              { t: 'Oferta', r: (p) => p.oferta },
              { t: 'Valor', num: true, r: (p) => p.total },
              { t: 'Situação', r: (p) => <SitB s={p.situacao} /> },
            ]}
          />
        </>
      )}
    </>
  );
}

/* ---------------- Pedidos ---------------- */
export function TelaPedidos({ abas }: { abas: React.ReactNode }) {
  const q = useDeal<{ vendedores: string[]; itens: (PedidoL & { aberto: number })[] }>('/pedidos');
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState('');
  const [sit, setSit] = useState('');
  const [vend, setVend] = useState('');
  const d = q.data;
  const ls = (d?.itens ?? []).filter(
    (p) =>
      (!tipo || p.tipo === tipo) &&
      (!sit || p.situacao[0] === sit) &&
      (!vend || p.vendedor === vend) &&
      (!busca || normaliza(`${p.id} ${p.cliente} ${p.oferta} ${p.vendedor}`).includes(normaliza(busca))),
  );
  const soma = ls.reduce((s, p) => s + p.totalN, 0);
  const R = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return (
    <>
      <PageHead titulo="Pedidos" acoes={novoPedido} />
      {abas}
      <Erro e={q.error} />
      <Stats
        itens={[
          { v: String(ls.length), l: 'pedidos' },
          { v: R(soma), l: 'vendido' },
          { v: R(ls.length ? soma / ls.length : 0), l: 'ticket médio' },
          { v: R(ls.reduce((s, p) => s + p.aberto, 0)), l: 'a receber' },
        ]}
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Busca rotulo="Buscar por pedido, cliente ou oferta" valor={busca} aoMudar={setBusca} />
        <div className="flex flex-wrap items-center gap-2">
          <Escolha
            rotulo="Tipo de venda"
            todos="Todos os tipos"
            valor={tipo}
            aoMudar={setTipo}
            opcoes={['B2C', 'B2B2C', 'B2B'].map((x) => ({ v: x, l: x }))}
            className="w-[170px]"
          />
          <Escolha
            rotulo="Situação"
            todos="Todas as situações"
            valor={sit}
            aoMudar={setSit}
            opcoes={['Em dia', 'Vencida', 'Quitado', 'Cancelado', 'Sem cronograma'].map((x) => ({ v: x, l: x }))}
            className="w-[200px]"
          />
          <Escolha
            rotulo="Vendedor"
            todos="Todos os vendedores"
            valor={vend}
            aoMudar={setVend}
            opcoes={(d?.vendedores ?? []).map((x) => ({ v: x, l: x }))}
            className="w-[220px]"
          />
        </div>
      </div>
      <TabelaDeal
        rotulo="Pedidos"
        linhas={ls}
        chave={(p) => p.id}
        vazio="nenhum pedido neste filtro"
        cols={[
          { t: 'Pedido', r: (p) => <Lk href={`/pedidos/${p.id}/geral`}>#{p.id}</Lk> },
          { t: 'Data', r: (p) => p.data },
          {
            t: 'Cliente',
            r: (p) => (
              <>
                {p.alunoId ? <Lk href={`/alunos/${p.alunoId}/contratos`}>{p.cliente}</Lk> : p.cliente}{' '}
                {p.renovacao && <Badge tom="purple">renovação</Badge>}
              </>
            ),
          },
          { t: 'Oferta', r: (p) => p.oferta },
          { t: 'Tipo', r: (p) => <Badge tom={p.tipo === 'B2C' ? 'gray' : 'blue'}>{p.tipo}</Badge> },
          { t: 'Pagamento', r: (p) => p.forma },
          { t: 'Vendedor', r: (p) => p.vendedor },
          { t: 'Valor', num: true, r: (p) => p.total },
          { t: 'Situação', r: (p) => <SitB s={p.situacao} /> },
        ]}
      />
    </>
  );
}

/* ---------------- Importações da Vindi ---------------- */
type Imp = {
  podeOperar: boolean;
  itens: {
    id: string;
    aba: string;
    quando: string;
    nome: string;
    oferta: string;
    valor: string;
    critica: string;
    pronta: boolean;
    acao: string;
  }[];
};
export function TelaImportar({ abas }: { abas: React.ReactNode }) {
  const q = useDeal<Imp>('/importacoes');
  const acao = useDealAcao();
  const [aba, setAba] = useState('vendas');
  const [msg, setMsg] = useState<Msg>(null);
  const d = q.data;
  const n = (a: string) => (d?.itens ?? []).filter((x) => x.aba === a).length;
  return (
    <>
      <PageHead titulo="Importações" />
      {abas}
      <MsgAviso m={msg} />
      <Aviso tom="blue" icone="info">
        Cobranças que chegaram da Vindi e ainda não viraram venda, estorno ou baixa. Só as prontas podem ser importadas;
        as com crítica precisam de ajuste antes.
      </Aviso>
      <div role="radiogroup" aria-label="Fila" className="mb-4 flex flex-wrap gap-1">
        {[
          ['vendas', 'Vendas'],
          ['cobrancas', 'Cobranças'],
          ['estornos', 'Estornos'],
        ].map(([k, l]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={aba === k}
            onClick={() => setAba(k)}
            className={
              aba === k
                ? 'h-9 rounded-full border border-azul-linha bg-azul-suave px-3.5 font-semibold text-azul'
                : 'h-9 rounded-full border border-transparent px-3.5 text-apagado hover:bg-hover hover:text-texto'
            }
          >
            {l} · {n(k)}
          </button>
        ))}
      </div>
      <TabelaDeal
        rotulo="Fila de importação"
        linhas={(d?.itens ?? []).filter((x) => x.aba === aba)}
        chave={(x) => x.id}
        vazio="nada na fila"
        cols={[
          { t: 'Cobrança', r: (x) => x.id },
          { t: 'Quando', r: (x) => x.quando },
          { t: 'Pagador', r: (x) => x.nome },
          { t: 'Oferta', r: (x) => x.oferta },
          { t: 'Valor', num: true, r: (x) => x.valor },
          { t: 'Crítica', r: (x) => <Badge tom={x.critica ? 'amber' : 'green'}>{x.critica || 'pronta'}</Badge> },
          { t: 'Ação', r: (x) => x.acao },
          {
            t: 'Ações',
            r: (x) =>
              x.pronta && d?.podeOperar ? (
                <Button
                  size="sm"
                  variant="primary"
                  disabled={acao.isPending}
                  onClick={() =>
                    acao.mutate(
                      { caminho: `/importacoes/${x.id}` },
                      {
                        onSuccess: (r) => setMsg({ txt: r.msg }),
                        onError: (e) => setMsg({ txt: e.message, erro: true }),
                      },
                    )
                  }
                >
                  Importar
                </Button>
              ) : (
                <span className="text-apagado">{x.pronta ? '—' : 'ajustar antes'}</span>
              ),
          },
        ]}
      />
    </>
  );
}

/* ---------------- Renovações ---------------- */
type Renov = {
  itens: {
    alunoId: number;
    nome: string;
    empresa: string | null;
    curso: string;
    cor: string;
    pct: number;
    usadas: number;
    total: number;
    restam: number;
    pedidoId: number | null;
  }[];
};
export function TelaRenovacoes({ abas }: { abas: React.ReactNode }) {
  const q = useDeal<Renov>('/renovacoes');
  const [busca, setBusca] = useState('');
  const ls = (q.data?.itens ?? []).filter(
    (x) => !busca || normaliza(`${x.nome} ${x.curso}`).includes(normaliza(busca)),
  );
  return (
    <>
      <PageHead titulo="Renovações" />
      {abas}
      <Erro e={q.error} />
      <Aviso tom="blue" icone="info">
        Alunos que já usaram 30% ou mais do pacote, do mais perto do fim para o mais longe. Renovar abre o Novo pedido
        com o preset de renovação e o cliente já escolhido.
      </Aviso>
      <div className="mb-4">
        <Busca rotulo="Buscar aluno ou curso" valor={busca} aoMudar={setBusca} />
      </div>
      <TabelaDeal
        rotulo="Renovações"
        linhas={ls}
        chave={(x) => `${x.alunoId}-${x.curso}`}
        vazio="ninguém perto do fim do pacote"
        cols={[
          { t: 'ID', r: (x) => idCadastro(x.alunoId) },
          { t: 'Aluno', r: (x) => <Lk href={`/alunos/${x.alunoId}/cursos`}>{x.nome}</Lk> },
          { t: 'Curso', r: (x) => <Badge tom="gray">{x.curso}</Badge> },
          {
            t: 'Uso do pacote',
            r: (x) => (
              <div className="min-w-[150px]">
                <Trilho pct={x.pct} cor={x.pct >= 45 ? '#d70c0c' : '#003fb0'} rotulo={`${x.pct}% usado`} />
                <Sub>
                  {x.pct}% · {x.usadas} de {x.total}
                </Sub>
              </div>
            ),
          },
          { t: 'Restam', num: true, r: (x) => x.restam },
          {
            t: 'Último pedido',
            r: (x) => (x.pedidoId ? <Lk href={`/pedidos/${x.pedidoId}/geral`}>#{x.pedidoId}</Lk> : <Nada />),
          },
          {
            t: 'Ações',
            r: (x) => (
              <Button asChild size="sm">
                <Link href={`/pedidos/novo?aluno=${x.alunoId}&renovar=1`}>Renovar</Link>
              </Button>
            ),
          },
        ]}
      />
    </>
  );
}

/* ---------------- Vendedores ---------------- */
type Vend = {
  itens: {
    nome: string;
    email: string;
    nichos: string[];
    pedidos: number;
    quitados: number;
    vendido: string;
    ultimo: string | null;
    ativo: boolean;
  }[];
};
export function TelaVendedores({ abas }: { abas: React.ReactNode }) {
  const q = useDeal<Vend>('/vendedores');
  return (
    <>
      <PageHead titulo="Vendedores" />
      {abas}
      <Erro e={q.error} />
      <Aviso tom="blue" icone="info">
        Vendedores são pessoas da Equipe (Usuários › Equipe) do departamento Comercial. Aqui ficam os nichos que cada um
        atende e o resultado de vendas.
      </Aviso>
      <TabelaDeal
        rotulo="Vendedores"
        linhas={q.data?.itens ?? []}
        chave={(v) => v.nome}
        vazio="nenhum vendedor"
        cols={[
          {
            t: 'Vendedor',
            r: (v) => (
              <>
                {v.nome}
                {v.email && <Sub>{v.email}</Sub>}
              </>
            ),
          },
          {
            t: 'Nichos',
            r: (v) => (
              <div className="flex flex-wrap gap-1">
                {v.nichos.map((n) => (
                  <Badge key={n} tom="blue">
                    {n}
                  </Badge>
                ))}
              </div>
            ),
          },
          { t: 'Pedidos', num: true, r: (v) => v.pedidos },
          { t: 'Quitados', num: true, r: (v) => v.quitados },
          { t: 'Vendido', num: true, r: (v) => v.vendido },
          { t: 'Último pedido', r: (v) => v.ultimo ?? <Nada /> },
          { t: 'Situação', r: (v) => <SitB s={v.ativo ? ['Ativo', 'green'] : ['Inativo', 'gray']} /> },
        ]}
      />
    </>
  );
}

/* ---------------- Descontos (cupons) ---------------- */
type Desc = {
  podeOperar: boolean;
  stats: StatD[];
  itens: {
    codigo: string;
    descricao: string;
    desconto: string;
    validade: string;
    usos: string;
    ofertas: number;
    situacao: Sit;
  }[];
};
export function TelaDescontos({ abas }: { abas: React.ReactNode }) {
  const q = useDeal<Desc>('/descontos');
  const [novo, setNovo] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const d = q.data;
  return (
    <>
      <PageHead
        titulo="Descontos"
        acoes={
          d?.podeOperar ? (
            <Button variant="primary" onClick={() => setNovo(true)}>
              <PlusIcon /> Novo cupom
            </Button>
          ) : null
        }
      />
      {abas}
      <MsgAviso m={msg} />
      <Erro e={q.error} />
      {d && <Stats itens={d.stats} />}
      <TabelaDeal
        rotulo="Cupons"
        linhas={d?.itens ?? []}
        chave={(c) => c.codigo}
        vazio="nenhum cupom"
        cols={[
          { t: 'Código', r: (c) => c.codigo },
          { t: 'Descrição', r: (c) => c.descricao },
          { t: 'Desconto', r: (c) => c.desconto },
          { t: 'Validade', r: (c) => c.validade },
          { t: 'Usos', num: true, r: (c) => c.usos },
          { t: 'Ofertas', num: true, r: (c) => c.ofertas },
          { t: 'Situação', r: (c) => <SitB s={c.situacao} /> },
        ]}
      />
      <NovoCupom aberto={novo} aoFechar={() => setNovo(false)} aoSalvo={(txt) => setMsg({ txt })} />
    </>
  );
}
function NovoCupom({
  aberto,
  aoFechar,
  aoSalvo,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoSalvo: (t: string) => void;
}) {
  const acao = useDealAcao();
  const [cod, setCod] = useState('');
  const [valor, setValor] = useState('10');
  const [desc, setDesc] = useState('');
  const [validade, setValidade] = useState('');
  const [limite, setLimite] = useState('50');
  const [erro, setErro] = useState('');
  useEffect(() => {
    if (!aberto) return;
    const d = new Date(Date.now() + 30 * 864e5);
    setCod('');
    setValor('10');
    setDesc('');
    setLimite('50');
    setErro('');
    setValidade(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    );
  }, [aberto]);
  const salvar = () => {
    if (cod.trim().length < 3) return setErro('Informe o código.');
    acao.mutate(
      {
        caminho: '/cupons',
        json: { codigo: cod, descricao: desc, valor: Number(valor), validade, limite: Number(limite) || 50 },
      },
      {
        onSuccess: (r) => {
          aoFechar();
          aoSalvo(r.msg);
        },
        onError: (e) => setErro(e.message),
      },
    );
  };
  return (
    <Dialog open={aberto} onOpenChange={(x) => !x && aoFechar()}>
      <DialogContent tamanho="sm">
        <DialogHead titulo="Novo cupom" descricao="vale para as ofertas B2C" />
        <DialogBody className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="cp-cod">
              Código<span className="text-vermelho">*</span>
            </Label>
            <Input
              id="cp-cod"
              value={cod}
              placeholder="EX.: MAIO15"
              className="uppercase"
              onChange={(e) => setCod(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cp-val">
              Desconto (%)<span className="text-vermelho">*</span>
            </Label>
            <Input
              id="cp-val"
              type="number"
              min={1}
              max={90}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="cp-desc">Descrição</Label>
            <Input id="cp-desc" value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cp-ate">
              Validade<span className="text-vermelho">*</span>
            </Label>
            <CampoData id="cp-ate" rotulo="Validade" valor={validade} aoMudar={setValidade} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cp-lim">Limite de usos</Label>
            <Input id="cp-lim" type="number" min={1} value={limite} onChange={(e) => setLimite(e.target.value)} />
          </div>
        </DialogBody>
        <DialogFoot>
          {erro && (
            <span role="alert" className="mr-auto font-medium text-vermelho">
              {erro}
            </span>
          )}
          <Button onClick={aoFechar}>Cancelar</Button>
          <Button variant="primary" disabled={acao.isPending} onClick={salvar}>
            Salvar cupom
          </Button>
        </DialogFoot>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Bolsas ---------------- */
type Bolsas = {
  stats: StatD[];
  itens: {
    id: number;
    alunoId: number;
    nome: string;
    caso: string;
    curso: string;
    vigencia: string;
    aulas: string;
    custo: string;
    motivo: string;
    situacao: Sit;
  }[];
};
export function TelaBolsas({ abas }: { abas: React.ReactNode }) {
  const q = useDeal<Bolsas>('/bolsas');
  return (
    <>
      <PageHead titulo="Bolsas" />
      {abas}
      <Erro e={q.error} />
      {q.data && <Stats itens={q.data.stats} />}
      <TabelaDeal
        rotulo="Bolsas"
        linhas={q.data?.itens ?? []}
        chave={(b) => b.id}
        vazio="nenhuma bolsa"
        cols={[
          { t: 'Bolsista', r: (b) => <Lk href={`/alunos/${b.alunoId}/perfil`}>{b.nome}</Lk> },
          { t: 'Caso', r: (b) => <Badge tom={b.caso === 'Social' ? 'purple' : 'gray'}>{b.caso}</Badge> },
          { t: 'Curso', r: (b) => b.curso },
          { t: 'Vigência', r: (b) => b.vigencia },
          { t: 'Aulas', r: (b) => b.aulas },
          { t: 'Custo', num: true, r: (b) => b.custo },
          { t: 'Motivo', r: (b) => <span className="text-apagado">{b.motivo}</span> },
          { t: 'Situação', r: (b) => <SitB s={b.situacao} /> },
        ]}
      />
    </>
  );
}
