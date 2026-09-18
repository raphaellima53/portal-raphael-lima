/* Entrada da API na Vercel (função Node): monta o Fastify uma vez por instância
   e repassa cada requisição ao servidor dele. Local e em CI a API sobe por src/server.ts. */
import { montaApp } from '../dist/app.js';

const pronto = montaApp().then(async (app) => {
  await app.ready();
  return app;
});

export default async function handler(req, res) {
  const app = await pronto;
  app.server.emit('request', req, res);
}
