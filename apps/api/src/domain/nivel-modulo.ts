/**
 * 30/09/2026: no curso por módulos (Open-Entry), a matrícula nasce sem módulo e o nivelamento define qual —
 * o módulo do curso com o mesmo CEFR (ex.: A0 → Confidence, A1+ → Essential 2). Só preenche matrícula ainda sem
 * módulo; troca de módulo depois continua manual.
 */
import { prisma } from '../db.ts';

export async function moduloPeloNivel(matriculaId: number, cefr: string) {
  const m = await prisma.matricula.findUnique({
    where: { id: matriculaId },
    include: { curso: { select: { estrutura: true, modulos: { select: { nome: true, cefr: true, ordem: true } } } } },
  });
  if (!m || m.modulo || m.curso.estrutura !== 'modulos' || !cefr) return null;
  const mod = m.curso.modulos.filter((x) => x.cefr === cefr).sort((a, b) => a.ordem - b.ordem)[0];
  if (!mod) return null;
  await prisma.matricula.update({ where: { id: m.id }, data: { modulo: mod.nome } });
  return mod.nome;
}
