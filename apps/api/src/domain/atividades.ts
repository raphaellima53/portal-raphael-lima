/**
 * Atividades em cartões (23/09/2026, rascunho "D - Atividades (Cartões)" e protótipo 23, atividades.src.js).
 * - Catálogo: a lista do usuário (atividade · descrição · cadência), com setor e tipo inferidos (scripts/classifica-atividades.mjs).
 * - Recorrência: modelos com cadência diária…trimestral ganham um cartão por período, sozinhos. Quando o período vira,
 *   o cartão anterior que nem foi iniciado sai do quadro como "não realizado" (expirada); o que está em andamento continua.
 * - Eventual: entra quando alguém cria a partir do catálogo. Projeto (sem cadência): tarefa única, criada pelo catálogo.
 */
import { prisma } from '../db.ts';
import type { Prisma } from '../generated/prisma/client.ts';
import { fmt } from '../lib/fmt.ts';
import { base } from './base.ts';
import catalogo from './dados/atividades-catalogo.json' with { type: 'json' };
import { ATV_FRENTES, ATV_SETOR_TELAS, atvFrenteDe } from './mapa.ts';

export { ATV_FRENTES, atvFrenteDe };
export const ATV_SETORES = Object.keys(ATV_SETOR_TELAS);
export const ATV_TIPOS = [
  'Ligação',
  'WhatsApp',
  'E-mail',
  'Reunião',
  'Atendimento',
  'Follow-up',
  'Relatório',
  'Tarefa',
  'Projeto',
];
export const ATV_PRIORIDADES = ['Alta', 'Média', 'Baixa'];
export const ATV_SITUACOES: [string, string, string][] = [
  ['afazer', 'A fazer', '#64748b'],
  ['andamento', 'Em andamento', '#003fb0'],
  ['concluida', 'Concluída', '#0a7a55'],
];
export const ATV_CADENCIAS: [string, string][] = [
  ['diaria', 'Diária'],
  ['semanal', 'Semanal'],
  ['quinzenal', 'Quinzenal'],
  ['mensal', 'Mensal'],
  ['bimestral', 'Bimestral'],
  ['trimestral', 'Trimestral'],
  ['eventual', 'Eventual'],
  ['projeto', 'Projeto'],
];
export const RECORRENTES = ['diaria', 'semanal', 'quinzenal', 'mensal', 'bimestral', 'trimestral'];
export const ATV_REL = [
  ['aluno', 'Aluno'],
  ['empresa', 'Empresa'],
  ['prof', 'Professor'],
  ['lead', 'Lead'],
] as const;

export type Hist = { quando: string; quem: string; acao: string; det: string };

/* ---------------- períodos ---------------- */
const p2 = (n: number) => String(n).padStart(2, '0');
const fimDoDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 18, 0, 0, 0);
const ultimoDia = (y: number, m: number) => new Date(y, m + 1, 0);
/** semana ISO (segunda a domingo) */
function semanaIso(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dia = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dia);
  const ini = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return { ano: t.getUTCFullYear(), n: Math.ceil(((+t - +ini) / 864e5 + 1) / 7) };
}
/** chave, rótulo e prazo do período de uma cadência na data (null: não gera hoje — fim de semana ou feriado na diária) */
export function periodoDe(cad: string, d: Date, feriados: Set<string>) {
  const y = d.getFullYear();
  const m = d.getMonth();
  if (cad === 'diaria') {
    if (d.getDay() === 0 || d.getDay() === 6 || feriados.has(fmt.iso(d))) return null;
    return { chave: fmt.iso(d), rot: fmt.data(d), prazo: fimDoDia(d) };
  }
  if (cad === 'semanal') {
    const s = semanaIso(d);
    const sexta = new Date(d);
    sexta.setDate(d.getDate() + (5 - (d.getDay() || 7)));
    return { chave: `${s.ano}-S${p2(s.n)}`, rot: `semana ${s.n}`, prazo: fimDoDia(sexta) };
  }
  if (cad === 'quinzenal') {
    const q = d.getDate() <= 15 ? 1 : 2;
    return {
      chave: `${y}-${p2(m + 1)}-Q${q}`,
      rot: `${q}ª quinzena de ${fmt.mes(d)}`,
      prazo: fimDoDia(q === 1 ? new Date(y, m, 15) : ultimoDia(y, m)),
    };
  }
  if (cad === 'mensal') return { chave: `${y}-${p2(m + 1)}`, rot: fmt.mes(d), prazo: fimDoDia(ultimoDia(y, m)) };
  if (cad === 'bimestral') {
    const b = Math.floor(m / 2);
    return { chave: `${y}-B${b + 1}`, rot: `${b + 1}º bimestre de ${y}`, prazo: fimDoDia(ultimoDia(y, b * 2 + 1)) };
  }
  if (cad === 'trimestral') {
    const t = Math.floor(m / 3);
    return { chave: `${y}-T${t + 1}`, rot: `${t + 1}º trimestre de ${y}`, prazo: fimDoDia(ultimoDia(y, t * 3 + 2)) };
  }
  return null;
}

