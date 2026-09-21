// Menu enxuto (brainstorming de 18/09/2026) no navegador (Edge instalado).
// Uso: node scripts/e2e-menu.mjs   (API e web rodando, banco com seed)
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
    console.log('ERRO', nome, '→', e.message.split('\n')[0]);
    process.exitCode = 1;
  }
};
async function entra(login, senha) {
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push(e.message));
  await pg.goto(`${BASE}/login`);
  await pg.fill('#lgLogin', login);
  await pg.fill('#lgSenha', senha);
  await pg.click('button[type=submit]');
  await pg.waitForURL((u) => !u.pathname.startsWith('/login'));
  return pg;
}
const menu = (pg) => pg.locator('nav[aria-label="Menu principal"] a').allInnerTexts();
const ativo = (pg) => pg.locator('nav[aria-label="Menu principal"] a[aria-current="page"]').innerText();

const adm = await entra('admin@alumni.teste', 'alumni-admin');

await passo('Admin: Início, Agenda, Usuários, Produtos e serviços e Ações', async () => {
  await adm.getByRole('heading', { name: 'Dashboard' }).waitFor();
  assert.deepEqual(await menu(adm), ['Início', 'Agenda', 'Usuários', 'Produtos e serviços', 'Ações']);
});

await passo('Usuários abre Alunos com as abas das pessoas; a ficha mantém o menu aceso', async () => {
  await adm.getByRole('link', { name: 'Usuários' }).click();
  await adm.waitForURL(/\/alunos$/);
  const abas = await adm.getByRole('tablist', { name: 'Seções' }).getByRole('tab').allInnerTexts();
  assert.deepEqual(abas, ['Alunos', 'Equipe', 'Empresas', 'Acessos']);
  await adm.getByRole('tab', { name: 'Acessos' }).click();
  await adm.waitForURL(/\/configuracoes\/usuarios$/);
  await adm.getByRole('heading', { name: 'Contas de acesso' }).or(adm.getByRole('heading', { name: 'Usuários' })).first().waitFor();
  assert.equal(await ativo(adm), 'Usuários');
  await adm.goto(`${BASE}/professores/p1/perfil`);
  await adm.getByText('Cursos e avaliação').waitFor();
  assert.equal(await ativo(adm), 'Usuários');
});

