import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../db.ts';
import { PERFIS } from '../domain/acesso.ts';
import { invalidaBase } from '../domain/base.ts';
import { erroRestaurar, excluir, previa, restaurar, TIPOS } from '../domain/lixeira.ts';
import { registra } from '../lib/log.ts';
import type { UsuarioSessao } from '../plugins/sessao.ts';

/** Excluir e a Lixeira são só do tipo de perfil Admin (decisão de 24/09/2026) */
export const ehAdmin = (u: UsuarioSessao | undefined) => u?.tipoPerfil === 'Admin';
const soAdmin = async (req: FastifyRequest, rep: FastifyReply) => {
  if (!req.usuario) return rep.code(401).send({ erro: 'Sessão expirada. Entre de novo.' });
  if (!ehAdmin(req.usuario)) return rep.code(403).send({ erro: 'Excluir e a Lixeira são só do Admin.' });
};

/** o que o sistema recusa excluir mesmo para o Admin */
async function recusa(u: UsuarioSessao, tipo: string, id: string): Promise<string | null> {
  if (tipo === 'usuario') {
    if (Number(id) === u.id) return 'Você não pode excluir o próprio usuário.';
    const alvo = await prisma.usuario.findUnique({ where: { id: Number(id) } });
    const admin = (x: { perfilId: number | null; nivel: number; status: string }) =>
      x.status === 'Ativo' && x.nivel === 1 && PERFIS.find((p) => p.id === x.perfilId)?.perfil === 'Admin';
    if (alvo && admin(alvo)) {
      const admins = (await prisma.usuario.findMany({ where: { status: 'Ativo', nivel: 1 } })).filter(admin);
      if (admins.length <= 1) return 'Este é o último administrador ativo: a base ficaria sem quem conceda acesso.';
    }
  }
  if (tipo === 'aluno') {
    const persona = await prisma.usuario.findFirst({ where: { alunoId: Number(id), personaLetra: { not: null } } });
    if (persona) return 'Persona de teste não se exclui (é o login de demonstração). Use Desativar.';
  }
  return null;
}

/** vaga da turma ocupada pelas matrículas ativas: sai com o aluno e volta com ele */
async function vagasDaTurma(
  matriculas: { cursoId: number; modulo: string | null; desativadoEm: unknown }[],
  d: 1 | -1,
) {
  for (const m of matriculas)
    if (m.modulo && !m.desativadoEm)
      await prisma.turma.updateMany({
        where: { cursoId: m.cursoId, nome: m.modulo, ...(d < 0 ? { ocupadas: { gt: 0 } } : {}) },
        data: { ocupadas: { increment: d } },
      });
}

/** move para a Lixeira e registra na Auditoria; usado também pelas rotas de exclusão de cada tela */
export async function moveParaLixeira(req: FastifyRequest, rep: FastifyReply, tipo: string, id: string) {
  const u = req.usuario!;
  if (!TIPOS[tipo]) return rep.code(400).send({ erro: 'Este registro não pode ir para a Lixeira.' });
  const nao = await recusa(u, tipo, id);
  if (nao) return rep.code(409).send({ erro: nao });
  const mats = tipo === 'aluno' ? await prisma.matricula.findMany({ where: { alunoId: Number(id) } }) : [];
  const r = await excluir(tipo, id, u.nome);
  if (r) await vagasDaTurma(mats, -1);
  if (!r) return rep.code(404).send({ erro: 'Registro não encontrado (talvez já esteja na Lixeira).' });
  invalidaBase();
  await registra({
    tipo: 'config',
    id: `lixeira:${r.id}`,
    acao: `${r.rotulo} movido para a Lixeira`,
    detalhe: r.junto.length ? `foi junto: ${r.junto.join(', ')}` : undefined,
    nome: r.nome,
    autor: u.nome,
  });
  return {
    msg: `${r.nome} foi para a Lixeira${r.junto.length ? ` com ${r.junto.join(', ')}` : ''}. Dá para restaurar em Configurações › Lixeira.`,
    lixeiraId: r.id,
  };
}

export default async function rotasLixeira(app: FastifyInstance) {
  /** o que vai junto (texto da confirmação) */
  app.get('/lixeira/previa', { preHandler: soAdmin }, async (req, rep) => {
    const { tipo = '', id = '' } = req.query as { tipo?: string; id?: string };
    const p = await previa(tipo, id);
    if (!p) return rep.code(404).send({ erro: 'Registro não encontrado.' });
    return { ...p, recusa: await recusa(req.usuario!, tipo, id) };
  });

  app.delete('/lixeira/:tipo/:id', { preHandler: soAdmin }, (req, rep) => {
    const { tipo, id } = req.params as { tipo: string; id: string };
    return moveParaLixeira(req, rep, tipo, id);
  });

  /** Configurações › Lixeira */
  app.get('/lixeira', { preHandler: soAdmin }, async () => {
    const ls = await prisma.lixeira.findMany({
      orderBy: { em: 'desc' },
      select: { id: true, tipo: true, nome: true, resumo: true, por: true, em: true },
    });
    return {
      itens: ls.map((l) => ({ ...l, rotulo: TIPOS[l.tipo]?.rotulo ?? l.tipo })),
      tipos: [...new Set(ls.map((l) => l.tipo))].map((t) => ({ v: t, l: TIPOS[t]?.rotulo ?? t })),
    };
  });

  app.post('/lixeira/:id/restaurar', { preHandler: soAdmin }, async (req, rep) => {
    try {
      const l = await restaurar(Number((req.params as { id: string }).id));
      if (!l) return rep.code(404).send({ erro: 'Item não está mais na Lixeira.' });
      if (l.tipo === 'aluno')
        await vagasDaTurma(await prisma.matricula.findMany({ where: { alunoId: Number(l.registroId) } }), 1);
      invalidaBase();
      await registra({
        tipo: 'config',
        id: `lixeira:${l.id}`,
        acao: `${TIPOS[l.tipo]?.rotulo ?? l.tipo} restaurado da Lixeira`,
        nome: l.nome,
        autor: req.usuario!.nome,
      });
      return { msg: `${l.nome} foi restaurado${l.resumo ? `, com ${l.resumo}` : ''}.` };
    } catch (e) {
      const msg = erroRestaurar(e);
      if (msg) return rep.code(409).send({ erro: msg });
      throw e;
    }
  });

  /** apagar de vez (sai da Lixeira; não dá mais para restaurar) */
  app.delete('/lixeira/:id', { preHandler: soAdmin }, async (req, rep) => {
    const l = await prisma.lixeira.findUnique({ where: { id: Number((req.params as { id: string }).id) } });
    if (!l) return rep.code(404).send({ erro: 'Item não está mais na Lixeira.' });
    await prisma.lixeira.delete({ where: { id: l.id } });
    await registra({
      tipo: 'config',
      id: `lixeira:${l.id}`,
      acao: `${TIPOS[l.tipo]?.rotulo ?? l.tipo} apagado de vez da Lixeira`,
      nome: l.nome,
      autor: req.usuario!.nome,
    });
    return { msg: `${l.nome} foi apagado de vez.` };
  });
}
