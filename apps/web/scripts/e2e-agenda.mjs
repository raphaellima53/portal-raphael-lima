// Fluxo da Agenda no navegador (Edge instalado). Uso: node scripts/e2e-agenda.mjs   (API e web rodando, banco com seed)
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

await passo('as quatro visões abrem pelo seletor e o endereço guarda a visão', async () => {
  await pg.goto(`${BASE}/agenda`);
  await pg.getByRole('heading', { name: 'Agenda' }).waitFor();
  for (const [rot, vista] of [
    ['Semanal', 'semanal'],
    ['Diária', 'diaria'],
    ['Kanban', 'kanban'],
    ['Mensal', null],
  ]) {
    await pg.getByRole('tab', { name: rot }).click();
    await pg.waitForURL((u) => (vista ? u.searchParams.get('vista') === vista : !u.searchParams.get('vista')));
  }
});

await passo('‹ › andam um mês e Hoje volta', async () => {
  const titulo = async () => pg.locator('main [data-periodo]').first().innerText();
  const antes = await titulo();
  await pg.getByRole('button', { name: 'Próximo período' }).click();
  await pg.waitForURL(/data=/);
  await pg.waitForFunction((t) => document.querySelector('main [data-periodo]')?.textContent !== t, antes);
  await pg.getByRole('button', { name: 'Hoje', exact: true }).click();
  await pg.waitForFunction((t) => document.querySelector('main [data-periodo]')?.textContent === t, antes);
});

await passo('filtro de produto restringe as aulas e o campo fica destacado', async () => {
  await pg.goto(`${BASE}/agenda?vista=semanal`);
  await pg.getByRole('combobox', { name: 'Cursos' }).click();
  await pg.getByRole('option', { name: 'FAAP' }).click();
  await pg.waitForURL(/prod=FAAP/);
  await pg.waitForTimeout(800);
  const blocos = await pg.locator('main button[style*="background"]').allInnerTexts();
  assert.ok(blocos.length > 0, 'nenhuma aula');
  assert.ok(
    blocos.every((t) => t.startsWith('FAAP')),
    `aula de outro produto: ${blocos.find((t) => !t.startsWith('FAAP'))}`,
  );
});

