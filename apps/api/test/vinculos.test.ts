/**
 * Um ID de usuário, vários perfis (21/09/2026): vínculos na ficha, Financeiro do aluno
 * e a visão secundária de aluno do professor que também estuda.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { montaApp } from '../src/app.ts';
import { prisma } from '../src/db.ts';
import { invalidaBase } from '../src/domain/base.ts';

let app: FastifyInstance;
let profUsuarioId = 0;
let alunoId = 0;
let alunoNome = '';
before(async () => {
  app = await montaApp();
  /* a Professora (persona I) passa a estudar: vincula um aluno com matrícula ativa e sem usuário */
  const prof = await prisma.usuario.findUniqueOrThrow({ where: { email: 'persona.i@alumni.teste' } });
  profUsuarioId = prof.id;
  const al = await prisma.aluno.findFirstOrThrow({
    where: { usuario: null, status: 'Ativo', matriculas: { some: {} } },
    orderBy: { id: 'asc' },
  });
  alunoId = al.id;
  alunoNome = al.nome;
  await prisma.usuario.update({ where: { id: prof.id }, data: { alunoId: al.id } });
  invalidaBase();
});
after(async () => {
  await prisma.usuario.update({ where: { id: profUsuarioId }, data: { alunoId: null } });
  invalidaBase();
  await app.close();
  await prisma.$disconnect();
});

async function entra(login: string, senha: string) {
  const r = await app.inject({ method: 'POST', url: '/auth/login', payload: { login, senha } });
  assert.equal(r.statusCode, 200, r.body);
  const c = r.cookies.find((x) => x.name === 'portal_sessao');
  return { cookie: `portal_sessao=${c!.value}` };
}
const get = async (h: { cookie: string }, url: string) => app.inject({ url, headers: h });

