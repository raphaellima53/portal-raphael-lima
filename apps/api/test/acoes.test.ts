/**
 * Testes de Ações: alocação, fechamento da competência, funil de vendas, atendimentos e os fluxos com kanban
 * (carga inicial, exigências da etapa, efeitos no portal e reabrir). Mexem na base: rode o seed depois.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { montaApp } from '../src/app.ts';
import { prisma } from '../src/db.ts';
import { fecMeses } from '../src/domain/acoes.ts';
import { invalidaBase } from '../src/domain/base.ts';

let app: FastifyInstance;
before(async () => {
  app = await montaApp();
  invalidaBase();
});
after(async () => {
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

describe('ações', () => {
  test('alocação e acesso por setor', async () => {
    const r = (await req(await adm(), 'GET', '/acoes/alocacao')).json;
    assert.equal(r.itens.length, 1);
    assert.equal(r.itens[0].tipo, 'conflitoAluno');
    const l = await entra('persona.l@alumni.teste', 'alumni-l');
    assert.equal((await req(l, 'GET', '/acoes/alocacao')).status, 403);
    assert.equal((await req(l, 'GET', '/acoes/funil')).status, 200);
  });

  test('fechamento: mês em andamento não fecha; o anterior fecha, tira o alerta e reabre', async () => {
    const h = await adm();
    const [atual, anterior] = fecMeses();
    assert.equal((await req(h, 'POST', `/acoes/fechamento/${atual}/fechar`)).status, 409);
    const d = (await req(h, 'GET', `/acoes/fechamento?mes=${anterior}`)).json;
    assert.equal(d.situacao.t, 'Pronta para fechar');
    const alertasAntes = (await req(h, 'GET', '/alertas')).json.alertas.map((a: { k: string }) => a.k);
    assert.ok(alertasAntes.includes('fec'));
    const f = await req(h, 'POST', `/acoes/fechamento/${anterior}/fechar`);
    assert.match(f.json.msg, /fechada: \d+ aulas pagas, \d+ descontadas por suporte, R\$ [\d.]+,\d{2} a pagar/);
    assert.equal((await req(h, 'GET', `/acoes/fechamento?mes=${anterior}`)).json.situacao.t, 'Fechada');
    invalidaBase();
    const alertas = (await req(h, 'GET', '/alertas')).json.alertas.map((a: { k: string }) => a.k);
    assert.ok(!alertas.includes('fec'));
    assert.match((await req(h, 'POST', `/acoes/fechamento/${anterior}/reabrir`)).json.msg, /reaberta/);
  });

  test('funil: novo, avançar, perder e reabrir, matricular a proposta', async () => {
    const h = await adm();
    const f = (await req(h, 'GET', '/acoes/funil')).json;
    const novo = await req(h, 'POST', '/acoes/funil', {
      nome: 'Lead de teste',
      email: '',
      origem: 'Site',
      curso: f.cursos[0],
      consultor: f.consultores[0],
    });
    assert.equal(novo.json.msg, 'Lead de teste entrou no funil.');
    const lead = (await req(h, 'GET', '/acoes/funil')).json.leads.find(
      (l: { nome: string }) => l.nome === 'Lead de teste',
    );
    assert.equal(lead.etapa, 'captado');
    assert.equal(
      (await req(h, 'POST', `/acoes/funil/${lead.id}/avancar`)).json.msg,
      'Lead de teste passou para Contato feito.',
    );
    assert.equal((await req(h, 'POST', `/acoes/funil/${lead.id}/perder`, {})).status, 400);
    assert.match(
      (await req(h, 'POST', `/acoes/funil/${lead.id}/perder`, { motivo: 'Preço' })).json.msg,
      /saiu do funil: preço/,
    );
    assert.equal(
      (await req(h, 'POST', `/acoes/funil/${lead.id}/reabrir`)).json.msg,
      'Lead de teste voltou para Contato feito.',
    );
    const proposta = f.leads.find((l: { etapa: string }) => l.etapa === 'proposta');
    const m = await req(h, 'POST', `/acoes/funil/${proposta.id}/matricular`);
    assert.ok(m.json.alunoId);
    assert.equal((await req(h, 'GET', `/alunos/${m.json.alunoId}`)).json.nome, proposta.nome);
  });

  test('atendimentos: todos os feedbacks, tratativa e novo atendimento', async () => {
    const h = await adm();
    const a = (await req(h, 'GET', '/acoes/atendimentos')).json;
    const abertos = a.itens.filter((x: { status: string }) => x.status === 'Aberto');
    assert.equal(abertos.length, 9);
    assert.match((await req(h, 'POST', `/acoes/atendimentos/${abertos[0].id}/avancar`)).json.msg, /em tratativa/);
    /* longe da Alice: o teste de Alunos roda em paralelo e conta os feedbacks dela */
    const aluno = a.alunos.at(-1);
    const n = await req(h, 'POST', '/acoes/atendimentos', {
      alunoId: aluno.id,
      tipo: 'Sugestão',
      area: 'Plataforma',
      texto: 'Quer app no celular',
    });
    assert.match(n.json.msg, new RegExp(`Sugestão registrada para ${aluno.nome}`));
  });

  test('fluxos: carga inicial, exigência da etapa, efeitos e reabrir', async () => {
    const h = await adm();
    const adm1 = (await req(h, 'GET', '/acoes/fluxos/acAdmissao')).json;
    assert.deepEqual(adm1.cards.map((c: { titulo: string }) => c.titulo).sort(), [
      'Beatriz Salles',
      'Helena Duarte',
      'Rodrigo Almeida',
    ]);
    const helena = adm1.cards.find((c: { titulo: string }) => c.titulo === 'Helena Duarte');
    assert.equal(helena.prox.k, 'ativo');
    const ativo = await req(h, 'POST', `/acoes/fluxos/acAdmissao/${helena.id}/mover`, { etapa: 'ativo' });
    assert.match(ativo.json.msg, /Helena Duarte: Ativo\. Helena Duarte criado em Professores\./);
    assert.ok((await prisma.professor.findFirst({ where: { nome: 'Helena Duarte' } }))?.ativo);
    const fim = await req(h, 'PUT', `/acoes/fluxos/acAdmissao/${helena.id}`, { v: { obs: 'x' } });
    assert.equal(fim.status, 409);
    assert.match(
      (await req(h, 'POST', `/acoes/fluxos/acAdmissao/${helena.id}/mover`, { etapa: 'candidato' })).json.msg,
      /Candidato/,
    );

    const sub = (await req(h, 'GET', '/acoes/fluxos/acSubstituicao')).json;
    const card = sub.cards.find((c: { etapa: string }) => c.etapa === 'busca');
    const semSub = await req(h, 'POST', `/acoes/fluxos/acSubstituicao/${card.id}/mover`, { etapa: 'confirmado' });
    assert.equal(semSub.json.erro, 'Para Confirmado, preencha: Substituto.');
    const campos = (await req(h, 'POST', '/acoes/fluxos/acSubstituicao/campos', { v: card.v })).json.campos;
    const subst = campos.find((c: { k: string }) => c.k === 'substituto').ops[0].v;
    const ok = await req(h, 'POST', `/acoes/fluxos/acSubstituicao/${card.id}/mover`, {
      etapa: 'confirmado',
      v: { ...card.v, substituto: subst },
    });
    assert.match(ok.json.msg, new RegExp(`${subst} assume a aula na agenda\\.`));
    const aj = await prisma.aulaAjuste.findUnique({ where: { chave: card.v.aula } });
    assert.equal((aj?.dados as { prof?: string } | undefined)?.prof, subst);

    const novo = await req(h, 'POST', '/acoes/fluxos/acCampanhas', { v: { nome: '' } });
    assert.equal(novo.json.erro, 'Preencha: Nome.');
    assert.equal(
      (await req(h, 'POST', '/acoes/fluxos/acCampanhas', { v: { nome: 'Campanha teste' } })).json.msg,
      'Campanha teste entrou em Ideia.',
    );
    const l = await entra('persona.l@alumni.teste', 'alumni-l');
    assert.equal((await req(l, 'GET', '/acoes/fluxos/acCampanhas')).status, 403);
  });
});
