// Empresas no navegador (Edge instalado). Uso: node scripts/e2e-empresas.mjs   (API e web rodando, banco com seed)
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
const dialogo = (pg) => pg.getByRole('dialog');
const pg = await entra('admin@alumni.teste', 'alumni-admin');

await passo('lista: vence antes primeiro, aviso de renovação e filtro Ver renovações', async () => {
  await pg.goto(`${BASE}/empresas`);
  await pg.getByRole('link', { name: 'Nordeste Energia' }).waitFor();
  const primeira = await pg.locator('main tbody tr').first().innerText();
  assert.match(primeira, /Nordeste Energia/);
  await pg.getByText(/contratos vencem em até 60 dias/).waitFor();
  await pg.getByRole('button', { name: 'Ver renovações' }).click();
  await pg.waitForTimeout(200);
  assert.equal(await pg.locator('main tbody tr').count(), 2);
});

await passo('Gerente B2B abre em Minhas contas', async () => {
  const s = await entra('persona.s@alumni.teste', 'alumni-s');
  await s.goto(`${BASE}/empresas`);
  await s.getByRole('combobox', { name: 'Gerente da conta' }).getByText('Minhas contas').waitFor();
  const linhas = await s.locator('main tbody tr td:nth-child(2)').allInnerTexts();
  assert.ok(linhas.length > 0 && linhas.every((t) => t === 'Sílvia Monteiro'));
});

await passo('ficha: Visão geral com contrato e a FAAP mostra Turmas', async () => {
  await pg.goto(`${BASE}/empresas`);
  await pg.getByRole('link', { name: 'Grupo Marlin' }).click();
  await pg.waitForURL(/\/empresas\/e2\/geral$/);
  await pg.getByText('a empresa paga 50% e o colaborador 50% · 15% de desconto').waitFor();
  await pg.goto(`${BASE}/empresas/e8/alunos`);
  await pg.getByRole('tab', { name: 'Turmas' }).waitFor();
  await pg.getByText('Turmas dedicadas de FAAP').waitFor();
});

await passo('nova empresa leva à aba Alunos; vincular e desvincular aluno', async () => {
  await pg.goto(`${BASE}/empresas`);
  await pg.getByRole('button', { name: 'Nova empresa' }).click();
  const d = dialogo(pg);
  await d.getByRole('button', { name: 'Criar empresa' }).click();
  await d.getByText('Dê o nome da empresa.').waitFor();
  await d.getByRole('textbox', { name: /^Nome/ }).fill('Empresa e2e');
  await d.getByRole('combobox', { name: 'Modelo' }).click();
  await pg.getByRole('option', { name: /B2B2C/ }).click();
  await d.getByRole('spinbutton', { name: /Subsídio/ }).fill('40');
  await d.getByRole('button', { name: 'Community live classes' }).click();
  await d.getByRole('button', { name: 'Criar empresa' }).click();
  await pg.waitForURL(/\/empresas\/e\d+\/alunos/);
  await pg.getByText('Empresa e2e criada. Vincule os alunos na aba Alunos.').waitFor();
  await pg.getByRole('combobox', { name: 'Aluno sem empresa' }).click();
  const opcao = pg.getByRole('option').nth(1);
  const nome = (await opcao.innerText()).split(' · ')[0];
  await opcao.click();
  await pg.getByRole('button', { name: 'Vincular à empresa' }).click();
  await pg.getByText(`${nome} agora é aluno de Empresa e2e.`).waitFor();
  await pg.getByRole('cell', { name: 'Empresa 40% · aluno 60%' }).waitFor();
  await pg.getByRole('button', { name: 'Desvincular' }).click();
  await pg.getByText(`${nome} saiu de Empresa e2e e passa a B2C.`).waitFor();
});

await passo('renovar contrato e o histórico registra', async () => {
  await pg.getByRole('button', { name: 'Renovar contrato' }).click();
  const d = dialogo(pg);
  await d.getByRole('button', { name: 'Renovar' }).click();
  await pg.getByText(/^Contrato renovado até \d{2}\/\d{2}\/\d{4}\.$/).waitFor();
  await pg.getByRole('tab', { name: 'Histórico' }).click();
  await pg.getByRole('cell', { name: 'Contrato renovado' }).waitFor();
  await pg.getByRole('cell', { name: 'Aluno desvinculado' }).waitFor();
  await pg.getByRole('cell', { name: 'Contrato assinado' }).waitFor();
});

await passo('editar empresa chega com os dados e salva', async () => {
  await pg.goto(`${BASE}/empresas/e1/geral`);
  await pg.getByRole('button', { name: 'Editar empresa' }).click();
  const d = dialogo(pg);
  await pg.waitForTimeout(800);
  assert.equal(await d.getByRole('textbox', { name: /^Nome/ }).inputValue(), 'Vetora Tecnologia');
  assert.equal(await d.getByRole('combobox', { name: 'Gerente da conta' }).innerText(), 'Sílvia Monteiro');
  await d.getByRole('button', { name: 'Salvar empresa' }).click();
  await pg.getByText('Empresa salva.').waitFor();
});

await passo('Colaborador só lê: sem Nova empresa nem ações da conta', async () => {
  const q = await entra('persona.q@alumni.teste', 'alumni-q');
  await q.goto(`${BASE}/empresas/e1/geral`);
  await q.getByRole('heading', { name: 'Vetora Tecnologia' }).waitFor();
  assert.equal(await q.getByRole('button', { name: 'Renovar contrato' }).count(), 0);
  await q.goto(`${BASE}/empresas`);
  await q.getByRole('link', { name: 'Vetora Tecnologia' }).waitFor();
  assert.equal(await q.getByRole('button', { name: 'Nova empresa' }).count(), 0);
});

await passo('Professora não entra em Empresas', async () => {
  const i = await entra('persona.i@alumni.teste', 'alumni-i');
  await i.goto(`${BASE}/empresas`);
  await i.getByText('Sem acesso a esta tela.').waitFor();
});

if (erros.length) {
  console.log('erros de página:', [...new Set(erros)].join(' | '));
  process.exitCode = 1;
}
console.log(`${ok} passos ok`);
await nav.close();
