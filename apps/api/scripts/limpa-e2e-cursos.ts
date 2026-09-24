/** Apaga do banco local os cursos que o e2e-cursos cria ("Curso de teste e2e…"), para rodá-lo de novo. */
import { prisma } from '../src/db.ts';

const cursos = await prisma.curso.findMany({ where: { nome: { startsWith: 'Curso de teste e2e' } } });
await prisma.curriculo.deleteMany({ where: { grupo: { in: cursos.map((c) => c.nome) } } });
const r = await prisma.curso.deleteMany({ where: { id: { in: cursos.map((c) => c.id) } } });
console.log(`${r.count} curso(s) de teste apagado(s):`, cursos.map((c) => c.nome).join(', ') || '—');
await prisma.$disconnect();
