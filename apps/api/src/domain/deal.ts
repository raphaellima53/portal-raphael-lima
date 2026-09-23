/**
 * Deal dentro do Portal (23/09/2026): porte de deal.src.js do protótipo 23.
 * - Cliente = Aluno ou Empresa do Portal. Parcelas dos pedidos que vieram das matrículas = as do Portal (finCobrancas),
 *   e dar baixa aqui é o mesmo ParcelaPaga da Cobrança; pedidos novos têm parcelas próprias (ParcelaPedido).
 * - A carga inicial (uma vez por banco) cria as ofertas padrão a partir dos cursos e, com dados de exemplo ligados,
 *   os contratos, pedidos, ordens, notas, cupons, bolsas e a fila da Vindi a partir da base viva.
 * - A fila de notas é calculada: parcela de aluno paga ou ordem liberada sem nota autorizada.
 */
import { prisma } from '../db.ts';
import type { Prisma } from '../generated/prisma/client.ts';
import { comExemplos } from '../lib/exemplos.ts';
import { fmt } from '../lib/fmt.ts';
import { CONSULTORES_BASE } from './acoes.ts';
import { alMat, crsRegras } from './agenda.ts';
import { type Base, base } from './base.ts';
import { finValorAula } from './cursos.ts';
import { type Cobranca, FIN_PARCELAS, finCobrancas } from './financeiro.ts';

export type Preset = {
  code: string;
  desc: string;
  nivel: 'B2C' | 'B2B2C' | 'B2B';
  regime: string;
  forma: string;
  fat: boolean;
  pag: boolean;
  contrato?: boolean;
};
export const DEAL_PRESETS: Preset[] = [
  {
    code: 'B2C_DIRETO',
    desc: 'Venda direta: a pessoa compra e é a beneficiária',
    nivel: 'B2C',
    regime: 'Assinatura',
    forma: 'Gateway',
    fat: false,
    pag: true,
  },
  {
    code: 'B2C_RENOVACAO',
    desc: 'Renovação de um pacote que está acabando',
    nivel: 'B2C',
    regime: 'Assinatura',
    forma: 'Gateway',
    fat: false,
    pag: true,
  },
  {
    code: 'B2C_UPSELL',
    desc: 'Upsell: mais horas ou outro curso para quem já é aluno',
    nivel: 'B2C',
    regime: 'Assinatura',
    forma: 'Gateway',
    fat: false,
    pag: true,
  },
  {
    code: 'B2C_PAGADOR_TERCEIRO',
    desc: 'Pagador diferente do beneficiário (pais, responsável)',
    nivel: 'B2C',
    regime: 'Assinatura',
    forma: 'Gateway',
    fat: false,
    pag: true,
  },
  {
    code: 'B2B2C_REEMBOLSO',
    desc: 'Aluno paga e a empresa reembolsa (benefício)',
    nivel: 'B2B2C',
    regime: 'Assinatura',
    forma: 'Gateway',
    fat: false,
    pag: true,
    contrato: true,
  },
  {
    code: 'B2B_ABERTO_PER_CAPITA',
    desc: 'Empresa paga por aluno ativo no mês, contra nota fiscal',
    nivel: 'B2B',
    regime: 'Contrato',
    forma: 'Faturado',
    fat: true,
    pag: true,
    contrato: true,
  },
  {
    code: 'B2B_TURMA_DEDICADA',
    desc: 'Empresa contrata turmas fechadas, cobrança por turma',
    nivel: 'B2B',
    regime: 'Contrato',
    forma: 'Faturado',
    fat: true,
    pag: true,
    contrato: true,
  },
  {
    code: 'BOLSA_OPERACIONAL',
    desc: 'Bolsa concedida pela operação (sem cobrança)',
    nivel: 'B2C',
    regime: 'Bolsa',
    forma: 'Sem cobrança',
    fat: false,
    pag: false,
  },
];
export const preset = (c: string) =>
  DEAL_PRESETS.find((p) => p.code === c) ??
  ({ code: c, desc: c, nivel: 'B2C', regime: '—', forma: '—', fat: false, pag: false } as Preset);
