// Alunos no navegador (Edge instalado). Uso: node scripts/e2e-alunos.mjs   (API e web rodando, banco com seed)
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
  const pg = await (
    await nav.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' })
  ).newPage();
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

await passo('lista: 40 alunos paginados, busca por CPF e filtro de produto', async () => {
  await pg.goto(`${BASE}/alunos`);
  await pg.getByText('Mostrando 1–10 de 40').waitFor();
  await pg.getByRole('searchbox', { name: /Buscar por nome/ }).fill('20003456789');
  await pg.getByRole('link', { name: 'Bernardo Klein' }).waitFor();
  assert.equal(await pg.locator('main tbody tr').count(), 1);
  await pg.getByRole('searchbox', { name: /Buscar por nome/ }).fill('');
  await pg.getByRole('combobox', { name: 'Produto' }).click();
  await pg.getByRole('option', { name: 'FAAP' }).click();
  await pg.waitForTimeout(200);
  const nomes = await pg.locator('main tbody tr td:nth-child(3)').allInnerTexts();
  assert.ok(nomes.length > 0 && nomes.every((t) => t.includes('FAAP')));
});

await passo('linha abre a ficha e as abas em dois níveis levam às subabas', async () => {
  await pg.goto(`${BASE}/alunos`);
  await pg.getByRole('link', { name: 'Alice Ferraz' }).click();
  await pg.waitForURL(/\/alunos\/1\/perfil$/);
  await pg.getByText('Vínculo e contrato').waitFor();
  await pg.getByRole('tab', { name: 'Matrícula', exact: true }).click();
  await pg.waitForURL(/\/alunos\/1\/cursos$/);
  await pg.getByText('Alocação de cada matrícula').waitFor();
  await pg.getByRole('tab', { name: 'Histórico' }).click();
  await pg.waitForURL(/\/alunos\/1\/agendamentos$/);
  await pg.getByRole('radio', { name: 'Passadas' }).click();
  await pg.getByText('aulas no período').waitFor();
});

await passo('nova matrícula: pacote vem do curso e a mensagem confirma', async () => {
  await pg.goto(`${BASE}/alunos/2/cursos`);
  await pg.getByRole('button', { name: 'Nova matrícula' }).click();
  const d = dialogo(pg);
  await d.getByRole('button', { name: 'Matricular' }).click();
  await d.getByText('Escolha o curso.').waitFor();
  await d.getByRole('combobox', { name: 'Curso' }).click();
  await pg.getByRole('option', { name: 'Conexión Español' }).click();
  assert.equal(await d.getByRole('spinbutton', { name: /Pacote de aulas/ }).inputValue(), '48');
  await d.getByRole('button', { name: 'Matricular' }).click();
  await pg.getByText(/Bernardo Klein matriculado em Conexión Español/).waitFor();
});

await passo('encerrar e reativar a matrícula nova; o Log registra', async () => {
  const linha = pg.getByRole('row', { name: /Conexión Español/ }).first();
  await linha.getByRole('button', { name: 'Encerrar' }).click();
  await pg.getByText(/Matrícula em Conexión Español encerrada/).waitFor();
  await pg
    .getByRole('row', { name: /Conexión Español/ })
    .getByRole('button', { name: 'Reativar' })
    .click();
  await pg.getByText(/Matrícula em Conexión Español reativada/).waitFor();
  await pg
    .getByRole('row', { name: /Conexión Español/ })
    .getByRole('button', { name: 'Encerrar' })
    .click();
  await pg.getByText(/Matrícula em Conexión Español encerrada/).waitFor();
  await pg.goto(`${BASE}/alunos/2/log`);
  await pg.getByRole('cell', { name: 'Matrícula encerrada' }).first().waitFor();
  await pg.getByRole('cell', { name: 'Nova matrícula' }).waitFor();
});

await passo('disponibilidade: marcar o sábado inteiro soma 15 horas', async () => {
  await pg.goto(`${BASE}/alunos/2/disponibilidade`);
  const horas = async () =>
    Number(
      await pg
        .locator('main')
        .getByText('horas disponíveis por semana')
        .locator('xpath=..')
        .locator('div')
        .first()
        .innerText(),
    );
  const antes = await horas();
  await pg.getByRole('button', { name: 'Marcar ou desmarcar sáb inteira' }).click();
  await pg.waitForFunction(
    (n) => [...document.querySelectorAll('main div')].some((d) => d.textContent === String(n)),
    antes + 15,
  );
  assert.equal(await horas(), antes + 15);
  await pg.getByRole('button', { name: 'Marcar ou desmarcar sáb inteira' }).click();
  await pg.waitForFunction(
    (n) => [...document.querySelectorAll('main div')].some((d) => d.textContent === String(n)),
    antes,
  );
});

