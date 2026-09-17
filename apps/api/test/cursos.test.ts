/**
 * Testes de Cursos: catálogo, abas por acesso, regras, criar e editar curso, currículos com versões.
 * Criam um curso e um currículo de teste e apagam no fim.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { montaApp } from '../src/app.ts';
import { prisma } from '../src/db.ts';
import { invalidaBase } from '../src/domain/base.ts';

let app: FastifyInstance;
const criados: { cursos: number[]; curriculos: string[] } = { cursos: [], curriculos: [] };
before(async () => {
  app = await montaApp();
});
after(async () => {
  await prisma.curriculo.deleteMany({ where: { id: { in: criados.curriculos } } });
  await prisma.curso.deleteMany({ where: { id: { in: criados.cursos } } });
  await app.close();
  await prisma.$disconnect();
});

async function entra(login: string, senha: string) {
  const r = await app.inject({ method: 'POST', url: '/auth/login', payload: { login, senha } });
  return { cookie: `portal_sessao=${r.cookies.find((x) => x.name === 'portal_sessao')!.value}` };
}
const req = async (
  h: { cookie: string },
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  payload?: unknown,
) => {
  const r = await app.inject({ method, url, headers: h, payload: payload as object });
  return { status: r.statusCode, json: r.json() };
};

describe('cursos', () => {
  test('catálogo com os 5 cursos e as abas conforme o setor', async () => {
    invalidaBase();
    const adm = await entra('admin@alumni.teste', 'alumni-admin');
    const cat = (await req(adm, 'GET', '/cursos')).json;
    assert.deepEqual(
      cat.cursos.map((c: { nome: string }) => c.nome),
      ['Community live classes', 'Conexión Español', 'Alumni Black', 'FAAP', 'Palmares Paulista'],
    );
    const faap = cat.cursos.find((c: { nome: string }) => c.nome === 'FAAP');
    const mkt = await entra('persona.k@alumni.teste', 'alumni-k');
    const r = (await req(mkt, 'GET', `/cursos/${faap.id}?aba=regras`)).json;
    assert.deepEqual(r.abas, ['geral', 'grade']);
    assert.equal(r.aba, 'geral');
    const prof = await entra('persona.i@alumni.teste', 'alumni-i');
    assert.equal((await req(prof, 'GET', '/cursos')).status, 403);
  });

  test('regras: Colaborador (nível 4) não salva; Admin salva e a grade lê a duração nova', async () => {
    const adm = await entra('admin@alumni.teste', 'alumni-admin');
    const faap = (await req(adm, 'GET', '/cursos')).json.cursos.find((c: { nome: string }) => c.nome === 'FAAP');
    const corpo = { duracao: 60, modalidades: [], pacote: 36, cancelamento: 6, autoAgenda: false, valorAula: 380 };
    const g = await entra('persona.g@alumni.teste', 'alumni-g');
    assert.equal((await req(g, 'PUT', `/cursos/${faap.id}/regras`, corpo)).status, 403);
    const ok = await req(adm, 'PUT', `/cursos/${faap.id}/regras`, corpo);
    assert.match(ok.json.msg, /Regras de FAAP salvas/);
    const regras = (await req(adm, 'GET', `/cursos/${faap.id}?aba=regras`)).json.dados;
    assert.deepEqual(regras.modalidades, ['Online'], 'sem modalidade marcada vale Online');
    const grade = (await req(adm, 'GET', `/cursos/${faap.id}?aba=grade`)).json.dados;
    assert.equal(grade.linhas.find((l: { item: string }) => l.item === 'Turma 1').horario, '08:00–09:00');
    await req(adm, 'PUT', `/cursos/${faap.id}/regras`, {
      ...corpo,
      duracao: 50,
      modalidades: ['Presencial', 'Online'],
    });
  });

  test('novo curso com turmas; editar mantém a turma que já existia e renomeia sem perder dados', async () => {
    const adm = await entra('admin@alumni.teste', 'alumni-admin');
    const vazio = await req(adm, 'POST', '/cursos', { nome: '', cor: '#123456' });
    assert.equal(vazio.status, 400);
    const dup = await req(adm, 'POST', '/cursos', { nome: 'faap', cor: '#123456' });
    assert.equal(dup.json.erro, 'Já existe um curso com esse nome.');
    const novo = await req(adm, 'POST', '/cursos', {
      nome: 'Curso de teste api',
      cor: '#123456',
      estrutura: 'turmas',
      tipo: 'Turmas dedicadas',
      idioma: 'Inglês',
      itens: [{ nome: 'Turma A', cor: '#123456' }],
    });
    assert.equal(novo.status, 200);
    criados.cursos.push(novo.json.id);
    await prisma.turma.updateMany({
      where: { cursoId: novo.json.id, nome: 'Turma A' },
      data: { vagas: 7, grade: 'Seg · 10:00' },
    });
    const ed = await req(adm, 'PUT', `/cursos/${novo.json.id}`, {
      nome: 'Curso de teste api 2',
      cor: '#123456',
      estrutura: 'turmas',
      itens: [
        { nome: 'Turma A', cor: '#123456' },
        { nome: 'Turma B', cor: '#123456' },
      ],
    });
    assert.equal(ed.status, 200);
    const turmas = await prisma.turma.findMany({ where: { cursoId: novo.json.id }, orderBy: { ordem: 'asc' } });
    assert.deepEqual(
      turmas.map((t) => [t.nome, t.vagas, t.grade]),
      [
        ['Turma A', 7, 'Seg · 10:00'],
        ['Turma B', 20, '—'],
      ],
    );
    const semItens = await req(adm, 'PUT', `/cursos/${novo.json.id}`, {
      nome: 'Curso de teste api 2',
      cor: '#123456',
      estrutura: 'turmas',
      itens: [],
    });
    assert.equal(semItens.status, 200);
    assert.equal((await prisma.curso.findUnique({ where: { id: novo.json.id } }))?.estrutura, 'nenhuma');
  });
});

describe('currículos', () => {
  test('quem edita: Gestor pedagógico sim, Professora não', async () => {
    const prof = await entra('persona.i@alumni.teste', 'alumni-i');
    const r = await req(prof, 'POST', '/curriculos/cur1/versao');
    assert.equal(r.status, 403);
    const f = await entra('persona.f@alumni.teste', 'alumni-f');
    const d = (await req(f, 'GET', '/curriculos/cur1')).json;
    assert.equal(d.pode.editar, true);
    assert.equal(d.pode.excluir, false, 'Gestor não exclui');
  });

  test('criar, conteúdo no rascunho, publicar, nova versão, mover, descartar e excluir', async () => {
    const adm = await entra('admin@alumni.teste', 'alumni-admin');
    const criado = await req(adm, 'POST', '/curriculos', {
      nome: 'Acervo de teste api · Unidade 1',
      grupo: '__novo',
      grupoNovo: 'Acervo de teste api',
      idioma: 'Espanhol',
    });
    assert.equal(criado.status, 200, JSON.stringify(criado.json));
    const id = criado.json.id;
    criados.curriculos.push(id);
    assert.equal(
      (await req(adm, 'POST', `/curriculos/${id}/publicar`)).json.erro,
      'Um currículo precisa de pelo menos um conteúdo para ser publicado.',
    );
    const link = await req(adm, 'POST', `/curriculos/${id}/conteudos`, { titulo: 'A', in: 'javascript:alert(1)' });
    assert.equal(link.status, 400);
    await req(adm, 'POST', `/curriculos/${id}/conteudos`, {
      titulo: 'A',
      voc: 'hola (n); correr (v)',
      in: 'https://x.teste/a',
    });
    await req(adm, 'POST', `/curriculos/${id}/conteudos`, { titulo: 'B' });
    const pub = await req(adm, 'POST', `/curriculos/${id}/publicar`);
    assert.match(pub.json.msg, /^v1 publicada\. As aulas geradas a partir de agora leem os 2 conteúdos dela\.$/);
    const mov = await req(adm, 'POST', `/curriculos/${id}/conteudos/1/mover`, { d: -1 });
    assert.match(mov.json.msg, /As mudanças foram para a v2 em rascunho/);
    let d = (await req(adm, 'GET', `/curriculos/${id}`)).json;
    assert.deepEqual(
      d.versoes[1].conteudos.map((x: { titulo: string }) => x.titulo),
      ['B', 'A'],
    );
    assert.deepEqual(
      d.versoes[0].conteudos.map((x: { titulo: string }) => x.titulo),
      ['A', 'B'],
      'publicada não muda',
    );
    assert.deepEqual(d.versoes[0].conteudos[0].voc, [
      ['hola', 'n'],
      ['correr', 'v'],
    ]);
    await req(adm, 'POST', `/curriculos/${id}/descartar`);
    d = (await req(adm, 'GET', `/curriculos/${id}`)).json;
    assert.equal(d.versoes.length, 1);
    const log = await prisma.logAlteracao.findMany({ where: { entidadeId: id }, orderBy: { id: 'asc' } });
    assert.ok(log.some((l) => l.acao === 'Versão publicada'));
    assert.equal((await req(adm, 'DELETE', `/curriculos/${id}`)).status, 200);
  });
});
