// Fluxo da base no navegador (Edge instalado): login pelo "usar", Dashboard, Personalizar e salvar, alertas, sair.
// Uso: node scripts/e2e-base.mjs   (API e web rodando)
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const BASE = process.env.WEB_URL ?? 'http://localhost:3000';
const nav = await chromium.launch({ channel: 'msedge', headless: true });
const pg = await (await nav.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' })).newPage();
const erros = [];
pg.on('pageerror', (e) => erros.push(e.message));
const passo = async (nome, f) => {
  try {
    await f();
    console.log('ok  ', nome);
  } catch (e) {
    console.log('ERRO', nome, '→', e.message.split('\n')[0]);
    process.exitCode = 1;
  }
};

await passo('rota protegida leva ao login', async () => {
  await pg.goto(`${BASE}/inicio`);
  await pg.waitForURL(/\/login\?volta=%2Finicio/);
});

await passo('login errado mostra a mensagem do portal', async () => {
  await pg.fill('#lgLogin', 'persona.f@alumni.teste');
  await pg.fill('#lgSenha', 'errada');
  await pg.click('button[type=submit]');
  await pg.getByText('Login ou senha incorretos. Confira na lista ao lado.').waitFor();
});

await passo('"usar" da persona F entra direto e volta para a tela pedida', async () => {
  await pg.getByRole('button', { name: 'Entrar como Juliana Prado' }).click();
  await pg.waitForURL(/\/inicio$/);
  await pg.getByRole('heading', { name: 'Dashboard' }).waitFor();
  const menu = await pg.locator('nav[aria-label="Menu principal"] a').allInnerTexts();
  assert.deepEqual(menu, ['Início', 'Agenda', 'Cursos', 'Alunos', 'Professores', 'Ações', 'Relatórios']);
});

await passo('Personalizar: desmarcar um grupo e salvar muda os blocos', async () => {
  await pg.getByRole('button', { name: /Personalizar · 8 de 13 blocos/ }).click();
  await pg.getByRole('button', { name: 'desmarcar' }).nth(1).click();
  await pg.getByText('alterações não salvas').waitFor();
  await pg.getByRole('button', { name: 'Salvar configuração' }).click();
  await pg.getByText(/Configuração salva: \d+ blocos/).waitFor();
  assert.equal(await pg.locator('[data-k="situacao"]').count(), 0);
  await pg.getByRole('button', { name: /Personalizar/ }).click();
  await pg.getByRole('button', { name: 'Restaurar padrão' }).click();
  await pg.getByRole('button', { name: 'Salvar configuração' }).click();
  await pg.locator('[data-k="situacao"]').waitFor();
});

await passo('alertas abrem e levam à agenda filtrada', async () => {
  await pg.getByRole('button', { name: /^Alertas: \d+ avisos?$/ }).click();
  await pg.getByRole('button', { name: /Aulas sem professor/ }).click();
  await pg.waitForURL(/\/agenda\?vista=kanban/);
});

await passo('Configurações sem acesso para o Gestor pedagógico', async () => {
  await pg.goto(`${BASE}/configuracoes/usuarios`);
  await pg.getByRole('heading', { name: 'Sem acesso a esta tela' }).waitFor();
});

await passo('? abre a ajuda e [ minimiza o menu', async () => {
  await pg.goto(`${BASE}/inicio`);
  await pg.getByRole('heading', { name: 'Dashboard' }).waitFor();
  await pg.keyboard.press('?');
  await pg.getByRole('dialog', { name: 'Ajuda e atalhos' }).waitFor();
  await pg.keyboard.press('Escape');
  await pg.keyboard.press('[');
  await pg.getByRole('button', { name: 'Expandir menu' }).waitFor();
  await pg.keyboard.press('[');
});

await passo('sair volta ao login e fecha a sessão', async () => {
  await pg.getByRole('button', { name: 'Opções da conta' }).click();
  await pg.getByRole('menuitem', { name: 'Sair' }).click();
  await pg.waitForURL(/\/login/);
  await pg.goto(`${BASE}/inicio`);
  await pg.waitForURL(/\/login/);
});

if (erros.length) {
  console.log('ERROS DE PÁGINA:', erros);
  process.exitCode = 1;
}
await nav.close();
