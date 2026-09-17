/**
 * As quatro visões da Agenda (Mensal, Semanal, Diária, Kanban) sobre a MESMA lista de aulas e os MESMOS filtros —
 * porte de agenda.src.js. A API devolve as aulas e eventos do recorte já filtrados, com os textos do calendário;
 * o front desenha a grade.
 */
import { fmt } from '../lib/fmt.ts';
import {
  AG_KB,
  type Aula,
  agAulasEntre,
  agCor,
  agHH,
  agInicioSemana,
  agISO,
  agNaAgenda,
  agOfertas,
  agRotulo,
  alMat,
  crsItens,
  dispK,
  prDisp,
} from './agenda.ts';
import type { Base } from './base.ts';
import { agEvEntre, type EventoB, evHora, evPessoas } from './eventos.ts';

export const VISTAS = ['mensal', 'semanal', 'diaria', 'kanban'] as const;
export type Vista = (typeof VISTAS)[number];
export const PERIODOS: [string, string][] = [
  ['hoje', 'dia'],
  ['semana', 'semana'],
  ['janela', '7 dias antes e 7 depois'],
  ['mes', 'mês'],
];
export type Filtros = { aluno: string; prof: string; prod: string; mod: string; tipo: string; qual: string };

export const AG_QUAL: [string, string, (b: Base, a: Aula) => boolean][] = [
  ['naoFin', 'aula não finalizada', (_b, a) => a.estado === 'naoFinalizada'],
  ['semProf', 'sem professor', (_b, a) => a.estado === 'semProfessor' || a.prof === '—'],
  ['subst', 'substituída', (_b, a) => a.estado === 'substituida'],
  [
    'profDisp',
    'fora da disponibilidade do professor',
    (b, a) => {
      const t = b.professores.find((x) => x.name === a.prof);
      return !!t && !prDisp(b, t).includes(dispK(a.quando.getDay(), a.quando.getHours()));
    },
  ],
  [
    'semCur',
    'módulo ou turma sem currículo',
    (b, a) => !!a.mod && !b.curriculos.some((x) => x.grupo === a.prod && x.aplicado.includes(a.mod!)),
  ],
];

const agCap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const mesNome = (d: Date) => d.toLocaleDateString('pt-BR', { month: 'long' });
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export const agFiltra = (l: Aula[], f: Filtros) =>
  l.filter(
    (a) =>
      (!f.aluno || a.alunos.includes(f.aluno)) &&
      (!f.prof || a.prof === f.prof) &&
      (!f.prod || a.prod === f.prod) &&
      (!f.mod || `${a.prod} · ${a.mod}` === f.mod),
  );
const agAtivo = (f: Filtros) => !!(f.aluno || f.prof || f.prod || f.mod || f.tipo);

export function agRegua(b: Base, evs: EventoB[] = []) {
  const hs = agOfertas(b)
    .map((o) => o.hora)
    .concat(evs.map((e) => e.ini.getHours()));
  if (!hs.length) return [];
  const i = Math.min(...hs);
  const f = Math.max(...hs);
  return Array.from({ length: f - i + 1 }, (_, k) => i + k);
}

export const aulaItem = (b: Base, a: Aula) => ({
  k: a.k,
  iso: agISO(a.quando),
  hora: a.quando.getHours(),
  quando: `${a.quando.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}, ${fmt.data(a.quando).slice(0, 5)} · ${agHH(a.quando.getHours())}`,
  rotulo: agRotulo(a),
  cor: agCor(b, a),
  prod: a.prod,
  mod: a.mod,
  quem: a.quem,
  prof: a.prof,
  sub: a.sub,
  sala: a.sala,
  n: a.n,
  vagas: a.vagas,
  estado: a.estado,
});
export type AulaItem = ReturnType<typeof aulaItem>;

