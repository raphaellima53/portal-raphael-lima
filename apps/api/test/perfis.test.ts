/**
 * Testes de Configurações › Perfis e hierarquias: o modelo de acesso editável (criar, editar, aplicar aos usuários,
 * excluir, hierarquias) e as travas (Admin e Aluno, perfis usados pelo sistema, colunas do Administrador).
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { montaApp } from '../src/app.ts';
import { prisma } from '../src/db.ts';
import { MATRIZ, NIVEIS, PERFIS, podeAcao } from '../src/domain/acesso.ts';
import { carregaModelo } from '../src/domain/acesso-modelo.ts';

let app: FastifyInstance;
before(async () => {
  await prisma.configuracao.deleteMany({ where: { chave: 'acessoModelo' } });
  app = await montaApp();
});
after(async () => {
  await prisma.usuario.deleteMany({ where: { email: 'perfil.teste@alumni.teste' } });
  await prisma.configuracao.deleteMany({ where: { chave: 'acessoModelo' } });
  await carregaModelo(true);
  await app.close();
  await prisma.$disconnect();
});

async function entra(login: string, senha: string) {
  const r = await app.inject({ method: 'POST', url: '/auth/login', payload: { login, senha } });
  return { cookie: `portal_sessao=${r.cookies.find((x) => x.name === 'portal_sessao')!.value}` };
}
type H = { cookie: string };
const envia = (method: 'POST' | 'PUT' | 'DELETE', url: string, headers: H, payload: object = {}) =>
  app.inject({ method, url, headers, payload });

describe('perfis e hierarquias', () => {
  test('cria perfil, usa num usuário, aplica a mudança e só exclui sem usuários', async () => {
    const h = await entra('admin@alumni.teste', 'alumni-admin');
    const sem = await envia('POST', '/config/perfis', h, {
      tipo: 'Colaborador',
      cargo: 'Analista de testes',
      nivel: 4,
    });
    assert.equal(sem.statusCode, 400);
    assert.match(sem.json().erro, /pelo menos um setor/);

    const r = await envia('POST', '/config/perfis', h, {
      tipo: 'Colaborador',
      cargo: 'Analista de testes',
      area: 'CX',
      nivel: 4,
      areas: { cx: { acesso: 'total' }, aca: { acesso: 'restrito', rotulo: 'Operacional' } },
    });
    assert.equal(r.statusCode, 200, r.body);
    const id = r.json().id as number;
    assert.equal(PERFIS.find((p) => p.id === id)?.cargo, 'Analista de testes');
    assert.deepEqual(MATRIZ[id].areas.aca, { acesso: 'restrito', rotulo: 'Operacional' });

    const dup = await envia('POST', '/config/perfis', h, {
      tipo: 'Colaborador',
      cargo: 'analista de testes',
      nivel: 4,
    });
    assert.match(dup.json().erro, /Já existe um perfil/);

    const u = await envia('POST', '/config/usuarios', h, {
      nome: 'Perfil Teste',
      email: 'perfil.teste@alumni.teste',
      perfilId: id,
      nivel: 4,
      setores: { cx: 'total' },
      justificativa: 'teste de perfil',
    });
    assert.equal(u.statusCode, 200, u.body);

    const ed = await envia('PUT', `/config/perfis/${id}`, h, {
      tipo: 'Colaborador',
      cargo: 'Analista de testes',
      area: 'CX',
      nivel: 3,
      areas: { cx: { acesso: 'total' }, mkt: { acesso: 'total' } },
      aplicar: true,
    });
    assert.equal(ed.statusCode, 200, ed.body);
    assert.match(ed.json().msg, /1 usuário/);
    const salvo = await prisma.usuario.findUniqueOrThrow({ where: { email: 'perfil.teste@alumni.teste' } });
    assert.equal(salvo.nivel, 3);
    assert.deepEqual(Object.keys(salvo.areas as object).sort(), ['cx', 'mkt']);

    const exc = await envia('DELETE', `/config/perfis/${id}`, h);
    assert.match(exc.json().erro, /1 usuário\(s\) usam este perfil/);
    await prisma.usuario.delete({ where: { id: salvo.id } });
    assert.equal((await envia('DELETE', `/config/perfis/${id}`, h)).statusCode, 200);
    assert.equal(
      PERFIS.find((p) => p.id === id),
      undefined,
    );

    const log = await prisma.logAlteracao.findFirst({ where: { acao: 'Perfil excluído' }, orderBy: { id: 'desc' } });
    assert.ok(log);
  });

  test('travas: Admin e Aluno não se editam; perfis do sistema não mudam de tipo nem se excluem', async () => {
    const h = await entra('admin@alumni.teste', 'alumni-admin');
    const corpo = { tipo: 'Colaborador', cargo: 'X qualquer', nivel: 2, areas: { com: { acesso: 'total' } } };
    assert.match((await envia('PUT', '/config/perfis/1', h, corpo)).json().erro, /Admin/);
    assert.match((await envia('PUT', '/config/perfis/15', h, corpo)).json().erro, /Aluno/);
    const tipo = await envia('PUT', '/config/perfis/13', h, { ...corpo, cargo: 'Professor', tipo: 'Colaborador' });
    assert.match(tipo.json().erro, /tipo deste perfil não muda/);
    assert.match((await envia('DELETE', '/config/perfis/16', h)).json().erro, /não se exclui/);
    const f = await entra('persona.f@alumni.teste', 'alumni-f');
    assert.equal((await envia('PUT', '/config/perfis/niveis/3', f, {})).statusCode, 403);
  });

  test('hierarquia: renomeia, muda o que pode e os botões seguem a tabela', async () => {
    const h = await entra('admin@alumni.teste', 'alumni-admin');
    assert.equal(podeAcao(3, 'editar'), true);
    const r = await envia('PUT', '/config/perfis/niveis/3', h, {
      nome: 'Redator',
      acoes: [1, 1, 0, 1, 0, 0, 1, 1],
    });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(NIVEIS.find((n) => n.n === 3)?.nome, 'Redator');
    assert.equal(podeAcao(3, 'editar'), false);
    assert.equal(podeAcao(3, 'criar'), true);
    /* Usuários e Configurações continuam só do Administrador */
    assert.deepEqual(NIVEIS.find((n) => n.n === 3)?.acoes.slice(6), [0, 0]);
    assert.equal(PERFIS.find((p) => p.id === 3)?.hierarquia, 'Redator');
    const adm = await envia('PUT', '/config/perfis/niveis/1', h, {
      nome: 'Administrador',
      acoes: [1, 0, 0, 0, 0, 0, 0, 0],
    });
    assert.equal(adm.statusCode, 200);
    assert.equal(podeAcao(1, 'excluir'), true);
    const cego = await envia('PUT', '/config/perfis/niveis/4', h, {
      nome: 'Colaborador',
      acoes: [0, 1, 0, 1, 0, 0, 0, 0],
    });
    assert.match(cego.json().erro, /visualizar/);

    assert.equal((await envia('POST', '/config/perfis/restaurar', h)).statusCode, 200);
    assert.equal(NIVEIS.find((n) => n.n === 3)?.nome, 'Editor');
    assert.equal(await prisma.configuracao.count({ where: { chave: 'acessoModelo' } }), 0);
    assert.equal(podeAcao(3, 'editar'), true);
  });
});
