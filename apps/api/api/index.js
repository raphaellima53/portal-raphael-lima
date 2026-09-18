/* Entrada da API na Vercel (função Node): monta o Fastify uma vez por instância
   e repassa cada requisição ao servidor dele. Local e em CI a API sobe por src/server.ts. */
const pronto = import('../dist/app.js')
  .then(({ montaApp }) => montaApp())
  .then(async (app) => {
    await app.ready();
    return app;
  })
  .catch((erro) => {
    /* aparece nos Runtime Logs (ex.: variável de ambiente faltando) */
    console.error('Falha ao montar a API:', erro);
    throw erro;
  });

export default async function handler(req, res) {
  const app = await pronto;
  app.server.emit('request', req, res);
}
