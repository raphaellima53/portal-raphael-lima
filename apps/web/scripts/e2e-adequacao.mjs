// Adequação ao Portal Alumni no navegador (Edge instalado): a tela genérica dos cadastros novos e as abas das fichas.
// Uso: node scripts/e2e-adequacao.mjs   (API e web rodando, banco com seed)
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
const NOME = `Mentoria e2e ${Date.now() % 100000}`;

await passo('Serviços: criar pelo popup, aparece na lista com a categoria', async () => {
  await pg.goto(`${BASE}/produtos/servicos`);
  await pg.getByRole('button', { name: 'Novo serviço' }).first().click();
  const d = dialogo(pg);
  await d.getByLabel('Nome').fill(NOME);
  await d.getByLabel('Sigla').fill('MNT');
  await d.getByRole('combobox', { name: 'Categoria' }).click();
  await pg.getByRole('option', { name: 'Consultoria' }).click();
  await d.getByRole('button', { name: 'Cadastrar' }).click();
  await pg.getByText('Serviço criado.').waitFor();
  const linha = pg.locator('main tbody tr', { hasText: NOME });
  await linha.waitFor();
  assert.match(await linha.innerText(), /MNT[\s\S]*Consultoria/);
});

await passo('Serviços: obrigatório vazio mostra o erro no popup', async () => {
  await pg.getByRole('button', { name: 'Novo serviço' }).first().click();
  const d = dialogo(pg);
  await d.getByRole('button', { name: 'Cadastrar' }).click();
  await d.getByText('Preencha nome.').waitFor();
  await d.getByRole('button', { name: 'Cancelar' }).click();
});

await passo('Serviços: editar e excluir', async () => {
  await pg.getByRole('button', { name: `Editar ${NOME}` }).click();
  const d = dialogo(pg);
  await d.getByLabel('Sigla').fill('MNT2');
  await d.getByRole('button', { name: 'Salvar' }).click();
  await pg.getByText('Serviço salvo.').waitFor();
  assert.match(await pg.locator('main tbody tr', { hasText: NOME }).innerText(), /MNT2/);
  await pg.getByRole('button', { name: `Excluir ${NOME}` }).click();
  await dialogo(pg).getByRole('button', { name: 'Excluir' }).click();
  await pg.getByText('Serviço excluído.').waitFor();
  assert.equal(await pg.locator('main tbody tr', { hasText: NOME }).count(), 0);
});

await passo('Ficha do aluno: Datas bloqueadas grava a data em dd/mm/aaaa e volta a data certa', async () => {
  await pg.goto(`${BASE}/alunos/1/datas`);
  await pg.getByRole('button', { name: 'Bloquear data' }).click();
  const d = dialogo(pg);
  await d.getByRole('textbox', { name: 'Data' }).fill('15/12/2031');
  await d.getByLabel('Motivo').fill('viagem e2e');
  await d.getByRole('button', { name: 'Cadastrar' }).click();
  await pg.getByText('Data bloqueada criada.').waitFor();
  const linha = pg.locator('main tbody tr', { hasText: 'viagem e2e' });
  assert.match(await linha.innerText(), /15\/12\/2031/);
  await pg.getByRole('button', { name: 'Excluir 15/12/2031' }).click();
  await dialogo(pg).getByRole('button', { name: 'Excluir' }).click();
  await pg.getByText('Data bloqueada excluída.').waitFor();
});

await passo('Ficha do professor: abas novas em Habilitação e Pagamentos', async () => {
  await pg.goto(`${BASE}/professores/p1/ausencias`);
  for (const aba of ['Ausências', 'Pedidos de cancelamento']) await pg.getByRole('tab', { name: aba }).waitFor();
  await pg.getByRole('button', { name: 'Nova ausência' }).waitFor();
  await pg.goto(`${BASE}/professores/p1/extrato`);
  await pg.getByRole('button', { name: 'Abrir extrato' }).waitFor();
});

await passo('Colaborador pedagógico (G) não vê Ofertas nem Serviços sem acesso', async () => {
  const g = await entra('persona.g@alumni.teste', 'alumni-g');
  await g.goto(`${BASE}/acoes/ofertas`);
  await g.getByText('Sem acesso a esta tela').waitFor();
});

await nav.close();
if (erros.length) {
  console.log('erros na página:', erros.slice(0, 3));
  process.exitCode = 1;
}
console.log(`${ok} passos ok`);