export const DEAL_FORMAS = [
  { id: 1, nome: 'Integral · Cartão', modo: 'Cartão', gateway: 'Vindi' },
  { id: 2, nome: 'Recorrência · Cartão', modo: 'Cartão', gateway: 'Vindi' },
  { id: 3, nome: 'Parcelado · Pix/Boleto', modo: 'Pix/Boleto', gateway: 'Vindi' },
  { id: 4, nome: 'Faturado · Boleto contra NF', modo: 'Boleto', gateway: 'Omie' },
];
export const forma = (id: number) => DEAL_FORMAS.find((f) => f.id === id) ?? DEAL_FORMAS[0];
export const MOTIVOS_CANCEL = ['Desistência do aluno', 'Erro de cadastro', 'Troca de oferta', 'Inadimplência'];

/** hash de 32 bits sem sinal (finHash do portal) */
export const dlH = (s: string) => {
  let h = 0;
  for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
};
const addDias = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
const addMes = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
export const mesDe = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export const mesRot = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return `${['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][m - 1]}/${String(y).slice(2)}`;
};
export const N = (x: Prisma.Decimal | number | null | undefined) => Number(x ?? 0);
export const histDeal = (quem: string, acao: string, det = '') => ({
  quando: new Date().toISOString(),
  quem,
  acao,
  det,
});

/** vendedores = a equipe comercial (Usuários › Equipe); os nichos saem da posição na lista */
export async function vendedores() {
  const cs = await prisma.colaborador.findMany({ orderBy: { nome: 'asc' } });
  const ls = cs
    .filter((c) => /comercial/i.test(c.departamento) || /diretor de opera/i.test(c.cargo))
    .map((c, i) => ({
      nome: c.nome,
      email: c.email,
      ativo: c.ativo,
      nichos: /comercial/i.test(c.departamento) ? (i % 2 ? ['B2B', 'B2B2C'] : ['B2C']) : ['B2B'],
    }));
  for (const n of CONSULTORES_BASE)
    if (!ls.some((v) => v.nome === n)) ls.push({ nome: n, email: '', ativo: true, nichos: ['B2C'] });
  return ls;
}

/* ---------------- carga inicial ---------------- */
let cargaFeita = false;
export async function garanteDeal() {
  if (cargaFeita) return;
  if (await prisma.dealCarga.findUnique({ where: { chave: 'inicial' } })) {
    cargaFeita = true;
    return;
  }
  try {
    await prisma.dealCarga.create({ data: { chave: 'inicial' } });
  } catch {
    /* outra instância está carregando */
    cargaFeita = true;
    return;
  }
  try {
    await carga();
  } catch (e) {
    /* carga pela metade não fica: apaga e tenta de novo na próxima leitura */
    await limpaDeal();
    throw e;
  }
  cargaFeita = true;
}

/** apaga tudo do Deal (carga que falhou no meio; os testes usam para recomeçar) */
export async function limpaDeal() {
  await prisma.$transaction([
    prisma.notaFiscal.deleteMany(),
    prisma.parcelaPedido.deleteMany(),
    prisma.pedido.deleteMany(),
    prisma.ordemFaturamento.deleteMany(),
    prisma.contratoEmpresa.deleteMany(),
    prisma.cupom.deleteMany(),
    prisma.bolsa.deleteMany(),
    prisma.importacaoVindi.deleteMany(),
    prisma.ofertaPadrao.deleteMany(),
    prisma.dealCarga.deleteMany(),
  ]);
  cargaFeita = false;
}