await passo('filtros com checkbox: vários alunos e os módulos de um curso de uma vez', async () => {
  await pg.goto(`${BASE}/agenda?vista=semanal`);
  /* Tipo: Tudo · Só aulas · Só reuniões */
  await pg.getByRole('combobox', { name: 'Tipo' }).click();
  assert.deepEqual(
    (await pg.getByRole('option').allInnerTexts()).map((t) => t.trim()),
    ['Tudo', 'Só aulas', 'Só reuniões'],
  );
  await pg.keyboard.press('Escape');
  /* Alunos: em ordem alfabética; marcar dois junta no endereço */
  await pg.getByRole('button', { name: /^Alunos: / }).click();
  const nomes = (await pg.getByRole('group', { name: 'Alunos' }).locator('label').allInnerTexts()).map((t) => t.trim());
  assert.deepEqual(
    nomes,
    [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR')),
  );
  await pg.getByRole('checkbox', { name: nomes[0] }).click();
  await pg.getByRole('checkbox', { name: nomes[1] }).click();
  await pg.waitForURL((u) => u.searchParams.get('aluno') === `${nomes[0]}|${nomes[1]}`);
  await pg.getByRole('button', { name: 'Alunos: 2 alunos' }).waitFor();
  await pg.getByRole('button', { name: 'Limpar' }).click();
  await pg.waitForURL((u) => !u.searchParams.get('aluno'));
  await pg.keyboard.press('Escape');
  /* Módulos e turmas: agrupados por curso; o checkbox do curso marca todos os módulos dele */
  await pg.getByRole('button', { name: /^Módulos e turmas: / }).click();
  const grupo = pg.getByRole('group', { name: 'Módulos e turmas' }).getByRole('group').first();
  const curso = await grupo.getAttribute('aria-label');
  await grupo.getByRole('checkbox', { name: curso }).click();
  await pg.waitForURL((u) => (u.searchParams.get('mod') ?? '').startsWith(`${curso} · `));
  await pg.keyboard.press('Escape');
  await pg
    .getByRole('button', { name: /^Módulos e turmas: / })
    .and(pg.locator('.bg-azul-suave'))
    .waitFor();
  /* a mesma consulta na API: só aulas do curso marcado */
  const mod = new URL(pg.url()).searchParams.get('mod');
  const r = await pg.request.get(`http://localhost:3333/agenda?vista=semanal&mod=${encodeURIComponent(mod)}`);
  const aulas = (await r.json()).aulas;
  assert.ok(
    aulas.every((a) => a.prod === curso),
    `aula de outro curso: ${aulas.find((a) => a.prod !== curso)?.prod}`,
  );
});

await passo('Kanban com filtro de qualidade "sem professor" só tem a coluna Sem professor', async () => {
  await pg.goto(`${BASE}/agenda?vista=kanban&qual=semProf`);
  await pg.getByRole('region', { name: 'Sem professor' }).waitFor();
  const outras = await pg.locator('section[aria-label]:not([aria-label="Sem professor"]) button').count();
  assert.equal(outras, 0);
});

let chave = '';
await passo('popup da aula: alterar professor', async () => {
  await pg.goto(`${BASE}/agenda?vista=kanban`);
  const card = pg.getByRole('region', { name: 'Com alunos' }).locator('button').first();
  await card.click();
  await dialogo(pg).getByRole('heading', { name: 'Detalhes da aula' }).waitFor();
  await dialogo(pg).getByRole('button', { name: 'Alterar professor' }).click();
  const combo = dialogo(pg).getByRole('combobox', { name: 'Professor' });
  const atual = await combo.innerText();
  await combo.click();
  const opcoes = await pg.getByRole('option').allInnerTexts();
  const novo = opcoes.find((o) => o.trim() && o.trim() !== atual.trim());
  await pg.getByRole('option', { name: novo }).click();
  await dialogo(pg).getByRole('button', { name: 'Salvar' }).click();
  await dialogo(pg).getByText(`${novo} assume esta aula.`).waitFor();
  chave = new URL(
    await dialogo(pg)
      .getByRole('link', { name: /Detalhes da aula/ })
      .getAttribute('href'),
    BASE,
  ).searchParams.get('k');
});

await passo('cancelar aula tira da agenda e desfazer devolve', async () => {
  await dialogo(pg).getByRole('button', { name: 'Cancelar aula' }).click();
  await dialogo(pg).getByRole('button', { name: 'Cancelar aula' }).click();
  await dialogo(pg).getByText('Aula cancelada.').waitFor();
  await pg.waitForTimeout(600);
  const r = await pg.request.get(`http://localhost:3333/aulas/detalhe?k=${encodeURIComponent(chave)}`);
  assert.equal((await r.json()).estado, 'cancelada');
  await dialogo(pg).getByRole('button', { name: 'Desfazer cancelamento' }).click();
  await dialogo(pg).getByText('A aula voltou para a agenda.').waitFor();
  await dialogo(pg).getByRole('button', { name: 'Fechar' }).last().click();
});

await passo('página da aula de hoje: presença obrigatória para concluir, depois conclui', async () => {
  const r = await pg.request.get(`http://localhost:3333/agenda?vista=diaria`);
  const d = await r.json();
  const aula = d.aulas.find((a) => a.n > 0 && a.estado !== 'cancelada' && /Private FLOW|Alumni Black/.test(a.rotulo));
  assert.ok(aula, 'sem aula individual hoje');
  await pg.goto(`${BASE}/agenda/aula?k=${encodeURIComponent(aula.k)}`);
  await pg.getByText('Lista de presença').waitFor();
  const concluir = pg.getByRole('button', { name: 'Concluir aula' });
  if (await concluir.count()) {
    await concluir.click();
    await pg.getByText(/Marque presença ou falta de todos antes de concluir/).waitFor();
    await pg.getByRole('button', { name: 'Marcar todos presentes' }).click();
    await pg.getByText('Todos marcados como presentes.').waitFor();
    await concluir.click();
    await pg.getByText('Aula concluída e presença registrada.').waitFor();
    await pg.getByText('Aula concluída: a presença está registrada.').waitFor();
  }
});

await passo('modo apresentação: slides andam pelas setas do teclado', async () => {
  await pg.goto(`${BASE}/agenda/apresentacao?k=${encodeURIComponent(chave)}`);
  await pg.getByRole('region', { name: /./ }).first().waitFor();
  await pg.getByText(/^1 de \d+ ·/).waitFor();
  await pg.keyboard.press('ArrowRight');
  await pg.getByText(/^2 de \d+ ·/).waitFor();
});

await passo('evento: criar com participante, ver na agenda, editar e excluir', async () => {
  await pg.goto(`${BASE}/agenda?vista=semanal`);
  await pg.getByRole('button', { name: 'Novo', exact: true }).click();
  await dialogo(pg).getByRole('button', { name: 'Criar' }).click();
  await dialogo(pg).getByText('Informe o título.').waitFor();
  await pg.fill('#evTitulo', 'Reunião de teste e2e');
  await pg.fill('#evIni', '21:00');
  await pg.fill('#evFim', '21:30');
  await dialogo(pg).getByRole('button', { name: 'Criar' }).click();
  await dialogo(pg)
    .getByText(/Reunião criada na agenda de 1 pessoa\./)
    .waitFor();
  await dialogo(pg).getByRole('button', { name: 'Editar' }).click();
  await pg.fill('#evTitulo', 'Reunião de teste e2e editada');
  await dialogo(pg).getByRole('button', { name: 'Salvar' }).click();
  await dialogo(pg).getByText('Alterações salvas.').waitFor();
  await dialogo(pg).getByRole('button', { name: 'Excluir' }).click();
  await dialogo(pg).getByRole('button', { name: 'Excluir' }).click();
  await dialogo(pg).waitFor({ state: 'detached' });
});

await passo('layout: Salvar vira Salvo e é aplicado ao voltar para /agenda; Resetar apaga', async () => {
  await pg.goto(`${BASE}/agenda?vista=kanban&periodo=mes`);
  await pg.getByRole('button', { name: 'Salvar', exact: true }).click();
  await pg.getByRole('button', { name: 'Salvo', exact: true }).waitFor();
  await pg.goto(`${BASE}/inicio`);
  await pg.getByRole('link', { name: 'Agenda' }).click();
  await pg.waitForURL(/vista=kanban/);
  await pg.getByRole('button', { name: 'Resetar', exact: true }).click();
  await pg.waitForURL((u) => u.pathname === '/agenda' && !u.search);
});

await passo('Diária: ação em massa sem marcar pede a marcação', async () => {
  await pg.goto(`${BASE}/agenda?vista=diaria`);
  await pg.getByText('Lista do dia').waitFor();
  await pg.getByRole('button', { name: 'Ação em massa' }).click();
  await pg.getByText('Marque as aulas na lista do dia para usar a ação em massa.').waitFor();
});

const aluno = await entra('persona.a@alumni.teste', 'alumni-a');
await passo('aluno: Minha agenda sem Kanban, sem Novo e presa nas próprias aulas', async () => {
  await aluno.getByRole('link', { name: 'Agenda', exact: true }).click();
  await aluno.getByRole('heading', { name: 'Agenda' }).waitFor();
  assert.equal(await aluno.getByRole('tab', { name: 'Kanban' }).count(), 0);
  assert.equal(await aluno.getByRole('button', { name: 'Novo', exact: true }).count(), 0);
  await aluno.goto(`${BASE}/minha-agenda?vista=semanal&prof=John%20Whitaker`);
  await aluno.waitForTimeout(800);
  const blocos = await aluno.locator('main button[style*="background"]').allInnerTexts();
  assert.ok(
    blocos.every((t) => t.startsWith('Essential 2')),
    blocos.join(' | '),
  );
});
await passo('aluno: histórico de aulas com presença', async () => {
  await aluno.getByRole('link', { name: 'Histórico de aulas', exact: true }).click();
  await aluno.getByText('de presença').waitFor();
  await aluno.getByRole('radio', { name: /Executadas/ }).click();
});

const prof = await entra('persona.i@alumni.teste', 'alumni-i');
await passo('Professora: agenda presa nela (campo de usuário travado)', async () => {
  await prof.goto(`${BASE}/agenda?vista=semanal`);
  const campo = prof.getByRole('button', { name: 'Usuários: Marina Pallotta' });
  await campo.waitFor();
  assert.equal(await campo.isDisabled(), true);
  await prof.waitForTimeout(600);
  const r = await prof.request.get('http://localhost:3333/agenda?vista=semanal');
  const d = await r.json();
  assert.ok(d.aulas.every((a) => a.prof === 'Marina Pallotta'));
});

if (erros.length) {
  console.log('ERROS DE PÁGINA:', [...new Set(erros)]);
  process.exitCode = 1;
}
console.log(`${ok} passos ok`);
await nav.close();
