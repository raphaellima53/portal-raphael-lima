/**
 * Community Flow (24/09/2026): 1 crédito de aula particular a cada 5 presenças nos níveis desde a adesão, agendado
 * num horário com vaga da grade do módulo (vagas do módulo; os seguintes entram na mesma aula), professor pelo cadastro.
 * Cria o próprio curso e devolve o professor como estava.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { montaApp } from '../src/app.ts';
import { prisma } from '../src/db.ts';
import { agAulasEntre, agISO, agOfertas, MOD_FLOW } from '../src/domain/agenda.ts';
import { base, invalidaBase } from '../src/domain/base.ts';
import { flowHorarios } from '../src/domain/flow.ts';

let app: FastifyInstance;
const NOME = 'Curso teste community flow';
let profAntes: { id: string; cursos: string[]; dispDefinida: boolean; disponibilidade: string[] } | null = null;

before(async () => {
  app = await montaApp();
});
after(async () => {
  const cs = await prisma.curso.findMany({ where: { nome: NOME } });
  await prisma.aulaAjuste.deleteMany({ where: { chave: { startsWith: `${NOME}|` } } });
  await prisma.matricula.deleteMany({ where: { cursoId: { in: cs.map((c) => c.id) } } });
  await prisma.curso.deleteMany({ where: { id: { in: cs.map((c) => c.id) } } });
  if (profAntes) {
    const { id, ...dados } = profAntes;
    await prisma.professor.update({ where: { id }, data: dados });
  }
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

describe('Community Flow', () => {
  test('créditos pelas presenças, horários livres, agendamento e crédito de volta', async () => {
    const h = await entra('admin@alumni.teste', 'alumni-admin');
    const prof = await prisma.professor.findFirstOrThrow({ where: { ativo: true }, orderBy: { ordem: 'asc' } });
    profAntes = {
      id: prof.id,
      cursos: prof.cursos,
      dispDefinida: prof.dispDefinida,
      disponibilidade: prof.disponibilidade,
    };
    const dias = [1, 2, 3, 4, 5];
    const novo = await req(h, 'POST', '/cursos', {
      nome: NOME,
      cor: '#123456',
      idioma: 'Inglês',
      estrutura: 'modulos',
      itens: [
        /* nível com professor vinculado (as presenças) e um horário sem professor (sai do cadastro) */
        {
          nome: 'Essential 1',
          cor: '#0467D8',
          cefr: 'A1',
          vagas: 5,
          agendamento: { valor: 1, unidade: 'h' },
          cancelamento: { valor: 1, unidade: 'h' },
          horarios: [
            ...dias.map((dia) => ({ dia, hora: '07:00', professorId: prof.id })),
            { dia: 5, hora: '15:30', professorId: '' },
          ],
        },
        {
          nome: MOD_FLOW,
          cor: '#6d28d9',
          cefr: 'A1',
          vagas: 2,
          agendamento: { valor: 1, unidade: 'h' },
          cancelamento: { valor: 1, unidade: 'h' },
          horarios: dias.map((dia) => ({ dia, hora: '21:00', professorId: '' })),
        },
      ],
    });
    assert.equal(novo.status, 200, JSON.stringify(novo.json));
    const cid = novo.json.id as number;
    /* o professor habilitado no curso, com disponibilidade marcada às 21h e às 15h de sexta */
    await prisma.professor.update({
      where: { id: prof.id },
      data: {
        cursos: [...prof.cursos, NOME],
        dispDefinida: true,
        disponibilidade: [...new Set([...prof.disponibilidade, ...dias.map((d) => `${d}-21`), '5-15'])],
      },
    });
    /* o aluno da persona A (entra com login próprio) */
    const persona = await prisma.usuario.findFirstOrThrow({ where: { email: 'persona.a@alumni.teste' } });
    const a = await prisma.aluno.findUniqueOrThrow({ where: { id: persona.alunoId! } });
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - 60);
    for (const modulo of ['Essential 1', MOD_FLOW])
      await prisma.matricula.create({
        data: {
          alunoId: a.id,
          cursoId: cid,
          modulo,
          usadas: 0,
          total: 48,
          inicio: new Date(`${agISO(inicio)}T00:00:00Z`),
        },
      });
    invalidaBase();

    /* horário da grade sem professor recebe o professor pelo cadastro */
    const b = await base();
    const auto = agOfertas(b).find((o) => o.prod === NOME && o.mod === 'Essential 1' && o.hora === 15.5);
    /* só recebe professor o horário com aluno; sem aluno ele não prende professor */
    assert.ok(auto);
    if (auto.alunos.length) {
      assert.equal(auto.prof, prof.nome);
      assert.equal(auto.profAuto, true);
    } else assert.equal(auto.prof, '—');

    const f = await req(h, 'GET', `/flow?alunoId=${a.id}`);
    assert.equal(f.status, 200, JSON.stringify(f.json));
    assert.equal(f.json.adesao, true);
    assert.ok(f.json.presencas > 5, `presenças: ${f.json.presencas}`);
    assert.equal(f.json.ganhos, Math.floor(f.json.presencas / 5));
    assert.equal(f.json.saldo, f.json.ganhos);
    assert.equal(f.json.faltam, 5 - (f.json.presencas % 5));
    assert.ok(f.json.dias.length > 0, 'deveria ter horário livre');
    const dia = f.json.dias[0];
    assert.deepEqual(dia.horas, [{ hora: '21:00', prof: prof.nome, vagas: 2, total: 2 }]);

    /* o próprio aluno vê o Flow dele e não o de outro aluno */
    const ha = await entra('persona.a@alumni.teste', 'alumni-a');
    assert.equal((await req(ha, 'GET', '/flow')).json.saldo, f.json.saldo);
    const outroId = (await prisma.aluno.findFirstOrThrow({ where: { id: { not: a.id } } })).id;
    assert.equal((await req(ha, 'GET', `/flow?alunoId=${outroId}`)).status, 403);

    /* o aluno agenda e gasta 1 crédito; o horário some para ele, mas continua com 1 vaga para os outros */
    const ag = await req(ha, 'POST', '/flow/agendar', { data: dia.data, hora: '21:00' });
    assert.equal(ag.status, 200, JSON.stringify(ag.json));
    assert.match(ag.json.msg, new RegExp(prof.nome));
    const av = await prisma.aulaAvulsa.findFirstOrThrow({ where: { cursoId: cid, modulo: MOD_FLOW } });
    assert.deepEqual(av.alunos, [a.nome]);
    assert.equal(av.professorId, prof.id);
    const f2 = await req(h, 'GET', `/flow?alunoId=${a.id}`);
    assert.equal(f2.json.usados, 1);
    assert.equal(f2.json.saldo, f.json.saldo - 1);
    assert.equal(f2.json.agendadas.length, 1);
    assert.ok(!f2.json.dias.some((x: { data: string }) => x.data === dia.data));
    const outra = await req(h, 'POST', '/flow/agendar', { alunoId: a.id, data: dia.data, hora: '21:00' });
    assert.equal(outra.status, 409);
    const b2 = await base();
    const c2 = b2.cursos.find((x) => x.id === cid)!;
    const livre = flowHorarios(b2, c2, null, agOfertas(b2)).find((x) => x.data === dia.data && x.hora === '21:00');
    assert.equal(livre?.vagas, 1);
    assert.equal(livre?.avulsa, av.id);

    /* a aula aparece na agenda com o professor */
    const aula = await req(h, 'GET', `/aulas/detalhe?k=${encodeURIComponent(ag.json.k)}`);
    assert.equal(aula.status, 200, JSON.stringify(aula.json));
    /* com um colega na mesma aula, o aluno só vê a si mesmo; a equipe vê os dois */
    await prisma.aulaAvulsa.update({ where: { id: av.id }, data: { alunos: [a.nome, 'Colega de teste'] } });
    invalidaBase();
    const vista = await req(ha, 'GET', `/aulas/detalhe?k=${encodeURIComponent(ag.json.k)}`);
    assert.equal(vista.status, 200, JSON.stringify(vista.json));
    assert.deepEqual(
      vista.json.alunos.map((x: { nome: string }) => x.nome),
      [a.nome],
    );
    assert.equal(vista.json.extra, 0);
    const daEquipe = await req(h, 'GET', `/aulas/detalhe?k=${encodeURIComponent(ag.json.k)}`);
    assert.equal(daEquipe.json.alunos.length, 2);
    assert.equal(daEquipe.json.meuCancelamento, null);

    /* o aluno cancela a própria aula até o prazo do módulo; fora do prazo, recusa */
    const mFlow = await prisma.modulo.findFirstOrThrow({ where: { cursoId: cid, nome: MOD_FLOW } });
    await prisma.modulo.update({ where: { id: mFlow.id }, data: { cancelamentoMin: 60 * 24 * 30 } });
    invalidaBase();
    const fora = await req(ha, 'GET', `/aulas/detalhe?k=${encodeURIComponent(ag.json.k)}`);
    assert.equal(fora.json.meuCancelamento.pode, false);
    assert.equal(fora.json.meuCancelamento.regra, 'até 720 horas antes');
    const tarde = await req(ha, 'POST', '/aulas/acao', { k: ag.json.k, acao: 'meuCancelamento' });
    assert.equal(tarde.status, 400);
    assert.match(tarde.json.erro, /prazo para cancelar/);
    await prisma.modulo.update({ where: { id: mFlow.id }, data: { cancelamentoMin: 60 } });
    invalidaBase();
    const noPrazo = await req(ha, 'GET', `/aulas/detalhe?k=${encodeURIComponent(ag.json.k)}`);
    assert.equal(noPrazo.json.meuCancelamento.pode, true);
    assert.equal(noPrazo.json.meuCancelamento.flow, true);
    /* a equipe não usa esta ação */
    assert.equal((await req(h, 'POST', '/aulas/acao', { k: ag.json.k, acao: 'meuCancelamento' })).status, 403);
    const cancelou = await req(ha, 'POST', '/aulas/acao', { k: ag.json.k, acao: 'meuCancelamento' });
    assert.equal(cancelou.status, 200, JSON.stringify(cancelou.json));
    assert.match(cancelou.json.msg, /crédito/);
    /* sai da aula (o colega fica), o crédito volta e o cartão mostra a regra */
    assert.deepEqual((await prisma.aulaAvulsa.findUniqueOrThrow({ where: { id: av.id } })).alunos, ['Colega de teste']);
    const fc = await req(h, 'GET', `/flow?alunoId=${a.id}`);
    assert.equal(fc.json.usados, 0);
    assert.equal(fc.json.regras.cancelar, 'até 1 hora antes');
    /* aula comum do nível: o aluno fica como cancelado nela */
    const b3 = await base();
    const agora = new Date();
    const fim3 = new Date(+agora + 14 * 864e5);
    const nivel = agAulasEntre(b3, agora, fim3, agora, agOfertas(b3)).find(
      (x) => x.prod === NOME && x.mod === 'Essential 1' && x.alunos.includes(a.nome) && +x.quando > +agora + 2 * 36e5,
    );
    if (nivel) {
      /* colega na aula: o aluno vê só o primeiro nome, sem e-mail; a equipe vê o nome inteiro */
      const colega = (await prisma.aluno.findFirstOrThrow({ where: { id: { not: a.id }, nome: { contains: ' ' } } }))
        .nome;
      await prisma.aulaAjuste.create({ data: { chave: nivel.k, dados: { extras: [colega] } } });
      invalidaBase();
      const doAluno = await req(ha, 'GET', `/aulas/detalhe?k=${encodeURIComponent(nivel.k)}`);
      const nomes = doAluno.json.alunos.map((x: { nome: string; email: string }) => [x.nome, x.email]);
      assert.ok(
        nomes.some(([n]: string[]) => n === a.nome),
        'o próprio nome inteiro',
      );
      const c1 = nomes.find(([n]: string[]) => n === colega.split(' ')[0]);
      assert.ok(c1, `colega pelo primeiro nome: ${JSON.stringify(nomes)}`);
      assert.equal(c1[1], '');
      assert.ok(!nomes.some(([n]: string[]) => n === colega));
      const daEq = await req(h, 'GET', `/aulas/detalhe?k=${encodeURIComponent(nivel.k)}`);
      assert.ok(daEq.json.alunos.some((x: { nome: string }) => x.nome === colega));
      /* evento com os dois: o aluno vê o colega pelo primeiro nome e não vê choques de agenda */
      const ev = await req(h, 'POST', '/eventos', {
        tipo: 'Evento',
        titulo: 'Evento de teste community flow',
        data: agISO(fim3),
        ini: '06:00',
        fim: '06:30',
        part: [
          { g: 'aluno', n: a.nome },
          { g: 'aluno', n: colega },
        ],
        confirmar: true,
      });
      assert.equal(ev.status, 200, JSON.stringify(ev.json));
      try {
        const evA = await req(ha, 'GET', `/eventos/${ev.json.id}`);
        assert.deepEqual(
          evA.json.part.map((x: { n: string }) => x.n),
          [a.nome, colega.split(' ')[0]],
        );
        assert.deepEqual(evA.json.choques, []);
        const evE = await req(h, 'GET', `/eventos/${ev.json.id}`);
        assert.deepEqual(
          evE.json.part.map((x: { n: string }) => x.n),
          [a.nome, colega],
        );
      } finally {
        await prisma.evento.delete({ where: { id: ev.json.id } });
        invalidaBase();
      }
      const sai = await req(ha, 'POST', '/aulas/acao', { k: nivel.k, acao: 'meuCancelamento' });
      assert.equal(sai.status, 200, JSON.stringify(sai.json));
      const depois = await req(ha, 'GET', `/aulas/detalhe?k=${encodeURIComponent(nivel.k)}`);
      assert.equal(depois.json.meuCancelamento, null);
      assert.equal(depois.json.alunos.find((x: { nome: string }) => x.nome === a.nome)?.fora, true);
    }

    /* autoagendamento (25/09/2026): o menu do dia traz as aulas Open-Entry em que o aluno não está, e ele agenda */
    assert.equal((await req(h, 'GET', `/agenda/agendar?data=${agISO(fim3)}`)).status, 403);
    let livre2: { dia: string; k: string } | null = null;
    for (let i = 1; i <= 14 && !livre2; i++) {
      const dia = agISO(new Date(Date.now() + i * 864e5));
      const m = await req(ha, 'GET', `/agenda/agendar?data=${dia}`);
      assert.equal(m.status, 200, JSON.stringify(m.json));
      const g = m.json.grupos.find((x: { curso: string; mod: string }) => x.curso === NOME && x.mod === 'Essential 1');
      const s = g?.aulas.find((x: { trava: string }) => !x.trava);
      if (s) livre2 = { dia, k: s.k };
    }
    assert.ok(livre2, 'deveria ter aula do Essential 1 para agendar');
    const entrou = await req(ha, 'POST', '/agenda/agendar', { k: livre2.k });
    assert.equal(entrou.status, 200, JSON.stringify(entrou.json));
    assert.match(entrou.json.msg, /^Aula agendada/);
    const naAula = await req(ha, 'GET', `/aulas/detalhe?k=${encodeURIComponent(livre2.k)}`);
    assert.equal(naAula.status, 200, JSON.stringify(naAula.json));
    assert.ok(naAula.json.meuCancelamento, 'o aluno agendado pode cancelar');
    const m2 = await req(ha, 'GET', `/agenda/agendar?data=${livre2.dia}`);
    assert.ok(!m2.json.grupos.some((g: { aulas: { k: string }[] }) => g.aulas.some((x) => x.k === livre2.k)));
    assert.equal((await req(ha, 'POST', '/agenda/agendar', { k: livre2.k })).status, 400);
    /* cancela: sai da aula e ela volta ao menu */
    assert.equal((await req(ha, 'POST', '/aulas/acao', { k: livre2.k, acao: 'meuCancelamento' })).status, 200);
    const m3 = await req(ha, 'GET', `/agenda/agendar?data=${livre2.dia}`);
    assert.ok(m3.json.grupos.some((g: { aulas: { k: string }[] }) => g.aulas.some((x) => x.k === livre2.k)));

    /* cancelada, o crédito volta */
    await prisma.aulaAjuste.create({ data: { chave: ag.json.k, dados: { cancelada: true } } });
    invalidaBase();
    const f3 = await req(h, 'GET', `/flow?alunoId=${a.id}`);
    assert.equal(f3.json.usados, 0);
    assert.equal(f3.json.saldo, f.json.saldo);

    /* sem adesão: nada a mostrar; o aluno não vê o Flow de outro aluno */
    await prisma.matricula.updateMany({
      where: { alunoId: a.id, cursoId: cid, modulo: MOD_FLOW },
      data: { desativadoEm: new Date() },
    });
    invalidaBase();
    const f4 = await req(h, 'GET', `/flow?alunoId=${a.id}`);
    assert.equal(f4.json.adesao, false);
    const semAdesao = await req(h, 'POST', '/flow/agendar', { alunoId: a.id, data: dia.data, hora: '21:00' });
    assert.equal(semAdesao.status, 400);
  });
});
