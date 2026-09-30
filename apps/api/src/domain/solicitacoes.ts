/**
 * Regras do aluno por tipo de curso (30/09/2026):
 * - Open-Entry (módulos): vínculo por módulo; o aluno agenda e cancela sozinho.
 * - Regular (turmas): vínculo por turma; o aluno SOLICITA o cancelamento e a equipe decide; o agendamento é do time
 *   pedagógico.
 * - Particular (alocação aluno + professor): grade fixa; o aluno cancela sozinho, SOLICITA mudança de dias e horários,
 *   e o agendamento é do time pedagógico.
 */
import { prisma } from '../db.ts';
import type { AjusteAula, Base, CursoB } from './base.ts';

export type ModoAluno = { cancelar: 'direto' | 'solicitar'; autoagenda: boolean; mudanca: boolean };

export const TIPO_CANCEL = 'Cancelamento de aula';
export const TIPO_MUDANCA = 'Mudança de dias e horários';
export const SOL_STATUS = ['Pendente', 'Aprovada', 'Recusada'];

export function modoAluno(c: CursoB | undefined): ModoAluno {
  if (c?.estrutura === 'turmas') return { cancelar: 'solicitar', autoagenda: false, mudanca: false };
  if (c?.estrutura === 'modulos') return { cancelar: 'direto', autoagenda: true, mudanca: false };
  /* Particular: alocação aluno + professor, grade fixa */
  return { cancelar: 'direto', autoagenda: false, mudanca: true };
}

/** tira o aluno da aula (o mesmo que a equipe faz ao retirar um aluno) */
export async function tiraDaAula(b: Base, k: string, aluno: string) {
  const ov: AjusteAula = structuredClone(b.ajustes[k] ?? {});
  if (ov.extras?.includes(aluno)) ov.extras = ov.extras.filter((x) => x !== aluno);
  else ov.fora = { ...(ov.fora ?? {}), [aluno]: true };
  b.ajustes[k] = ov;
  await prisma.aulaAjuste.upsert({ where: { chave: k }, create: { chave: k, dados: ov }, update: { dados: ov } });
}

/** solicitações pendentes de um aluno numa aula (para não pedir duas vezes) */
export const pendenteNaAula = (alunoId: number, k: string) =>
  prisma.solicitacaoAluno.findFirst({ where: { alunoId, aula: k, status: 'Pendente', tipo: TIPO_CANCEL } });
