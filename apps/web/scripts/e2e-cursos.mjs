// Cursos no navegador (Edge instalado). Uso: node scripts/e2e-cursos.mjs   (API e web rodando, banco com seed)
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

await passo('catálogo: 5 cursos e a busca por módulo filtra', async () => {
  await pg.goto(`${BASE}/cursos`);
  await pg.getByText('5 cursos').waitFor();
  await pg.getByRole('searchbox', { name: /Buscar curso/ }).fill('maestria');
  await pg.waitForTimeout(300);
  const cards = await pg.locator('main a[href^="/cursos/"]').allInnerTexts();
  assert.equal(cards.length, 1);
  assert.match(cards[0], /Conexión Español/);
});

let idFaap = '';
await passo('FAAP: Visão geral com turmas e clique na turma troca o detalhe', async () => {
  await pg.goto(`${BASE}/cursos`);
  await pg.getByRole('link', { name: /FAAP/ }).click();
  await pg.waitForURL(/\/cursos\/\d+\/geral/);
  idFaap = pg.url().match(/cursos\/(\d+)/)[1];
  await pg.getByText('155/200').waitFor();
  await pg.getByRole('row', { name: /Turma 3/ }).click();
  await pg.getByRole('heading', { name: 'Turma 3 · FAAP' }).waitFor();
});

await passo('abas: Regras, Currículo e Grade semanal abrem pelo endereço', async () => {
  for (const [aba, texto] of [
    ['regras', 'Duração da aula'],
    ['curriculo', 'currículos do curso'],
    ['grade', 'horários ofertados'],
  ]) {
    await pg
      .getByRole('tab', { name: { regras: 'Regras', curriculo: 'Currículo', grade: 'Grade semanal' }[aba] })
      .click();
    await pg.waitForURL(new RegExp(`/${aba}$`));
    await pg.getByText(texto).first().waitFor();
  }
});

await passo('regras: duração nova muda o horário da grade', async () => {
  await pg.goto(`${BASE}/cursos/${idFaap}/regras`);
  const campo = pg.getByRole('spinbutton', { name: 'minutos' });
  await campo.fill('10');
  await pg.getByRole('button', { name: 'Salvar regras' }).click();
  await pg.getByText('A aula precisa ter pelo menos 15 minutos.').waitFor();
  await campo.fill('60');
  await pg.getByRole('button', { name: 'Salvar regras' }).click();
  await pg.getByText('Regras de FAAP salvas.', { exact: false }).waitFor();
  await pg.goto(`${BASE}/cursos/${idFaap}/grade`);
  await pg.getByRole('cell', { name: '08:00–09:00' }).first().waitFor();
  await pg.goto(`${BASE}/cursos/${idFaap}/regras`);
  await pg.getByRole('spinbutton', { name: 'minutos' }).fill('50');
  await pg.getByRole('button', { name: 'Salvar regras' }).click();
  await pg.getByText('Regras de FAAP salvas.', { exact: false }).waitFor();
});

