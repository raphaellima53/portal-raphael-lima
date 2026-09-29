/**
 * Banco local: restaura da Lixeira os itens pedidos (uso: tsx scripts/restaura-lixeira.ts 36 63) e, com --limpa,
 * apaga de vez o resto (sobras de teste). Para acertar o banco de trabalho depois de testes.
 */
import { prisma } from '../src/db.ts';
import { invalidaBase } from '../src/domain/base.ts';
import { restaurar } from '../src/domain/lixeira.ts';

const ids = process.argv
  .slice(2)
  .filter((x) => /^\d+$/.test(x))
  .map(Number);
for (const id of ids) {
  try {
    const l = await restaurar(id);
    console.log(l ? `restaurado: ${l.tipo} ${l.nome}` : `não está na Lixeira: ${id}`);
  } catch (e) {
    console.log('não restaurou:', id, (e as Error).message.split('\n')[0]);
  }
}
if (process.argv.includes('--limpa')) {
  const r = await prisma.lixeira.deleteMany({});
  console.log(`${r.count} sobras apagadas de vez`);
}
invalidaBase();
await prisma.$disconnect();
