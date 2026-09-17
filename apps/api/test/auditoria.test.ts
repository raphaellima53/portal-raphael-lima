/**
 * Testes da Auditoria: só o Administrador entra; histórico da base junto com o que muda no portal, com o link do registro.
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

describe('auditoria', () => {
  test('Admin vê base e portal; o registro de professor abre o log da ficha; Gestor não entra', async () => {
    const h = await entra('admin@alumni.teste', 'alumni-admin');
    /* uma alteração de professor que nenhum outro teste usa: disponibilidade do p9 liga e desliga */
    await app.inject({ method: 'PUT', url: '/professores/p9/disponibilidade', headers: h, payload: { k: 'h21' } });
    await app.inject({ method: 'PUT', url: '/professores/p9/disponibilidade', headers: h, payload: { k: 'h21' } });
    const r = (await app.inject({ method: 'GET', url: '/auditoria', headers: h })).json();
    const base = r.linhas.filter((x: { vivo: boolean }) => !x.vivo);
    assert.ok(base.length >= 5);
    assert.ok(base.some((x: { acao: string }) => x.acao === 'importação'));
    const prof = r.linhas.find((x: { href: string | null }) => x.href === '/professores/p9/log');
    assert.ok(prof, 'linha do professor com link');
    assert.match(prof.acao, /^Disponibilidade alterada( · \d+ cliques)?$/);
    assert.ok(r.entidades.includes('Professor'));
    assert.match(prof.quando, /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/);
    const f = await entra('persona.f@alumni.teste', 'alumni-f');
    assert.equal((await app.inject({ method: 'GET', url: '/auditoria', headers: f })).statusCode, 403);
  });
});
