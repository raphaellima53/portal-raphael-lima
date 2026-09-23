import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { carregaModelo } from './domain/acesso-modelo.ts';
import { env } from './env.ts';
import sessao from './plugins/sessao.ts';
import rotasAcoes from './routes/acoes.ts';
import rotasAgenda from './routes/agenda.ts';
import rotasAlunos from './routes/alunos.ts';
import rotasAtividades from './routes/atividades.ts';
import rotasAuditoria from './routes/auditoria.ts';
import rotasAuth from './routes/auth.ts';
import rotasCadastros from './routes/cadastros.ts';
import rotasConfigAcessos from './routes/config-acessos.ts';
import rotasConfigRegras from './routes/config-regras.ts';
import rotasCursos from './routes/cursos.ts';
import rotasDeal from './routes/deal.ts';
import rotasEmpresas from './routes/empresas.ts';
import rotasEngenharia from './routes/engenharia.ts';
import rotasInicio from './routes/inicio.ts';
import rotasProfessores from './routes/professores.ts';
import rotasRelatorios from './routes/relatorios.ts';

export async function montaApp() {
  const app = Fastify({
    logger: env.NODE_ENV === 'test' ? false : { level: env.NODE_ENV === 'production' ? 'info' : 'warn' },
    trustProxy: true,
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: env.WEB_ORIGIN.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });
  await app.register(rateLimit, { max: 600, timeWindow: '1 minute' });
  await app.register(cookie, { secret: env.COOKIE_SECRET });
  /* perfis e hierarquias editados em Configurações valem antes da sessão ler o acesso */
  app.addHook('onRequest', async () => {
    await carregaModelo();
  });
  await app.register(sessao);

  app.setErrorHandler((err: Error & { statusCode?: number }, req, rep) => {
    req.log.error(err);
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    rep.code(status).send({ erro: status === 500 ? 'Erro inesperado no servidor.' : err.message });
  });

  app.get('/saude', async () => ({ ok: true }));
  await app.register(rotasAuth);
  await app.register(rotasInicio);
  await app.register(rotasAgenda);
  await app.register(rotasCursos);
  await app.register(rotasAlunos);
  await app.register(rotasEmpresas);
  await app.register(rotasProfessores);
  await app.register(rotasAcoes);
  await app.register(rotasAtividades);
  await app.register(rotasDeal);
  await app.register(rotasAuditoria);
  await app.register(rotasRelatorios);
  await app.register(rotasConfigAcessos);
  await app.register(rotasConfigRegras);
  await app.register(rotasCadastros);
  await app.register(rotasEngenharia);
  return app;
}
