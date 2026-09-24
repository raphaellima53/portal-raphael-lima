/**
 * Testes da Agenda: visões, filtros presos por perfil, ações na aula com a hierarquia, eventos e layout salvo.
 * Mexem no banco (ajustes de aula e eventos) e desfazem o que criam.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { montaApp } from '../src/app.ts';
import { prisma } from '../src/db.ts';
import { base } from '../src/domain/base.ts';

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
  const c = r.cookies.find((x) => x.name === 'portal_sessao')!;
  return { cookie: `portal_sessao=${c.value}` };
}
const get = async (h: { cookie: string }, url: string) => (await app.inject({ url, headers: h })).json();

/** uma aula futura com alunos, que ainda não foi mexida */
async function aulaFutura(h: { cookie: string }) {
  const d = await get(h, '/agenda?vista=semanal');
  const hoje = new Date();
  const futura = d.aulas.find((a: { estado: string; iso: string; hora: number }) => {
    const q = new Date(`${a.iso}T${String(a.hora).padStart(2, '0')}:00:00`);
    return a.estado === 'comAlunos' && q > hoje;
  });
  return futura as { k: string; prof: string; n: number };
}
const limpaAjuste = async (k: string) => {
  await prisma.aulaAjuste.deleteMany({ where: { chave: k } });
  delete (await base()).ajustes[k];
};

describe('visões e filtros', () => {
  test('as quatro visões respondem com os textos do calendário', async () => {
    const h = await entra('admin@alumni.teste', 'alumni-admin');
    const m = await get(h, '/agenda?vista=mensal&data=2026-09-10');
    assert.equal(m.titulo, 'Setembro 2026');
    assert.equal(m.dias.length, 30);
    const s = await get(h, '/agenda?vista=semanal&data=2026-09-17');
    assert.equal(s.titulo, '13 de setembro – 19 de setembro 2026');
    const d = await get(h, '/agenda?vista=diaria&data=2026-09-13');
    assert.equal(d.vazio, 'domingo — não há aula');
    const k = await get(h, '/agenda?vista=kanban&periodo=mes&data=2026-09-17');
    assert.equal(k.titulo, '01/09/2026 — 30/09/2026');
    assert.deepEqual(
      k.colunas.map((c: { k: string }) => c.k),
      ['semAlunos', 'comAlunos', 'semProfessor', 'executada', 'substituida', 'naoFinalizada', 'cancelada'],
    );
  });

  test('aluno: filtros presos nele e sem Kanban', async () => {
    const h = await entra('persona.b@alumni.teste', 'alumni-b');
    const d = await get(h, '/agenda?vista=kanban&prof=John%20Whitaker&aluno=Alice%20Ferraz');
    assert.equal(d.vista, 'mensal');
    assert.equal(d.filtros.aluno, 'Breno Carvalho');
    assert.equal(d.filtros.prof, '');
    /* pirâmide do aluno: filtros Produtos e Módulos, só com os dele */
    assert.equal(d.opcoes.soAluno, true);
    assert.deepEqual(d.opcoes.cursosDoAluno, ['Community live classes']);
    assert.ok(d.opcoes.modulosDoAluno.every((m: string) => m.startsWith('Community live classes · ')));
    assert.equal(d.podeCriarEvento, false);
  });

  test('Professora: agenda presa nela e produtos só dos cursos dela', async () => {
    const h = await entra('persona.i@alumni.teste', 'alumni-i');
    const d = await get(h, '/agenda?vista=semanal&prof=John%20Whitaker');
    assert.equal(d.filtros.prof, 'Marina Pallotta');
    assert.ok(d.aulas.every((a: { prof: string }) => a.prof === 'Marina Pallotta'));
    assert.deepEqual(d.opcoes.produtos, ['Community live classes', 'Palmares Paulista']);
  });

  test('filtros com vários valores (|) e opções em ordem alfabética, módulos por curso', async () => {
    const h = await entra('admin@alumni.teste', 'alumni-admin');
    const abc = (l: string[]) =>
      [...l].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base', numeric: true }));
    const tudo = await get(h, '/agenda?vista=semanal&data=2026-09-17');
    assert.deepEqual(tudo.opcoes.produtos, abc(tudo.opcoes.produtos));
    const grupos = tudo.opcoes.modulos as { curso: string; itens: { v: string; l: string }[] }[];
    assert.deepEqual(
      grupos.map((g) => g.curso),
      abc(grupos.map((g) => g.curso)),
    );
    for (const g of grupos) {
      assert.deepEqual(
        g.itens.map((i) => i.l),
        abc(g.itens.map((i) => i.l)),
      );
      assert.ok(g.itens.every((i) => i.v === `${g.curso} · ${i.l}`));
    }
    /* dois professores: só aulas deles, e as de ambos aparecem */
    const profs = [...new Set((tudo.aulas as { prof: string }[]).map((a) => a.prof).filter((p) => p !== '—'))].slice(
      0,
      2,
    );
    assert.equal(profs.length, 2);
    const dois = await get(h, `/agenda?vista=semanal&data=2026-09-17&prof=${encodeURIComponent(profs.join('|'))}`);
    const vistos = new Set((dois.aulas as { prof: string }[]).map((a) => a.prof));
    assert.deepEqual([...vistos].sort(), [...profs].sort());
    /* dois módulos de cursos diferentes */
    const mods = grupos.slice(0, 2).map((g) => g.itens[0].v);
    const dm = await get(h, `/agenda?vista=semanal&data=2026-09-17&mod=${encodeURIComponent(mods.join('|'))}`);
    assert.ok((dm.aulas as { prod: string; mod: string }[]).every((a) => mods.includes(`${a.prod} · ${a.mod}`)));
  });
});

