/**
 * Testes de Alunos: lista e ações por nível, ficha com abas por acesso, cadastro, matrículas, alocação,
 * disponibilidade, feedbacks com anexo e Acessar como. Criam um aluno de teste e apagam no fim.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { montaApp } from '../src/app.ts';
import { prisma } from '../src/db.ts';
import { fxHash } from '../src/domain/aulas.ts';
import { invalidaBase } from '../src/domain/base.ts';

let app: FastifyInstance;
const criados: number[] = [];
before(async () => {
  app = await montaApp();
  invalidaBase();
});
after(async () => {
  await prisma.aluno.deleteMany({ where: { id: { in: criados } } });
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
  let json: Record<string, unknown> & { [k: string]: never } = {} as never;
  try {
    json = r.json();
  } catch {}
  // biome-ignore lint/suspicious/noExplicitAny: corpo de resposta lido à vontade nos testes
  return { status: r.statusCode, json: json as Record<string, any>, headers: r.headers, raw: r.rawPayload };
};
const adm = () => entra('admin@alumni.teste', 'alumni-admin');

describe('alunos · lista e ações', () => {
  test('lista na ordem do portal, ações conforme o nível e aluno sem acesso', async () => {
    const h = await adm();
    const r = (await req(h, 'GET', '/alunos')).json;
    /* alunos criados por outros testes (Novo aluno, lead matriculado) entram no topo: a ordem do portal vale para os da base */
    assert.equal(r.alunos.filter((a: { id: number }) => a.id <= 40)[0].nome, 'Alice Ferraz');
    assert.ok(r.alunos.length >= 40);
    assert.deepEqual(r.pode, { criar: true, editar: true, desativar: true, excluir: true, como: true, ficha: true });
    const k = (await req(await entra('persona.k@alumni.teste', 'alumni-k'), 'GET', '/alunos')).json;
    assert.equal(k.pode.editar, true, 'Editor edita');
    assert.equal(k.pode.desativar, false, 'Editor não desativa');
    const aluno = await entra('persona.a@alumni.teste', 'alumni-a');
    assert.equal((await req(aluno, 'GET', '/alunos')).status, 403);
  });

  test('persona de teste não se exclui; Gestor não exclui', async () => {
    const h = await adm();
    const amanda = (await req(h, 'GET', '/alunos')).json.alunos.find((a: { nome: string }) => a.nome === 'Amanda Reis');
    assert.equal(amanda.persona, true);
    assert.equal((await req(h, 'DELETE', `/alunos/${amanda.id}`)).status, 409);
    const p = await entra('persona.p@alumni.teste', 'alumni-p');
    assert.equal((await req(p, 'DELETE', `/alunos/${amanda.id}`)).status, 403);
  });
});