let novoId = '';
await passo(
  'Novo curso: obrigatórios, dois módulos com grade marcável e abre nas Regras; editar tira um módulo',
  async () => {
    const d = dialogo(pg);
    const escolhe = async (nome, opcao) => {
      await d.getByRole('combobox', { name: nome }).click();
      await pg.getByRole('option', { name: opcao, exact: true }).click();
    };
    await pg.goto(`${BASE}/cursos`);
    await pg.getByRole('button', { name: 'Novo curso' }).click();
    await d.getByRole('button', { name: 'Criar curso' }).click();
    await d.getByText('Informe o nome do curso.').waitFor();
    await pg.fill('#cf-nome', 'Curso de teste e2e');
    await escolhe('Idioma', 'Inglês');
    assert.equal(await d.getByRole('radio', { name: 'Grupo Open-Entry' }).getAttribute('aria-checked'), 'true');
    for (const [k, nome, cefr] of [
      [0, 'Nível A', 'A1'],
      [1, 'Nível B', 'A2'],
    ]) {
      await d.getByRole('button', { name: 'Novo módulo' }).click();
      await pg.fill(`#cf-it-nome-${k}`, nome);
      await escolhe(`CEFR do módulo ${k + 1}`, cefr);
      await pg.fill(`#cf-it-vagas-${k}`, '6');
      await pg.fill(`#cf-agendamento-${k}`, '2');
      await pg.fill(`#cf-cancelamento-${k}`, '90');
      await d.getByRole('combobox', { name: 'Unidade de cancelamento' }).nth(k).click();
      await pg.getByRole('option', { name: 'minutos', exact: true }).click();
    }
    /* sem a regra obrigatória o módulo não salva */
    await pg.fill('#cf-agendamento-1', '');
    await d.getByRole('button', { name: 'Criar curso' }).click();
    await d.getByText('Informe a regra de agendamento.').waitFor();
    await pg.fill('#cf-agendamento-1', '2');
    /* grade: marcar Seg e Qua às 08h com o professor; sábado depois do funcionamento fica travado */
    const grade = d.getByRole('table', { name: 'Grade de Módulo 1' });
    await grade.getByRole('img', { name: 'Sáb 13:00: fora do horário de funcionamento' }).waitFor();
    for (const dia of ['Seg', 'Qua']) {
      await grade.getByRole('button', { name: `${dia} 08:00: livre, marcar o horário` }).click();
      await pg.getByRole('list', { name: 'Professores' }).getByRole('button').first().click();
    }
    assert.equal(await grade.getByRole('button', { name: /^(Seg|Qua) 08:00: (?!livre)/ }).count(), 2);
    /* horário sem professor: vale, fica em âmbar e o aviso lista o que falta vincular */
    await grade.getByRole('button', { name: 'Sex 10:00: livre, marcar o horário' }).click();
    await pg.getByRole('button', { name: 'Sem professor (vincular depois)' }).click();
    await grade.getByRole('button', { name: 'Sex 10:00: sem professor' }).waitFor();
    await d.getByText('1 horário sem professor:').waitFor();
    await d.getByRole('button', { name: 'Criar curso' }).click();
    await pg.waitForURL(/\/cursos\/\d+\/regras/);
    novoId = pg.url().match(/cursos\/(\d+)/)[1];
    await pg.getByText('Módulos — 2 níveis').waitFor();
    await pg.getByText('1 horário da grade sem professor:').waitFor();
    await pg.getByText(/Nível A · Sex 10:00/).waitFor();
    await pg.getByRole('button', { name: 'Vincular em Editar curso' }).click();
    assert.equal(
      await d
        .getByRole('table', { name: 'Grade de Módulo 1' })
        .getByRole('button', { name: /^(Seg|Qua) 08:00: (?!livre)/ })
        .count(),
      2,
    );
    /* vincular o professor tira o aviso */
    await d.getByRole('button', { name: 'Sex 10:00: sem professor' }).click();
    await pg.getByRole('list', { name: 'Professores' }).getByRole('button').first().click();
    assert.equal(await d.getByText('1 horário sem professor:').count(), 0);
    await d.getByRole('button', { name: 'Remover módulo 2' }).click();
    await d.getByRole('button', { name: 'Salvar' }).click();
    await pg.getByText('Módulos — 1 níveis').waitFor();
    assert.equal(await pg.getByText('horário da grade sem professor').count(), 0);
  },
);

