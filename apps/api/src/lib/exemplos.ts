import { prisma } from '../db.ts';

/**
 * Base zerada para testes de cadastro (scripts/zera-base.ts grava `dadosDeExemplo: false`):
 * os feedbacks e os cards de fluxo de exemplo deixam de nascer na primeira leitura.
 */
let cache: { valor: boolean; ate: number } | null = null;
export async function comExemplos() {
  if (cache && cache.ate > Date.now()) return cache.valor;
  const c = await prisma.configuracao.findUnique({ where: { chave: 'dadosDeExemplo' } });
  const valor = c?.valor !== false;
  cache = { valor, ate: Date.now() + 15_000 };
  return valor;
}