/* ---------------- catálogo e geração ---------------- */
type ItemCatalogo = { nome: string; descricao: string; cadencia: string; setor: string; tipo: string };
let catalogoPronto = false;
/** a primeira leitura carrega o catálogo colado pelo usuário (o seed não apaga: vale para o banco publicado) */
export async function garanteCatalogo() {
  if (catalogoPronto) return;
  if ((await prisma.atividadeModelo.count()) === 0)
    await prisma.atividadeModelo.createMany({
      data: (catalogo as ItemCatalogo[]).map((c) => ({
        nome: c.nome,
        descricao: c.descricao,
        cadencia: c.cadencia,
        setor: c.setor,
        tipo: c.tipo,
      })),
    });
  catalogoPronto = true;
}

let geradoEm = 0;
/** cria o cartão do período de cada modelo recorrente e tira do quadro o do período passado que nem começou */
export async function garanteRecorrentes(agora = new Date(), forcar = false) {
  await garanteCatalogo();
  if (!forcar && Date.now() - geradoEm < 60_000) return;
  geradoEm = Date.now();
  const b = await base();
  const modelos = await prisma.atividadeModelo.findMany({ where: { ativo: true, cadencia: { in: RECORRENTES } } });
  const novos: Prisma.AtividadeCreateManyInput[] = [];
  const atuais: Record<string, string> = {};
  for (const m of modelos) {
    const p = periodoDe(m.cadencia, agora, b.feriados);
    if (!p) continue;
    atuais[m.cadencia] = p.chave;
    novos.push({
      titulo: m.nome,
      descricao: m.descricao,
      setor: m.setor,
      tipo: m.tipo,
      responsavel: m.responsavel,
      prioridade: m.prioridade,
      prazo: p.prazo,
      modeloId: m.id,
      periodo: p.chave,
      criado: agora,
      criadoPor: 'Sistema',
      hist: [{ quando: agora.toISOString(), quem: 'Sistema', acao: 'Cartão do período', det: p.rot }],
    });
  }
  if (novos.length) await prisma.atividade.createMany({ data: novos, skipDuplicates: true });
  for (const [cad, chave] of Object.entries(atuais))
    await prisma.atividade.updateMany({
      where: { situacao: 'afazer', periodo: { not: chave }, modelo: { cadencia: cad } },
      data: { situacao: 'expirada' },
    });
}

/* ---------------- leitura para as telas ---------------- */
const rotRel: Record<string, string> = Object.fromEntries(ATV_REL);
export const hrefRel = (tipo: string | null, id: string | null) =>
  !tipo
    ? null
    : tipo === 'aluno' && id
      ? `/alunos/${id}/perfil`
      : tipo === 'empresa' && id
        ? `/empresas/${id}/geral`
        : tipo === 'prof' && id
          ? `/professores/${id}/perfil`
          : tipo === 'lead'
            ? '/acoes/acFunil'
            : null;

export const atvAberta = (s: string) => s === 'afazer' || s === 'andamento';
export function prazoTxt(prazo: Date | null, situacao: string, agora = new Date()) {
  if (!prazo) return 'sem prazo';
  const d0 = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const dd = new Date(prazo.getFullYear(), prazo.getMonth(), prazo.getDate());
  const n = Math.round((+dd - +d0) / 864e5);
  const atrasada = atvAberta(situacao) && prazo < agora;
  if (atrasada && n < 0) return `atrasada há ${-n} ${n === -1 ? 'dia' : 'dias'} · ${fmt.data(prazo)}`;
  if (n === 0) return `${atrasada ? 'atrasada · ' : ''}hoje às ${fmt.hora(prazo)}`;
  if (n === 1) return `amanhã às ${fmt.hora(prazo)}`;
  return fmt.dataHora(prazo);
}

type AtvDb = Prisma.AtividadeGetPayload<{ include: { modelo: true } }>;
export function atvCartao(a: AtvDb, agora = new Date()) {
  return {
    id: a.id,
    titulo: a.titulo,
    descricao: a.descricao,
    setor: a.setor,
    frente: atvFrenteDe(a.setor),
    tipo: a.tipo,
    responsavel: a.responsavel,
    prioridade: a.prioridade,
    prazo: a.prazo ? a.prazo.toISOString() : null,
    prazoIso: a.prazo ? fmt.iso(a.prazo) : '',
    prazoHora: a.prazo ? fmt.hora(a.prazo) : '',
    prazoTxt: prazoTxt(a.prazo, a.situacao, agora),
    atrasada: atvAberta(a.situacao) && !!a.prazo && a.prazo < agora,
    situacao: a.situacao,
    rel: a.relTipo
      ? {
          tipo: a.relTipo,
          rot: rotRel[a.relTipo] ?? a.relTipo,
          id: a.relId,
          nome: a.relNome ?? '',
          href: hrefRel(a.relTipo, a.relId),
        }
      : null,
    modelo: a.modelo ? { id: a.modelo.id, cadencia: a.modelo.cadencia } : null,
    periodo: a.periodo,
    concluida: a.concluida ? fmt.data(a.concluida) : null,
    criado: fmt.dataHora(a.criado),
    criadoPor: a.criadoPor,
    hist: (a.hist as Hist[]).map((h) => ({ ...h, quando: fmt.dataHora(new Date(h.quando)) })),
  };
}
export type AtvCartao = ReturnType<typeof atvCartao>;