async function carga() {
  const b = await base();
  const hoje = new Date();
  /* ofertas padrão: por curso, os pacotes que o comercial vende */
  const ofertas: Prisma.OfertaPadraoCreateManyInput[] = [];
  let oid = 500;
  for (const c of b.cursos) {
    const v = finValorAula(c);
    const turma = c.estrutura === 'turmas';
    const pacotes: [number, number, string][] = turma
      ? [[crsRegras(c).pacote || 40, 12, 'B2B']]
      : c.estrutura === 'nenhuma'
        ? [
            [32, 6, 'B2C'],
            [64, 12, 'B2C'],
          ]
        : [
            [48, 6, 'B2C'],
            [96, 12, 'B2C'],
            [96, 12, 'B2B2C'],
          ];
    pacotes.forEach(([aulas, meses, merc], k) => {
      oid++;
      const rec = !turma && k === 1;
      ofertas.push({
        id: oid,
        codigo:
          `${c.name.replace(/[^A-Za-z]/g, '').slice(0, 4)}-${aulas}H${merc === 'B2B2C' ? '-EMP' : ''}`.toUpperCase(),
        nome: `${turma ? 'Contrato de turma' : 'Pacote de aulas'} ${c.name} · ${aulas} aulas (em até ${meses} meses)`,
        curso: c.name,
        aulas,
        meses,
        preco: aulas * v,
        parcelasMax: turma ? 12 : rec ? 12 : 6,
        recorrente: rec,
        forma: turma ? 4 : rec ? 2 : 1,
        faturamento: turma ? 'Faturado contra NF' : 'Gateway',
        mercado: merc,
        nicho: merc === 'B2C' ? 'Pessoa física' : merc === 'B2B2C' ? 'Benefício corporativo' : 'Empresas',
        planoVindi: turma ? '' : dlH(c.name + aulas) % 5 === 0 ? '' : `plan_${1000 + oid}`,
        criada: addMes(hoje, -(8 + k)),
        itens: [{ tipologia: 'Serviço', produto: 'Aulas ao vivo', curso: c.name }].concat(
          k === 1 && !turma ? [{ tipologia: 'Produto', produto: 'Material digital', curso: c.name }] : [],
        ),
      });
    });
  }
  /* códigos únicos mesmo com cursos de nome parecido */
  const vistos = new Set<string>();
  for (const o of ofertas) {
    let cod = o.codigo;
    for (let i = 2; vistos.has(cod); i++) cod = `${o.codigo}-${i}`;
    o.codigo = cod;
    vistos.add(cod);
  }
  await prisma.ofertaPadrao.createMany({ data: ofertas, skipDuplicates: true });
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"OfertaPadrao"', 'id'), (SELECT MAX(id) FROM "OfertaPadrao"))`,
  );
  if (!(await comExemplos())) return;
  const vend = await vendedores();
  const vendDe = (i: number) => vend[i % vend.length].nome;
  const empresas = await prisma.empresa.findMany({ orderBy: { ordem: 'asc' } });
  const pagas = new Map((await prisma.parcelaPaga.findMany()).map((p) => [p.chave, p.quando]));
  const cobs = finCobrancas(b, pagas, hoje);
  /* contratos: um por empresa (benefício) e um por curso de turmas dedicadas */
  const contratos: (Prisma.ContratoEmpresaCreateManyInput & { id: number })[] = [];
  let cid = 10700;
  empresas.forEach((e, i) => {
    const benef = b.alunos.filter((a) => a.empresa === e.nome).map((a) => a.id);
    contratos.push({
      id: ++cid,
      nome: `${e.nome} — Benefício de idiomas`,
      empresa: e.nome,
      empresaId: e.id,
      cnpj: e.cnpj,
      preset: 'B2B2C_REEMBOLSO',
      tipoB2B: 'Reembolso ao colaborador',
      inicio: addMes(hoje, -(4 + (dlH(e.nome) % 8))),
      fim: e.fim,
      status: e.ativo ? 'Ativo' : 'Encerrado',
      max: Math.max(benef.length + 2, 5),
      benef,
      kam: vendDe(i + 1),
      retencao: 'Sem retenção',
      ofertas: ofertas.filter((o) => o.mercado === 'B2B2C').map((o) => o.id!),
      turmas: [],
    });
  });
  b.cursos
    .filter((c) => c.estrutura === 'turmas')
    .forEach((c, i) => {
      const ini = addMes(hoje, -(6 + i * 3));
      contratos.push({
        id: ++cid,
        nome: `${c.name} — Turmas dedicadas`,
        empresa: c.name,
        empresaId: empresas.find((e) => e.turmaCurso === c.name)?.id ?? null,
        cnpj: String(30000000000100 + i * 1111),
        preset: 'B2B_TURMA_DEDICADA',
        tipoB2B: 'Turma fechada',
        inicio: ini,
        fim: addMes(ini, 12),
        status: 'Ativo',
        max: c.turmas.length,
        benef: [],
        kam: vendDe(i),
        retencao: i ? 'ISS retido na fonte' : 'Sem retenção',
        ofertas: ofertas.filter((o) => o.curso === c.name).map((o) => o.id!),
        turmas: c.turmas.map((t) => t.name),
      });
    });
  await prisma.contratoEmpresa.createMany({ data: contratos });
  /* pedidos: um por matrícula fora das turmas dedicadas; parcelas = as do aluno no Portal */
  const pedidos: (Prisma.PedidoCreateManyInput & { id: number })[] = [];
  let pid = 10800;
  const porTurma = (nome: string) => b.cursos.find((c) => c.name === nome)?.estrutura === 'turmas';
  b.alunos.forEach((a, ai) => {
    alMat(a).forEach((e, ei) => {
      /* duas matrículas no mesmo curso dividem as parcelas do Portal (mesma chave): um pedido só */
      if (porTurma(e.curso) || !e.total || pedidos.some((p) => p.chave === `${a.id}|${e.curso}`)) return;
      const ct = a.empresa ? contratos.find((c) => c.empresa === a.empresa) : undefined;
      const of =
        ofertas.find((o) => o.curso === e.curso && o.mercado === (ct ? 'B2B2C' : 'B2C') && o.aulas >= e.total) ??
        ofertas.find((o) => o.curso === e.curso);
      const h = dlH(a.id + e.curso);
      const cur = b.cursos.find((c) => c.name === e.curso);
      const total = e.total * (cur ? finValorAula(cur) : 0);
      const renov = h % 6 === 0;
      const pr = ct
        ? 'B2B2C_REEMBOLSO'
        : renov
          ? 'B2C_RENOVACAO'
          : h % 9 === 0
            ? 'B2C_PAGADOR_TERCEIRO'
            : h % 7 === 0
              ? 'B2C_UPSELL'
              : 'B2C_DIRETO';
      const andamento = (e.usadas || 0) / (e.total || 1);
      pedidos.push({
        id: ++pid,
        data: addDias(addMes(hoje, -Math.round(andamento * 6)), -(h % 20)),
        alunoId: a.id,
        cliente: a.name,
        curso: e.curso,
        ofertaId: of?.id ?? null,
        ofertaNome: of?.nome ?? e.curso,
        total,
        forma: of?.recorrente ? 2 : h % 3 === 0 ? 3 : 1,
        parcelas: FIN_PARCELAS,
        preset: pr,
        tipo: ct ? 'B2B2C' : 'B2C',
        contratoId: ct?.id ?? null,
        vendedor: vendDe(ai + ei),
        renovacao: renov,
        cupom: h % 11 === 0 ? 'VOLTA10' : '',
        desconto: h % 11 === 0 ? Math.round(total * 0.1) : 0,
        chave: `${a.id}|${e.curso}`,
        hist: [histDeal('Sistema', 'Venda criada', `para ${a.name} por ${vendDe(ai + ei)}`)],
      });
    });
  });
  /* contrato de turma: um pedido por contrato, parcelas = as das turmas */
  for (const ct of contratos.filter((c) => c.preset === 'B2B_TURMA_DEDICADA')) {
    const lin = cobs.filter((x) => x.tipo === 'turma' && x.curso === ct.empresa);
    pedidos.push({
      id: ++pid,
      data: ct.inicio,
      alunoId: null,
      cliente: ct.empresa,
      curso: ct.empresa,
      ofertaId: (ct.ofertas as number[])[0] ?? null,
      ofertaNome: ofertas.find((o) => o.id === (ct.ofertas as number[])[0])?.nome ?? ct.nome,
      total: lin.reduce((s, x) => s + x.valor, 0),
      forma: 4,
      parcelas: FIN_PARCELAS,
      preset: ct.preset,
      tipo: 'B2B',
      contratoId: ct.id,
      vendedor: ct.kam,
      chave: `turma|${ct.empresa}`,
      hist: [histDeal('Sistema', 'Venda criada', `contrato ${ct.nome}`)],
    });
  }
  await prisma.pedido.createMany({ data: pedidos });
  /* ordens de faturamento: turmas dedicadas por competência (o mês corrente a confirmar ou proposta; os anteriores liberados) */
  const ordens: (Prisma.OrdemFaturamentoCreateManyInput & { id: number })[] = [];
  let onum = 1;
  for (const ct of contratos.filter((c) => c.preset === 'B2B_TURMA_DEDICADA')) {
    const porMes: Record<string, Cobranca[]> = {};
    for (const x of cobs.filter((y) => y.tipo === 'turma' && y.curso === ct.empresa))
      porMes[mesDe(x.venc)] = [...(porMes[mesDe(x.venc)] ?? []), x];
    for (const m of Object.keys(porMes).sort()) {
      if (m > mesDe(hoje)) continue;
      const ls = porMes[m];
      const atual = m === mesDe(hoje);
      const st = atual ? (dlH(ct.empresa) % 2 ? 'a confirmar' : 'proposta') : 'liberada';
      ordens.push({
        id: onum,
        numero: st === 'a confirmar' ? '' : `OF-${m.replace('-', '')}-${String(onum).padStart(4, '0')}`,
        competencia: m,
        status: st,
        contratoId: ct.id,
        pagador: ct.empresa,
        linhas: ls.length,
        total: ls.reduce((s, x) => s + x.valor, 0),
        venc: addDias(ls[0].venc, 5),
        turmas: ls.map((x) => x.item),
        liberadaEm: st === 'liberada' ? addDias(ls[0].venc, -8) : null,
      });
      onum++;
    }
  }
  await prisma.ordemFaturamento.createMany({ data: ordens });
  /* notas: parcelas pagas há mais de 3 dias e ordens liberadas (as pagas mais recentes ficam na fila) */
  const nfs: Prisma.NotaFiscalCreateManyInput[] = [];
  let nfn = 4200;
  for (const p of pedidos.filter((x) => x.alunoId))
    for (const x of cobs.filter((c) => c.key.startsWith(`${p.chave}|`) && c.pago && (+hoje - +c.pago!) / 864e5 >= 3)) {
      if (nfs.some((n) => n.chave === x.key)) continue;
      nfs.push({
        numero: String(++nfn),
        total: x.valor,
        competencia: mesDe(x.venc),
        emitida: x.pago!,
        pagador: p.cliente,
        alunoId: p.alunoId,
        pedidoId: p.id,
        parcela: x.parcela,
        chave: x.key,
        escopo: 'Aluno',
      });
    }
  for (const o of ordens.filter((x) => x.status === 'liberada'))
    nfs.push({
      numero: String(++nfn),
      total: o.total,
      competencia: o.competencia,
      emitida: o.liberadaEm as Date,
      pagador: o.pagador,
      pedidoId: pedidos.find((p) => p.contratoId === o.contratoId)?.id ?? null,
      ordemId: o.id,
      escopo: 'Empresa',
    });
  await prisma.notaFiscal.createMany({ data: nfs });
  /* cupons, bolsas e a fila da Vindi */
  const b2c = ofertas.filter((o) => o.mercado === 'B2C').map((o) => o.id!);
  await prisma.cupom.createMany({
    data: [
      {
        codigo: 'VOLTA10',
        descricao: '10% para quem volta a estudar',
        tipo: '%',
        valor: 10,
        validade: addDias(hoje, 40),
        limite: 50,
        ofertas: b2c,
      },
      {
        codigo: 'AMIGO150',
        descricao: 'R$ 150 de desconto na indicação',
        tipo: 'R$',
        valor: 150,
        validade: addDias(hoje, 90),
        limite: 100,
        ofertas: b2c,
      },
      {
        codigo: 'BLACK2025',
        descricao: 'Black Friday 2025',
        tipo: '%',
        valor: 25,
        validade: addDias(hoje, -280),
        limite: 200,
        ofertas: [],
      },
    ],
  });
  const bolsistas = b.alunos.filter((a) => dlH(`bolsa${a.id}`) % 13 === 0).slice(0, 4);
  await prisma.bolsa.createMany({
    data: bolsistas.map((a, i) => {
      const e = alMat(a)[0];
      const curso = e?.curso ?? b.cursos[0]?.name ?? '—';
      const cur = b.cursos.find((c) => c.name === curso);
      const aulas = e?.total ?? 32;
      return {
        alunoId: a.id,
        nome: a.name,
        caso: i % 2 ? 'Social' : 'Operacional',
        curso,
        inicio: addMes(hoje, -3 - i),
        fim: addMes(hoje, 9 - i),
        aulas,
        usadas: e?.usadas ?? 0,
        custo: aulas * (cur ? finValorAula(cur) : 0),
        motivo: i % 2 ? 'Programa social da escola' : 'Compensação de aulas não dadas',
        concedida: addMes(hoje, -3 - i),
      };
    }),
  });
  const nomes = ['Helena Costa', 'Rafael Monteiro', 'Beatriz Aquino', 'Otávio Brandão', 'Luíza Farias'];
  const ofB2c = ofertas.filter((o) => o.mercado === 'B2C');
  if (ofB2c.length)
    await prisma.importacaoVindi.createMany({
      data: nomes.map((n, i) => {
        const of = ofB2c[i % 3] ?? ofB2c[0];
        const estorno = i === 4;
        const preco = Number(of.preco);
        return {
          id: `B${88100 + i}`,
          aba: estorno ? 'estornos' : i < 3 ? 'vendas' : 'cobrancas',
          nome: n,
          valor: estorno ? -preco / 6 : preco / (i < 3 ? 1 : 6),
          quando: addDias(hoje, -(i + 1)),
          oferta: of.nome,
          critica: i === 1 ? 'cliente sem CPF no cadastro' : i === 3 ? 'parcela já baixada à mão' : '',
          pronta: i !== 1 && i !== 3,
          acao: estorno ? 'estornar a parcela' : i < 3 ? 'criar a venda' : 'dar baixa na parcela',
        };
      }),
    });
  for (const t of ['ContratoEmpresa', 'Pedido', 'OrdemFaturamento', 'NotaFiscal'])
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${t}"', 'id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM "${t}"), 1))`,
    );
}