await passo('Equipe: professores e colaboradores numa lista só, em ordem alfabética', async () => {
  await adm.getByRole('link', { name: 'Usuários' }).click();
  await adm.getByRole('tab', { name: 'Equipe' }).click();
  await adm.waitForURL(/\/equipe$/);
  await adm.getByRole('heading', { name: 'Equipe' }).waitFor();
  await adm.getByRole('combobox', { name: 'Itens por página' }).click();
  await adm.getByRole('option', { name: '50' }).click();
  await adm.waitForTimeout(300);
  const linhas = adm.locator('main table[aria-label="Equipe"] tbody tr');
  const nomes = await linhas.locator('td:nth-child(1)').allInnerTexts();
  const tipos = await linhas.locator('td:nth-child(3)').allInnerTexts();
  assert.ok(tipos.includes('Professor') && tipos.includes('Colaborador'), tipos.join());
  const ordem = [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  assert.deepEqual(nomes, ordem);
  await adm.goto(`${BASE}/configuracoes/prestadores`);
  await adm.waitForURL(/\/equipe$/);
});

await passo('Produtos e serviços: catálogo, currículos e serviços', async () => {
  await adm.getByRole('link', { name: 'Produtos e serviços' }).click();
  await adm.waitForURL(/\/cursos$/);
  await adm.getByRole('tab', { name: 'Serviços' }).click();
  await adm.waitForURL(/\/produtos\/servicos$/);
  await adm.getByText('Os serviços (atendimento, acompanhamento e consultoria)').waitFor();
  assert.equal(await ativo(adm), 'Produtos e serviços');
});

await passo('Ações reúne relatórios, financeiro e auditoria', async () => {
  await adm.getByRole('link', { name: 'Ações' }).click();
  await adm.waitForURL(/\/acoes\//);
  const abas = await adm.getByRole('tablist', { name: 'Seções' }).getByRole('tab').allInnerTexts();
  for (const a of ['Pedagógico', 'Financeiro/Fiscal', 'CX', 'Relatórios', 'Auditoria']) assert.ok(abas.includes(a), a);
  await adm.getByRole('tab', { name: 'Relatórios' }).click();
  await adm.waitForURL(/\/relatorios\/relatorio$/);
  assert.equal(await ativo(adm), 'Ações');
  await adm.getByRole('tab', { name: 'Auditoria' }).click();
  await adm.waitForURL(/\/auditoria$/);
  assert.equal(await ativo(adm), 'Ações');
});

await passo('Configurações e Engenharia ficam no menu da conta', async () => {
  await adm.getByRole('button', { name: 'Opções da conta' }).click();
  await adm.getByRole('menuitem', { name: 'Configurações' }).click();
  await adm.waitForURL(/\/configuracoes\/politicas$/);
  await adm.getByRole('button', { name: 'Opções da conta' }).click();
  await adm.getByRole('menuitem', { name: 'Engenharia' }).waitFor();
  await adm.keyboard.press('Escape');
});

const aluno = await entra('persona.a@alumni.teste', 'alumni-a');
await passo('Aluno: Agenda, Histórico e Central de ajuda', async () => {
  assert.deepEqual(await menu(aluno), ['Agenda', 'Histórico', 'Central de ajuda']);
  await aluno.getByRole('link', { name: 'Central de ajuda' }).click();
  await aluno.getByRole('heading', { name: 'Central de ajuda' }).waitFor();
  await aluno.getByText('Faltei. Como peço a reposição?').waitFor();
  assert.equal(await aluno.getByRole('button', { name: 'Ajuda e atalhos' }).count(), 0);
});

const prof = await entra('persona.i@alumni.teste', 'alumni-i');
await passo('Professor: entra na Agenda e vê Agenda, Histórico e Central de ajuda', async () => {
  await prof.waitForURL(/\/agenda/);
  assert.deepEqual(await menu(prof), ['Agenda', 'Histórico', 'Central de ajuda']);
});
await passo('Professor: histórico com as aulas dele e a contagem de alunos', async () => {
  await prof.getByRole('link', { name: 'Histórico', exact: true }).click();
  await prof.getByText('executadas', { exact: true }).waitFor();
  await prof.getByRole('columnheader', { name: 'Alunos' }).waitFor();
  const r = await prof.request.get('http://localhost:3333/historico-de-aulas?dias=60');
  const d = await r.json();
  assert.equal(d.modo, 'professor');
  assert.ok(d.aulas.length > 0);
  assert.ok(d.aulas.every((a) => a.prof === 'Marina Pallotta' || a.sub === 'Marina Pallotta'));
});

/* um ID, vários perfis: o admin vincula um aluno ao usuário da Professora, que ganha o botão Aluno */
const API = 'http://localhost:3333';
const usuarioI = async () => {
  const lista = await (await adm.request.get(`${API}/config/usuarios`)).json();
  return lista.linhas.find((l) => l.email === 'persona.i@alumni.teste');
};
const vincula = async (alunoId) => {
  const u = await usuarioI();
  const form = (await (await adm.request.get(`${API}/config/usuarios/form?id=${u.id}`)).json()).usuario;
  const r = await adm.request.put(`${API}/config/usuarios/${u.id}`, { data: { ...form, alunoId } });
  assert.equal(r.status(), 200, await r.text());
};
let alunoLivre = null;
await passo('Usuários › Acessos: o formulário tem Vincular a aluno e Vincular a professor', async () => {
  const u = await usuarioI();
  await adm.goto(`${BASE}/configuracoes/usuarios/${u.id}`);
  await adm.getByRole('combobox', { name: 'Vincular a aluno' }).waitFor();
  await adm.getByRole('combobox', { name: 'Vincular a professor' }).waitFor();
  const form = await (await adm.request.get(`${API}/config/usuarios/form?id=${u.id}`)).json();
  alunoLivre = form.alunos.find((a) => !a.usuario);
  assert.ok(alunoLivre, 'um aluno sem usuário');
  await vincula(alunoLivre.id);
});
await passo('Professor que estuda: botão Aluno acima do perfil troca para a visão de aluno e volta', async () => {
  const p = await entra('persona.i@alumni.teste', 'alumni-i');
  const botao = p.getByRole('button', { name: 'Abrir a visão de aluno' });
  await botao.waitFor();
  const ordem = await p.evaluate(() => {
    const b = document.querySelector('button[aria-label="Abrir a visão de aluno"]');
    const conta = document.querySelector('button[aria-label="Opções da conta"]');
    return !!(b.compareDocumentPosition(conta) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  assert.ok(ordem, 'o botão Aluno vem antes do perfil');
  await botao.click();
  await p.waitForURL(/\/minha-agenda/);
  assert.deepEqual(await menu(p), ['Agenda', 'Histórico', 'Central de ajuda']);
  await p.getByRole('link', { name: 'Histórico', exact: true }).click();
  await p.waitForURL(/visao=aluno/);
  await p.getByText('de presença').waitFor();
  await p.getByRole('button', { name: 'Voltar à visão de professor' }).click();
  await p.waitForURL(/\/agenda/);
  await p.getByRole('button', { name: 'Abrir a visão de aluno' }).waitFor();
});
await passo('Ficha do aluno: Matrícula, Financeiro e os perfis vinculados', async () => {
  await adm.goto(`${BASE}/alunos/${alunoLivre.id}/perfil`);
  await adm.getByText('Usuário e perfis vinculados').waitFor();
  await adm.getByRole('link', { name: /Professor\s*Marina Pallotta/ }).waitFor();
  await adm.getByRole('tab', { name: 'Financeiro' }).click();
  await adm.waitForURL(/\/financeiro$/);
  await adm.getByRole('table', { name: 'Parcelas' }).waitFor();
  await adm.getByRole('tab', { name: 'Matrícula' }).waitFor();
});
if (alunoLivre) await vincula(null);

if (erros.length) {
  console.log('erros de página:', [...new Set(erros)].join(' | '));
  process.exitCode = 1;
}
console.log(`${ok} passos ok`);
await nav.close();
