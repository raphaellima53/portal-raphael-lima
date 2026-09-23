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

await passo('Admin: Início · A Agenda · B Usuários · C Produtos e serviços · D Atividades · E Auditoria · F Configurações', async () => {
  await adm.getByRole('heading', { name: 'Dashboard' }).waitFor();
  assert.deepEqual(await menu(adm), [
    'Início',
    'Agenda',
    'Usuários',
    'Produtos e serviços',
    'Atividades',
    'Auditoria',
    'Configurações',
  ]);
  /* rodapé: Central de ajuda; Meu perfil e Trocar senha no menu da conta */
  await adm.getByRole('button', { name: 'Central de ajuda' }).click();
  await adm.waitForURL(/\/central-de-ajuda$/);
  await adm.getByText('Onde fica cada coisa no menu?').waitFor();
  await adm.getByRole('button', { name: 'Opções da conta' }).click();
  await adm.getByRole('menuitem', { name: 'Meu perfil' }).click();
  await adm.waitForURL(/\/meu-perfil$/);
  await adm.getByText('Conta de acesso').waitFor();
});

await passo('Usuários abre Alunos com as abas das pessoas; a ficha mantém o menu aceso', async () => {
  await adm.getByRole('link', { name: 'Usuários' }).click();
  await adm.waitForURL(/\/alunos$/);
  const abas = await adm.getByRole('tablist', { name: 'Seções' }).getByRole('tab').allInnerTexts();
  assert.deepEqual(abas, ['Alunos', 'Equipe', 'Empresas']);
  /* o ID do cadastro vem antes do nome, com 5 dígitos */
  await adm.getByText(/^Mostrando 1–10 de/).waitFor();
  const linha1 = await adm.locator('main table tbody tr').first().locator('td').allInnerTexts();
  assert.match(linha1[0], /^\d{5}$/);
  await adm.getByRole('tab', { name: 'Empresas' }).click();
  await adm.waitForURL(/\/empresas$/);
  await adm.getByRole('cell', { name: /^E\d{4}$/ }).first().waitFor();
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
  /* colunas: ID · Nome (com o e-mail embaixo) · Tipo */
  const nomes = (await linhas.locator('td:nth-child(2)').allInnerTexts()).map((t) => t.split('\n')[0]);
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
  const abasP = await adm.getByRole('tablist', { name: 'Seções' }).getByRole('tab').allInnerTexts();
  assert.deepEqual(abasP, ['Cursos', 'Materiais', 'Serviços']);
  await adm.getByRole('tab', { name: 'Serviços' }).click();
  await adm.waitForURL(/\/produtos\/servicos$/);
  await adm.getByText('Os serviços (atendimento, acompanhamento e consultoria)').waitFor();
  assert.equal(await ativo(adm), 'Produtos e serviços');
});

await passo('Atividades reúne relatórios, financeiro e auditoria', async () => {
  await adm.getByRole('link', { name: 'Atividades' }).click();
  /* Atividades abre no Dashboard (23/09/2026: Dashboard · Comercial · Operações) */
  await adm.waitForURL(/\/acoes\/atvDash$/);
  await adm.getByRole('heading', { name: 'Visão geral das atividades' }).waitFor();
  const abas = await adm.getByRole('tablist', { name: 'Seções' }).getByRole('tab').allInnerTexts();
  for (const a of ['Dashboard', 'Comercial', 'Operações']) assert.ok(abas.includes(a), a);
  assert.ok(!abas.includes('Auditoria'));
  await adm.getByRole('tab', { name: 'Relatório por seletores' }).click();
  await adm.waitForURL(/\/relatorios\/relatorio$/);
  assert.equal(await ativo(adm), 'Atividades');
  await adm.getByRole('link', { name: 'Auditoria' }).click();
  await adm.waitForURL(/\/auditoria$/);
  assert.equal(await ativo(adm), 'Auditoria');
});

