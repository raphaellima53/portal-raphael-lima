// Capturas dos formulários de 24/09/2026 (Novo curso por tipo, Nova oferta, Novo aluno, Novo prestador).
// Uso: node scripts/capturas-formularios.mjs <saida>   (API e web rodando)
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const [saida] = process.argv.slice(2);
const BASE = process.env.WEB_URL ?? 'http://localhost:3000';
mkdirSync(saida, { recursive: true });
const nav = await chromium.launch({ channel: 'msedge', headless: true });
const ctx = await nav.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'pt-BR' });
const pg = await ctx.newPage();
const erros = [];
pg.on('pageerror', (e) => erros.push(e.message));
pg.on('console', (m) => m.type() === 'error' && erros.push(m.text()));
await pg.goto(`${BASE}/login`);
await pg.fill('#lgLogin', 'admin@alumni.teste');
await pg.fill('#lgSenha', 'alumni-admin');
await pg.click('button[type=submit]');
await pg.waitForURL((u) => !u.pathname.startsWith('/login'));
const foto = async (nome) => {
  await pg.waitForTimeout(500);
  await pg.screenshot({ path: join(saida, `${nome}.png`) });
  console.log('png', nome);
};
const dialogo = () => pg.getByRole('dialog');

await pg.goto(`${BASE}/cursos`);
await pg.getByRole('button', { name: 'Novo curso' }).click();
await dialogo().getByRole('button', { name: 'Novo módulo' }).click();
await dialogo().getByRole('button', { name: 'Novo horário' }).click();
await foto('curso-open-entry');
await dialogo().getByRole('button', { name: 'Criar curso' }).click();
await foto('curso-open-entry-erros');
await dialogo().getByRole('radio', { name: 'Grupo Regular' }).click();
await foto('curso-regular');
await dialogo().getByRole('radio', { name: 'Particular' }).click();
await dialogo().getByRole('button', { name: 'Nova alocação' }).click();
await foto('curso-particular');
await pg.keyboard.press('Escape');

await pg.goto(`${BASE}/produtos/dlOfertas`);
await pg.getByRole('button', { name: 'Nova oferta' }).click();
await foto('nova-oferta');
await pg.keyboard.press('Escape');

await pg.goto(`${BASE}/alunos`);
await pg.getByRole('button', { name: 'Novo aluno' }).click();
await pg.locator('#al-tel').fill('11912345678');
await foto('novo-aluno');
await dialogo().getByRole('combobox', { name: 'Oferta' }).click();
await pg.getByRole('option').nth(1).click();
await pg.waitForTimeout(300);
await dialogo().locator('fieldset').nth(1).scrollIntoViewIfNeeded();
await foto('novo-aluno-matricula');
await pg.keyboard.press('Escape');

await pg.goto(`${BASE}/equipe`);
await pg.getByRole('button', { name: 'Novo' }).click();
await foto('time-novo-menu');
await pg.getByRole('menuitem', { name: 'Prestador' }).click();
await foto('novo-prestador');
await pg.keyboard.press('Escape');
await pg.getByRole('button', { name: 'Novo' }).click();
await pg.getByRole('menuitem', { name: 'Professor' }).click();
await foto('novo-professor');

console.log(erros.length ? `ERROS NO CONSOLE:\n${erros.join('\n')}` : 'sem erros no console');
await nav.close();
