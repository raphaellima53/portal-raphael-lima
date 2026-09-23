/**
 * Carrega a base do banco no formato que as regras portadas do artefato leem
 * (DB.alunos, CAD.courses, CAD.teachers, CUR, AG_OV…). A base é pequena: fica em memória
 * e é recarregada depois de cada escrita (invalidaBase).
 */
import { prisma } from '../db.ts';
import { PERFIS, perfilNome } from './acesso.ts';

export type Regras = {
  vagas: number;
  duracao: number;
  modalidades: string[];
  pacote: number;
  cancelamento: number;
  /** horas de antecedência para marcar a aula (adequação ao Portal Alumni) */
  antecedencia?: number;
  exigeDisp: boolean;
  valorAula?: number;
};
export type TurmaB = {
  id: number;
  name: string;
  grupo: string;
  professor: string | null;
  grade: string;
  vagas: number;
  ocupadas: number;
  sala: string;
  modalidade: string;
  periodo: string;
  curriculo: string;
  /** turma inativa sai da grade e da agenda */
  ativa: boolean;
  cor: string;
  cefr: string;
  descricao: string;
};
export type CursoB = {
  id: number;
  name: string;
  color: string;
  estrutura: 'modulos' | 'turmas' | 'nenhuma';
  formato: string;
  tipo: string;
  idioma: string;
  active: boolean;
  autoAgenda: boolean;
  descricao: string;
  regras: Regras;
  modulos: string[];
  cores: Record<string, string>;
  turmas: TurmaB[];
  allowsModules: boolean;
  /* adequação ao Portal Alumni */
  sigla: string;
  natureza: string;
  visibilidadeOferta: string;
  tipoSala: string;
  configAgenda: Record<string, string | boolean> | null;
  /** sigla, descrição e vagas de cada módulo, pelo nome */
  modInfo: Record<
    string,
    {
      sigla: string;
      descricao: string;
      vagas: number | null;
      /* 24/09/2026: CEFR, regras de agenda do módulo (minutos) e a grade (dia, hora, professor) */
      cefr: string;
      agendamentoMin: number | null;
      cancelamentoMin: number | null;
      horarios: { dia: number; hora: string; professorId: string | null; prof: string | null }[];
    }
  >;
  /** curso Particular: as alocações (responsável e vagas) */
  alocacoes: { responsavel: string; vagas: number }[];
};
export type ProfessorB = {
  id: string;
  name: string;
  email: string;
  cursos: string[];
  habil: Record<string, string[]> | null;
  carga: number;
  teto: number;
  active: boolean;
  valorHora: number | null;
  disp: string[] | null;
};
export type MatriculaB = {
  id: number;
  curso: string;
  modulo: string | null;
  usadas: number;
  total: number;
  modalidade: string;
  desativadoEm: Date | null;
  aloc: { prof?: string; dias?: number[]; hora?: number; valor?: number } | null;
};
/** cores dos níveis na paleta da marca (Figma, Page 3) */
export const COR_NIVEL: Record<string, string> = {
  Confidence: '#2377FF',
  'Essential 1': '#0E56D5',
  'Essential 2': '#003FB0',
  'Essential 3': '#083688',
  'Essential 4': '#062967',
  'Rise 1': '#A14F9C',
  'Rise 2': '#83367E',
  'Rise 3': '#6E0C6F',
  'Apex 1': '#D13543',
  'Apex 2': '#B41624',
  'Apex 3': '#8E0F1A',
};

export type AlunoB = {
  id: number;
  name: string;
  email: string;
  cpf: string;
  status: string;
  desativadoEm: Date | null;
  empresa: string | null;
  contratoFim: Date | null;
  disp: string[] | null;
  matriculas: MatriculaB[];
};
export type ConteudoCur = {
  titulo: string;
  formato: string;
  gram: string;
  voc: [string, string][];
  links: { pre: string; in: string; post: string };
};
export type CurriculoB = {
  id: string;
  nome: string;
  grupo: string;
  tipo: string;
  idioma: string;
  aplicado: string[];
  conteudos: ConteudoCur[];
};
export type SalaB = { name: string; atende: string; tipo: string; zoom: boolean; active: boolean };
export type UsuarioLinha = { nome: string; email: string; status: string; mfa: boolean; perfil: string };
export type Suporte = { motivo: string; detalhe: string; quem: string; quando: string };
export type ZoomAula = {
  aberta?: boolean;
  desde?: string;
  gravando?: boolean;
  gravou?: boolean;
  enviado?: string;
  durou?: number;
};
export type AjusteAula = {
  prof?: string;
  cancelada?: boolean;
  fora?: Record<string, boolean>;
  iniciada?: boolean;
  inicioEm?: string;
  concluida?: boolean;
  pres?: Record<string, 'presente' | 'falta'>;
  valor?: number;
  valorMotivo?: string;
  /** false = pedido retirado (vale sobre a base) */
  suporte?: Suporte | false;
  conteudo?: { cur: string; i: number };
  zoom?: ZoomAula;
  zoomGerado?: string;
  notas?: string;
};

