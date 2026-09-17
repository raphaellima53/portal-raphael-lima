import { prisma } from '../db.ts';

/** entidade do log por tipo (AUD_ENT do portal) */
export const ENTIDADE: Record<string, string> = {
  aluno: 'Aluno',
  prof: 'Professor',
  fechamento: 'Fechamento',
  lead: 'Lead',
  aula: 'Aula',
  evento: 'Evento',
  curriculo: 'Currículo',
  empresa: 'Empresa',
  curso: 'Curso',
  config: 'Configuração',
  acao: 'Ação',
};

/**
 * Registra uma alteração no histórico (fxLog do portal). Cliques seguidos na mesma ação, pela mesma pessoa,
 * em menos de 2 minutos viram uma linha só.
 */
export async function registra(o: {
  tipo: string;
  id: string;
  acao: string;
  detalhe?: string;
  nome: string;
  autor: string;
}) {
  const entidade = ENTIDADE[o.tipo] ?? o.tipo;
  const ult = await prisma.logAlteracao.findFirst({ where: { origem: 'portal' }, orderBy: { id: 'desc' } });
  const agora = new Date();
  if (
    ult &&
    ult.entidade === entidade &&
    ult.entidadeId === o.id &&
    ult.acao === o.acao &&
    ult.autor === o.autor &&
    +agora - +ult.quando < 12e4
  ) {
    await prisma.logAlteracao.update({
      where: { id: ult.id },
      data: { quando: agora, detalhe: o.detalhe ?? null, vezes: { increment: 1 } },
    });
    return;
  }
  await prisma.logAlteracao.create({
    data: {
      entidade,
      entidadeId: o.id,
      acao: o.acao,
      detalhe: o.detalhe ?? null,
      nome: o.nome,
      autor: o.autor,
      origem: 'portal',
    },
  });
}