describe('alunos · ficha', () => {
  test('abas por acesso, aliases e subtítulo', async () => {
    const g = await entra('persona.g@alumni.teste', 'alumni-g');
    const r = (await req(g, 'GET', '/alunos/1?aba=log')).json;
    assert.equal(r.aba, 'perfil', 'sem Log cai na primeira aba liberada');
    assert.deepEqual(
      r.grupos.map((x: { abas: { k: string }[] }) => x.abas.map((a) => a.k)),
      [['perfil'], ['cursos', 'disponibilidade'], ['agendamentos']],
    );
    assert.match(r.sub, /^alice.ferraz@vetora.teste · B2B · Vetora Tecnologia · contrato até \d{2}\/\d{2}\/\d{4}$/);
    const h = await adm();
    const hist = (await req(h, 'GET', '/alunos/1?aba=historico')).json;
    assert.equal(hist.aba, 'agendamentos');
    assert.equal(hist.quando, 'passadas');
    assert.ok(hist.dados.stats.aulas > 0);
  });

  test('feedbacks de exemplo nascem estáveis e o Novo feedback grava com anexo', async () => {
    const h = await adm();
    const alice = (await req(h, 'GET', '/alunos/1?aba=feedbacks')).json;
    const n = fxHash('Alice Ferraz') % 4;
    assert.equal(alice.dados.lista.length, n);
    assert.equal((await req(h, 'GET', '/alunos/1?aba=feedbacks')).json.dados.lista.length, n, 'não duplica');
    const semTexto = await req(h, 'POST', '/alunos/1/feedbacks', { tipo: 'Elogio', area: 'Professor', texto: '' });
    assert.equal(semTexto.json.erro, 'Escreva o relato.');
    const png = Buffer.from('89504e470d0a1a0a', 'hex').toString('base64');
    const ok = await req(h, 'POST', '/alunos/1/feedbacks', {
      tipo: 'Elogio',
      area: 'Professor',
      curso: 'Alumni Black',
      canal: 'WhatsApp',
      texto: 'Aula ótima',
      anexos: [{ nome: 'print.png', tipo: 'image/png', base64: png }],
    });
    assert.match(ok.json.msg, /Elogio registrada para Alice Ferraz com 1 anexo/);
    const lista = (await req(h, 'GET', '/alunos/1?aba=feedbacks')).json.dados.lista;
    const novo = lista.find((x: { texto: string }) => x.texto === 'Aula ótima');
    assert.equal(novo.status, 'Aberto');
    const anexo = await req(h, 'GET', `/anexos/${novo.anexos[0].id}`);
    assert.equal(anexo.headers['content-type'], 'image/png');
    assert.equal(
      (
        await req(h, 'POST', '/alunos/1/feedbacks', {
          tipo: 'Elogio',
          area: 'Professor',
          texto: 'x',
          anexos: [{ nome: 'a.exe', tipo: 'application/x-msdownload', base64: png }],
        })
      ).status,
      400,
    );
    assert.match((await req(h, 'POST', `/alunos/1/feedbacks/${novo.id}/avancar`)).json.msg, /em tratativa/);
    assert.match((await req(h, 'POST', `/alunos/1/feedbacks/${novo.id}/avancar`)).json.msg, /concluído/);
    assert.equal((await req(h, 'POST', `/alunos/1/feedbacks/${novo.id}/avancar`)).status, 409);
    await prisma.feedbackAluno.delete({ where: { id: novo.id } });
  });

  test('disponibilidade: o dia inteiro liga e desliga', async () => {
    const h = await adm();
    const antes = (await req(h, 'GET', '/alunos/1?aba=disponibilidade')).json.dados.stats[0].valor;
    const liga = await req(h, 'PUT', '/alunos/1/disponibilidade', { k: 'd6' });
    assert.equal(liga.json.horas, Number(antes) + 15);
    const desliga = await req(h, 'PUT', '/alunos/1/disponibilidade', { k: 'd6' });
    assert.equal(desliga.json.horas, Number(antes));
    assert.equal((await req(h, 'PUT', '/alunos/1/disponibilidade', { k: 'x9' })).status, 400);
  });
});

