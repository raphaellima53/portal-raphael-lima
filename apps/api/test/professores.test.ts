/**
 * Testes de Professores: lista e ações por nível, ficha com abas por acesso, cadastro, habilitação com titular,
 * disponibilidade, avaliação registrada e Acessar como. Criam um professor de teste e apagam no fim.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { montaApp } from '../src/app.ts';
import { prisma } from '../src/db.ts';
import { invalidaBase } from '../src/domain/base.ts';

let app: FastifyInstance;
const criados: string[] = [];
before(async () => {
  app = await montaApp();
  invalidaBase();
});
after(async () => {
  await prisma.professor.deleteMany({ where: { id: { in: criados } } });
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
  // biome-ignore lint/suspicious/noExplicitAny: corpo de resposta lido à vontade nos testes
  return { status: r.statusCode, json: r.json() as Record<string, any> };
};
const adm = () => entra('admin@alumni.teste', 'alumni-admin');

describe('professores', () => {
  test('lista com a grade e as ações por nível; aluno não entra', async () => {
    const r = (await req(await adm(), 'GET', '/professores')).json;
    assert.equal(r.professores[0].nome, 'Ana Beatriz Lorenzi');
    assert.ok(r.professores.length >= 10, 'a Admissão de Ações pode ter criado mais um');
    assert.deepEqual(r.pode, { criar: true, editar: true, desativar: true, como: true, ficha: true });
    const aluno = await entra('persona.a@alumni.teste', 'alumni-a');
    assert.equal((await req(aluno, 'GET', '/professores')).status, 403);
  });

  test('habilitação: titular não sai; recortar e voltar a todos', async () => {
    const h = await adm();
    const tira = await req(h, 'PUT', '/professores/p1/habilitacao/curso', { curso: 'Palmares Paulista' });
    assert.equal(tira.status, 409);
    assert.match(tira.json.erro, /é titular de Turma 1, Turma 4, Turma 7 em Palmares Paulista/);
    const item = await req(h, 'PUT', '/professores/p1/habilitacao/item', {
      curso: 'Palmares Paulista',
      item: 'Turma 1',
    });
    assert.equal(item.status, 409);
    await req(h, 'PUT', '/professores/p1/habilitacao/item', { curso: 'Community live classes', item: 'Apex 3' });
    let c = (await req(h, 'GET', '/professores/p1?aba=cursos')).json.dados.cursos[0];
    assert.match(c.resumo, /^habilitado em 12 de 13 módulos/);
    await req(h, 'PUT', '/professores/p1/habilitacao/item', { curso: 'Community live classes', item: 'Apex 3' });
    c = (await req(h, 'GET', '/professores/p1?aba=cursos')).json.dados.cursos[0];
    assert.match(c.resumo, /^habilitado em 13 de 13 módulos/);
    const log = (await req(h, 'GET', '/professores/p1?aba=log')).json.dados.linhas;
    assert.equal(log[0].acao, 'Habilitação recortada');
    assert.equal(log.at(-1).acao, 'Cadastro na base');
  });

  test('novo professor, editar, habilitar curso, desativar e reativar', async () => {
    const h = await adm();
    assert.equal((await req(h, 'POST', '/professores', { nome: 'x' })).json.erro, 'Informe o nome.');
    assert.equal(
      (await req(h, 'POST', '/professores', { nome: 'ana beatriz lorenzi' })).json.erro,
      'Já existe um professor com esse nome.',
    );
    const novo = await req(h, 'POST', '/professores', {
      nome: 'Professor de teste api',
      email: 'p@teste.teste',
      teto: 10,
      cpf: '529.982.247-25',
      cnpj: '12.345.678/0001-95',
      telefone: '+55 (11) 91234-5678',
      admissao: '2026-09-01',
    });
    assert.equal(novo.status, 200, JSON.stringify(novo.json));
    const id = novo.json.id as string;
    criados.push(id);
    assert.match(
      (await req(h, 'PUT', `/professores/${id}/habilitacao/curso`, { curso: 'Alumni Black' })).json.msg,
      /habilitado em Alumni Black\.$/,
    );
    const ed = await req(h, 'PUT', `/professores/${id}`, {
      nome: 'Professor de teste api',
      email: 'p@teste.teste',
      teto: 12,
      cursos: ['Alumni Black'],
      ativo: true,
    });
    assert.equal(ed.json.msg, 'Dados de Professor de teste api salvos.');
    const k = await entra('persona.k@alumni.teste', 'alumni-k');
    assert.equal((await req(k, 'POST', `/professores/${id}/desativar`)).status, 403);
    assert.match((await req(h, 'POST', `/professores/${id}/desativar`)).json.msg, /desativado/);
    assert.match((await req(h, 'POST', `/professores/${id}/reativar`)).json.msg, /reativado/);
  });

  test('avaliação registrada entra nos Feedbacks', async () => {
    const h = await adm();
    const fb = (await req(h, 'GET', '/professores/p1?aba=feedbacks')).json.dados;
    const antes = fb.lista.length;
    assert.equal(
      (await req(h, 'POST', '/professores/p1/avaliacoes', { aula: fb.aulas[0].k, aluno: '', nota: 5 })).json.erro,
      'Escolha o aluno.',
    );
    const ok = await req(h, 'POST', '/professores/p1/avaliacoes', {
      aula: fb.aulas[0].k,
      aluno: fb.alunos[0],
      nota: 2,
      texto: 'Começou atrasada',
    });
    assert.equal(ok.json.msg, `Avaliação de ${fb.alunos[0]} registrada: nota 2.`);
    const depois = (await req(h, 'GET', '/professores/p1?aba=feedbacks')).json.dados;
    assert.equal(depois.lista.length, antes + 1);
    assert.equal(depois.lista[0].registrada, true);
    await prisma.avaliacaoProfessor.deleteMany({ where: { professorId: 'p1', texto: 'Começou atrasada' } });
  });

  test('acessar como: vira Prestador com a agenda presa no professor e volta', async () => {
    const h = await adm();
    assert.equal((await req(h, 'POST', '/professores/p1/acessar-como', { volta: '/professores' })).json.ir, '/inicio');
    const me = (await req(h, 'GET', '/auth/me')).json.usuario;
    assert.equal(me.nome, 'Ana Beatriz Lorenzi');
    assert.equal(me.tipoPerfil, 'Prestador');
    assert.deepEqual(me.agendaPresa, { prof: 'Ana Beatriz Lorenzi' });
    assert.equal((await req(h, 'POST', '/professores/p2/acessar-como')).status, 403, 'não encadeia');
    assert.equal((await req(h, 'POST', '/auth/como-voltar')).json.ir, '/professores');
    assert.equal((await req(h, 'GET', '/auth/me')).json.usuario.tipoPerfil, 'Admin');
  });
});