await passo('Configurações abre no Painel; Engenharia fica no menu da conta', async () => {
  await adm.getByRole('link', { name: 'Configurações' }).click();
  await adm.waitForURL(/\/configuracoes\/admPainel$/);
  assert.equal(await ativo(adm), 'Configurações');
  await adm.getByRole('button', { name: 'Opções da conta' }).click();
  await adm.getByRole('menuitem', { name: 'Engenharia' }).waitFor();
  await adm.keyboard.press('Escape');
});

const aluno = await entra('persona.a@alumni.teste', 'alumni-a');
await passo('Aluno: Agenda, Histórico de aulas e Meu perfil; Central de ajuda no rodapé', async () => {
  assert.deepEqual(await menu(aluno), ['Agenda', 'Histórico de aulas', 'Meu perfil']);
  await aluno.getByRole('link', { name: 'Meu perfil' }).click();
  await aluno.getByText('aulas restantes').waitFor();
  await aluno.getByRole('button', { name: 'Central de ajuda' }).click();
  await aluno.getByRole('heading', { name: 'Central de ajuda' }).waitFor();
  await aluno.getByText('Faltei. Como peço a reposição?').waitFor();
  assert.equal(await aluno.getByRole('button', { name: 'Ajuda e atalhos' }).count(), 0);
});

const prof = await entra('persona.i@alumni.teste', 'alumni-i');
await passo('Professor: entra na Agenda e vê Agenda, Histórico de aulas e Meu perfil', async () => {
  await prof.waitForURL(/\/agenda/);
  assert.deepEqual(await menu(prof), ['Agenda', 'Histórico de aulas', 'Meu perfil']);
});
await passo('Professor: histórico com as aulas dele e a contagem de alunos', async () => {
  await prof.getByRole('link', { name: 'Histórico de aulas', exact: true }).click();
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
  assert.deepEqual(await menu(p), ['Agenda', 'Histórico de aulas', 'Meu perfil']);
  await p.getByRole('link', { name: 'Histórico de aulas', exact: true }).click();
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
await passo('Ficha do aluno: aba Acesso com a conta vinculada; Editar acesso volta para a ficha', async () => {
  await adm.getByRole('tab', { name: 'Acesso', exact: true }).click();
  await adm.waitForURL(/\/acesso$/);
  await adm.getByText('persona.i@alumni.teste').first().waitFor();
  await adm.getByRole('table', { name: 'Histórico de acesso' }).waitFor();
  await adm.getByRole('link', { name: 'Editar acesso' }).click();
  await adm.waitForURL(/\/configuracoes\/usuarios\/\d+\?volta=/);
  await adm.getByRole('combobox', { name: 'Vincular a aluno' }).waitFor();
});
await passo('Aluno sem conta: Criar acesso abre o Novo usuário preenchido', async () => {
  const form = await (await adm.request.get(`${API}/config/usuarios/form`)).json();
  const outro = form.alunos.find((a) => !a.usuario && a.id !== alunoLivre.id);
  await adm.goto(`${BASE}/alunos/${outro.id}/acesso`);
  await adm.getByRole('link', { name: 'Criar acesso' }).click();
  await adm.waitForURL(/\/configuracoes\/usuarios\/novo\?/);
  await adm.waitForTimeout(800);
  assert.equal(await adm.locator('#nu-nome').inputValue(), outro.nome);
});
await passo('Equipe: o cadastro do colaborador mostra o Acesso ao portal', async () => {
  await adm.goto(`${BASE}/equipe`);
  await adm.getByRole('combobox', { name: 'Tipo' }).click();
  await adm.getByRole('option', { name: 'Colaboradores' }).click();
  await adm.getByRole('button', { name: /^Editar / }).first().click();
  await adm.getByRole('dialog').getByRole('heading', { name: 'Acesso ao portal' }).waitFor();
  await adm.keyboard.press('Escape');
});
if (alunoLivre) await vincula(null);

if (erros.length) {
  console.log('erros de página:', [...new Set(erros)].join(' | '));
  process.exitCode = 1;
}
console.log(`${ok} passos ok`);
await nav.close();