export type Base = {
  cursos: CursoB[];
  professores: ProfessorB[];
  alunos: AlunoB[];
  curriculos: CurriculoB[];
  feriados: Set<string>;
  usuarios: UsuarioLinha[];
  ajustes: Record<string, AjusteAula>;
  salas: SalaB[];
  colaboradores: { nome: string; ativo: boolean }[];
  /** competências fechadas (AAAA-MM) */
  fechadas: Set<string>;
  corModulo: Record<string, string>;
  corCurso: Record<string, string>;
};

let cache: Promise<Base> | null = null;
let carregadaEm = 0;
/** outra instância ou um seed podem mudar o banco: a base em memória vale por pouco tempo */
const VALIDADE_MS = 15_000;

export function invalidaBase() {
  cache = null;
}

export function base(): Promise<Base> {
  if (!cache || Date.now() - carregadaEm > VALIDADE_MS) {
    carregadaEm = Date.now();
    cache = carrega().catch((e) => {
      cache = null;
      throw e;
    });
  }
  return cache;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
/** coluna @db.Date chega como meia-noite UTC: ancora na meia-noite local para não voltar um dia */
const diaLocal = (d: Date | null) => (d ? new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) : null);

async function carrega(): Promise<Base> {
  const [cursos, tipos, professores, alunos, curriculos, feriados, usuarios, ajustes, salas, colaboradores, fechadas] =
    await Promise.all([
      prisma.curso.findMany({
        orderBy: { ordem: 'asc' },
        include: {
          modulos: { orderBy: { ordem: 'asc' }, include: { horarios: { orderBy: [{ dia: 'asc' }, { hora: 'asc' }] } } },
          alocacoes: { orderBy: { ordem: 'asc' } },
          turmas: { orderBy: { ordem: 'asc' }, include: { professor: { select: { nome: true } } } },
        },
      }),
      prisma.catalogo.findMany({ where: { tipo: 'courseTypes' } }),
      prisma.professor.findMany({ orderBy: { ordem: 'asc' } }),
      prisma.aluno.findMany({
        orderBy: { id: 'asc' },
        include: {
          empresa: { select: { nome: true } },
          matriculas: { orderBy: { ordem: 'asc' }, include: { curso: { select: { nome: true } } } },
        },
      }),
      prisma.curriculo.findMany({ orderBy: { ordem: 'asc' } }),
      prisma.feriado.findMany(),
      prisma.usuario.findMany({
        orderBy: { ordem: 'asc' },
        select: { nome: true, email: true, status: true, mfa: true, perfilId: true, perfilLegado: true },
      }),
      prisma.aulaAjuste.findMany(),
      prisma.sala.findMany({ orderBy: { ordem: 'asc' } }),
      prisma.colaborador.findMany({ orderBy: { ordem: 'asc' }, select: { nome: true, ativo: true } }),
      prisma.fechamentoCompetencia.findMany({ select: { ym: true } }),
    ]);
  const permiteModulos = new Map(
    tipos.map((t) => [t.nome, !!(t.dados as { allowsModules?: boolean } | null)?.allowsModules]),
  );

  const corModulo: Record<string, string> = {};
  const corCurso: Record<string, string> = {};
  /* níveis da paleta do Figma (Page 3, 21/09/2026): Confidence, Essential 1–4, Rise 1–3 e Apex 1–3 */
  const corNivel = (nome: string, cor: string) => {
    const m = /^(Confidence|Essential [1-4]|Rise [1-3]|Apex [1-3])\b/.exec(nome);
    return m ? COR_NIVEL[m[1]] : cor;
  };
  const cs: CursoB[] = cursos.map((c) => {
    corCurso[c.nome] = c.cor;
    const cores: Record<string, string> = {};
    for (const m of c.modulos) {
      cores[m.nome] = corNivel(m.nome, m.cor);
      corModulo[m.nome] ??= corNivel(m.nome, m.cor);
    }
    return {
      id: c.id,
      name: c.nome,
      color: c.cor,
      estrutura: c.estrutura as CursoB['estrutura'],
      formato: c.formato,
      tipo: c.tipo,
      idioma: c.idioma,
      active: c.ativo,
      autoAgenda: c.autoAgenda,
      descricao: c.descricao,
      regras: c.regras as Regras,
      modulos: c.modulos.map((m) => m.nome),
      cores,
      allowsModules: permiteModulos.get(c.tipo) ?? false,
      sigla: c.sigla,
      natureza: c.natureza,
      visibilidadeOferta: c.visibilidadeOferta,
      tipoSala: c.tipoSala,
      configAgenda: (c.configAgenda as Record<string, string | boolean> | null) ?? null,
      modInfo: Object.fromEntries(
        c.modulos.map((m) => [
          m.nome,
          {
            sigla: m.sigla,
            descricao: m.descricao,
            vagas: m.vagas,
            cefr: m.cefr,
            agendamentoMin: m.agendamentoMin,
            cancelamentoMin: m.cancelamentoMin,
            horarios: m.horarios.map((h) => ({
              dia: h.dia,
              hora: h.hora,
              professorId: h.professorId,
              prof: professores.find((p) => p.id === h.professorId)?.nome ?? null,
            })),
          },
        ]),
      ),
      alocacoes: c.alocacoes.map((x) => ({ responsavel: x.responsavel, vagas: x.vagas })),
      turmas: c.turmas.map((t) => ({
        id: t.id,
        name: t.nome,
        grupo: t.grupo,
        professor: t.professor?.nome ?? null,
        grade: t.grade,
        vagas: t.vagas,
        ocupadas: t.ocupadas,
        sala: t.sala,
        modalidade: t.modalidade,
        periodo: t.periodo,
        curriculo: t.curriculo,
        ativa: t.ativa,
        cor: t.cor,
        cefr: t.cefr,
        descricao: t.descricao,
      })),
    };
  });

  return {
    cursos: cs,
    professores: professores.map((t) => ({
      id: t.id,
      name: t.nome,
      email: t.email,
      cursos: t.cursos,
      habil: (t.habilitacao as Record<string, string[]> | null) ?? null,
      carga: t.carga,
      teto: t.teto,
      active: t.ativo,
      valorHora: t.valorHora == null ? null : Number(t.valorHora),
      disp: t.dispDefinida ? t.disponibilidade : null,
    })),
    alunos: alunos.map((a) => ({
      id: a.id,
      name: a.nome,
      email: a.email,
      cpf: a.cpf,
      status: a.status,
      desativadoEm: a.desativadoEm,
      empresa: a.empresa?.nome ?? null,
      contratoFim: diaLocal(a.contratoFim),
      disp: a.dispDefinida ? a.disponibilidade : null,
      matriculas: a.matriculas.map((m) => ({
        id: m.id,
        curso: m.curso.nome,
        modulo: m.modulo,
        usadas: m.usadas,
        total: m.total,
        modalidade: m.modalidade,
        desativadoEm: m.desativadoEm,
        aloc: (m.alocacao as MatriculaB['aloc']) ?? null,
      })),
    })),
    curriculos: curriculos.map((c) => ({
      id: c.id,
      nome: c.nome,
      grupo: c.grupo,
      tipo: c.tipo,
      idioma: c.idioma,
      aplicado: c.aplicado,
      conteudos: c.conteudos as ConteudoCur[],
    })),
    feriados: new Set(feriados.map((f) => iso(f.data))),
    usuarios: usuarios.map((u) => ({
      nome: u.nome,
      email: u.email,
      status: u.status,
      mfa: u.mfa,
      perfil: u.perfilLegado ?? perfilNome(PERFIS.find((p) => p.id === u.perfilId)),
    })),
    salas: salas.map((r) => ({ name: r.nome, atende: r.atende, tipo: r.tipo, zoom: r.zoom, active: r.ativo })),
    colaboradores: colaboradores.map((c) => ({ nome: c.nome, ativo: c.ativo })),
    fechadas: new Set(fechadas.map((f) => f.ym)),
    ajustes: Object.fromEntries(ajustes.map((a) => [a.chave, a.dados as AjusteAula])),
    corModulo,
    corCurso,
  };
}
