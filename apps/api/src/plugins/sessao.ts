/**
 * Sessão por cookie httpOnly. O token vai no cookie; no banco fica só o sha256.
 * `request.usuario` traz a pessoa já com o acesso resolvido (hierarquia, setores, tipo de perfil).
 */
import { createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { prisma } from '../db.ts';
import { type Areas, MATRIZ, PERFIS, type TipoPerfil } from '../domain/acesso.ts';
import { chavesDe, type Pessoa, podeChave } from '../domain/mapa.ts';
import { env } from '../env.ts';

export const COOKIE = 'portal_sessao';

export type UsuarioSessao = Pessoa & {
  id: number;
  sessaoId: string;
  nome: string;
  email: string;
  perfilId: number | null;
  tipoPerfil: TipoPerfil | null;
  alunoId: number | null;
  personaLetra: string | null;
  agendaPresa: Record<string, string> | null;
  temAluno: boolean;
  /** Acessar como: quem abriu a sessão e para onde volta */
  como: { quem: string; volta: string } | null;
};

declare module 'fastify' {
  interface FastifyRequest {
    usuario: UsuarioSessao | null;
  }
  interface FastifyInstance {
    exigeLogin: (req: FastifyRequest, rep: FastifyReply) => Promise<void>;
    exigeChave: (chave: string) => (req: FastifyRequest, rep: FastifyReply) => Promise<void>;
  }
}

const hash = (t: string) => createHash('sha256').update(t).digest('hex');

export async function abreSessao(rep: FastifyReply, req: FastifyRequest, usuarioId: number) {
  const token = randomBytes(32).toString('base64url');
  const expiraEm = new Date(Date.now() + env.SESSION_DAYS * 864e5);
  await prisma.sessao.create({
    data: {
      id: hash(token),
      usuarioId,
      expiraEm,
      ip: req.ip,
      userAgent: String(req.headers['user-agent'] ?? '').slice(0, 300),
    },
  });
  rep.setCookie(COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    expires: expiraEm,
    signed: true,
  });
}

export async function fechaSessao(rep: FastifyReply, req: FastifyRequest) {
  if (req.usuario)
    await prisma.sessao.update({ where: { id: req.usuario.sessaoId }, data: { encerradaEm: new Date() } });
  rep.clearCookie(COOKIE, { path: '/' });
}

async function carregaUsuario(req: FastifyRequest): Promise<UsuarioSessao | null> {
  const bruto = req.cookies[COOKIE];
  if (!bruto) return null;
  const des = req.unsignCookie(bruto);
  if (!des.valid || !des.value) return null;
  const s = await prisma.sessao.findUnique({ where: { id: hash(des.value) }, include: { usuario: true } });
  if (!s || s.encerradaEm || s.expiraEm < new Date() || s.usuario.status !== 'Ativo') return null;
  /* última atividade da sessão, no máximo uma escrita por minuto */
  if (Date.now() - +s.vistaEm > 6e4) await prisma.sessao.update({ where: { id: s.id }, data: { vistaEm: new Date() } });
  const u = s.usuario;
  if (s.comoProfId != null) {
    const t = await prisma.professor.findUnique({ where: { id: s.comoProfId }, select: { nome: true, email: true } });
    const m = MATRIZ[13];
    if (t)
      return {
        id: u.id,
        sessaoId: s.id,
        nome: t.nome,
        email: t.email,
        perfilId: 13,
        nivel: m.nivel,
        areas: structuredClone(m.areas),
        tipoPerfil: 'Prestador',
        ehAluno: false,
        alunoId: null,
        temAluno: false,
        personaLetra: null,
        agendaPresa: { prof: t.nome },
        como: { quem: u.nome, volta: s.comoVolta ?? '/equipe' },
      };
  }
  if (s.comoAlunoId != null) {
    const al = await prisma.aluno.findUnique({
      where: { id: s.comoAlunoId },
      select: { id: true, nome: true, email: true },
    });
    if (al)
      return {
        id: u.id,
        sessaoId: s.id,
        nome: al.nome,
        email: al.email,
        perfilId: 15,
        nivel: 5,
        areas: {} as Areas,
        tipoPerfil: 'Aluno',
        ehAluno: true,
        alunoId: al.id,
        temAluno: false,
        personaLetra: null,
        agendaPresa: null,
        como: { quem: u.nome, volta: s.comoVolta ?? '/alunos' },
      };
  }
  const tipoPerfil = (PERFIS.find((p) => p.id === u.perfilId)?.perfil ?? null) as TipoPerfil | null;
  return {
    id: u.id,
    sessaoId: s.id,
    nome: u.nome,
    email: u.email,
    perfilId: u.perfilId,
    nivel: u.nivel,
    areas: u.areas as Areas,
    tipoPerfil,
    ehAluno: tipoPerfil === 'Aluno',
    alunoId: u.alunoId,
    temAluno: tipoPerfil !== 'Aluno' && u.alunoId != null,
    personaLetra: u.personaLetra,
    agendaPresa: (u.agendaPresa as Record<string, string> | null) ?? null,
    como: null,
  };
}

export default fp(async (app: FastifyInstance) => {
  app.decorateRequest('usuario', null);
  app.addHook('onRequest', async (req) => {
    req.usuario = await carregaUsuario(req);
  });
  app.decorate('exigeLogin', async (req: FastifyRequest, rep: FastifyReply) => {
    if (!req.usuario) return rep.code(401).send({ erro: 'Sessão expirada. Entre de novo.' });
  });
  app.decorate('exigeChave', (chave: string) => async (req: FastifyRequest, rep: FastifyReply) => {
    if (!req.usuario) return rep.code(401).send({ erro: 'Sessão expirada. Entre de novo.' });
    if (!podeChave(req.usuario, chave)) return rep.code(403).send({ erro: 'Sem acesso a esta tela.' });
  });
});

export { chavesDe };
