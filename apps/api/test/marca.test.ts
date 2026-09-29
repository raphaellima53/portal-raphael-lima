/**
 * Tema da sub-marca (24/09/2026): o /auth/me diz marca "black" só para o aluno com matrícula ativa no Alumni Black.
 * Cria um curso "Alumni Black (teste marca)" e uma matrícula temporária, e apaga no fim.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { montaApp } from '../src/app.ts';
import { prisma } from '../src/db.ts';
import { invalidaBase } from '../src/domain/base.ts';

let app: FastifyInstance;
const NOME = 'Alumni Black (teste marca)';
before(async () => {
  app = await montaApp();
});
after(async () => {
  const cs = await prisma.curso.findMany({ where: { nome: NOME } });
  await prisma.matricula.deleteMany({ where: { cursoId: { in: cs.map((c) => c.id) } } });
  await prisma.curso.deleteMany({ where: { id: { in: cs.map((c) => c.id) } } });
  invalidaBase();
  await app.close();
  await prisma.$disconnect();
});

async function me(login: string, senha: string) {
  const r = await app.inject({ method: 'POST', url: '/auth/login', payload: { login, senha } });
  const cookie = `portal_sessao=${r.cookies.find((x) => x.name === 'portal_sessao')!.value}`;
  return (await app.inject({ url: '/auth/me', headers: { cookie } })).json().usuario;
}

describe('tema da sub-marca', () => {
  test('aluno do Alumni Black recebe marca black; os outros não', async () => {
    const adm = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { login: 'admin@alumni.teste', senha: 'alumni-admin' },
    });
    const cookie = `portal_sessao=${adm.cookies.find((x) => x.name === 'portal_sessao')!.value}`;
    const c = await app.inject({
      method: 'POST',
      url: '/cursos',
      headers: { cookie },
      payload: { nome: NOME, cor: '#08080a', idioma: 'Inglês', estrutura: 'nenhuma' },
    });
    assert.equal(c.statusCode, 200, c.body);
    const persona = await prisma.usuario.findFirstOrThrow({ where: { email: 'persona.a@alumni.teste' } });
    assert.equal((await me('persona.a@alumni.teste', 'alumni-a')).marca, null);
    const m = await prisma.matricula.create({
      data: { alunoId: persona.alunoId!, cursoId: c.json().id, usadas: 0, total: 8 },
    });
    assert.equal((await me('persona.a@alumni.teste', 'alumni-a')).marca, 'black');
    /* a equipe nunca vê o tema, mesmo o Admin */
    assert.equal((await me('admin@alumni.teste', 'alumni-admin')).marca, null);
    /* matrícula encerrada tira o tema */
    await prisma.matricula.update({ where: { id: m.id }, data: { desativadoEm: new Date() } });
    assert.equal((await me('persona.a@alumni.teste', 'alumni-a')).marca, null);
  });
});
