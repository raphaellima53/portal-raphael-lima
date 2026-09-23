'use client';

import { FileTextIcon, PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Busca, normaliza } from '@/components/acoes/alocacao';
import type { Msg } from '@/components/alunos/comum';
import { Aviso, PageHead } from '@/components/ds';
import { Escolha } from '@/components/escolha';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFoot, DialogHead } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type NotaL, type Sit, type StatD, useDeal, useDealAcao } from '@/lib/deal';
import { Lk, Nada, SitB, Stats, Sub, TabelaDeal } from './comum';
import { TabelaNotas } from './pedido';

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
function useMsgAcao() {
  const acao = useDealAcao();
  const [msg, setMsg] = useState<Msg>(null);
  const faz = (caminho: string, json?: unknown) =>
    acao.mutate(
      { caminho, json },
      { onSuccess: (r) => setMsg({ txt: r.msg }), onError: (e) => setMsg({ txt: e.message, erro: true }) },
    );
  return { msg, faz, ocupado: acao.isPending };
}

/* ---------------- Faturamento › Ordem de faturamento ---------------- */
type Ordens = {
  podeOperar: boolean;
  stats: StatD[];
  itens: {
    id: number;
    numero: string;
    competencia: string;
    pagador: string;
    contrato: { id: number; nome: string } | null;
    linhas: number;
    total: string;
    venc: string;
    status: string;
  }[];
};
const SIT_ORDEM: Record<string, Sit[1]> = { 'a confirmar': 'amber', proposta: 'blue', liberada: 'green' };
export function TelaOrdens({ abas }: { abas: React.ReactNode }) {
  const q = useDeal<Ordens>('/ordens');
  const { msg, faz, ocupado } = useMsgAcao();
  const [st, setSt] = useState('');
  const d = q.data;
  return (
    <>
      <PageHead titulo="Ordem de faturamento" />
      {abas}
      <MsgAviso m={msg} />
      <Erro e={q.error} />
      {d && <Stats itens={d.stats} />}
      <div className="mb-4 flex justify-end">
        <Escolha
          rotulo="Situação"
          todos="Todas as situações"
          valor={st}
          aoMudar={setSt}
          opcoes={['a confirmar', 'proposta', 'liberada'].map((x) => ({ v: x, l: x[0].toUpperCase() + x.slice(1) }))}
          className="w-[210px]"
        />
      </div>
      <TabelaDeal
        rotulo="Ordens de faturamento"
        linhas={(d?.itens ?? []).filter((o) => !st || o.status === st)}
        chave={(o) => o.id}
        vazio="nenhuma ordem neste filtro"
        cols={[
          { t: 'Ordem', r: (o) => o.numero || <span className="text-apagado">sem número</span> },
          { t: 'Competência', r: (o) => o.competencia },
          { t: 'Pagador', r: (o) => o.pagador },
          {
            t: 'Contrato',
            r: (o) => (o.contrato ? <Lk href={`/contratos/${o.contrato.id}/geral`}>{o.contrato.nome}</Lk> : <Nada />),
          },
          { t: 'Linhas', num: true, r: (o) => o.linhas },
          { t: 'Total', num: true, r: (o) => o.total },
          { t: 'Vencimento', r: (o) => o.venc },
          { t: 'Situação', r: (o) => <Badge tom={SIT_ORDEM[o.status]}>{o.status}</Badge> },
          {
            t: 'Ações',
            r: (o) =>
              !d?.podeOperar || o.status === 'liberada' ? (
                <Nada />
              ) : (
                <Button
                  size="sm"
                  variant={o.status === 'proposta' ? 'primary' : 'default'}
                  disabled={ocupado}
                  onClick={() => faz(`/ordens/${o.id}`)}
                >
                  {o.status === 'a confirmar' ? 'Confirmar linhas' : 'Liberar'}
                </Button>
              ),
          },
        ]}
      />
    </>
  );
}

