/**
 * Eventos e reuniões da Agenda — porte de eventos.src.js.
 * Participantes: colaborador (time interno), prestador (professor) e aluno. Aparecem na Mensal, Semanal e Diária.
 */
import { prisma } from '../db.ts';
import { agAulasEntre, agHM, agRotulo } from './agenda.ts';
import type { Base } from './base.ts';

export type Participante = { g: 'colaborador' | 'prestador' | 'aluno'; n: string };
export type EventoB = {
  id: string;
  tipo: string;
  titulo: string;
  ini: Date;
  fim: Date;
  local: string;
  desc: string;
  part: Participante[];
  por: string;
};

export const EV_GRUPOS: [Participante['g'], string][] = [
  ['colaborador', 'Colaboradores'],
  ['prestador', 'Prestadores'],
  ['aluno', 'Alunos'],
];
export const EV_UM: Record<string, string> = { colaborador: 'Colaborador', prestador: 'Prestador', aluno: 'Aluno' };

export function evPessoas(b: Base) {
  const uniq = (l: string[]) => [...new Set(l.filter(Boolean))].sort((x, y) => x.localeCompare(y, 'pt-BR'));
  const prest = b.professores.filter((t) => t.active).map((t) => t.name);
  return {
    colaborador: uniq(
      b.usuarios
        .filter((u) => !/^(Aluno|Prestador)/.test(u.perfil || ''))
        .map((u) => u.nome)
        .concat(b.colaboradores.filter((e) => e.ativo).map((e) => e.nome))
        .filter((n) => !prest.includes(n)),
    ),
    prestador: uniq(prest),
    aluno: uniq(b.alunos.map((a) => a.name)),
  };
}

const deBanco = (e: {
  id: string;
  tipo: string;
  titulo: string;
  inicio: Date;
  fim: Date;
  local: string;
  descricao: string;
  participantes: unknown;
  criadoPor: string;
}): EventoB => ({
  id: e.id,
  tipo: e.tipo,
  titulo: e.titulo,
  ini: e.inicio,
  fim: e.fim,
  local: e.local,
  desc: e.descricao,
  part: e.participantes as Participante[],
  por: e.criadoPor,
});

export async function eventoPor(id: string) {
  const e = await prisma.evento.findUnique({ where: { id } });
  return e ? deBanco(e) : null;
}

export type FiltroEv = { aluno?: string; prof?: string; prod?: string; mod?: string; tipo?: string };

/** eventos de um intervalo com os filtros da agenda: tipo, aluno e professor (curso e módulo não se aplicam a eventos) */
export async function agEvEntre(ini: Date, fim: Date, f: FiltroEv): Promise<EventoB[]> {
  if (f.tipo === 'aulas' || f.prod || f.mod) return [];
  const a = new Date(ini);
  const z = new Date(fim);
  a.setHours(0, 0, 0, 0);
  z.setHours(23, 59, 59, 999);
  const es = (await prisma.evento.findMany({ where: { inicio: { gte: a, lte: z } }, orderBy: { inicio: 'asc' } })).map(
    deBanco,
  );
  /* vários alunos e usuários, separados por | (24/09/2026) */
  const alunos = f.aluno ? f.aluno.split('|') : [];
  const profs = f.prof ? f.prof.split('|') : [];
  return es.filter(
    (e) =>
      (!alunos.length || e.part.some((x) => x.g === 'aluno' && alunos.includes(x.n))) &&
      (!profs.length || e.part.some((x) => x.g !== 'aluno' && profs.includes(x.n))),
  );
}

/** aulas no mesmo horário de professores e alunos do evento */
export function evChoques(b: Base, e: { ini: Date; fim: Date; part: Participante[] }) {
  const nomes = new Set(e.part.filter((x) => x.g === 'prestador' || x.g === 'aluno').map((x) => x.n));
  if (!nomes.size) return [];
  const d = new Date(e.ini);
  d.setHours(0, 0, 0, 0);
  return agAulasEntre(b, d, d)
    .filter((a) => a.estado !== 'cancelada')
    .filter((a) => {
      const fimA = new Date(a.quando.getTime() + (a.duracao || 50) * 6e4);
      return a.quando < e.fim && fimA > e.ini;
    })
    .flatMap((a) =>
      [a.prof, ...a.alunos].filter((n) => nomes.has(n)).map((n) => `${n} tem ${agRotulo(a)} às ${agHM(a.quando)}`),
    );
}

/** Nível: criar até 4, editar até 3 ou o criador, excluir até 2 ou o criador; aluno só vê. */
export const evPodeCriar = (nv: number) => nv <= 4;
export const evPodeEditar = (nv: number, e: EventoB, quem: string) => nv <= 3 || (nv <= 4 && e.por === quem);
export const evPodeExcluir = (nv: number, e: EventoB, quem: string) => nv <= 2 || (nv <= 4 && e.por === quem);
export const evHora = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