await passo(
  'feedbacks: registrar ocorrência a partir do ponto de qualidade, com anexo, e iniciar tratativa',
  async () => {
    await pg.goto(`${BASE}/alunos/1/feedbacks`);
    await pg.getByText('Qualidade do aluno').waitFor();
    await pg.getByRole('button', { name: 'Registrar ocorrência' }).first().click();
    const d = dialogo(pg);
    await d.getByRole('heading', { name: 'Registrar ocorrência de qualidade' }).waitFor();
    assert.match(await d.getByRole('textbox', { name: /Relato/ }).inputValue(), /^Faltas: /);
    await d.locator('input[type=file]').setInputFiles({
      name: 'print.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4a50000000049454e44ae426082',
        'hex',
      ),
    });
    await d.getByRole('button', { name: 'Registrar ocorrência' }).click();
    await pg.getByText(/Ocorrência de qualidade registrada para Alice Ferraz com 1 anexo/).waitFor();
    const linha = pg.getByRole('row', { name: /Qualidade/ }).first();
    await linha.getByRole('link', { name: 'Abrir print.png' }).waitFor();
    await linha.getByRole('button', { name: 'Iniciar tratativa' }).click();
    await pg.getByText(/agora está em tratativa/).waitFor();
  },
);

await passo('alocação individual: choque de agenda não salva', async () => {
  await pg.goto(`${BASE}/alunos/1/cursos`);
  const card = pg.locator('[data-slot=card]').filter({ hasText: 'Aula individual' });
  await card.getByRole('combobox', { name: /Hora da aula/ }).click();
  await pg.getByRole('option', { name: '12:00' }).click();
  await card.getByRole('checkbox', { name: 'qua' }).click();
  await card.getByRole('checkbox', { name: 'sex' }).click();
  await card.getByRole('checkbox', { name: 'ter' }).click();
  await card
    .getByText(/já tem aula em ter/)
    .first()
    .waitFor();
  await card.getByRole('button', { name: 'Salvar alocação' }).click();
  await card.getByText(/Nada foi salvo\./).waitFor();
});

await passo('menu da linha: desativar e reativar, e Acessar como volta ao portal', async () => {
  await pg.goto(`${BASE}/alunos`);
  await pg.getByRole('button', { name: 'Ações de Camila Duarte' }).click();
  await pg.getByRole('menuitem', { name: 'Desativar' }).click();
  await pg.getByText('Camila Duarte desativado. Dá para reativar pelo mesmo menu.').waitFor();
  await pg.getByRole('button', { name: 'Ações de Camila Duarte' }).click();
  await pg.getByRole('menuitem', { name: 'Reativar' }).click();
  await pg.getByText('Camila Duarte reativado como Ativo.').waitFor();
  await pg.getByRole('button', { name: 'Ações de Camila Duarte' }).click();
  await pg.getByRole('menuitem', { name: 'Acessar como' }).click();
  await pg.waitForURL(/\/minha-agenda/);
  await pg.getByText(/Você está vendo o portal como/).waitFor();
  await pg.getByRole('button', { name: 'Voltar ao portal' }).click();
  await pg.waitForURL(/\/alunos$/);
  await pg.getByRole('heading', { name: 'Alunos' }).waitFor();
});

await passo('editar dados: o formulário chega com a empresa e salvar sem mudança não altera nada', async () => {
  await pg.goto(`${BASE}/alunos/1/perfil`);
  await pg.getByRole('button', { name: 'Editar dados' }).click();
  const d = dialogo(pg);
  await d.getByText('Matrículas ativas', { exact: true }).waitFor();
  await pg.waitForTimeout(800);
  assert.equal(await d.getByRole('combobox', { name: 'Empresa' }).innerText(), 'Vetora Tecnologia');
  assert.equal(await d.getByRole('textbox', { name: 'Contrato até' }).inputValue(), '21/07/2027');
  await d.getByRole('button', { name: 'Salvar' }).click();
  await pg.getByText('Nada mudou no cadastro.').waitFor();
});

await passo('Marketing (só Perfil): ficha sem as outras abas e sem Nova matrícula', async () => {
  const k = await entra('persona.k@alumni.teste', 'alumni-k');
  await k.goto(`${BASE}/alunos/1/cursos`);
  await k.waitForURL(/\/alunos\/1\/perfil$/);
  assert.equal(await k.getByRole('tab', { name: 'Matrícula', exact: true }).count(), 0);
  assert.equal(await k.getByRole('button', { name: 'Nova matrícula' }).count(), 0);
});

await passo('aluno não entra na lista de alunos', async () => {
  const a = await entra('persona.a@alumni.teste', 'alumni-a');
  await a.goto(`${BASE}/alunos`);
  await a.getByText('Sem acesso a esta tela.').waitFor();
});

if (erros.length) {
  console.log('erros de página:', [...new Set(erros)].join(' | '));
  process.exitCode = 1;
}
console.log(`${ok} passos ok`);
await nav.close();