describe('alunos · cadastro, matrícula e alocação', () => {
  test('novo aluno com matrícula em turma, editar, desativar, reativar e excluir', async () => {
    const h = await adm();
    assert.equal((await req(h, 'POST', '/alunos', { nome: 'x' })).json.erro, 'Informe o nome.');
    const turma = await prisma.turma.findFirst({ where: { nome: 'Turma 1', curso: { nome: 'FAAP' } } });
    const novo = await req(h, 'POST', '/alunos', {
      nome: 'Aluno de teste api',
      cpf: '123.456.789-01',
      email: 'teste.api@alumni.teste',
      status: 'Ativo',
      nova: { curso: 'FAAP', item: 'Turma 1', modalidade: 'Presencial', total: 36 },
    });
    assert.equal(novo.status, 200, JSON.stringify(novo.json));
    const id = novo.json.id as number;
    criados.push(id);
    const lista = (await req(h, 'GET', '/alunos')).json.alunos;
    assert.equal(lista[0].id, id, 'aluno novo entra no topo');
    const t2 = await prisma.turma.findUnique({ where: { id: turma!.id } });
    assert.equal(t2!.ocupadas, turma!.ocupadas + 1, 'a turma ganha uma vaga ocupada');

    const ed = await req(h, 'PUT', `/alunos/${id}`, {
      nome: 'Aluno de teste api 2',
      cpf: '12345678901',
      email: 'teste.api@alumni.teste',
      status: 'Suspenso',
    });
    assert.equal(ed.json.msg, 'Dados de Aluno de teste api 2 salvos.');
    const log = (await req(h, 'GET', `/alunos/${id}?aba=log`)).json.dados.linhas;
    assert.equal(log[0].acao, 'Dados editados');
    assert.equal(log[0].detalhe, 'nome, situação');

    const k = await entra('persona.k@alumni.teste', 'alumni-k');
    assert.equal((await req(k, 'POST', `/alunos/${id}/desativar`)).status, 403);
    assert.match((await req(h, 'POST', `/alunos/${id}/desativar`)).json.msg, /desativado/);
    assert.match((await req(h, 'POST', `/alunos/${id}/reativar`)).json.msg, /reativado como Suspenso/);

    const mid = (await req(h, 'GET', `/alunos/${id}?aba=cursos`)).json.dados.ativas[0].id;
    const passa = await req(h, 'PUT', `/alunos/${id}/matriculas/${mid}`, {
      item: 'Turma 1',
      modalidade: 'Presencial',
      total: 10,
      usadas: 11,
    });
    assert.equal(passa.json.erro, 'Aulas usadas não podem passar do pacote.');
    assert.match((await req(h, 'POST', `/alunos/${id}/matriculas/${mid}/encerrar`)).json.msg, /encerrada/);
    const t3 = await prisma.turma.findUnique({ where: { id: turma!.id } });
    assert.equal(t3!.ocupadas, turma!.ocupadas);
    const cur = (await req(h, 'GET', `/alunos/${id}?aba=cursos`)).json.dados;
    assert.equal(cur.ativas.length, 0);
    assert.equal(cur.encerradas.length, 1);

    const nm = await req(h, 'POST', `/alunos/${id}/matriculas`, {
      curso: 'Community live classes',
      modalidade: 'Online',
      total: 48,
    });
    assert.equal(nm.json.erro, 'Escolha o módulo ou a turma.');
    const nm2 = await req(h, 'POST', `/alunos/${id}/matriculas`, {
      curso: 'FAAP',
      item: 'Turma 1',
      modalidade: 'Online',
      total: 36,
    });
    assert.equal(nm2.status, 200);

    assert.match((await req(h, 'DELETE', `/alunos/${id}`)).json.msg, /excluído/);
    assert.equal((await req(h, 'GET', `/alunos/${id}`)).status, 404);
    const t4 = await prisma.turma.findUnique({ where: { id: turma!.id } });
    assert.equal(t4!.ocupadas, turma!.ocupadas, 'excluir devolve a vaga');
  });

  test('alocação individual: choque bloqueia, a válida grava e volta à sugestão', async () => {
    const h = await adm();
    const cards = (await req(h, 'GET', '/alunos/1?aba=cursos')).json.dados.alocacao;
    const black = cards.find((c: { curso: string }) => c.curso === 'Alumni Black');
    const grupo = cards.find((c: { curso: string }) => c.curso === 'Community live classes');
    assert.equal(black.ind, true);
    assert.equal(grupo.ind, false);
    const url = `/alunos/1/matriculas/${black.mid}/alocacao`;
    const choque = await req(h, 'PUT', url, { prof: black.prof, dias: [2, 4], hora: 12 });
    assert.equal(choque.status, 409);
    assert.match(choque.json.erro, /já tem aula às 12:00 em .*\. Nada foi salvo\./);
    const semDia = await req(h, 'PUT', url, { prof: black.prof, dias: [], hora: 10 });
    assert.equal(semDia.json.erro, 'Marque ao menos um dia. Nada foi salvo.');
    const ok = await req(h, 'PUT', url, { prof: black.prof, dias: black.dias, hora: black.hora, valor: 150 });
    assert.equal(ok.status, 200, JSON.stringify(ok.json));
    const depois = (await req(h, 'GET', '/alunos/1?aba=cursos')).json.dados.alocacao.find(
      (c: { curso: string }) => c.curso === 'Alumni Black',
    );
    assert.equal(depois.gravada, true);
    assert.equal(depois.valor, 150);
    assert.match((await req(h, 'DELETE', url)).json.msg, /sugestão da grade/);
    const g = await entra('persona.i@alumni.teste', 'alumni-i');
    assert.equal(
      (await req(g, 'PUT', url, { prof: black.prof, dias: [3], hora: 10 })).status,
      403,
      'sem acesso de alocação',
    );
  });
});

describe('alunos · acessar como', () => {
  test('a sessão vê o portal como o aluno e volta para a tela de onde saiu', async () => {
    const h = await adm();
    const r = await req(h, 'POST', '/alunos/1/acessar-como', { volta: '/alunos/1/perfil' });
    assert.equal(r.json.ir, '/minha-area');
    const me = (await req(h, 'GET', '/auth/me')).json.usuario;
    assert.equal(me.ehAluno, true);
    assert.equal(me.nome, 'Alice Ferraz');
    assert.deepEqual(me.como, { quem: 'Admin de teste', volta: '/alunos/1/perfil' });
    assert.equal((await req(h, 'GET', '/alunos')).status, 403, 'como aluno, sem a lista');
    assert.equal((await req(h, 'POST', '/auth/como-voltar')).json.ir, '/alunos/1/perfil');
    assert.equal((await req(h, 'GET', '/auth/me')).json.usuario.ehAluno, false);
  });
});
