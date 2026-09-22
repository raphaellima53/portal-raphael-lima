// Capturas de tela do portal rodando (usa o Edge instalado; não baixa navegador).
// Uso: node scripts/capturas.mjs <saida> <larguraxaltura> <login|-> <rota> [rota…]
// Rotas com "!" rodam uma ação antes da captura: "inicio!personalizar", "inicio!conta", "inicio!alertas", "inicio!ajuda", "inicio!mini",
// "rota!botao:Novo serviço" (clica no botão com esse nome).
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const [saida, tam, login, ...rotas] = process.argv.slice(2);
const [w, h] = tam.split('x').map(Number);
const BASE = process.env.WEB_URL ?? 'http://localhost:3000';
mkdirSync(saida, { recursive: true });

const navegador = await chromium.launch({ channel: 'msedge', headless: true });
const ctx = await navegador.newContext({
  viewport: { width: w, height: h },
  locale: 'pt-BR',
  timezoneId: 'America/Sao_Paulo',
});
const pg = await ctx.newPage();
const erros = [];
pg.on('console', (m) => m.type() === 'error' && erros.push(m.text()));
pg.on('pageerror', (e) => erros.push(e.message));

if (login && login !== '-') {
  const senha = login === 'admin' ? 'alumni-admin' : `alumni-${login}`;
  const email = login === 'admin' ? 'admin@alumni.teste' : `persona.${login}@alumni.teste`;
  await pg.goto(`${BASE}/login`);
  await pg.fill('#lgLogin', email);
  await pg.fill('#lgSenha', senha);
  await pg.click('button[type=submit]');
  await pg.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
}

for (const r of rotas) {
  const [rota, acao] = r.split('!');
  await pg.goto(`${BASE}/${rota}`);
  await pg.waitForLoadState('networkidle');
  await pg.waitForTimeout(600);
  if (acao === 'personalizar') await pg.getByRole('button', { name: /Personalizar/ }).click();
  if (acao === 'conta') await pg.getByRole('button', { name: 'Opções da conta' }).click();
  if (acao === 'alertas')
    await pg
      .getByRole('button', { name: /^Alertas/ })
      .first()
      .click();
  if (acao === 'ajuda') await pg.keyboard.press('?');
  if (acao === 'mini') await pg.keyboard.press('[');
  if (acao === 'aula') await pg.locator('main button[style*=background]').nth(3).click();
  if (acao === 'evento')
    await pg
      .getByRole('button', { name: /Reunião pedagógica|Alinhamento/ })
      .first()
      .click();
  if (acao === 'novoevento') await pg.getByRole('button', { name: 'Novo evento' }).click();
  if (acao === 'gaveta') await pg.getByRole('button', { name: 'Abrir menu' }).click();
  /* botao:<nome> clica no primeiro botão com esse nome (abre formulários) */
  if (acao?.startsWith('botao:'))
    await pg
      .getByRole('button', { name: acao.slice(6) })
      .first()
      .click();
  if (acao) await pg.waitForTimeout(1200);
  const arq = join(saida, `${login}-${w}-${r.replace(/[^a-z0-9]+/gi, '_')}.png`);
  await pg.screenshot({ path: arq });
  const larg = await pg.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  console.log('png', arq, larg[0] > larg[1] ? `ROLAGEM HORIZONTAL ${larg[0]}>${larg[1]}` : '');
}
if (erros.length) console.log(`ERROS NO CONSOLE:\n${[...new Set(erros)].join('\n')}`);
await navegador.close();