describe('ações na aula', () => {
  test('Gestor troca o professor; professor fora da habilitação é recusado', async () => {
    const h = await entra('persona.f@alumni.teste', 'alumni-f');
    const a = await aulaFutura(h);
    const det = await get(h, `/aulas/detalhe?k=${encodeURIComponent(a.k)}`);
    const outro = det.profsHabilitados.find((n: string) => n !== a.prof);
    const r = await app.inject({
      method: 'POST',
      url: '/aulas/acao',
      headers: h,
      payload: { k: a.k, acao: 'professor', prof: outro },
    });
    assert.equal(r.json().msg, `${outro} assume esta aula.`);
    const r2 = await app.inject({
      method: 'POST',
      url: '/aulas/acao',
      headers: h,
      payload: { k: a.k, acao: 'professor', prof: 'Bruno Sanches' },
    });
    assert.equal(r2.statusCode, 400);
    const log = await prisma.logAlteracao.findFirst({ where: { entidadeId: a.k }, orderBy: { id: 'desc' } });
    assert.equal(log?.acao, 'Professor alterado');
    await limpaAjuste(a.k);
  });

  test('cancelar é só até Gestor; Colaborador (nível 4) recebe 403', async () => {
    const h4 = await entra('persona.g@alumni.teste', 'alumni-g');
    const a = await aulaFutura(h4);
    const r = await app.inject({
      method: 'POST',
      url: '/aulas/acao',
      headers: h4,
      payload: { k: a.k, acao: 'cancelar' },
    });
    assert.equal(r.statusCode, 403);
    const h2 = await entra('persona.f@alumni.teste', 'alumni-f');
    const ok = await app.inject({
      method: 'POST',
      url: '/aulas/acao',
      headers: h2,
      payload: { k: a.k, acao: 'cancelar' },
    });
    assert.equal(ok.json().msg, 'Aula cancelada.');
    assert.equal((await get(h2, `/aulas/detalhe?k=${encodeURIComponent(a.k)}`)).estado, 'cancelada');
    await app.inject({ method: 'POST', url: '/aulas/acao', headers: h2, payload: { k: a.k, acao: 'reabrir' } });
    assert.equal((await get(h2, `/aulas/detalhe?k=${encodeURIComponent(a.k)}`)).estado, 'comAlunos');
    await limpaAjuste(a.k);
  });

  test('aluno não abre aula de que não participa nem faz ação', async () => {
    const hAdm = await entra('admin@alumni.teste', 'alumni-admin');
    const d = await get(hAdm, '/agenda?vista=semanal&prod=FAAP');
    const k = d.aulas[0].k;
    const h = await entra('persona.a@alumni.teste', 'alumni-a');
    assert.equal((await app.inject({ url: `/aulas/detalhe?k=${encodeURIComponent(k)}`, headers: h })).statusCode, 404);
    assert.equal(
      (await app.inject({ method: 'POST', url: '/aulas/acao', headers: h, payload: { k, acao: 'cancelar' } }))
        .statusCode,
      404,
    );
  });

  test('valor hora/aula só aparece para quem vê a folha', async () => {
    const hAdm = await entra('admin@alumni.teste', 'alumni-admin');
    const a = await aulaFutura(hAdm);
    assert.equal((await get(hAdm, `/aulas/detalhe?k=${encodeURIComponent(a.k)}`)).folha.ve, true);
    const hCom = await entra('persona.l@alumni.teste', 'alumni-l');
    const f = (await get(hCom, `/aulas/detalhe?k=${encodeURIComponent(a.k)}`)).folha;
    assert.equal(f.ve, false);
    assert.equal(f.valor, null);
  });
});