/* ---------------- Faturamento › Fechamento por matrícula ---------------- */
type Fech = {
  competencia: string;
  itens: {
    id: number;
    nome: string;
    vigentes: string;
    aulas: number;
    presencas: number;
    faltas: number;
    linhas: number;
    aFaturar: string;
    comNota: number;
    etapa: Sit;
  }[];
};
export function TelaFechamento({ abas }: { abas: React.ReactNode }) {
  const q = useDeal<Fech>('/fechamento');
  return (
    <>
      <PageHead titulo="Fechamento por matrícula" />
      {abas}
      <Erro e={q.error} />
      {q.data && (
        <Aviso tom="blue" icone="info">
          Competência {q.data.competencia}: quem está vigente em cada contrato, a presença nas aulas do mês (Agenda) e o
          que vira cobrança.
        </Aviso>
      )}
      <TabelaDeal
        rotulo="Fechamento por matrícula"
        linhas={q.data?.itens ?? []}
        chave={(x) => x.id}
        vazio="nenhum contrato ativo"
        cols={[
          { t: 'Contrato', r: (x) => <Lk href={`/contratos/${x.id}/beneficiarios`}>{x.nome}</Lk> },
          { t: 'Vigentes', num: true, r: (x) => x.vigentes },
          { t: 'Aulas no mês', num: true, r: (x) => x.aulas },
          { t: 'Presenças', num: true, r: (x) => x.presencas },
          { t: 'Faltas', num: true, r: (x) => <span className={x.faltas ? 'text-vermelho' : ''}>{x.faltas}</span> },
          { t: 'Linhas', num: true, r: (x) => x.linhas },
          { t: 'A faturar', num: true, r: (x) => x.aFaturar },
          { t: 'Com nota', num: true, r: (x) => x.comNota },
          { t: 'Etapa', r: (x) => <SitB s={x.etapa} /> },
        ]}
      />
    </>
  );
}

/* ---------------- Faturamento › Notas fiscais ---------------- */
type Notas = { podeOperar: boolean; fila: number; stats: StatD[]; competencias: string[]; itens: NotaL[] };
export function TelaNotas({ abas }: { abas: React.ReactNode }) {
  const q = useDeal<Notas>('/notas');
  const { msg, faz, ocupado } = useMsgAcao();
  const [busca, setBusca] = useState('');
  const [st, setSt] = useState('');
  const [mes, setMes] = useState('');
  const d = q.data;
  const ls = (d?.itens ?? []).filter(
    (n) =>
      (!st || n.situacao[0] === st) &&
      (!mes || n.competencia === mes) &&
      (!busca || normaliza(`${n.numero} ${n.pagador} ${n.origem}`).includes(normaliza(busca))),
  );
  return (
    <>
      <PageHead
        titulo="Notas fiscais"
        acoes={
          d?.fila && d.podeOperar ? (
            <Button variant="primary" disabled={ocupado} onClick={() => faz('/notas/emitir')}>
              <FileTextIcon /> Emitir {d.fila} da fila
            </Button>
          ) : null
        }
      />
      {abas}
      <MsgAviso m={msg} />
      <Erro e={q.error} />
      {d && <Stats itens={d.stats} />}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Busca rotulo="Buscar por número ou pagador" valor={busca} aoMudar={setBusca} />
        <div className="flex flex-wrap gap-2">
          <Escolha
            rotulo="Situação"
            todos="Todas as situações"
            valor={st}
            aoMudar={setSt}
            opcoes={[
              { v: 'autorizada', l: 'Autorizadas' },
              { v: 'na fila', l: 'Na fila' },
            ]}
            className="w-[200px]"
          />
          <Escolha
            rotulo="Competência"
            todos="Todas as competências"
            valor={mes}
            aoMudar={setMes}
            opcoes={(d?.competencias ?? []).map((x) => ({ v: x, l: x }))}
            className="w-[220px]"
          />
        </div>
      </div>
      <TabelaNotas ls={ls} />
    </>
  );
}

