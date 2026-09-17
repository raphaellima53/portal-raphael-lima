// Relatórios no navegador (Edge instalado). Uso: node scripts/e2e-relatorios.mjs   (API e web rodando, banco com seed)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
    acceptDownloads: true,
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
const linhas = (pg) => pg.locator('table tbody tr');
const baixa = async (pg) => {
  const [d] = await Promise.all([
    pg.waitForEvent('download'),
    pg.getByRole('button', { name: 'Exportar CSV' }).click(),
  ]);
  return { nome: d.suggestedFilename(), texto: readFileSync(await d.path(), 'utf8') };
};
const pg = await entra('admin@alumni.teste', 'alumni-admin');

await passo('presença: qualidade filtra, CSV sai com o filtro e a linha abre a ficha', async () => {
  await pg.goto(`${BASE}/relatorios/rpPresenca`);
  await pg.getByText('alunos com aula').waitFor();
  const total = Number(await pg.getByText('alunos com aula').locator('..').locator('div').first().innerText());
  await pg.getByRole('combobox', { name: 'Qualidade' }).click();
  await pg.getByRole('option', { name: '2 faltas ou mais no período' }).click();
  await pg.waitForURL(/qual=faltas/);
  await pg.waitForFunction(
    (t) => Number(document.querySelector('main')?.innerText.match(/(\d+)\nalunos com aula/)?.[1]) < t,
    total,
  );
  const csv = await baixa(pg);
  assert.equal(csv.nome, 'presenca-por-aluno-faltas.csv');
  assert.ok(csv.texto.startsWith('﻿"Aluno";"Cursos";"Aulas dadas"'));
  await linhas(pg).first().getByRole('link').click();
  await pg.waitForURL(/\/alunos\/\d+\/agendamentos\?quando=passadas/);
});

await passo('aulas por curso: por módulo ou turma ganha a coluna', async () => {
  await pg.goto(`${BASE}/relatorios/rpAulas`);
  await pg.getByRole('columnheader', { name: 'Aulas no período' }).waitFor();
  assert.equal(await pg.getByRole('columnheader', { name: 'Módulo ou turma' }).count(), 0);
  await pg.getByRole('radio', { name: 'por módulo ou turma' }).click();
  await pg.getByRole('columnheader', { name: 'Módulo ou turma' }).waitFor();
});

await passo('seletores: incluir coluna, trocar perspectiva e exportar', async () => {
  await pg.goto(`${BASE}/relatorios/relatorio`);
  await pg.getByRole('columnheader', { name: 'Produto' }).waitFor();
  await pg.getByRole('button', { name: 'E-mail', exact: true }).click();
  await pg.getByRole('columnheader', { name: 'E-mail' }).waitFor();
  await pg.getByRole('radio', { name: 'Cursos' }).click();
  await pg.getByRole('columnheader', { name: 'Estrutura' }).waitFor();
  assert.equal(await linhas(pg).count(), 5);
  const csv = await baixa(pg);
  assert.equal(csv.nome, 'relatorio-curso.csv');
  /* a coluna escolhida em Alunos continua lá ao voltar */
  await pg.getByRole('radio', { name: 'Alunos' }).click();
  await pg.getByRole('columnheader', { name: 'E-mail' }).waitFor();
});

await passo('financeiro: clicar no mês abre a competência; registrar pagamento baixa a parcela', async () => {
  await pg.goto(`${BASE}/relatorios/rpFinanceiro`);
  await pg.getByText('receita reconhecida', { exact: true }).waitFor();
  const ant = pg.getByRole('button', { name: /^Ver / }).nth(4);
  const nome = (await ant.getAttribute('aria-label')).replace('Ver ', '');
  await ant.click();
  await pg.waitForURL(/mes=\d{4}-\d{2}/);
  await pg.getByText(`${nome} · mês completo`, { exact: false }).waitFor();
  await pg.goto(`${BASE}/relatorios/rpFinanceiro`);
  const seg = pg.getByRole('radio', { name: /^Vencidas · \d+/ });
  const n = Number((await seg.innerText()).match(/\d+/)[0]);
  await pg.getByRole('button', { name: 'Registrar pagamento' }).first().click();
  await pg.getByText(/registrada como paga: R\$/).waitFor();
  await pg.getByRole('radio', { name: `Vencidas · ${n - 1}` }).waitFor();
});

await passo('Gerente comercial: seletores sem Professores e sem acesso ao Financeiro', async () => {
  const l = await entra('persona.l@alumni.teste', 'alumni-l');
  await l.goto(`${BASE}/relatorios/relatorio`);
  await l.getByRole('radio', { name: 'Cursos' }).waitFor();
  assert.equal(await l.getByRole('radio', { name: 'Professores' }).count(), 0);
  assert.equal(await l.getByRole('tab', { name: 'Financeiro' }).count(), 0);
  await l.goto(`${BASE}/relatorios/rpFinanceiro`);
  await l.getByText('Sem acesso a esta tela').waitFor();
});

if (erros.length) {
  console.log('erros de página:', [...new Set(erros)].join(' | '));
  process.exitCode = 1;
}
console.log(`${ok} passos ok`);
await nav.close();
