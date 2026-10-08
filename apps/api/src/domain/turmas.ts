import type { prisma } from '../db.ts';
import { registra } from '../lib/log.ts';

type Tx = Pick<typeof prisma, 'matricula'>;
export type Desvinculo = { alunoId: number; aluno: string; curso: string; turma: string };

/**
 * Decisão 2.6.3.2 (05/10/2026): excluir uma turma com alunos tira o vínculo das matrículas ativas com ela
 * (a matrícula fica sem turma) e o perfil do aluno passa a avisar que ele precisa de nova alocação.
 */
export async function desvinculaTurmas(tx: Tx, cursoId: number, turmas: string[]): Promise<Desvinculo[]> {
  if (!turmas.length) return [];
  const ms = await tx.matricula.findMany({
    where: { cursoId, modulo: { in: turmas }, desativadoEm: null },
    include: { aluno: { select: { id: true, nome: true } }, curso: { select: { nome: true } } },
  });
  if (ms.length) await tx.matricula.updateMany({ where: { id: { in: ms.map((m) => m.id) } }, data: { modulo: null } });
  return ms.map((m) => ({ alunoId: m.aluno.id, aluno: m.aluno.nome, curso: m.curso.nome, turma: m.modulo ?? '' }));
}

/** o registro no Log de cada aluno desvinculado (fora da transação) */
export const registraDesvinculos = (l: Desvinculo[], autor: string) =>
  Promise.all(
    l.map((x) =>
      registra({
        tipo: 'aluno',
        id: String(x.alunoId),
        nome: x.aluno,
        acao: 'Turma excluída: precisa de nova alocação',
        detalhe: `${x.curso} · ${x.turma}`,
        autor,
      }),
    ),
  );
