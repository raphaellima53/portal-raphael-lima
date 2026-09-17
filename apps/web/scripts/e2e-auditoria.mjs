// Auditoria no navegador (Edge instalado). Uso: node scripts/e2e-auditoria.mjs   (API e web rodando, banco com seed)
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const BASE = process.env.WEB_URL ?? 'http://localhost:3000';
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
const pg = await entra('admin@alumni.teste', 'alumni-admin');

await passo('histórico da base aparece com data e hora completas', async () => {
  await pg.goto(`${BASE}/auditoria`);
  await pg.getByRole('cell', { name: 'Feriados nacionais 2026' }).waitFor();
  await pg.getByRole('cell', { name: '11/08/2026 09:56:00' }).waitFor();
});

await passo('desativar um professor entra na auditoria e a linha abre o log da ficha', async () => {
  await pg.goto(`${BASE}/professores`);
  await pg.getByRole('button', { name: 'Ações de Letícia Vasques' }).click();
  await pg.getByRole('menuitem', { name: 'Desativar' }).click();
  await pg.getByText(/Letícia Vasques desativado/).waitFor();
  await pg.goto(`${BASE}/auditoria`);
  await pg.getByRole('combobox', { name: 'Entidade' }).click();
  await pg.getByRole('option', { name: 'Professor' }).click();
  await pg.getByRole('cell', { name: 'Professor desativado' }).first().waitFor();
  await pg.getByRole('link', { name: 'Letícia Vasques' }).first().click();
  await pg.waitForURL(/\/professores\/p\d+\/log$/);
  await pg.getByRole('cell', { name: 'Professor desativado' }).waitFor();
});

await passo('busca filtra e mostra a contagem', async () => {
  await pg.goto(`${BASE}/auditoria`);
  await pg.getByRole('searchbox', { name: 'Buscar na auditoria' }).fill('feriados');
  await pg.getByText('1 registro', { exact: true }).waitFor();
});

await passo('só o Administrador entra', async () => {
  const f = await entra('persona.f@alumni.teste', 'alumni-f');
  await f.goto(`${BASE}/auditoria`);
  await f.getByText('Sem acesso a esta tela').first().waitFor();
  assert.equal(await f.getByRole('link', { name: 'Auditoria' }).count(), 0);
});

if (erros.length) {
  console.log('erros de página:', [...new Set(erros)].join(' | '));
  process.exitCode = 1;
}
console.log(`${ok} passos ok`);
await nav.close();
