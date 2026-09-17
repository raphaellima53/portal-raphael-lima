// Ações no navegador (Edge instalado). Uso: node scripts/e2e-acoes.mjs   (API e web rodando, banco com seed)
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

await passo('alertas: os 6 do Admin, e Competência aberta leva ao Fechamento', async () => {
  await pg.goto(`${BASE}/inicio`);
  await pg
    .getByRole('button', { name: /Alertas/ })
    .first()
    .click();
  await pg.getByText('Pendências de alocação').waitFor();
  await pg.getByText('Atendimentos abertos').waitFor();
  await pg.getByText('Propostas paradas').waitFor();
  await pg.getByText('Competência aberta').click();
  await pg.waitForURL(/\/acoes\/acFechamento/);
  await pg.getByRole('heading', { name: 'Fechamento' }).waitFor();
});

await passo('alocação: pendência leva à ficha do aluno', async () => {
  await pg.goto(`${BASE}/acoes/acAlocacao`);
  await pg.getByRole('link', { name: 'ver alocação' }).click();
  await pg.waitForURL(/\/alunos\/\d+\/cursos/);
});

await passo('fechamento: fechar, ver as aulas do professor e reabrir', async () => {
  await pg.goto(`${BASE}/acoes/acFechamento`);
  await pg.getByText('Pronta para fechar').waitFor();
  await pg.getByRole('button', { name: 'Fechar competência' }).click();
  await pg.getByText(/fechada: \d+ aulas pagas/).waitFor();
  await pg.getByText('Fechada', { exact: true }).waitFor();
  await pg
    .getByRole('row', { name: /Camila Bernardes/ })
    .getByRole('button', { name: 'Ver aulas' })
    .click();
  await dialogo(pg)
    .getByText(/Aulas de Camila Bernardes/)
    .waitFor();
  assert.ok((await dialogo(pg).locator('tbody tr').count()) > 10);
  await dialogo(pg).getByRole('button', { name: 'Fechar' }).last().click();
  await pg.getByRole('button', { name: 'Reabrir competência' }).click();
  await pg.getByText(/reaberta\./).waitFor();
});

await passo('funil: avançar, perder com motivo e reabrir', async () => {
  await pg.goto(`${BASE}/acoes/acFunil`);
  const col = pg.getByRole('region', { name: 'Captado' });
  const card = col.locator('article').first();
  const nome = await card.locator('b').innerText();
  await card.getByRole('button', { name: 'Avançar' }).click();
  await pg.getByText(`${nome} passou para Contato feito.`).waitFor();
  const card2 = pg.getByRole('region', { name: 'Contato feito' }).locator('article', { hasText: nome });
  await card2.getByRole('button', { name: 'Perder' }).click();
  await dialogo(pg).getByRole('button', { name: 'Marcar como perdido' }).click();
  await dialogo(pg).getByText('Escolha o motivo.').waitFor();
  await dialogo(pg).getByRole('combobox', { name: 'Motivo' }).click();
  await pg.getByRole('option', { name: 'Horário' }).click();
  await dialogo(pg).getByRole('button', { name: 'Marcar como perdido' }).click();
  await pg.getByText(`${nome} saiu do funil: horário.`).waitFor();
  await pg
    .getByRole('region', { name: 'Perdido' })
    .locator('article', { hasText: nome })
    .getByRole('button', { name: 'Reabrir' })
    .click();
  await pg.getByText(`${nome} voltou para Contato feito.`).waitFor();
});

await passo('atendimentos: iniciar tratativa tira da lista de abertos', async () => {
  await pg.goto(`${BASE}/acoes/acAtendimentos`);
  await pg.getByRole('radio', { name: /Aberto · 9/ }).waitFor();
  await pg.getByRole('button', { name: 'Iniciar tratativa' }).first().click();
  await pg.getByText(/agora está em tratativa/).waitFor();
  await pg.getByRole('radio', { name: /Aberto · 8/ }).waitFor();
});

await passo('admissão: Helena vai para Ativo e aparece em Professores', async () => {
  await pg.goto(`${BASE}/acoes/acAdmissao`);
  const card = pg.getByRole('region', { name: 'Documentação' }).locator('article', { hasText: 'Helena Duarte' });
  await card.getByRole('button', { name: 'Ativo' }).click();
  await pg.getByText('Helena Duarte: Ativo. Helena Duarte criado em Professores.').waitFor();
  await pg.goto(`${BASE}/professores`);
  await pg.getByRole('link', { name: 'Helena Duarte' }).waitFor();
});

await passo('substituição: exigência abre o formulário; com substituto confirma', async () => {
  await pg.goto(`${BASE}/acoes/acSubstituicao`);
  const card = pg.getByRole('region', { name: 'Buscando substituto' }).locator('article').first();
  await card.getByRole('button', { name: 'Confirmado' }).click();
  const d = dialogo(pg);
  await d.getByText('Para Confirmado, preencha: Substituto.').waitFor();
  await d.getByRole('combobox', { name: 'Substituto' }).click();
  const opcao = pg.getByRole('option').nth(1);
  const subst = await opcao.innerText();
  await opcao.click();
  await d.getByRole('button', { name: /^Confirmado/ }).click();
  await pg.getByText(new RegExp(`${subst} assume a aula na agenda\\.`)).waitFor();
});

await passo('campanhas: nova campanha entra em Ideia; lista mostra a etapa', async () => {
  await pg.goto(`${BASE}/acoes/acCampanhas`);
  await pg.getByRole('button', { name: 'Nova campanha' }).click();
  const d = dialogo(pg);
  await d.getByRole('button', { name: 'Criar' }).click();
  await d.getByText('Preencha: Nome.').waitFor();
  await d.getByRole('textbox', { name: /Nome/ }).fill('Campanha e2e');
  await d.getByRole('button', { name: 'Criar' }).click();
  await pg.getByText('Campanha e2e entrou em Ideia.').waitFor();
  await pg.getByRole('radio', { name: 'Lista' }).click();
  await pg.getByRole('row', { name: /Campanha e2e.*Ideia/ }).waitFor();
});

await passo('Gerente comercial vê só Comercial em Ações', async () => {
  const l = await entra('persona.l@alumni.teste', 'alumni-l');
  await l.goto(`${BASE}/acoes/acFunil`);
  await l.getByRole('heading', { name: 'Funil de vendas' }).waitFor();
  assert.equal(await l.getByRole('tab', { name: 'Pedagógico' }).count(), 0);
  await l.goto(`${BASE}/acoes/acAlocacao`);
  await l.getByText('Sem acesso a esta tela').waitFor();
});

if (erros.length) {
  console.log('erros de página:', [...new Set(erros)].join(' | '));
  process.exitCode = 1;
}
console.log(`${ok} passos ok`);
await nav.close();