const eventoItem = (e: EventoB) => ({
  id: e.id,
  tipo: e.tipo,
  titulo: e.titulo,
  iso: agISO(e.ini),
  hora: e.ini.getHours(),
  ini: evHora(e.ini),
  fim: evHora(e.fim),
  nPart: e.part.length,
  pessoas: `${e.part
    .slice(0, 3)
    .map((x) => x.n)
    .join(', ')}${e.part.length > 3 ? ` +${e.part.length - 3}` : ''}`,
  local: e.local || 'sem local',
});

export type Contexto = {
  /** aluno (ou Minha agenda de quem também é aluno): só Mensal, Semanal e Diária */
  soAluno: boolean;
  alunoNome: string | null;
  cursosDoAluno: string[];
  /** Prestador: filtro de produtos com os cursos em que dá aula */
  cursosDoProf: string[] | null;
  presa: Record<string, string> | null;
};

/** Aplica o que o perfil prende: o aluno vê só a própria agenda; a Professora, a dela. */
export function filtrosEfetivos(f: Filtros, c: Contexto): Filtros {
  if (c.soAluno) {
    return {
      aluno: c.alunoNome ?? '',
      prof: '',
      mod: '',
      tipo: '',
      qual: '',
      prod: c.cursosDoAluno.length > 1 && c.cursosDoAluno.includes(f.prod) ? f.prod : '',
    };
  }
  return { ...f, ...(c.presa ?? {}) };
}

export async function montaAgenda(
  b: Base,
  vista: Vista,
  refIso: string | null,
  periodo: string,
  f: Filtros,
  c: Contexto,
  agora = new Date(),
) {
  if (c.soAluno && vista === 'kanban') vista = 'mensal';
  const ref = refIso ? new Date(`${refIso}T00:00:00`) : new Date(agora);
  ref.setHours(0, 0, 0, 0);
  const hoje = new Date(agora);
  hoje.setHours(0, 0, 0, 0);
  const soEventos = f.tipo === 'eventos';
  const dia = (d: Date) => ({
    iso: agISO(d),
    dia: d.getDate(),
    dow: d.getDay(),
    rot: DIAS[d.getDay()],
    feriado: b.feriados.has(agISO(d)),
    hoje: agISO(d) === agISO(hoje),
  });
  const faixa = (ini: Date, fim: Date) => {
    const out = [];
    for (const d = new Date(ini); d <= fim; d.setDate(d.getDate() + 1)) out.push(dia(new Date(d)));
    return out;
  };
  const ativo = agAtivo(f);
  const base = { vista, ref: agISO(ref), hoje: agISO(hoje), horaAgora: agora.getHours(), periodo, filtros: f };

  if (vista === 'mensal') {
    const ini = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const fim = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    const aulas = soEventos ? [] : agNaAgenda(agFiltra(agAulasEntre(b, ini, fim, agora), f));
    const evs = await agEvEntre(ini, fim, f);
    return {
      ...base,
      titulo: `${agCap(mesNome(ini))} ${ini.getFullYear()}`,
      sub: '',
      dias: faixa(ini, fim),
      aulas: aulas.map((a) => aulaItem(b, a)),
      eventos: evs.map(eventoItem),
      vazio:
        aulas.length || evs.length || !ativo
          ? null
          : soEventos
            ? 'nenhum evento ou reunião com esses filtros neste mês'
            : 'nenhuma aula com esses filtros neste mês',
    };
  }
  if (vista === 'semanal') {
    const s0 = agInicioSemana(ref);
    const s6 = new Date(s0);
    s6.setDate(s0.getDate() + 6);
    const aulas = soEventos ? [] : agNaAgenda(agFiltra(agAulasEntre(b, s0, s6, agora), f));
    const evs = await agEvEntre(s0, s6, f);
    return {
      ...base,
      titulo: `${s0.getDate()} de ${mesNome(s0)}${s0.getFullYear() !== s6.getFullYear() ? ` ${s0.getFullYear()}` : ''} – ${s6.getDate()} de ${mesNome(s6)} ${s6.getFullYear()}`,
      sub: '',
      dias: faixa(s0, s6),
      regua: agRegua(b, evs),
      aulas: aulas.map((a) => aulaItem(b, a)),
      eventos: evs.map(eventoItem),
      vazio:
        aulas.length || evs.length || !ativo
          ? null
          : soEventos
            ? 'nenhum evento ou reunião com esses filtros nesta semana'
            : 'nenhuma aula com esses filtros nesta semana',
    };
  }
  if (vista === 'diaria') {
    const aulas = soEventos ? [] : agNaAgenda(agFiltra(agAulasEntre(b, ref, ref, agora), f));
    const evs = await agEvEntre(ref, ref, f);
    const ehHoje = agISO(ref) === agISO(hoje);
    return {
      ...base,
      titulo: `${agCap(ref.toLocaleDateString('pt-BR', { weekday: 'long' }))}, ${ref.getDate()} de ${mesNome(ref)} ${ref.getFullYear()}`,
      sub: ehHoje ? 'Hoje' : '',
      diaSemana: ref.toLocaleDateString('pt-BR', { weekday: 'long' }),
      dias: [dia(ref)],
      regua: agRegua(b, evs),
      aulas: aulas.map((a) => aulaItem(b, a)),
      eventos: evs.map(eventoItem),
      vazio:
        aulas.length || evs.length
          ? null
          : soEventos
            ? 'nenhum evento ou reunião neste dia'
            : !ref.getDay()
              ? 'domingo — não há aula'
              : b.feriados.has(agISO(ref))
                ? 'feriado — não há aula'
                : ativo
                  ? 'nenhuma aula com esses filtros neste dia'
                  : 'nenhuma aula neste dia',
    };
  }
  /* kanban: a camada de alertas da agenda; cada aula do período cai em exatamente uma coluna */
  const [ini, fim] = intervalo(ref, periodo);
  const q = AG_QUAL.find((x) => x[0] === f.qual);
  const todas = agFiltra(agAulasEntre(b, ini, fim, agora), f);
  const aulas = q ? todas.filter((a) => q[2](b, a)) : todas;
  return {
    ...base,
    titulo:
      periodo === 'hoje'
        ? agCap(ini.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }))
        : `${fmt.data(ini)} — ${fmt.data(fim)}`,
    sub: '',
    colunas: AG_KB.map(([k, rot, cor, desc]) => ({
      k,
      rot,
      cor,
      desc,
      aulas: aulas.filter((a) => a.estado === k).map((a) => aulaItem(b, a)),
    })),
    qualidades: AG_QUAL.map(([k, l]) => ({ k, l })),
    periodos: PERIODOS.map(([k, l]) => ({ k, l })),
  };
}