await passo('currículo: novo currículo, conteúdo, publicar, nova versão, subir e descartar', async () => {
  await pg.goto(`${BASE}/cursos/${novoId}/curriculo`);
  await pg.getByRole('button', { name: 'Novo currículo' }).click();
  await dialogo(pg).getByRole('button', { name: 'Nível A' }).click();
  await dialogo(pg).getByRole('button', { name: 'Criar currículo' }).click();
  await dialogo(pg).getByText('Dê um nome ao currículo.').waitFor();
  await pg.fill('#cur-nome', 'Curso de teste e2e · Nível A');
  await dialogo(pg).getByRole('button', { name: 'Criar currículo' }).click();
  await pg.waitForURL(/\/cursos\/curriculos\/cur\d+/);
  await pg.getByText('Currículo criado como v1 em rascunho').waitFor();
  await pg.getByRole('button', { name: 'Publicar v1' }).click();
  await pg.getByText('Um currículo precisa de pelo menos um conteúdo para ser publicado.').waitFor();
  for (const t of ['Primeira aula', 'Segunda aula']) {
    await pg.getByRole('button', { name: 'Novo conteúdo' }).click();
    await pg.fill('#ct-titulo', t);
    await pg.fill('#ct-in', 'ftp://errado');
    await dialogo(pg).getByRole('button', { name: 'Adicionar conteúdo' }).click();
    await dialogo(pg)
      .getByText(/O link de In-class precisa ser um endereço completo/)
      .waitFor();
    await pg.fill('#ct-in', 'https://materiais.alumni.teste/e2e');
    await dialogo(pg).getByRole('button', { name: 'Adicionar conteúdo' }).click();
    await dialogo(pg).waitFor({ state: 'detached' });
  }
  await pg.getByText('2 conteúdos', { exact: true }).waitFor();
  await pg.getByRole('button', { name: 'Publicar v1' }).click();
  await pg.getByText(/v1 publicada\. As aulas geradas a partir de agora leem os 2 conteúdos/).waitFor();
  await pg.getByRole('button', { name: 'Nova versão' }).click();
  await pg.getByText('As mudanças foram para a v2 em rascunho.', { exact: false }).waitFor();
  const seg = pg.getByRole('button', { name: /Segunda aula/ });
  if ((await seg.getAttribute('aria-expanded')) !== 'true') await seg.click();
  await pg.getByRole('button', { name: '↑ Subir' }).last().click();
  await pg.waitForTimeout(700);
  const titulos = await pg.locator('main button[aria-expanded] b').allInnerTexts();
  assert.deepEqual(titulos.slice(0, 2), ['Segunda aula', 'Primeira aula']);
  await pg.getByRole('button', { name: 'Descartar rascunho' }).click();
  await pg.getByText('Rascunho v2 descartado.', { exact: false }).waitFor();
  await pg.getByRole('button', { name: 'Excluir currículo' }).click();
  await dialogo(pg).getByRole('button', { name: 'Excluir currículo' }).click();
  await pg.waitForURL(/\/cursos$/);
});

const k = await entra('persona.k@alumni.teste', 'alumni-k');
await passo('Marketing: vê só Visão geral e Grade semanal', async () => {
  await k.goto(`${BASE}/cursos/${idFaap}/regras`);
  await k.waitForURL(/\/geral$/);
  await k.getByRole('tab', { name: 'Grade semanal' }).waitFor();
  const abas = await k.getByRole('tab').allInnerTexts();
  assert.deepEqual(abas, ['Visão geral', 'Grade semanal'], abas.join('|'));
  /* Analista marketing é Editor (nível 3): vê Editar curso, como no portal */
  assert.equal(await k.getByRole('button', { name: 'Editar curso' }).count(), 1);
});
const prof = await entra('persona.i@alumni.teste', 'alumni-i');
await passo('Professora: sem menu Cursos e sem acesso pelo endereço', async () => {
  assert.equal(await prof.getByRole('link', { name: 'Cursos', exact: true }).count(), 0);
  await prof.goto(`${BASE}/cursos`);
  await prof.getByText('Sem acesso a esta tela').first().waitFor();
});

if (erros.length) {
  console.log('ERROS DE PÁGINA:', [...new Set(erros)]);
  process.exitCode = 1;
}
console.log(`${ok} passos ok`);
await nav.close();