/**
 * Cria o pedido com o cronograma próprio (vence dia 10; a 1ª parcela no cartão já entra paga) e põe o aluno
 * como beneficiário do contrato empresarial, se houver. Usado pelo Novo pedido e pela Matrícula do Novo aluno.
 */
export async function criaPedido(o: {
  alunoId: number;
  cliente: string;
  oferta: { id: number; nome: string; curso: string };
  total: number;
  forma: number;
  parcelas: number;
  preset: string;
  tipo: string;
  contrato: { id: number; benef: number[] } | null;
  vendedor: string;
  cupom?: string;
  desconto?: number;
  obs?: string;
  autor: string;
  origem: string;
}) {
  const hoje = new Date();
  const p = await prisma.pedido.create({
    data: {
      data: hoje,
      alunoId: o.alunoId,
      cliente: o.cliente,
      curso: o.oferta.curso,
      ofertaId: o.oferta.id,
      ofertaNome: o.oferta.nome,
      total: o.total,
      forma: o.forma,
      parcelas: o.parcelas,
      preset: o.preset,
      tipo: o.tipo,
      contratoId: o.contrato?.id ?? null,
      vendedor: o.vendedor,
      renovacao: o.preset === 'B2C_RENOVACAO',
      cupom: o.cupom ?? '',
      desconto: o.desconto ?? 0,
      chave: 'novo|',
      obs: o.obs ?? '',
      hist: [histDeal(o.autor, 'Venda criada', `para ${o.cliente} por ${o.vendedor}, ${o.origem}`)],
    },
  });
  const chave = `novo|${p.id}`;
  await prisma.pedido.update({ where: { id: p.id }, data: { chave } });
  await prisma.parcelaPedido.createMany({
    data: Array.from({ length: o.parcelas }, (_, k) => ({
      chave: `${chave}|${k}`,
      pedidoId: p.id,
      n: k + 1,
      de: o.parcelas,
      venc: new Date(hoje.getFullYear(), hoje.getMonth() + k + (hoje.getDate() > 10 ? 1 : 0), 10),
      valor: Math.round((o.total / o.parcelas) * 100) / 100,
      pago: k === 0 && o.forma !== 3 ? hoje : null,
    })),
  });
  if (o.contrato && !o.contrato.benef.includes(o.alunoId))
    await prisma.contratoEmpresa.update({
      where: { id: o.contrato.id },
      data: { benef: [...o.contrato.benef, o.alunoId] },
    });
  return p;
}

