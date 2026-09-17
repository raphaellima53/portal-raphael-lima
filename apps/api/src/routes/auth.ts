import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.ts';
import { acessoResumo, nivelDe, PERFIS, perfilNome } from '../domain/acesso.ts';
import { dispositivo } from '../domain/configuracoes.ts';
import { chavesDe, navDe } from '../domain/mapa.ts';
import { logAcesso } from '../lib/acesso-log.ts';
import { confereSenha, hashSenha } from '../lib/senha.ts';
import { abreSessao, fechaSessao } from '../plugins/sessao.ts';

const Login = z.object({
  login: z.string().trim().toLowerCase().min(1, 'Preencha login e senha.'),
  senha: z.string().min(1, 'Preencha login e senha.'),
});

const TrocaSenha = z.object({
  atual: z.string().min(1, 'Informe a senha atual.'),
  nova: z.string().min(8, 'A senha nova precisa de pelo menos 8 caracteres.').max(200),
});

export default async function rotasAuth(app: FastifyInstance) {
  /** Personas de teste para a tela de login (senha à mostra porque é ambiente de teste). */
  app.get('/auth/personas', async () => {
    const us = await prisma.usuario.findMany({ where: { personaLetra: { not: null } }, orderBy: { ordem: 'asc' } });
    return {
      personas: us.map((u) => ({
        letra: u.personaLetra,
        tipo: u.personaTipo,
        nome: u.nome,
        hierarquia: nivelDe(u.nivel)?.nome ?? '',
        cursos: u.personaCursos,
        modulos: u.personaModulos,
        login: u.email,
        senha: u.senhaTeste,
      })),
    };
  });

  app.post('/auth/login', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, rep) => {
    const r = Login.safeParse(req.body);
    if (!r.success) return rep.code(400).send({ erro: 'Preencha login e senha.' });
    const u = await prisma.usuario.findUnique({ where: { email: r.data.login } });
    const disp = dispositivo(String(req.headers['user-agent'] ?? ''));
    if (u?.status !== 'Ativo' || !(await confereSenha(r.data.senha, u.senhaHash))) {
      const motivo = !u
        ? 'e-mail não cadastrado'
        : u.status === 'Bloqueado'
          ? 'usuário bloqueado'
          : u.status !== 'Ativo'
            ? `usuário ${u.status.toLowerCase()}`
            : 'senha incorreta';
      await logAcesso(u?.nome ?? 'desconhecido', 'login', 'recusado', `${motivo} · ${disp}`);
      return rep.code(401).send({ erro: 'Login ou senha incorretos. Confira na lista ao lado.' });
    }
    await abreSessao(rep, req, u.id);
    await logAcesso(u.nome, 'login', 'sucesso', `${u.mfa ? 'MFA aprovado' : 'sem MFA — perfil não exige'} · ${disp}`);
    return { ok: true, ehAluno: PERFIS.find((p) => p.id === u.perfilId)?.perfil === 'Aluno' };
  });

  app.post('/auth/logout', async (req, rep) => {
    if (req.usuario)
      await logAcesso(req.usuario.nome, 'logout', 'sucesso', dispositivo(String(req.headers['user-agent'] ?? '')));
    await fechaSessao(rep, req);
    return { ok: true };
  });

  app.put(
    '/auth/senha',
    { preHandler: app.exigeLogin, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req, rep) => {
      const r = TrocaSenha.safeParse(req.body);
      if (!r.success) return rep.code(400).send({ erro: r.error.issues[0].message });
      const u = await prisma.usuario.findUniqueOrThrow({ where: { id: req.usuario!.id } });
      if (!(await confereSenha(r.data.atual, u.senhaHash)))
        return rep.code(400).send({ erro: 'A senha atual não confere.' });
      await prisma.usuario.update({
        where: { id: u.id },
        data: { senhaHash: await hashSenha(r.data.nova), senhaTeste: u.personaLetra ? r.data.nova : null },
      });
      return { ok: true };
    },
  );

  /** Quem está logado, o menu dela e as chaves de acesso liberadas. Sem sessão, devolve usuario: null (sem 401, para a tela de login não sujar o console). */
  /** Voltar ao portal: encerra o Acessar como (aluno ou professor) e devolve a tela de onde saiu */
  app.post('/auth/como-voltar', async (req, rep) => {
    const u = req.usuario;
    if (!u) return rep.code(401).send({ erro: 'Sessão expirada. Entre de novo.' });
    const volta = u.como?.volta ?? '/inicio';
    await prisma.sessao.update({
      where: { id: u.sessaoId },
      data: { comoAlunoId: null, comoProfId: null, comoVolta: null },
    });
    return { ir: volta };
  });

  app.get('/auth/me', async (req) => {
    const u = req.usuario;
    if (!u) return { usuario: null, nav: [], chaves: [] };
    const perfil = PERFIS.find((p) => p.id === u.perfilId) ?? null;
    return {
      usuario: {
        id: u.id,
        nome: u.nome,
        email: u.email,
        papel: perfil ? perfil.cargo || perfil.perfil : '—',
        perfil: perfilNome(perfil),
        tipoPerfil: u.tipoPerfil,
        nivel: u.nivel,
        nivelNome: nivelDe(u.nivel)?.nome ?? '',
        resumo: acessoResumo(u, perfil),
        ehAluno: u.ehAluno,
        alunoId: u.alunoId,
        temAluno: u.temAluno,
        persona: u.personaLetra,
        agendaPresa: u.agendaPresa,
        como: u.como,
      },
      nav: navDe(u),
      chaves: chavesDe(u),
    };
  });
}