describe('um ID, vários perfis', () => {
  test('professor que estuda: menu de professor e a visão de aluno atrás do botão', async () => {
    const h = await entra('persona.i@alumni.teste', 'alumni-i');
    const me = (await get(h, '/auth/me')).json();
    type N = { label: string; visao?: string };
    assert.deepEqual(
      me.nav.filter((n: N) => !n.visao).map((n: N) => n.label),
      ['Agenda', 'Histórico de aulas', 'Meu perfil'],
    );
    assert.deepEqual(
      me.nav.filter((n: N) => n.visao === 'aluno').map((n: N) => n.label),
      ['Agenda', 'Histórico de aulas', 'Meu perfil'],
    );
    const comoProf = (await get(h, '/historico-de-aulas?dias=60')).json();
    assert.equal(comoProf.modo, 'professor');
    const comoAluno = (await get(h, '/historico-de-aulas?dias=60&visao=aluno')).json();
    assert.equal(comoAluno.modo, 'aluno');
    const minha = (await get(h, '/agenda?vista=semanal&minha=1')).json();
    assert.equal(minha.opcoes.soAluno, true);
  });

  test('ficha do aluno: ID do usuário e os perfis vinculados, com link para o professor', async () => {
    const h = await entra('admin@alumni.teste', 'alumni-admin');
    const f = (await get(h, `/alunos/${alunoId}?aba=perfil`)).json();
    const v = f.dados.vinculos;
    assert.match(v.usuario.codigo, /^#\d{5}$/);
    assert.deepEqual(
      v.papeis.map((p: { tipo: string }) => p.tipo),
      ['Aluno', 'Professor'],
    );
    assert.equal(v.papeis[0].nome, alunoNome);
    assert.equal(v.papeis[0].atual, true);
    assert.match(v.papeis[1].href, /^\/professores\/p\d+\/perfil$/);
    const prof = (await get(h, `${v.papeis[1].href.replace('/perfil', '')}?aba=perfil`)).json();
    assert.deepEqual(
      prof.dados.vinculos.papeis.map((p: { tipo: string; atual: boolean }) => `${p.tipo}${p.atual ? '*' : ''}`),
      ['Aluno', 'Professor*'],
    );
  });

  test('ficha do aluno: grupos Matrícula e Financeiro; Financeiro traz as parcelas', async () => {
    const h = await entra('admin@alumni.teste', 'alumni-admin');
    const f = (await get(h, `/alunos/${alunoId}?aba=financeiro`)).json();
    assert.deepEqual(
      f.grupos.map((g: { rotulo: string }) => g.rotulo),
      ['Dados', 'Matrícula', 'Financeiro', 'Contratos', 'Histórico', 'Acesso'],
    );
    assert.equal(f.aba, 'financeiro');
    assert.ok(f.dados.linhas.length > 0);
    assert.equal(f.dados.stats[0].rotulo, 'em contrato');
    assert.equal(f.dados.cobranca, '/acoes/acCobranca');
  });

  test('Financeiro do aluno só para os setores com dinheiro: o pedagógico não vê', async () => {
    const h = await entra('persona.f@alumni.teste', 'alumni-f');
    const f = await get(h, `/alunos/${alunoId}?aba=financeiro`);
    if (f.statusCode === 200) assert.notEqual(f.json().aba, 'financeiro');
  });

  test('aba Acesso: a conta vinculada, com sessões e histórico; só o Admin vê', async () => {
    const h = await entra('admin@alumni.teste', 'alumni-admin');
    const f = (await get(h, `/alunos/${alunoId}?aba=acesso`)).json();
    assert.equal(f.aba, 'acesso');
    assert.deepEqual(
      f.grupos.map((g: { rotulo: string }) => g.rotulo),
      ['Dados', 'Matrícula', 'Financeiro', 'Contratos', 'Histórico', 'Acesso'],
    );
    assert.equal(f.dados.usuario.email, 'persona.i@alumni.teste');
    assert.match(f.dados.usuario.codigo, /^#\d{5}$/);
    assert.ok(Array.isArray(f.dados.sessoes) && Array.isArray(f.dados.historico));
    /* o professor vinculado mostra a mesma conta na ficha dele */
    const prof = f.dados.usuario.email;
    const profId = (await get(h, `/alunos/${alunoId}?aba=perfil`)).json().dados.vinculos.papeis[1].href.split('/')[2];
    const fp = (await get(h, `/professores/${profId}?aba=acesso`)).json();
    assert.equal(fp.aba, 'acesso');
    assert.equal(fp.dados.usuario.email, prof);
    /* quem não é Admin não tem a aba */
    const g = await entra('persona.o@alumni.teste', 'alumni-o');
    const fo = (await get(g, `/alunos/${alunoId}?aba=acesso`)).json();
    assert.notEqual(fo.aba, 'acesso');
    assert.ok(!fo.grupos.some((x: { rotulo: string }) => x.rotulo === 'Acesso'));
  });

  test('aluno sem conta: Criar acesso já leva a pessoa e o vínculo', async () => {
    const h = await entra('admin@alumni.teste', 'alumni-admin');
    const sem = await prisma.aluno.findFirstOrThrow({
      where: { usuario: null, NOT: { id: alunoId } },
      orderBy: { id: 'asc' },
    });
    const f = (await get(h, `/alunos/${sem.id}?aba=acesso`)).json();
    assert.equal(f.dados.usuario, null);
    assert.match(f.dados.criar, new RegExp(`^/configuracoes/usuarios/novo\\?.*aluno=${sem.id}`));
  });

  test('colaborador: a mesma seção Acesso pelo cadastro', async () => {
    const h = await entra('admin@alumni.teste', 'alumni-admin');
    const c = await prisma.colaborador.findFirstOrThrow({ orderBy: { id: 'asc' } });
    const r = (await get(h, `/config/acesso?colab=${c.id}`)).json();
    assert.equal(r.pessoa.tipo, 'Colaborador');
    assert.equal(r.pessoa.nome, c.nome);
    const f = await entra('persona.f@alumni.teste', 'alumni-f');
    assert.equal((await get(f, `/config/acesso?colab=${c.id}`)).statusCode, 403);
  });

  test('Meu perfil: o aluno vê a área dele; o professor, o resumo; o botão Aluno, a área de aluno', async () => {
    const a = await entra('persona.a@alumni.teste', 'alumni-a');
    const pa = (await get(a, '/meu-perfil')).json();
    assert.equal(pa.papel, 'aluno');
    assert.ok(pa.aluno.matriculas.length > 0);
    assert.equal(pa.blocos[0].titulo, 'Conta de acesso');
    const h = await entra('persona.i@alumni.teste', 'alumni-i');
    const pp = (await get(h, '/meu-perfil')).json();
    assert.equal(pp.papel, 'professor');
    assert.equal(pp.aluno, null);
    assert.ok(pp.blocos.length > 1, 'conta + resumo do professor');
    const pv = (await get(h, '/meu-perfil?visao=aluno')).json();
    assert.equal(pv.papel, 'aluno');
    assert.equal(pv.aluno.nome, 'Marina Pallotta');
  });

  test('vincular aluno a outro usuário é recusado', async () => {
    const h = await entra('admin@alumni.teste', 'alumni-admin');
    const outro = await prisma.usuario.findUniqueOrThrow({ where: { email: 'persona.f@alumni.teste' } });
    const form = (await get(h, `/config/usuarios/form?id=${outro.id}`)).json().usuario;
    const r = await app.inject({
      method: 'PUT',
      url: `/config/usuarios/${outro.id}`,
      headers: h,
      payload: { ...form, alunoId },
    });
    assert.equal(r.statusCode, 400);
    assert.match(r.json().erro, /já está vinculado/);
  });
});
