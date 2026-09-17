/**
 * Testes de Relatórios: recorte, filtro de qualidade, perspectivas dos seletores pelo acesso e o Dashboard financeiro.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { montaApp } from '../src/app.ts';
import { prisma } from '../src/db.ts';

let app: FastifyInstance;
before(async () => {
  app = await montaApp();
});
after(async () => {
  await app.close();
  await prisma.$disconnect();
});

async function entra(login: string, senha: string) {
  const r = await app.inject({ method: 'POST', url: '/auth/login', payload: { login, senha } });
  return { cookie: `portal_sessao=${r.cookies.find((x) => x.name === 'portal_sessao')!.value}` };
}
const get = async (url: string, headers: { cookie: string }) => app.inject({ method: 'GET', url, headers });

describe('relatórios', () => {
  test('presença: recorte por curso e qualidade só deixa quem tem o ponto; linha abre a ficha', async () => {
    const h = await entra('admin@alumni.teste', 'alumni-admin');
    const r = (await get('/relatorios/rp/rpPresenca?dias=30', h)).json();
    assert.equal(r.t, 'Presença por aluno');
    assert.deepEqual(
      r.cols.map((c: { t: string }) => c.t),
      ['Aluno', 'Cursos', 'Aulas dadas', 'Presenças', 'Faltas', 'Sem registro', 'Presença'],
    );
    assert.equal(r.resumo[0].v, String(r.linhas.length));
    assert.match(r.recorte, /^\d{2}\/\d{2}\/\d{4} a \d{2}\/\d{2}\/\d{4} · todos os cursos$/);
    assert.match(r.linhas[0].href, /^\/alunos\/\d+\/agendamentos\?quando=passadas$/);
    const f = (await get('/relatorios/rp/rpPresenca?dias=30&qual=faltas', h)).json();
    assert.ok(f.linhas.length > 0 && f.linhas.length < r.linhas.length);
    assert.ok(f.linhas.every((l: { v: { f: number } }) => l.v.f >= 2));
    assert.equal(f.arquivo, 'presenca-por-aluno-faltas');
    const c = (await get(`/relatorios/rp/rpPresenca?dias=90&curso=${encodeURIComponent('Alumni Black')}`, h)).json();
    assert.equal(c.filtro.dias, 90);
    assert.ok(c.linhas.every((l: { v: { cursos: string } }) => l.v.cursos.includes('Alumni Black')));
    /* valor fora da lista volta ao padrão */
    assert.equal((await get('/relatorios/rp/rpPresenca?dias=13&qual=xx', h)).json().filtro.dias, 30);
  });

  test('aulas por curso agrupa por módulo; ocupação não tem período', async () => {
    const h = await entra('admin@alumni.teste', 'alumni-admin');
    const c = (await get('/relatorios/rp/rpAulas', h)).json();
    const i = (await get('/relatorios/rp/rpAulas?grupo=item', h)).json();
    assert.equal(c.cols[1].t, 'Aulas no período');
    assert.equal(i.cols[1].t, 'Módulo ou turma');
    assert.ok(i.linhas.length > c.linhas.length);
    const o = (await get('/relatorios/rp/rpOcupacao', h)).json();
    assert.equal(o.periodo, false);
    assert.match(o.recorte, /^situação de hoje · /);
    assert.equal((await get('/relatorios/rp/rpNada', h)).statusCode, 404);
  });

  test('acesso: Gerente comercial não abre Avaliação nem Financeiro e vê só Alunos e Cursos nos seletores', async () => {
    const l = await entra('persona.l@alumni.teste', 'alumni-l');
    assert.equal((await get('/relatorios/rp/rpAvaliacao', l)).statusCode, 403);
    assert.equal((await get('/relatorios/financeiro', l)).statusCode, 403);
    const s = (await get('/relatorios/seletores?pers=professor', l)).json();
    assert.deepEqual(
      s.perspectivas.map((p: { v: string }) => p.v),
      ['aluno', 'curso'],
    );
    assert.equal(s.filtro.pers, 'aluno');
    const cur = (await get('/relatorios/seletores?pers=curso&prod=FAAP', l)).json();
    assert.deepEqual(
      cur.linhas.map((x: { v: { nome: string } }) => x.v.nome),
      ['FAAP'],
    );
  });

  test('financeiro: 6 meses, KPIs e registrar pagamento tira a parcela de Vencidas', async () => {
    const h = await entra('admin@alumni.teste', 'alumni-admin');
    const d = (await get('/relatorios/financeiro', h)).json();
    assert.equal(d.serie.length, 6);
    assert.equal(d.kpis.length, 6);
    assert.equal(d.ym, d.meses[0].v);
    assert.ok(d.cobrancas.vencidas.length > 0);
    const alvo = d.cobrancas.vencidas.at(-1);
    const p = await app.inject({
      method: 'POST',
      url: '/relatorios/financeiro/pagar',
      headers: h,
      payload: { key: alvo.key },
    });
    assert.equal(p.statusCode, 200, p.body);
    assert.match(p.json().msg, /registrada como paga: R\$ /);
    const de = (await get('/relatorios/financeiro', h)).json();
    assert.ok(!de.cobrancas.vencidas.some((c: { key: string }) => c.key === alvo.key));
    assert.ok(de.cobrancas.pagas.some((c: { key: string }) => c.key === alvo.key));
    const again = await app.inject({
      method: 'POST',
      url: '/relatorios/financeiro/pagar',
      headers: h,
      payload: { key: alvo.key },
    });
    assert.equal(again.statusCode, 409);
  });
});
