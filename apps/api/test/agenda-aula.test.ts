/**
 * Agenda de 24/09/2026: + Novo › Aula (aula avulsa com tópico), Bloquear horário, Gerenciar alunos › Adicionar,
 * Encerrar disponibilidade na grade e Transcrição (Zoom não conectado). Cria e apaga o próprio curso.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { montaApp } from '../src/app.ts';
import { prisma } from '../src/db.ts';
import { agISO } from '../src/domain/agenda.ts';
import { invalidaBase } from '../src/domain/base.ts';

let app: FastifyInstance;
const NOME = 'Curso teste agenda nova';
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

async function entra(login: string, senha: string) {
  const r = await app.inject({ method: 'POST', url: '/auth/login', payload: { login, senha } });
  return { cookie: `portal_sessao=${r.cookies.find((x) => x.name === 'portal_sessao')!.value}` };
}
const req = async (h: { cookie: string }, method: 'GET' | 'POST', url: string, payload?: unknown) => {
  const r = await app.inject({ method, url, headers: h, payload: payload as object });
  // biome-ignore lint/suspicious/noExplicitAny: corpo de resposta lido à vontade nos testes
  return { status: r.statusCode, json: r.json() as Record<string, any> };
};
/** próxima data com o dia da semana pedido, a pelo menos 3 dias de hoje */
const proxima = (dow: number, mais = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  while (d.getDay() !== dow) d.setDate(d.getDate() + 1);
  d.setDate(d.getDate() + mais);
  return agISO(d);
};

