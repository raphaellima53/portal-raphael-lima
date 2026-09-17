// Configurações no navegador (Edge instalado). Uso: node scripts/e2e-configuracoes.mjs   (API e web rodando, banco com seed)
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
const escolhe = async (raiz, pg, rotulo, opcao, busca) => {
  const c = raiz.getByRole('combobox', { name: rotulo });
  await c.click();
  if (busca) await c.fill(busca);
  await pg.getByRole('option', { name: opcao }).first().click();
};
const pg = await entra('admin@alumni.teste', 'alumni-admin');

await passo('usuários: filtro de status e novo usuário a partir de uma pessoa', async () => {
  await pg.goto(`${BASE}/configuracoes/usuarios`);
  await escolhe(pg, pg, 'Status', 'Bloqueado');
  await pg.getByRole('cell', { name: /Arthur Braz sem-email/ }).waitFor();
  assert.equal(await pg.getByRole('table', { name: 'Usuários' }).locator('tbody tr').count(), 1);
  await pg.getByRole('link', { name: 'Novo usuário' }).click();
  await pg.getByRole('heading', { name: 'Novo usuário' }).waitFor();
  await pg.getByRole('button', { name: 'Criar e enviar convite' }).first().click();
  await pg.getByText(/Para salvar o usuário, falta: nome de exibição/).waitFor();
  await escolhe(pg, pg, 'Pessoa', /^Tomás Herrera · Professor/, 'Tomás');
  assert.equal(await pg.getByLabel('Nome de exibição').inputValue(), 'Tomás Herrera');
  await escolhe(pg, pg, 'Cargo', 'Prestador · Professor', 'Prestador');
  await pg.getByText('telas no menu desta pessoa').waitFor();
  await pg.getByLabel('Justificativa da concessão').fill('acesso do professor ao portal');
  await pg.getByRole('button', { name: 'Criar e enviar convite' }).first().click();
  await pg.waitForURL(/\/configuracoes\/usuarios\?msg=/);
  await pg.getByText(/Tomás Herrera criado: convite enviado para/).waitFor();
  await pg
    .getByRole('cell', { name: /Tomás Herrera/ })
    .first()
    .waitFor();
});

await passo('departamentos: cria, renomeia e exclui', async () => {
  await pg.goto(`${BASE}/configuracoes/departamentos`);
  await pg.getByRole('button', { name: 'Novo departamento' }).click();
  await dialogo(pg).getByLabel('Nome').fill('Qualidade e2e');
  await dialogo(pg).getByRole('button', { name: 'Salvar' }).click();
  await pg.getByText('Qualidade e2e criado.').waitFor();
  await pg.getByRole('button', { name: 'Editar Qualidade e2e' }).click();
  await dialogo(pg).getByLabel('Nome').fill('Qualidade e2e 2');
  await dialogo(pg).getByRole('button', { name: 'Salvar' }).click();
  await pg.getByText('Qualidade e2e 2 salvo.').waitFor();
  await pg.getByRole('button', { name: 'Editar Qualidade e2e 2' }).click();
  await dialogo(pg).getByRole('button', { name: 'Excluir departamento' }).click();
  await pg.getByText('Qualidade e2e 2 excluído.').waitFor();
});

await passo('feriados: importar os nacionais de outro ano e remover um', async () => {
  await pg.goto(`${BASE}/configuracoes/feriados`);
  await escolhe(pg, pg, 'Ano', String(new Date().getFullYear() + 1));
  await pg.getByRole('button', { name: /Importar feriados nacionais de/ }).click();
  await pg.getByText(/feriados nacionais de \d{4} (importados|já estavam)/).waitFor();
  await pg.getByRole('button', { name: /^Remover Tiradentes/ }).click();
  await pg.getByText(/Tiradentes \(21\/04\/\d{4}\) removido/).waitFor();
});

await passo('condições e vigência: salvar pede justificativa', async () => {
  await pg.goto(`${BASE}/configuracoes/politicas`);
  await pg.getByRole('button', { name: 'Salvar políticas' }).first().click();
  await pg.getByText('Nada mudou desde o último salvamento.').waitFor();
  await pg.getByLabel('Faltas consecutivas para alerta').fill('4');
  await pg.getByRole('button', { name: 'Salvar políticas' }).first().click();
  await dialogo(pg).getByText('1 campo alterado').waitFor();
  await dialogo(pg)
    .getByLabel(/Justificativa/)
    .fill('pedido da coordenação');
  await dialogo(pg).getByRole('button', { name: 'Salvar' }).click();
  await pg.getByText('Salvo: 1 campo · justificativa na Auditoria.').waitFor();
});

await passo('sessões: política salva ao clicar; alertas: executar rotinas', async () => {
  await pg.goto(`${BASE}/configuracoes/sessoes`);
  await pg.getByRole('switch', { name: 'Sessão única por usuário' }).click();
  await pg.getByText('Sessão única por usuário: ligada.').waitFor();
  await pg.getByRole('switch', { name: 'Sessão única por usuário' }).click();
  await pg.getByText('Sessão única por usuário: desligada.').waitFor();
  await pg.goto(`${BASE}/configuracoes/alertas`);
  await pg.getByRole('button', { name: 'Executar agora' }).click();
  await pg.getByText(/Rotinas executadas: \d+ avisos? — Ociosidade: \d+/).waitFor();
});

await passo('mapa de telas: A construir mostra Engenharia e a linha abre a tela', async () => {
  await pg.goto(`${BASE}/configuracoes/docTelas`);
  await pg.getByRole('radio', { name: 'A construir' }).click();
  await pg.getByRole('link', { name: 'Repositórios' }).waitFor();
  await pg.getByRole('radio', { name: 'Todas' }).click();
  await pg.locator('table a[href="/agenda"]').first().click();
  await pg.waitForURL(/\/agenda/);
});

await passo('personas: Entrar como troca a sessão; a persona não abre Configurações', async () => {
  const p = await entra('admin@alumni.teste', 'alumni-admin');
  await p.goto(`${BASE}/configuracoes/docPersonas`);
  await p
    .getByRole('row', { name: /Juliana Prado/ })
    .getByRole('button', { name: 'Entrar como' })
    .click();
  await p.waitForURL(/\/inicio/);
  await p.getByText('Juliana Prado').first().waitFor();
  await p.goto(`${BASE}/configuracoes/usuarios`);
  await p.getByText('Sem acesso a esta tela').waitFor();
});

if (erros.length) {
  console.log('erros de página:', [...new Set(erros)].join(' | '));
  process.exitCode = 1;
}
console.log(`${ok} passos ok`);
await nav.close();