export function intervalo(r: Date, p: string): [Date, Date] {
  if (p === 'hoje') return [r, r];
  if (p === 'mes') return [new Date(r.getFullYear(), r.getMonth(), 1), new Date(r.getFullYear(), r.getMonth() + 1, 0)];
  if (p === 'janela') {
    const a = new Date(r);
    const z = new Date(r);
    a.setDate(r.getDate() - 7);
    z.setDate(r.getDate() + 7);
    return [a, z];
  }
  const s = agInicioSemana(r);
  const f = new Date(s);
  f.setDate(s.getDate() + 6);
  return [s, f];
}

/** opções dos filtros do cabeçalho */
export function opcoesFiltros(b: Base, f: Filtros, c: Contexto) {
  if (c.soAluno) return { soAluno: true, cursosDoAluno: c.cursosDoAluno.length > 1 ? c.cursosDoAluno : [] };
  const ativos = b.cursos.filter((x) => x.active !== false && (!c.cursosDoProf || c.cursosDoProf.includes(x.name)));
  const ps = evPessoas(b);
  return {
    soAluno: false,
    presa: c.presa,
    alunos: b.alunos
      .filter((a) => alMat(a).length)
      .map((a) => a.name)
      .sort((x, y) => x.localeCompare(y, 'pt-BR')),
    colaboradores: ps.colaborador,
    prestadores: ps.prestador,
    produtos: ativos.map((x) => x.name),
    modulos: ativos
      .filter((x) => !f.prod || x.name === f.prod)
      .flatMap((x) => crsItens(x).map((i) => `${x.name} · ${i}`)),
  };
}
