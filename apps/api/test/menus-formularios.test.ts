/**
 * Menus e formulários de 24/09/2026 (itens 1 a 3 da pirâmide): ordem do menu, Novo curso por tipo
 * (Open-Entry com grade que alimenta a Agenda, Regular com turmas, Particular com alocações), Nova oferta,
 * Novo aluno (obrigatórios, matrícula pela oferta, pedido e nivelamento), Novo professor e Novo prestador.
 * Apaga o que criou no fim.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { montaApp } from '../src/app.ts';
import { prisma } from '../src/db.ts';
import { agAulasEntre, agFaixa, agOfertas } from '../src/domain/agenda.ts';
import { alAgenda } from '../src/domain/alunos.ts';
import { base, invalidaBase } from '../src/domain/base.ts';

let app: FastifyInstance;
const NOME = 'Curso teste menus';
before(async () => {
  app = await montaApp();
});
after(async () => {
  const alunos = await prisma.aluno.findMany({ where: { nome: { startsWith: 'Aluno teste menus' } } });
  const ids = alunos.map((a) => a.id);
  const peds = await prisma.pedido.findMany({ where: { alunoId: { in: ids } } });
  await prisma.parcelaPedido.deleteMany({ where: { pedidoId: { in: peds.map((p) => p.id) } } });
  await prisma.pedido.deleteMany({ where: { id: { in: peds.map((p) => p.id) } } });
  await prisma.matricula.deleteMany({ where: { alunoId: { in: ids } } });
  await prisma.aluno.deleteMany({ where: { id: { in: ids } } });
  await prisma.ofertaPadrao.deleteMany({ where: { curso: { startsWith: NOME } } });
  await prisma.curso.deleteMany({ where: { nome: { startsWith: NOME } } });
  await prisma.colaborador.deleteMany({ where: { nome: { startsWith: 'Prestador teste menus' } } });
  await prisma.professor.deleteMany({ where: { nome: { startsWith: 'Professor teste menus' } } });
  invalidaBase();
  await app.close();
  await prisma.$disconnect();
});

async function entra(login: string, senha: string) {
  const r = await app.inject({ method: 'POST', url: '/auth/login', payload: { login, senha } });
  return { cookie: `portal_sessao=${r.cookies.find((x) => x.name === 'portal_sessao')!.value}` };
}
const req = async (h: { cookie: string }, method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown) => {
  const r = await app.inject({ method, url, headers: h, payload: payload as object });
  // biome-ignore lint/suspicious/noExplicitAny: corpo de resposta lido à vontade nos testes
  return { status: r.statusCode, json: r.json() as Record<string, any> };
};
const adm = () => entra('admin@alumni.teste', 'alumni-admin');

describe('menus e formulários (24/09/2026)', () => {
  test('menu: Início · Produtos e serviços · Usuários · Agenda…; seções novas', async () => {
    const me = (await req(await adm(), 'GET', '/auth/me')).json;
    const labels = me.nav
      .filter((n: { lugar?: string; visao?: string }) => !n.lugar && !n.visao)
      .map((n: { label: string }) => n.label);
    assert.deepEqual(labels.slice(0, 4), ['Início', 'Produtos e serviços', 'Usuários', 'Agenda']);
    const secoes = (k: string) =>
      me.nav.find((n: { label: string }) => n.label === k).secoes.map((x: { etapa: string }) => x.etapa);
    assert.deepEqual(secoes('Produtos e serviços').slice(0, 2), ['Cursos', 'Ofertas']);
    assert.deepEqual(secoes('Usuários'), ['Alunos', 'Time', 'Departamentos', 'Cargos', 'Empresas']);
  });

  test('Novo curso Open-Entry: obrigatórios, grade do módulo na Agenda e regras em minutos', async () => {
    const h = await adm();
    const prof = await prisma.professor.findFirstOrThrow({ where: { ativo: true }, orderBy: { ordem: 'asc' } });
    const modulo = {
      nome: 'Módulo A',
      cor: '#123456',
      cefr: 'A1',
      vagas: 6,
      descricao: '',
      agendamento: { valor: 2, unidade: 'h' },
      cancelamento: { valor: 90, unidade: 'min' },
      horarios: [{ dia: 2, hora: '19:30', professorId: prof.id }],
    };
    const semIdioma = await req(h, 'POST', '/cursos', {
      nome: NOME,
      cor: '#123456',
      estrutura: 'modulos',
      itens: [modulo],
    });
    assert.equal(semIdioma.json.erro, 'Escolha o idioma do curso.');
    const semCefr = await req(h, 'POST', '/cursos', {
      nome: NOME,
      cor: '#123456',
      idioma: 'Inglês',
      estrutura: 'modulos',
      itens: [{ ...modulo, cefr: '' }],
    });
    assert.match(semCefr.json.erro, /CEFR/);
    const r = await req(h, 'POST', '/cursos', {
      nome: NOME,
      cor: '#123456',
      idioma: 'Inglês',
      estrutura: 'modulos',
      itens: [modulo],
    });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    const m = await prisma.modulo.findFirstOrThrow({ where: { curso: { nome: NOME } }, include: { horarios: true } });
    assert.equal(m.cefr, 'A1');
    assert.equal(m.agendamentoMin, 120);
    assert.equal(m.cancelamentoMin, 90);
    assert.equal(m.horarios.length, 1);
    invalidaBase();
    const ofs = agOfertas(await base()).filter((o) => o.prod === NOME);
    assert.equal(ofs.length, 1);
    assert.deepEqual([ofs[0].dias, ofs[0].hora, ofs[0].prof], [[2], 19.5, prof.nome]);
    /* horário quebrado (19:30) chega inteiro à Agenda */
    const b = await base();
    assert.match(agFaixa({ hora: ofs[0].hora, duracao: 45 }), /^19:30–20:15$/);
    const hoje = new Date();
    const aulas = agAulasEntre(b, hoje, new Date(+hoje + 14 * 864e5), hoje, ofs);
    assert.ok(aulas.length > 0);
    assert.ok(aulas.every((a) => a.quando.getHours() === 19 && a.quando.getMinutes() === 30));
    /* prazos do módulo: agendar até 2 h antes e cancelar até 90 min antes */
    const al = b.alunos[0];
    const ag = alAgenda(
      b,
      al,
      28,
      ofs.map((o) => ({ ...o, alunos: [al.name] })),
      hoje,
    );
    assert.ok(ag.aulas.length > 0);
    assert.match(ag.aulas[0].agendarAte, / · 17:30$/);
    assert.match(ag.aulas[0].limite, / · 18:00$/);
    const form = (await req(h, 'GET', `/cursos/${r.json.id}`)).json.form;
    assert.deepEqual(form.itens[0].agendamento, { valor: 2, unidade: 'h' });
    assert.equal(form.itens[0].horarios[0].hora, '19:30');
    /* editar mantém o módulo (id) e regrava a grade */
    const ed = await req(h, 'PUT', `/cursos/${r.json.id}`, {
      nome: NOME,
      cor: '#123456',
      idioma: 'Inglês',
      estrutura: 'modulos',
      itens: [{ ...modulo, horarios: [] }],
    });
    assert.equal(ed.status, 200);
    const m2 = await prisma.modulo.findFirstOrThrow({ where: { curso: { nome: NOME } }, include: { horarios: true } });
    assert.equal(m2.id, m.id);
    assert.equal(m2.horarios.length, 0);
  });

  test('Novo curso Regular (turmas com CEFR) e Particular (alocações)', async () => {
    const h = await adm();
    const reg = await req(h, 'POST', '/cursos', {
      nome: `${NOME} regular`,
      cor: '#123456',
      idioma: 'Inglês',
      estrutura: 'turmas',
      itens: [{ nome: 'Turma X', cor: '#ff0000', cefr: 'B1', vagas: 12, descricao: 'noite' }],
    });
    assert.equal(reg.status, 200, JSON.stringify(reg.json));
    const t = await prisma.turma.findFirstOrThrow({ where: { curso: { nome: `${NOME} regular` } } });
    assert.deepEqual([t.cor, t.cefr, t.vagas, t.descricao], ['#ff0000', 'B1', 12, 'noite']);
    const part = await req(h, 'POST', '/cursos', {
      nome: `${NOME} particular`,
      cor: '#123456',
      idioma: 'Inglês',
      estrutura: 'nenhuma',
      alocacoes: [
        { responsavel: '', vagas: 1 },
        { responsavel: 'Carla', vagas: 2 },
      ],
    });
    assert.equal(part.status, 200, JSON.stringify(part.json));
    const al = await prisma.cursoAlocacao.findMany({
      where: { curso: { nome: `${NOME} particular` } },
      orderBy: { ordem: 'asc' },
    });
    assert.deepEqual(
      al.map((x) => [x.responsavel, x.vagas]),
      [
        ['Aluno 1', 1],
        ['Carla', 2],
      ],
    );
  });

  test('Nova oferta e Novo aluno com matrícula, pedido e nivelamento', async () => {
    const h = await adm();
    const of = await req(h, 'POST', '/deal/ofertas', { curso: NOME, horas: 40, valor: 1200, meses: 6 });
    assert.equal(of.status, 200, JSON.stringify(of.json));
    const oferta = await prisma.ofertaPadrao.findUniqueOrThrow({ where: { id: of.json.id } });
    assert.deepEqual([oferta.aulas, Number(oferta.preco), oferta.meses], [40, 1200, 6]);

    const semCpf = await req(h, 'POST', '/alunos', {
      nome: 'Aluno teste menus 1',
      email: 'a@menus.teste',
      telefone: '+55 (11) 91234-5678',
    });
    assert.equal(semCpf.json.erro, 'Informe o CPF.');
    const semContato = await req(h, 'POST', '/alunos', {
      nome: 'Aluno teste menus 1',
      cpf: '52998224725',
      email: 'a@menus.teste',
    });
    assert.equal(semContato.json.erro, 'Informe o contato.');
    const soNivel = await req(h, 'POST', '/alunos', {
      nome: 'Aluno teste menus 1',
      cpf: '52998224725',
      email: 'a@menus.teste',
      telefone: '+55 (11) 91234-5678',
      nivelamento: { cefr: 'A2', concluidoEm: '' },
    });
    assert.match(soNivel.json.erro, /nivelamento fica na matrícula/);
    const ok = await req(h, 'POST', '/alunos', {
      nome: 'Aluno teste menus 1',
      cpf: '529.982.247-25',
      email: 'a@menus.teste',
      emailSecundario: 'outro@menus.teste',
      telefone: '+55 (11) 91234-5678',
      genero: 'Não binário',
      matricula: {
        ofertaId: oferta.id,
        item: 'Módulo A',
        modalidade: 'Online',
        contratoId: null,
        forma: 3,
        parcelas: 3,
      },
      nivelamento: { cefr: 'A2', concluidoEm: '2026-09-20' },
    });
    assert.equal(ok.status, 200, JSON.stringify(ok.json));
    const a = await prisma.aluno.findUniqueOrThrow({
      where: { id: ok.json.id },
      include: { matriculas: { include: { nivelamento: true } } },
    });
    assert.equal(a.emailSecundario, 'outro@menus.teste');
    assert.equal(a.matriculas.length, 1);
    assert.equal(a.matriculas[0].total, 40);
    assert.equal(a.matriculas[0].nivelamento?.cefr, 'A2');
    const ped = await prisma.pedido.findFirstOrThrow({ where: { alunoId: a.id } });
    assert.equal(ped.parcelas, 3);
    assert.equal(await prisma.parcelaPedido.count({ where: { pedidoId: ped.id } }), 3);
  });

  test('Novo professor e Novo prestador: CNPJ e admissão obrigatórios', async () => {
    const h = await adm();
    const base0 = {
      cpf: '52998224725',
      email: 'x@menus.teste',
      telefone: '+55 (11) 91234-5678',
      admissao: '2026-09-01',
    };
    const semCnpj = await req(h, 'POST', '/professores', { nome: 'Professor teste menus', ...base0 });
    assert.equal(semCnpj.json.erro, 'Informe o CNPJ.');
    const prof = await req(h, 'POST', '/professores', {
      nome: 'Professor teste menus',
      ...base0,
      cnpj: '12.345.678/0001-95',
    });
    assert.equal(prof.status, 200, JSON.stringify(prof.json));
    const p = await prisma.professor.findUniqueOrThrow({ where: { id: prof.json.id } });
    assert.equal(p.cnpj, '12345678000195');
    const pre = { nome: 'Prestador teste menus', ...base0, email: 'prestador@menus.teste', vinculo: 'Prestador' };
    assert.equal((await req(h, 'POST', '/config/colaboradores', pre)).json.erro, 'Informe o CNPJ.');
    const ok = await req(h, 'POST', '/config/colaboradores', { ...pre, cnpj: '12345678000195' });
    assert.equal(ok.status, 200, JSON.stringify(ok.json));
    const c = await prisma.colaborador.findUniqueOrThrow({ where: { email: 'prestador@menus.teste' } });
    assert.deepEqual([c.vinculo, c.cnpj], ['Prestador', '12345678000195']);
  });
});
