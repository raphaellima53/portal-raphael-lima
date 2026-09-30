/**
 * Lixeira (24/09/2026): só o Admin exclui; o registro vai com o que depende dele e volta igual (mesmos códigos)
 * ao restaurar; apagar de vez tira da Lixeira. Cria e apaga os próprios dados.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { montaApp } from '../src/app.ts';
import { prisma } from '../src/db.ts';
import { invalidaBase } from '../src/domain/base.ts';

let app: FastifyInstance;
const NOME = 'Curso teste lixeira';
before(async () => {
  app = await montaApp();
});
after(async () => {
  await prisma.lixeira.deleteMany({ where: { nome: { startsWith: NOME } } });
  const cs = await prisma.curso.findMany({ where: { nome: { startsWith: NOME } } });
  await prisma.matricula.deleteMany({ where: { cursoId: { in: cs.map((c) => c.id) } } });
  await prisma.oferta.deleteMany({ where: { cursoId: { in: cs.map((c) => c.id) } } });
  await prisma.curso.deleteMany({ where: { id: { in: cs.map((c) => c.id) } } });
  invalidaBase();
  await app.close();
  await prisma.$disconnect();
});

async function entra(login: string, senha: string) {
  const r = await app.inject({ method: 'POST', url: '/auth/login', payload: { login, senha } });
  return { cookie: `portal_sessao=${r.cookies.find((x) => x.name === 'portal_sessao')!.value}` };
}
const req = async (h: { cookie: string }, method: 'GET' | 'POST' | 'DELETE', url: string, payload?: unknown) => {
  const r = await app.inject({ method, url, headers: h, payload: payload as object });
  // biome-ignore lint/suspicious/noExplicitAny: corpo de resposta lido à vontade nos testes
  return { status: r.statusCode, json: r.json() as Record<string, any> };
};

describe('Lixeira', () => {
  test('curso vai com módulos, grade, matrículas e propostas e volta com os mesmos códigos', async () => {
    const h = await entra('admin@alumni.teste', 'alumni-admin');
    const aluno = await prisma.aluno.findFirstOrThrow({ orderBy: { id: 'asc' } });
    const novo = (await req(h, 'POST', '/cursos', {
      nome: NOME,
      cor: '#123456',
      idioma: 'Inglês',
      estrutura: 'modulos',
      itens: [
        {
          nome: 'M1',
          cor: '#123456',
          cefr: 'A1',
          vagas: 5,
          agendamento: { valor: 1, unidade: 'h' },
          cancelamento: { valor: 1, unidade: 'h' },
          horarios: [{ dia: 1, hora: '09:00', professorId: '' }],
        },
      ],
    })) as { status: number; json: { id: number } };
    assert.equal(novo.status, 200, JSON.stringify(novo.json));
    const curso = await prisma.curso.findUniqueOrThrow({
      where: { id: novo.json.id },
      include: { modulos: { include: { horarios: true } } },
    });
    const oferta = await prisma.oferta.findFirst();
    const of = oferta
      ? await prisma.oferta.create({
          data: { ...oferta, id: 'teste-lixeira-of', cursoId: curso.id } as never,
        })
      : null;
    const mat = await prisma.matricula.create({
      data: { alunoId: aluno.id, cursoId: curso.id, modulo: 'M1', usadas: 1, total: 10, ofertaId: of?.id },
    });

    const p = await req(h, 'GET', `/lixeira/previa?tipo=curso&id=${curso.id}`);
    assert.equal(p.status, 200, JSON.stringify(p.json));
    assert.equal(p.json.nome, NOME);
    assert.ok(p.json.junto.includes('1 módulo'));
    assert.ok(p.json.junto.includes('1 matrícula'));

    const ex = await req(h, 'DELETE', `/lixeira/curso/${curso.id}`);
    assert.equal(ex.status, 200, JSON.stringify(ex.json));
    assert.match(ex.json.msg, /foi para a Lixeira com .*1 matrícula/);
    assert.equal(await prisma.curso.count({ where: { id: curso.id } }), 0);
    assert.equal(await prisma.matricula.count({ where: { id: mat.id } }), 0);

    const lista = await req(h, 'GET', '/lixeira');
    const item = lista.json.itens.find((x: { nome: string }) => x.nome === NOME);
    assert.equal(item.rotulo, 'Curso');

    const rs = await req(h, 'POST', `/lixeira/${item.id}/restaurar`);
    assert.equal(rs.status, 200, JSON.stringify(rs.json));
    const volta = await prisma.curso.findUniqueOrThrow({
      where: { id: curso.id },
      include: { modulos: { include: { horarios: true } } },
    });
    assert.equal(volta.modulos[0].id, curso.modulos[0].id);
    assert.equal(volta.modulos[0].horarios[0].hora, '09:00');
    const m2 = await prisma.matricula.findUniqueOrThrow({ where: { id: mat.id } });
    assert.deepEqual([m2.modulo, m2.usadas, m2.ofertaId], ['M1', 1, of?.id ?? null]);
    if (of)
      assert.equal(String((await prisma.oferta.findUniqueOrThrow({ where: { id: of.id } })).preco), String(of.preco));
    assert.equal(await prisma.lixeira.count({ where: { id: item.id } }), 0);

    /* restaurar recusa quando outro com o mesmo nome apareceu; apagar de vez tira da Lixeira */
    await req(h, 'DELETE', `/lixeira/curso/${curso.id}`);
    const outro = (
      await req(h, 'POST', '/cursos', { nome: NOME, cor: '#000000', idioma: 'Inglês', estrutura: 'nenhuma' })
    ).json;
    const it2 = (await req(h, 'GET', '/lixeira')).json.itens.find((x: { nome: string }) => x.nome === NOME);
    const conflito = await req(h, 'POST', `/lixeira/${it2.id}/restaurar`);
    assert.equal(conflito.status, 409);
    assert.match(conflito.json.erro, /mesmo nome/);
    assert.equal(await prisma.curso.count({ where: { id: curso.id } }), 0, 'restauração parcial desfeita');
    await prisma.curso.delete({ where: { id: outro.id } });
    assert.equal((await req(h, 'DELETE', `/lixeira/${it2.id}`)).status, 200);
    assert.equal(await prisma.lixeira.count({ where: { id: it2.id } }), 0);
  });

  test('só o Admin; não exclui o próprio usuário; persona de teste vai com o login e volta', async () => {
    const adm = await entra('admin@alumni.teste', 'alumni-admin');
    const eu = (await req(adm, 'GET', '/auth/me')).json.usuario;
    assert.match((await req(adm, 'DELETE', `/lixeira/usuario/${eu.id}`)).json.erro, /próprio usuário/);
    const persona = await prisma.usuario.findFirstOrThrow({
      where: { personaLetra: { not: null }, alunoId: { not: null } },
    });
    /* 30/09/2026: o aluno da persona vai para a Lixeira levando o login; restaurar devolve os dois */
    const ex = await req(adm, 'DELETE', `/lixeira/aluno/${persona.alunoId}`);
    assert.equal(ex.status, 200, JSON.stringify(ex.json));
    assert.equal(await prisma.usuario.count({ where: { id: persona.id } }), 0);
    assert.equal((await req(adm, 'POST', `/lixeira/${ex.json.lixeiraId}/restaurar`)).status, 200);
    const volta = await prisma.usuario.findUniqueOrThrow({ where: { id: persona.id } });
    assert.equal(volta.alunoId, persona.alunoId);
    assert.equal(volta.personaLetra, persona.personaLetra);
    /* Diretoria/Gestor não: Gestor (persona F) recebe 403 */
    const gestor = await entra('persona.f@alumni.teste', 'alumni-f');
    assert.equal((await req(gestor, 'GET', '/lixeira')).status, 403);
    assert.equal((await req(gestor, 'DELETE', '/lixeira/curso/1')).status, 403);
  });
});
