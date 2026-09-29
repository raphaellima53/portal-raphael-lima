// Community Flow no navegador (Edge instalado): créditos na ficha do aluno e agendamento da aula particular.
// Uso: node scripts/e2e-flow.mjs   (API e web rodando; banco com o Community live classes e alunos no Community Flow)
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const BASE = process.env.WEB_URL ?? 'http://localhost:3000';
const API = process.env.API_URL ?? 'http://localhost:3333';
const FOTOS = process.env.FOTOS;
const nav = await chromium.launch({ channel: 'msedge', headless: true });
const erros = [];
const passo = async (nome, f) => {
  try {
    await f();
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

const pg = await entra('admin@alumni.teste', 'alumni-admin');
/* um aluno com adesão ao Community Flow, crédito e horário livre */
const lista = await (await pg.request.get(`${API}/alunos`)).json();
let aluno = null;
for (const a of lista.linhas ?? lista.alunos ?? []) {
  const f = await (await pg.request.get(`${API}/flow?alunoId=${a.id}`)).json();
  if (f.adesao && f.saldo > 0 && f.dias.length) {
    aluno = { ...a, flow: f };
    break;
  }
}
let criada = null;

await passo('ficha › Cursos: cartão do Community Flow com créditos e presenças', async () => {
  assert.ok(aluno, 'nenhum aluno com crédito e horário livre');
  await pg.goto(`${BASE}/alunos/${aluno.id}/cursos`);
  const c = pg.locator('[data-flow]');
  await c.waitFor();
  await c
    .getByText(`${aluno.flow.saldo.toLocaleString('pt-BR')} crédito`)
    .first()
    .waitFor();
  await c.getByText(/presenças? · .*créditos? ganhos?/).waitFor();
  await pg.getByText('aula particular agendada com crédito').first().waitFor();
  if (FOTOS) await pg.screenshot({ path: `${FOTOS}/flow-ficha.png`, fullPage: true });
});

await passo('Agendar aula particular: escolhe o dia e o horário e agenda', async () => {
  await pg.getByRole('button', { name: 'Agendar aula particular' }).click();
  const d = pg.getByRole('dialog');
  await d.getByText('Horário').first().waitFor();
  const h = aluno.flow.dias[0].horas[0];
  /* cada horário mostra o professor e as vagas que sobram */
  const btn = d.getByRole('button', { name: new RegExp(`^${h.hora}`) });
  await btn.getByText(`Professor: ${h.prof}`).waitFor();
  await btn.getByText(`${h.vagas} ${h.vagas === 1 ? 'vaga' : 'vagas'}`).waitFor();
  await btn.click();
  if (FOTOS) await pg.screenshot({ path: `${FOTOS}/flow-agendar.png` });
  await d.getByRole('button', { name: 'Agendar', exact: true }).click();
  await pg.getByText(/Aula Community Flow agendada:/).waitFor();
  const f = await (await pg.request.get(`${API}/flow?alunoId=${aluno.id}`)).json();
  assert.equal(f.usados, aluno.flow.usados + 1);
  criada = f.agendadas.at(-1)?.k ?? null;
  await pg.locator('[data-flow]').getByText('Aulas particulares agendadas').waitFor();
});

/* limpa: a aula agendada vai para a Lixeira e sai de vez */
if (criada) {
  const id = /Aula avulsa (av-[\w-]+)/.exec(criada)?.[1];
  const ex = await (await pg.request.delete(`${API}/lixeira/aulaAvulsa/${id}`)).json();
  if (ex.lixeiraId) await pg.request.delete(`${API}/lixeira/${ex.lixeiraId}`);
}
if (erros.length) {
  console.log('ERRO erros de página:', erros.join(' | '));
  process.exitCode = 1;
}
await nav.close();