describe('eventos', () => {
  test('criar com choque pede confirmação; confirmar cria; aluno não cria', async () => {
    const h = await entra('admin@alumni.teste', 'alumni-admin');
    const d = await get(h, '/agenda?vista=diaria');
    const aula = d.aulas.find((a: { prof: string }) => a.prof !== '—');
    const corpo = {
      tipo: 'Reunião',
      titulo: 'Teste de choque',
      data: aula.iso,
      ini: `${String(aula.hora).padStart(2, '0')}:00`,
      fim: `${String(aula.hora).padStart(2, '0')}:30`,
      local: '',
      desc: '',
      part: [{ g: 'prestador', n: aula.prof }],
    };
    const r = await app.inject({ method: 'POST', url: '/eventos', headers: h, payload: corpo });
    assert.equal(r.statusCode, 409);
    assert.match(r.json().erro, /^Choque de horário:/);
    const ok = await app.inject({
      method: 'POST',
      url: '/eventos',
      headers: h,
      payload: { ...corpo, confirmar: true },
    });
    assert.equal(ok.statusCode, 200);
    const id = ok.json().id;
    const del = await app.inject({ method: 'DELETE', url: `/eventos/${id}`, headers: h });
    assert.equal(del.json().msg, 'Reunião excluída.');
    const ha = await entra('persona.a@alumni.teste', 'alumni-a');
    assert.equal((await app.inject({ method: 'POST', url: '/eventos', headers: ha, payload: corpo })).statusCode, 403);
  });

  test('o término precisa ser depois do início', async () => {
    const h = await entra('admin@alumni.teste', 'alumni-admin');
    const r = await app.inject({
      method: 'POST',
      url: '/eventos',
      headers: h,
      payload: {
        tipo: 'Evento',
        titulo: 'x',
        data: '2026-09-18',
        ini: '10:00',
        fim: '09:00',
        part: [{ g: 'colaborador', n: 'Juliana Prado' }],
      },
    });
    assert.equal(r.statusCode, 400);
    assert.equal(r.json().erro, 'O término precisa ser depois do início.');
  });
});

describe('layout salvo', () => {
  test('salvar, ler e apagar', async () => {
    const h = await entra('persona.n@alumni.teste', 'alumni-n');
    const l = {
      agF: { aluno: '', prof: '', prod: 'FAAP', mod: '', tipo: '', qual: '' },
      vista: 'kanban',
      periodo: 'mes',
    };
    await app.inject({ method: 'PUT', url: '/agenda/layout', headers: h, payload: l });
    assert.deepEqual((await get(h, '/agenda/layout')).salvo, l);
    await app.inject({ method: 'DELETE', url: '/agenda/layout', headers: h });
    assert.equal((await get(h, '/agenda/layout')).salvo, null);
  });
});
