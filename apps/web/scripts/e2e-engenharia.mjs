// Engenharia no navegador (Edge instalado). Uso: node scripts/e2e-engenharia.mjs   (API e web rodando, banco com seed)
// Este é o único e2e que depende da internet: lista e clona um repositório público do GitHub.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const BASE = process.env.WEB_URL ?? 'http://localhost:3000';
const DONO = process.env.GH_DONO ?? 'raphaellima53';
const REPO = process.env.GH_REPO ?? 'portal-raphael-lima';
const nav = await chromium.launch({ channel: 'msedge', headless: true });
const erros = [];
let ok = 0;
const passo = async (nome, f) => {
  try {
    await f();
    ok++;
    console.log('ok  ', nome);
  } catch (e) {
    console.log('ERRO', nome, '→', e.message.split('\n').slice(0, 4).join(' / '));
    process.exitCode = 1;
  }
};
async function entra(login, senha) {
  const ctx = await nav.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push(e.message));
  await pg.goto(`${BASE}/login`);
  await pg.fill('#lgLogin', login);
  await pg.fill('#lgSenha', senha);
  await pg.click('button[type=submit]');
  await pg.waitForURL((u) => !u.pathname.startsWith('/login'));
  return pg;
}
const dialogo = (pg) => pg.getByRole('dialog');
const pg = await entra('admin@alumni.teste', 'alumni-admin');

await passo('repositórios: a tela explica os 16 critérios antes de qualquer busca', async () => {
  await pg.goto(`${BASE}/engenharia/engRepos`);
  await pg.getByRole('heading', { name: 'Repositórios' }).waitFor();
  await pg.getByText('Escreva o usuário ou a organização do GitHub').waitFor();
  assert.equal(await pg.getByRole('table', { name: 'Critérios de saúde' }).locator('tbody tr').count(), 16);
});

await passo(`github: lista os repositórios de ${DONO} e analisa ${REPO}`, async () => {
  await pg.goto(`${BASE}/engenharia/engRepos`);
  await pg.getByLabel('Dono no GitHub').fill(DONO);
  await pg.getByRole('button', { name: 'Buscar repositórios' }).click();
  const linha = pg.getByRole('row', { name: new RegExp(REPO) });
  await linha.waitFor({ timeout: 60_000 });
  await linha.getByRole('button', { name: `Analisar ${REPO}` }).click();
  /* clone e leitura dos 16 critérios levam alguns segundos */
  await pg.getByText(new RegExp(`${REPO}: nota \\d+ de 100`)).waitFor({ timeout: 180_000 });
  const d = dialogo(pg);
  await d.getByText(/critérios ok/).waitFor();
  assert.equal(await d.getByRole('table', { name: 'Critérios avaliados' }).locator('tbody tr').count(), 16);
  await d.getByText('Sem segredo no código').waitFor();
  await d.getByRole('button', { name: 'Fechar' }).last().click();
  await pg.getByRole('button', { name: `Ver os critérios de ${REPO}` }).waitFor();
});

await passo('ia: três provedores e, sem chave, a resposta diz o que falta no .env', async () => {
  await pg.goto(`${BASE}/engenharia/engIA`);
  for (const nome of ['Anthropic', 'OpenAI', 'Google Gemini'])
    await pg.getByText(nome, { exact: true }).first().waitFor();
  await pg.getByRole('button', { name: 'Perguntar' }).click();
  await pg.getByText('Escreva a pergunta.').waitFor();
  await pg.getByLabel('Pergunta').fill('Em uma frase: o que é um portal acadêmico?');
  await pg.getByRole('button', { name: 'Perguntar' }).click();
  await pg.getByText(/ANTHROPIC_API_KEY|Anthropic respondeu/).waitFor({ timeout: 90_000 });
});

await passo('só Admin: a Coordenadora não vê Engenharia', async () => {
  const f = await entra('persona.f@alumni.teste', 'alumni-f');
  await f.goto(`${BASE}/inicio`);
  assert.equal(await f.getByRole('link', { name: 'Engenharia' }).count(), 0);
  await f.goto(`${BASE}/engenharia/engRepos`);
  await f.getByText('Sem acesso a esta tela').waitFor();
});

if (erros.length) {
  console.log('erros de página:', [...new Set(erros)].join(' | '));
  process.exitCode = 1;
}
console.log(`${ok} passos ok`);
await nav.close();
