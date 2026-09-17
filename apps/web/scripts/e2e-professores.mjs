// Professores no navegador (Edge instalado). Uso: node scripts/e2e-professores.mjs   (API e web rodando, banco com seed)
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

await passo('lista: 9 ativos, busca e filtro de curso', async () => {
  await pg.goto(`${BASE}/professores`);
  await pg.getByText('9 professores').waitFor();
  await pg.getByRole('searchbox', { name: 'Buscar professor' }).fill('lorenzi');
  await pg.getByText('1 professor', { exact: true }).waitFor();
  await pg.getByRole('searchbox', { name: 'Buscar professor' }).fill('');
  await pg.getByRole('combobox', { name: 'Curso' }).click();
  await pg.getByRole('option', { name: 'FAAP' }).click();
  await pg.waitForTimeout(200);
  const cursos = await pg.locator('main tbody tr td:nth-child(3)').allInnerTexts();
  assert.ok(cursos.length > 0 && cursos.every((t) => t.includes('FAAP')));
});

await passo('ficha: abas em dois níveis e Perfil com escala', async () => {
  await pg.goto(`${BASE}/professores`);
  await pg.getByRole('link', { name: 'Ana Beatriz Lorenzi' }).click();
  await pg.waitForURL(/\/professores\/p1\/perfil$/);
  await pg.getByText('Cursos e avaliação').waitFor();
  await pg.getByRole('tab', { name: 'Histórico' }).click();
  await pg.waitForURL(/\/professores\/p1\/agenda$/);
  await pg.getByRole('radio', { name: 'Passadas' }).click();
  await pg.getByText('aulas dadas').waitFor();
});

await passo('habilitação: titular não sai e recortar módulo mostra a contagem', async () => {
  await pg.goto(`${BASE}/professores/p1/cursos`);
  await pg.getByRole('switch', { name: 'Habilitado em Palmares Paulista' }).click();
  await pg.getByText(/é titular de Turma 1, Turma 4, Turma 7 em Palmares Paulista/).waitFor();
  await pg.getByRole('button', { name: 'Apex 3', exact: true }).click();
  await pg.getByText(/habilitado em 12 de 13 módulos/).waitFor();
  await pg.getByRole('button', { name: 'Apex 3', exact: true }).click();
  await pg.getByText(/habilitado em 13 de 13 módulos/).waitFor();
});

await passo('disponibilidade: a hora inteira em todos os dias', async () => {
  await pg.goto(`${BASE}/professores/p2/disponibilidade`);
  await pg.getByText('Disponibilidade semanal').waitFor();
  const valor = () =>
    pg.locator('main').getByText('horas disponíveis por semana').locator('xpath=..').locator('div').first().innerText();
  const antes = Number(await valor());
  await pg.getByRole('button', { name: 'Marcar ou desmarcar 21:00 em todos os dias' }).click();
  await pg.waitForFunction(
    (n) => [...document.querySelectorAll('main div')].some((d) => d.textContent === String(n)),
    antes + 6,
  );
  await pg.getByRole('button', { name: 'Marcar ou desmarcar 21:00 em todos os dias' }).click();
  await pg.waitForFunction(
    (n) => [...document.querySelectorAll('main div')].some((d) => d.textContent === String(n)),
    antes,
  );
});

await passo('feedbacks: registrar avaliação de aluno', async () => {
  await pg.goto(`${BASE}/professores/p1/feedbacks`);
  await pg.getByText('Média por curso').waitFor();
  await pg.getByRole('button', { name: 'Novo feedback' }).click();
  const d = dialogo(pg);
  await d.getByRole('button', { name: 'Registrar avaliação' }).click();
  await d.getByText('Escolha o aluno.').waitFor();
  await d.getByRole('combobox', { name: 'Aluno' }).click();
  const opcao = pg.getByRole('option').nth(1);
  const nome = await opcao.innerText();
  await opcao.click();
  await d.getByRole('combobox', { name: 'Nota' }).click();
  await pg.getByRole('option', { name: '5 — excelente' }).click();
  await d.getByRole('button', { name: 'Registrar avaliação' }).click();
  await pg.getByText(`Avaliação de ${nome} registrada: nota 5.`).waitFor();
  await pg.getByText('registrada no portal').first().waitFor();
});

await passo('novo professor vai para Cursos; editar chega com os dados', async () => {
  await pg.goto(`${BASE}/professores`);
  await pg.getByRole('button', { name: 'Novo professor' }).click();
  const d = dialogo(pg);
  await d.getByRole('textbox', { name: /Nome completo/ }).fill('Professor e2e');
  await d.getByRole('button', { name: 'Alumni Black' }).click();
  await d.getByRole('button', { name: 'Cadastrar' }).click();
  await pg.waitForURL(/\/professores\/p\d+\/cursos$/);
  await pg.getByRole('switch', { name: 'Habilitado em Alumni Black' }).waitFor();
  assert.equal(
    await pg.getByRole('switch', { name: 'Habilitado em Alumni Black' }).getAttribute('aria-checked'),
    'true',
  );
  await pg.getByRole('button', { name: 'Editar dados' }).click();
  await pg.waitForTimeout(700);
  assert.equal(
    await dialogo(pg)
      .getByRole('textbox', { name: /Nome completo/ })
      .inputValue(),
    'Professor e2e',
  );
  await dialogo(pg).getByRole('button', { name: 'Salvar' }).click();
  await pg.getByText('Nada mudou no cadastro.').waitFor();
});

await passo('menu da linha: desativar some da lista de ativos; Acessar como volta', async () => {
  await pg.goto(`${BASE}/professores`);
  await pg.getByRole('button', { name: 'Ações de Professor e2e' }).click();
  await pg.getByRole('menuitem', { name: 'Desativar' }).click();
  await pg.getByText(/Professor e2e desativado/).waitFor();
  await pg.getByRole('link', { name: 'Professor e2e' }).waitFor({ state: 'detached' });
  await pg.getByRole('button', { name: 'Ações de Rafael Contarini' }).click();
  await pg.getByRole('menuitem', { name: 'Acessar como' }).click();
  await pg.waitForURL(/\/inicio/);
  await pg.getByText(/Você está vendo o portal como/).waitFor();
  await pg.getByRole('button', { name: 'Voltar ao portal' }).click();
  await pg.waitForURL(/\/professores$/);
});

await passo('Colaborador pedagógico (G) vê só as abas liberadas da ficha', async () => {
  const i = await entra('persona.g@alumni.teste', 'alumni-g');
  await i.goto(`${BASE}/professores/p1/cursos`);
  await i.waitForURL(/\/professores\/p1\/(perfil|agenda|disponibilidade)$/);
  assert.equal(await i.getByRole('tab', { name: 'Feedbacks' }).count(), 0);
});

if (erros.length) {
  console.log('erros de página:', [...new Set(erros)].join(' | '));
  process.exitCode = 1;
}
console.log(`${ok} passos ok`);
await nav.close();
