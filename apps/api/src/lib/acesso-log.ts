import { prisma } from '../db.ts';

/** Histórico de acesso (Configurações › Sessões e acessos): login, logout, recusa, logout forçado, perfil alterado */
export const logAcesso = (quem: string, evento: string, resultado: string, detalhe = '') =>
  prisma.acessoLog.create({ data: { quem, evento, resultado, detalhe: detalhe.slice(0, 500) } });