describe('Agenda: aula avulsa e ações novas da aula', () => {
  test('aula avulsa, bloquear, incluir aluno, encerrar na grade e transcrição', async () => {
    const h = await entra('admin@alumni.teste', 'alumni-admin');
    const prof = await prisma.professor.findFirstOrThrow({ where: { ativo: true }, orderBy: { ordem: 'asc' } });
    const novo = await req(h, 'POST', '/cursos', {
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
          horarios: [{ dia: 2, hora: '10:00', professorId: prof.id }],
        },
      ],
    });
    assert.equal(novo.status, 200, JSON.stringify(novo.json));
    const cid = novo.json.id as number;
    await prisma.professor.update({ where: { id: prof.id }, data: { cursos: { push: NOME } } });
    const [a1, a2, a3] = await prisma.aluno.findMany({ orderBy: { id: 'asc' }, take: 3 });
    for (const a of [a1, a2])
      await prisma.matricula.create({ data: { alunoId: a.id, cursoId: cid, modulo: 'M1', usadas: 0, total: 10 } });
    invalidaBase();
    try {
      /* + Novo › Aula */
      const op = await req(h, 'GET', '/aulas/avulsas/opcoes');
      const oc = op.json.cursos.find((c: { nome: string }) => c.nome === NOME);
      assert.deepEqual([oc.rotuloItem, oc.itens], ['Módulo', ['M1']]);
      assert.deepEqual(
        oc.alunos,
        [a1.nome, a2.nome].sort((x, y) => x.localeCompare(y, 'pt-BR')),
      );
      const qua = proxima(3);
      const base = {
        cursoId: cid,
        modulo: 'M1',
        topico: 'Revisão geral',
        professorId: prof.id,
        data: qua,
        local: '',
        desc: 'Aula extra',
      };
      assert.match(
        (await req(h, 'POST', '/aulas/avulsas', { ...base, ini: '16:00', fim: '15:00' })).json.erro,
        /término/,
      );
      assert.match(
        (await req(h, 'POST', '/aulas/avulsas', { ...base, ini: '15:00', fim: '16:30', alunos: [a3.nome] })).json.erro,
        /Sem matrícula ativa/,
      );
      const cria = await req(h, 'POST', '/aulas/avulsas', { ...base, ini: '15:00', fim: '16:30', alunos: [a1.nome] });
      assert.equal(cria.status, 200, JSON.stringify(cria.json));
      const av = (await req(h, 'GET', `/aulas/detalhe?k=${encodeURIComponent(cria.json.k)}`)).json;
      assert.deepEqual(
        [av.topico, av.inicio, av.termino, av.prof, av.n],
        ['Revisão geral', '15:00', '16:30', prof.nome, 1],
      );
      assert.equal(av.avulsa.descricao, 'Aula extra');
      /* avulsa não vira horário semanal da grade */
      const grade = (await req(h, 'GET', `/cursos/${cid}?aba=modulos`)).json.dados.modulos[0].horarios;
      assert.equal(grade.length, 1);

      /* aula da grade na terça: bloquear e desbloquear */
      const ter = proxima(2);
      const k = [NOME, 'M1', 'Turma aberta', ter, 10].join('|');
      const antes = (await req(h, 'GET', `/aulas/detalhe?k=${encodeURIComponent(k)}`)).json;
      assert.equal(antes.n, 2, JSON.stringify(antes));
      assert.equal(antes.encerrarGrade.pode, true);
      const bl = await req(h, 'POST', '/aulas/acao', { k, acao: 'bloquear' });
      assert.match(bl.json.msg, /2 alunos recebem o crédito de volta/);
      const blq = (await req(h, 'GET', `/aulas/detalhe?k=${encodeURIComponent(k)}`)).json;
      assert.deepEqual(
        [blq.bloqueada, blq.est[0], blq.estado, blq.podeReabrir],
        [true, 'Horário bloqueado', 'cancelada', false],
      );
      await req(h, 'POST', '/aulas/acao', { k, acao: 'bloquear' });
      assert.equal((await req(h, 'GET', `/aulas/detalhe?k=${encodeURIComponent(k)}`)).json.bloqueada, false);

      /* Gerenciar alunos › Adicionar: só com matrícula no curso; remover tira */
      const mat3 = await prisma.matricula.create({ data: { alunoId: a3.id, cursoId: cid, usadas: 0, total: 10 } });
      invalidaBase();
      const inc = await req(h, 'POST', '/aulas/acao', { k, acao: 'adicionarAluno', aluno: a3.nome });
      assert.equal(inc.status, 200, JSON.stringify(inc.json));
      const com3 = (await req(h, 'GET', `/aulas/detalhe?k=${encodeURIComponent(k)}`)).json;
      assert.equal(com3.n, 3);
      assert.equal(com3.alunos.find((x: { nome: string }) => x.nome === a3.nome).incluido, true);
      await req(h, 'POST', '/aulas/acao', { k, acao: 'agendamento', aluno: a3.nome });
      assert.equal((await req(h, 'GET', `/aulas/detalhe?k=${encodeURIComponent(k)}`)).json.n, 2);
      await prisma.matricula.delete({ where: { id: mat3.id } });

      /* Encerrar disponibilidade na grade: esta terça e as seguintes somem; a grade guarda o último dia */
      const enc = await req(h, 'POST', '/aulas/acao', { k, acao: 'encerrarGrade' });
      assert.equal(enc.status, 200, JSON.stringify(enc.json));
      assert.match(enc.json.msg, /saiu da grade/);
      assert.equal((await req(h, 'GET', `/aulas/detalhe?k=${encodeURIComponent(k)}`)).status, 404);
      const k2 = [NOME, 'M1', 'Turma aberta', proxima(2, 7), 10].join('|');
      assert.equal((await req(h, 'GET', `/aulas/detalhe?k=${encodeURIComponent(k2)}`)).status, 404);
      const hs = await prisma.moduloHorario.findMany({ where: { modulo: { cursoId: cid } } });
      assert.ok(hs[0].ate);

      /* Transcrição: sem sala do Zoom (ou sem conta conectada) explica o motivo */
      const tr = await req(h, 'GET', `/aulas/transcricao?k=${encodeURIComponent(cria.json.k)}`);
      assert.equal(tr.json.ok, false);
      assert.ok(tr.json.motivo);
    } finally {
      await prisma.professor.update({
        where: { id: prof.id },
        data: {
          cursos: (await prisma.professor.findUniqueOrThrow({ where: { id: prof.id } })).cursos.filter(
            (c) => c !== NOME,
          ),
        },
      });
    }
  });
});