/* ---------------- leitura: tudo que as telas usam, calculado uma vez por pedido HTTP ---------------- */
export type Linha = Cobranca;
export type PedidoDb = Prisma.PedidoGetPayload<object>;

export async function dealCtx(agora = new Date()) {
  await garanteDeal();
  const b = await base();
  const [pagasDb, pedidos, parcNovas, contratos, ordens, nfs, ofertas, cupons] = await Promise.all([
    prisma.parcelaPaga.findMany(),
    prisma.pedido.findMany({ orderBy: { data: 'desc' } }),
    prisma.parcelaPedido.findMany({ orderBy: { n: 'asc' } }),
    prisma.contratoEmpresa.findMany({ orderBy: { id: 'asc' } }),
    prisma.ordemFaturamento.findMany({ orderBy: { id: 'asc' } }),
    prisma.notaFiscal.findMany({ orderBy: { id: 'asc' } }),
    prisma.ofertaPadrao.findMany({ orderBy: { id: 'asc' } }),
    prisma.cupom.findMany({ orderBy: { criado: 'asc' } }),
  ]);
  const cobs = finCobrancas(b, new Map(pagasDb.map((p) => [p.chave, p.quando])), agora);
  const porPed = new Map<number, typeof parcNovas>();
  for (const x of parcNovas) porPed.set(x.pedidoId, [...(porPed.get(x.pedidoId) ?? []), x]);
  const cacheLinhas = new Map<number, Linha[]>();
  const linhas = (p: PedidoDb): Linha[] => {
    const c = cacheLinhas.get(p.id);
    if (c) return c;
    const ls: Linha[] = p.chave.startsWith('novo|')
      ? (porPed.get(p.id) ?? []).map((x) => {
          const vencida = !x.pago && x.venc < agora;
          return {
            key: x.chave,
            parcela: `${x.n}/${x.de}`,
            venc: x.venc,
            valor: N(x.valor),
            pago: x.pago,
            sit: x.pago ? 'paga' : vencida ? 'vencida' : 'aVencer',
            atraso: vencida ? Math.floor((+agora - +x.venc) / 864e5) : 0,
            pagador: p.cliente,
            tipo: 'aluno',
            logId: p.alunoId ?? 0,
            curso: p.curso,
            item: '—',
            alunoId: p.alunoId,
            cursoId: null,
          } satisfies Linha;
        })
      : cobs.filter((x) => x.key.startsWith(`${p.chave}|`));
    cacheLinhas.set(p.id, ls);
    return ls;
  };
  /* notas por chave de parcela e por ordem; a fila é o que foi pago e ainda não tem nota */
  const nfPorChave = new Map(nfs.filter((n) => n.chave).map((n) => [n.chave!, n]));
  const fila = [
    ...pedidos
      .filter((p) => p.alunoId && !p.cancelado)
      .flatMap((p) =>
        linhas(p)
          .filter((x) => x.pago && !nfPorChave.has(x.key))
          .map((x) => ({
            tipo: 'parcela' as const,
            chave: x.key,
            total: x.valor,
            competencia: mesDe(x.venc),
            pagador: p.cliente,
            alunoId: p.alunoId,
            pedidoId: p.id,
            ordemId: null as number | null,
            parcela: x.parcela,
            pago: x.pago!,
          })),
      ),
    ...ordens
      .filter((o) => o.status === 'liberada' && !nfs.some((n) => n.ordemId === o.id))
      .map((o) => ({
        tipo: 'ordem' as const,
        chave: null as string | null,
        total: N(o.total),
        competencia: o.competencia,
        pagador: o.pagador,
        alunoId: null as number | null,
        pedidoId: pedidos.find((p) => p.contratoId === o.contratoId)?.id ?? null,
        ordemId: o.id,
        parcela: '—',
        pago: o.liberadaEm ?? agora,
      })),
  ];
  const sitPedido = (p: PedidoDb): [string, string] => {
    if (p.cancelado) return ['Cancelado', 'gray'];
    const ls = linhas(p);
    if (!ls.length) return ['Sem cronograma', 'amber'];
    if (ls.some((x) => x.sit === 'vencida')) return ['Vencida', 'red'];
    if (ls.every((x) => x.sit === 'paga')) return ['Quitado', 'green'];
    return ['Em dia', 'blue'];
  };
  const posicao = (p: PedidoDb) => {
    const ls = linhas(p);
    const notas = nfs.filter((n) => n.pedidoId === p.id);
    const soma = (f: (x: Linha) => boolean) => ls.filter(f).reduce((s, x) => s + x.valor, 0);
    const venc = ls.filter((x) => x.sit === 'vencida');
    const prox = ls.filter((x) => x.sit === 'aVencer').sort((a, c) => +a.venc - +c.venc)[0];
    const naFila = fila.some((f) => f.pedidoId === p.id);
    return {
      emitido: notas.reduce((s, n) => s + N(n.total), 0),
      pago: soma((x) => x.sit === 'paga'),
      aReceber: soma((x) => x.sit !== 'paga'),
      vencido: soma((x) => x.sit === 'vencida'),
      passo: p.cancelado
        ? 'Pedido cancelado'
        : venc.length
          ? `Cobrar a parcela ${venc[0].parcela}`
          : naFila
            ? 'Emitir a nota da última parcela paga'
            : prox
              ? `Aguardar a parcela ${prox.parcela}, vence ${fmt.data(prox.venc)}`
              : 'Tudo quitado · avaliar renovação',
      ls,
      notas,
    };
  };
  const ctPos = (ctId: number) => {
    const ps = pedidos.filter((p) => p.contratoId === ctId);
    const ls = ps.flatMap(linhas);
    const soma = (f: (x: Linha) => boolean) => ls.filter(f).reduce((s, x) => s + x.valor, 0);
    const ords = ordens.filter((o) => o.contratoId === ctId);
    return {
      ps,
      ls,
      ords,
      vendido: ps.reduce((s, p) => s + N(p.total), 0),
      pago: soma((x) => x.sit === 'paga'),
      vencido: soma((x) => x.sit === 'vencida'),
      emitido: nfs.filter((n) => ps.some((p) => p.id === n.pedidoId)).reduce((s, n) => s + N(n.total), 0),
      aConfirmar: ords.filter((o) => o.status !== 'liberada'),
    };
  };
  return { b, agora, cobs, pedidos, contratos, ordens, nfs, ofertas, cupons, fila, linhas, sitPedido, posicao, ctPos };
}
export type DealCtx = Awaited<ReturnType<typeof dealCtx>>;

/** vigência do contrato: vencido, vence em N dias (menos de 60) ou vigente */
export const ctVig = (fim: Date, agora = new Date()): [string, string] => {
  const d = Math.round((+fim - +agora) / 864e5);
  return d < 0 ? ['Vencido', 'gray'] : d < 60 ? [`vence em ${d} dias`, 'amber'] : ['Vigente', 'green'];
};
export const cnpjFmt = (s: string) => {
  const d = String(s || '').replace(/\D/g, '');
  return d.length === 14 ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : s || '—';
};
export type { Base };
