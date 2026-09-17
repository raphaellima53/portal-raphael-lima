import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../db.ts';
import { audLinhas } from '../domain/auditoria.ts';
import { base } from '../domain/base.ts';
import { podeChave } from '../domain/mapa.ts';

async function exige(req: FastifyRequest, rep: FastifyReply) {
  const u = req.usuario;
  if (!u) return rep.code(401).send({ erro: 'Sessão expirada. Entre de novo.' });
  if (u.ehAluno || !podeChave(u, 'auditoria')) return rep.code(403).send({ erro: 'Sem acesso a esta tela.' });
}

/** as alterações mais recentes que a tela carrega de uma vez */
const LIMITE = 5000;

export default async function rotasAuditoria(app: FastifyInstance) {
  app.get('/auditoria', { preHandler: exige }, async () => {
    const [b, logs, empresas, total] = await Promise.all([
      base(),
      prisma.logAlteracao.findMany({ orderBy: { quando: 'desc' }, take: LIMITE }),
      prisma.empresa.findMany({ select: { id: true } }),
      prisma.logAlteracao.count(),
    ]);
    const linhas = audLinhas(b, logs, new Set(empresas.map((e) => e.id)));
    const ordena = (xs: string[]) => [...new Set(xs)].sort((x, y) => x.localeCompare(y, 'pt-BR'));
    return {
      linhas,
      total,
      limite: total > LIMITE ? LIMITE : null,
      vivos: linhas.filter((x) => x.vivo).length,
      entidades: ordena(linhas.map((x) => x.ent)),
      autores: ordena(linhas.map((x) => x.quem)),
    };
  });
}