/* ---------------- Recebimento › Cobranças ---------------- */
type Cobs = {
  stats: StatD[];
  itens: {
    cobranca: string;
    pagador: string;
    alunoId: number | null;
    pedidoId: number;
    parcela: string;
    curso: string;
    meio: string;
    venc: string;
    pago: string | null;
    valor: string;
    sit: string;
    situacao: Sit;
  }[];
};
export function TelaCobrancas({ abas }: { abas: React.ReactNode }) {
  const q = useDeal<Cobs>('/cobrancas');
  const [busca, setBusca] = useState('');
  const [sit, setSit] = useState('');
  const ls = (q.data?.itens ?? []).filter(
    (x) => (!sit || x.sit === sit) && (!busca || normaliza(`${x.pagador} ${x.curso}`).includes(normaliza(busca))),
  );
  return (
    <>
      <PageHead titulo="Cobranças" />
      {abas}
      <Erro e={q.error} />
      {q.data && <Stats itens={q.data.stats} />}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Busca rotulo="Buscar por pagador ou curso" valor={busca} aoMudar={setBusca} />
        <Escolha
          rotulo="Situação"
          todos="Todas as situações"
          valor={sit}
          aoMudar={setSit}
          opcoes={[
            { v: 'paga', l: 'Pagas' },
            { v: 'vencida', l: 'Vencidas' },
            { v: 'aVencer', l: 'Agendadas' },
          ]}
          className="w-[200px]"
        />
      </div>
      <TabelaDeal
        rotulo="Cobranças"
        linhas={ls}
        chave={(x) => `${x.cobranca}-${x.parcela}-${x.pedidoId}`}
        vazio="nenhuma cobrança"
        cols={[
          { t: 'Cobrança', r: (x) => x.cobranca },
          {
            t: 'Pagador',
            r: (x) => (x.alunoId ? <Lk href={`/alunos/${x.alunoId}/financeiro`}>{x.pagador}</Lk> : x.pagador),
          },
          { t: 'Pedido', r: (x) => <Lk href={`/pedidos/${x.pedidoId}/cronograma`}>#{x.pedidoId}</Lk> },
          {
            t: 'Parcela',
            r: (x) => (
              <>
                {x.parcela}
                <Sub>{x.curso}</Sub>
              </>
            ),
          },
          { t: 'Meio', r: (x) => x.meio },
          { t: 'Vencimento', r: (x) => x.venc },
          { t: 'Pago em', r: (x) => x.pago ?? <Nada /> },
          { t: 'Valor', num: true, r: (x) => x.valor },
          { t: 'Situação', r: (x) => <SitB s={x.situacao} /> },
        ]}
      />
    </>
  );
}

/* ---------------- Recebimento › Liquidação manual ---------------- */
type Liq = {
  podeOperar: boolean;
  stats: StatD[];
  itens: {
    key: string;
    pagador: string;
    alunoId: number | null;
    curso: string;
    parcela: string;
    venc: string;
    atraso: number;
    valor: string;
  }[];
};
export function TelaLiquidacao({ abas }: { abas: React.ReactNode }) {
  const q = useDeal<Liq>('/liquidacao');
  const { msg, faz, ocupado } = useMsgAcao();
  const [busca, setBusca] = useState('');
  const d = q.data;
  const ls = (d?.itens ?? []).filter((x) => !busca || normaliza(`${x.pagador} ${x.curso}`).includes(normaliza(busca)));
  return (
    <>
      <PageHead titulo="Liquidação manual" />
      {abas}
      <MsgAviso m={msg} />
      <Erro e={q.error} />
      {d && <Stats itens={d.stats} />}
      <Aviso tom="blue" icone="info">
        Dar baixa aqui é o mesmo que Registrar pagamento em Atividades › Operações › Cobrança: a parcela fica paga no
        pedido, na ficha do aluno e no relatório financeiro.
      </Aviso>
      <div className="mb-4">
        <Busca rotulo="Buscar por pagador ou curso" valor={busca} aoMudar={setBusca} />
      </div>
      <TabelaDeal
        rotulo="Parcelas vencidas"
        linhas={ls}
        chave={(x) => x.key}
        vazio="nenhuma parcela vencida"
        cols={[
          {
            t: 'Pagador',
            r: (x) => (x.alunoId ? <Lk href={`/alunos/${x.alunoId}/financeiro`}>{x.pagador}</Lk> : x.pagador),
          },
          { t: 'Curso', r: (x) => x.curso },
          { t: 'Parcela', r: (x) => x.parcela },
          { t: 'Vencimento', r: (x) => x.venc },
          { t: 'Atraso', num: true, r: (x) => `${x.atraso} dias` },
          { t: 'Valor', num: true, r: (x) => x.valor },
          {
            t: 'Ações',
            r: (x) =>
              d?.podeOperar ? (
                <Button size="sm" disabled={ocupado} onClick={() => faz('/baixa', { key: x.key })}>
                  Dar baixa
                </Button>
              ) : (
                <Nada />
              ),
          },
        ]}
      />
    </>
  );
}

/* ---------------- Recebimento › Conciliação ---------------- */
type Conc = {
  stats: StatD[];
  itens: {
    pagador: string;
    parcela: string;
    pago: string;
    gateway: string;
    valor: string;
    recebido: string | null;
    diferenca: string | null;
    estado: Sit;
  }[];
};
export function TelaConciliacao({ abas }: { abas: React.ReactNode }) {
  const q = useDeal<Conc>('/conciliacao');
  return (
    <>
      <PageHead titulo="Conciliação" />
      {abas}
      <Erro e={q.error} />
      {q.data && <Stats itens={q.data.stats} />}
      <TabelaDeal
        titulo="Pagamentos dos últimos 60 dias × recebimentos"
        rotulo="Conciliação"
        linhas={q.data?.itens ?? []}
        chave={(_x, i) => i}
        vazio="nada nos últimos 60 dias"
        cols={[
          { t: 'Pagador', r: (x) => x.pagador },
          { t: 'Parcela', r: (x) => x.parcela },
          { t: 'Pago em', r: (x) => x.pago },
          { t: 'Gateway', r: (x) => x.gateway },
          { t: 'Valor', num: true, r: (x) => x.valor },
          { t: 'Recebido em', r: (x) => x.recebido ?? <Nada /> },
          {
            t: 'Diferença',
            num: true,
            r: (x) => (x.diferenca ? <span className="text-vermelho">{x.diferenca}</span> : <Nada />),
          },
          { t: 'Estado', r: (x) => <SitB s={x.estado} /> },
        ]}
      />
    </>
  );
}

/* ---------------- Posição › Posição financeira ---------------- */
type Pos = {
  stats: StatD[];
  itens: { k: string; n: number; pago: string; vencido: string; aVencer: string; inad: string }[];
};
export function TelaPosicao({ abas }: { abas: React.ReactNode }) {
  const [eixo, setEixo] = useState('curso');
  const q = useDeal<Pos>(`/posicao?eixo=${eixo}`);
  return (
    <>
      <PageHead titulo="Posição financeira" />
      {abas}
      <Erro e={q.error} />
      {q.data && <Stats itens={q.data.stats} />}
      <div className="mb-4 flex justify-end">
        <Escolha
          rotulo="Agrupar por"
          destacar={false}
          valor={eixo}
          aoMudar={setEixo}
          opcoes={[
            { v: 'curso', l: 'Por curso' },
            { v: 'tipo', l: 'Por pagador' },
            { v: 'mes', l: 'Por mês de vencimento' },
          ]}
          className="w-[230px]"
        />
      </div>
      <TabelaDeal
        rotulo="Posição financeira"
        linhas={q.data?.itens ?? []}
        chave={(x) => x.k}
        vazio="sem parcelas"
        cols={[
          { t: eixo === 'curso' ? 'Curso' : eixo === 'tipo' ? 'Pagador' : 'Mês', r: (x) => x.k },
          { t: 'Parcelas', num: true, r: (x) => x.n },
          { t: 'Pago', num: true, r: (x) => x.pago },
          { t: 'Vencido', num: true, r: (x) => x.vencido },
          { t: 'A vencer', num: true, r: (x) => x.aVencer },
          { t: 'Inadimplência', num: true, r: (x) => x.inad },
        ]}
      />
    </>
  );
}

/* ---------------- Posição › Clientes empresariais ---------------- */
type Contas = {
  itens: {
    empresaId: string | null;
    nome: string;
    cnpj: string;
    classe: string;
    kam: string;
    contratos: number;
    membros: number;
    matriculas: number;
    aFaturar: string;
    vencido: string;
    temVencido: boolean;
  }[];
};
export function TelaContas({ abas }: { abas: React.ReactNode }) {
  const q = useDeal<Contas>('/contas');
  const [busca, setBusca] = useState('');
  const [classe, setClasse] = useState('');
  const ls = (q.data?.itens ?? []).filter(
    (x) => (!classe || x.classe === classe) && (!busca || normaliza(`${x.nome} ${x.cnpj}`).includes(normaliza(busca))),
  );
  return (
    <>
      <PageHead titulo="Clientes empresariais" />
      {abas}
      <Erro e={q.error} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Busca rotulo="Buscar por empresa ou CNPJ" valor={busca} aoMudar={setBusca} />
        <Escolha
          rotulo="Classe"
          todos="Todas as classes"
          valor={classe}
          aoMudar={setClasse}
          opcoes={[
            { v: 'Contrato', l: 'Com contrato' },
            { v: 'Turma dedicada', l: 'Turma dedicada' },
            { v: 'Sem contrato', l: 'Sem contrato' },
          ]}
          className="w-[210px]"
        />
      </div>
      <TabelaDeal
        rotulo="Clientes empresariais"
        linhas={ls}
        chave={(x, i) => `${x.nome}-${i}`}
        vazio="nenhuma empresa neste filtro"
        cols={[
          {
            t: 'Empresa',
            r: (x) => (
              <>
                {x.empresaId ? <Lk href={`/empresas/${x.empresaId}/contratos`}>{x.nome}</Lk> : x.nome}
                <Sub>{x.cnpj}</Sub>
              </>
            ),
          },
          { t: 'Classe', r: (x) => <Badge tom={x.classe === 'Sem contrato' ? 'gray' : 'blue'}>{x.classe}</Badge> },
          { t: 'KAM', r: (x) => x.kam },
          { t: 'Contratos', num: true, r: (x) => x.contratos },
          { t: 'Membros', num: true, r: (x) => x.membros },
          { t: 'Matrículas', num: true, r: (x) => x.matriculas },
          { t: 'A faturar no mês', num: true, r: (x) => x.aFaturar },
          {
            t: 'Vencido',
            num: true,
            r: (x) => <span className={x.temVencido ? 'text-vermelho' : ''}>{x.vencido}</span>,
          },
        ]}
      />
    </>
  );
}

/* ---------------- Posição › Conferência de cronograma ---------------- */
type Conf = {
  meses: string[];
  itens: { preset: string; desc: string; celulas: { fato: number; cron: number; sem: number }[] }[];
};
export function TelaConferencia({ abas }: { abas: React.ReactNode }) {
  const q = useDeal<Conf>('/conferencia');
  const d = q.data;
  return (
    <>
      <PageHead titulo="Conferência de cronograma" />
      {abas}
      <Erro e={q.error} />
      <Aviso tom="blue" icone="info">
        Cronograma (o que deveria ser faturado) × fato (notas autorizadas), por preset e competência. Diferença aponta
        nota que falta emitir — emita em{' '}
        <Link href="/financeiro/dlNotas" className="font-semibold text-azul hover:underline">
          Notas fiscais
        </Link>
        .
      </Aviso>
      {d && (
        <TabelaDeal
          rotulo="Conferência de cronograma"
          linhas={d.itens}
          chave={(x) => x.preset}
          vazio="nenhum preset com vendas"
          cols={[
            {
              t: 'Preset',
              r: (x) => (
                <>
                  {x.preset}
                  <Sub>{x.desc}</Sub>
                </>
              ),
            },
            ...d.meses.map((m, i) => ({
              t: m,
              num: true,
              r: (x: Conf['itens'][number]) => (
                <>
                  {x.celulas[i].fato} de {x.celulas[i].cron}
                  {x.celulas[i].sem > 0 && (
                    <div className="mt-1">
                      <Badge tom="amber">{x.celulas[i].sem} sem nota</Badge>
                    </div>
                  )}
                </>
              ),
            })),
          ]}
        />
      )}
    </>
  );
}

/* ---------------- Produtos e serviços › Ofertas ---------------- */
type Ofertas = {
  podeCriar: boolean;
  cursos: string[];
  stats: StatD[];
  itens: {
    id: number;
    codigo: string;
    mercado: string;
    nome: string;
    curso: string;
    itens: string;
    preco: string;
    forma: string;
    parcelas: string;
    pedidos: number;
    pendencias: string[];
    ativa: boolean;
  }[];
};
export function TelaOfertas({ abas }: { abas: React.ReactNode }) {
  const q = useDeal<Ofertas>('/ofertas');
  const [busca, setBusca] = useState('');
  const [merc, setMerc] = useState('');
  const [nova, setNova] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const ls = (q.data?.itens ?? []).filter(
    (o) =>
      (!merc || o.mercado === merc) &&
      (!busca || normaliza(`${o.codigo} ${o.nome} ${o.curso}`).includes(normaliza(busca))),
  );
  return (
    <>
      <PageHead
        titulo="Ofertas"
        acoes={
          q.data?.podeCriar ? (
            <Button variant="primary" onClick={() => setNova(true)}>
              <PlusIcon /> Nova oferta
            </Button>
          ) : null
        }
      />
      {abas}
      <MsgAviso m={msg} />
      {q.data && (
        <NovaOferta
          cursos={q.data.cursos}
          aberto={nova}
          aoFechar={() => setNova(false)}
          aoSalvo={(txt) => setMsg({ txt })}
        />
      )}
      <Erro e={q.error} />
      {q.data && <Stats itens={q.data.stats} />}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Busca rotulo="Buscar por código, nome ou curso" valor={busca} aoMudar={setBusca} />
        <Escolha
          rotulo="Mercado"
          todos="Todos os mercados"
          valor={merc}
          aoMudar={setMerc}
          opcoes={['B2C', 'B2B2C', 'B2B'].map((x) => ({ v: x, l: x }))}
          className="w-[190px]"
        />
      </div>
      <TabelaDeal
        rotulo="Ofertas padrão"
        linhas={ls}
        chave={(o) => o.id}
        vazio="nenhuma oferta"
        cols={[
          {
            t: 'Código',
            r: (o) => (
              <>
                {o.codigo}
                <div className="mt-1">
                  <Badge tom={o.mercado === 'B2C' ? 'gray' : 'blue'}>{o.mercado}</Badge>
                </div>
              </>
            ),
          },
          {
            t: 'Oferta',
            r: (o) => (
              <>
                {o.nome}
                <Sub>{o.itens}</Sub>
              </>
            ),
          },
          { t: 'Preço', num: true, r: (o) => o.preco },
          {
            t: 'Pagamento',
            r: (o) => (
              <>
                {o.forma}
                <Sub>{o.parcelas}</Sub>
              </>
            ),
          },
          { t: 'Pedidos', num: true, r: (o) => o.pedidos },
          {
            t: 'Pendências',
            r: (o) =>
              o.pendencias.length ? (
                o.pendencias.map((p) => (
                  <Badge key={p} tom="amber">
                    {p}
                  </Badge>
                ))
              ) : (
                <Badge tom="green">ok</Badge>
              ),
          },
        ]}
      />
    </>
  );
}

type Presets = {
  itens: {
    code: string;
    desc: string;
    nivel: string;
    regime: string;
    forma: string;
    faturamento: string;
    acordos: number;
  }[];
};
export function TelaPresets({ abas }: { abas: React.ReactNode }) {
  const q = useDeal<Presets>('/presets');
  return (
    <>
      <PageHead titulo="Presets de venda" />
      {abas}
      <Erro e={q.error} />
      <Aviso tom="blue" icone="info">
        O preset define como a venda é cobrada e faturada: quem paga, quem recebe as aulas, se passa pelo gateway ou
        vira nota contra a empresa.
      </Aviso>
      <TabelaDeal
        rotulo="Presets de venda"
        linhas={q.data?.itens ?? []}
        chave={(p) => p.code}
        vazio="nenhum preset"
        cols={[
          { t: 'Código', r: (p) => p.code },
          { t: 'Descrição', r: (p) => p.desc },
          { t: 'Nível', r: (p) => <Badge tom={p.nivel === 'B2C' ? 'gray' : 'blue'}>{p.nivel}</Badge> },
          { t: 'Regime', r: (p) => p.regime },
          { t: 'Forma', r: (p) => p.forma },
          { t: 'Faturamento', r: (p) => p.faturamento },
          { t: 'Acordos', num: true, r: (p) => p.acordos },
        ]}
      />
    </>
  );
}

/** Nova oferta (24/09/2026): curso, horas ofertadas, valor e vigência em meses */
function NovaOferta({
  cursos,
  aberto,
  aoFechar,
  aoSalvo,
}: {
  cursos: string[];
  aberto: boolean;
  aoFechar: () => void;
  aoSalvo: (t: string) => void;
}) {
  const acao = useDealAcao();
  const [v, setV] = useState({ curso: '', horas: '', valor: '', meses: '', mercado: 'B2C' });
  const [erro, setErro] = useState('');
  useEffect(() => {
    if (aberto) {
      setV({ curso: '', horas: '', valor: '', meses: '', mercado: 'B2C' });
      setErro('');
    }
  }, [aberto]);
  const dig = (x: string, n: number) => x.replace(/\D/g, '').slice(0, n);
  /* R$ 0,00: digita só números e a vírgula entra sozinha */
  const moeda = (x: string) => {
    const d = x.replace(/\D/g, '').slice(0, 10);
    return d ? (Number(d) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '';
  };
  const salvar = () => {
    const valor = Number(v.valor.replace(/\./g, '').replace(',', '.'));
    if (!v.curso) return setErro('Escolha o curso.');
    if (!Number(v.horas)) return setErro('Informe as horas ofertadas.');
    if (!valor) return setErro('Informe o valor.');
    if (!Number(v.meses)) return setErro('Informe a vigência em meses.');
    acao.mutate(
      {
        caminho: '/ofertas',
        json: { curso: v.curso, horas: Number(v.horas), valor, meses: Number(v.meses), mercado: v.mercado },
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
        <DialogHead titulo="Nova oferta" descricao="o pacote que o comercial vende" />
        <DialogBody className="grid gap-4 sm:grid-cols-2">
          <div className="grid content-start gap-1.5 sm:col-span-2">
            <Label>
              Curso<span className="text-vermelho">*</span>
            </Label>
            <Escolha
              rotulo="Curso"
              todos="Selecione…"
              destacar={false}
              valor={v.curso}
              aoMudar={(x) => setV((o) => ({ ...o, curso: x }))}
              opcoes={cursos.map((c) => ({ v: c, l: c }))}
            />
          </div>
          <div className="grid content-start gap-1.5">
            <Label htmlFor="of-horas">
              Horas ofertadas<span className="text-vermelho">*</span>
            </Label>
            <Input
              id="of-horas"
              inputMode="numeric"
              value={v.horas}
              onChange={(e) => setV((o) => ({ ...o, horas: dig(e.target.value, 4) }))}
            />
          </div>
          <div className="grid content-start gap-1.5">
            <Label htmlFor="of-valor">
              Valor (R$)<span className="text-vermelho">*</span>
            </Label>
            <Input
              id="of-valor"
              inputMode="numeric"
              placeholder="0,00"
              value={v.valor}
              onChange={(e) => setV((o) => ({ ...o, valor: moeda(e.target.value) }))}
            />
          </div>
          <div className="grid content-start gap-1.5">
            <Label htmlFor="of-meses">
              Vigência em meses<span className="text-vermelho">*</span>
            </Label>
            <Input
              id="of-meses"
              inputMode="numeric"
              value={v.meses}
              onChange={(e) => setV((o) => ({ ...o, meses: dig(e.target.value, 2) }))}
            />
          </div>
          <div className="grid content-start gap-1.5">
            <Label>Mercado</Label>
            <Escolha
              rotulo="Mercado"
              destacar={false}
              valor={v.mercado}
              aoMudar={(x) => setV((o) => ({ ...o, mercado: x }))}
              opcoes={['B2C', 'B2B2C', 'B2B'].map((x) => ({ v: x, l: x }))}
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
          <Button variant="primary" disabled={acao.isPending} onClick={salvar}>
            Criar oferta
          </Button>
        </DialogFoot>
      </DialogContent>
    </Dialog>
  );
}
