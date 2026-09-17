/**
 * Testes de Empresas: lista com Minhas contas, ficha por aba, quem gere, nova conta, renovar, relatório ao RH,
 * vincular e desvincular aluno. Criam uma conta de teste e apagam no fim.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { montaApp } from '../src/app.ts';
import { prisma } from '../src/db.ts';
import { invalidaBase } from '../src/domain/base.ts';

let app: FastifyInstance;
const criadas: string[] = [];
before(async () => {
  app = await montaApp();
  invalidaBase();
});
after(async () => {
  await prisma.aluno.updateMany({ where: { empresaId: { in: criadas } }, data: { empresaId: null } });
  await prisma.empresa.deleteMany({ where: { id: { in: criadas } } });
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
const iso = (dias: number) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

describe('empresas', () => {
  test('lista das que vencem antes; Gerente B2B abre em Minhas contas; quem só lê e quem não entra', async () => {
    const r = (await req(await adm(), 'GET', '/empresas')).json;
    assert.equal(r.empresas[0].nome, 'Nordeste Energia');
    assert.equal(r.empresas.length, 9);
    assert.equal(r.eu, '');
    const s = (await req(await entra('persona.s@alumni.teste', 'alumni-s'), 'GET', '/empresas')).json;
    assert.equal(s.eu, 'Sílvia Monteiro');
    assert.equal(s.podeGerir, true);
    const q = await entra('persona.q@alumni.teste', 'alumni-q');
    assert.equal((await req(q, 'GET', '/empresas')).json.podeGerir, false);
    assert.equal((await req(q, 'POST', '/empresas/e1/relatorio')).status, 403);
    const prof = await entra('persona.i@alumni.teste', 'alumni-i');
    assert.equal((await req(prof, 'GET', '/empresas')).status, 403);
  });

  test('ficha: turmas dedicadas na FAAP e alunos com quem paga no B2B2C', async () => {
    const h = await adm();
    const faap = (await req(h, 'GET', '/empresas/e8?aba=alunos')).json;
    assert.equal(faap.dados.turma, true);
    assert.ok(faap.dados.turmas.length > 0);
    const marlin = (await req(h, 'GET', '/empresas/e2?aba=alunos')).json;
    assert.equal(marlin.dados.alunos[0].paga, 'Empresa 50% · aluno 50%');
    const geral = (await req(h, 'GET', '/empresas/e3')).json;
    assert.match(geral.dados.alertas[0], /^Vence em \d+ dias · sem renovação automática$/);
  });

  test('nova conta, vincular e desvincular aluno, renovar, relatório e histórico', async () => {
    const h = await adm();
    const corpo = {
      nome: 'Empresa de teste api',
      cnpj: '00.000.000/0001-00',
      segmento: 'Teste',
      modelo: 'B2B2C',
      gerente: 'Sílvia Monteiro',
      inicio: iso(0),
      fim: iso(-1),
      licencas: 2,
      aulas: 80,
      valor: 300,
      subsidio: 40,
      desconto: 10,
      cursos: ['Community live classes'],
      renovaAuto: false,
      rhNome: 'Ana',
      rhEmail: 'rh@teste.teste',
    };
    assert.equal(
      (await req(h, 'POST', '/empresas', corpo)).json.erro,
      'O fim do contrato precisa ser depois do início.',
    );
    assert.equal(
      (await req(h, 'POST', '/empresas', { ...corpo, nome: 'faap', fim: iso(365) })).json.erro,
      'Já existe uma empresa com esse nome.',
    );
    assert.equal(
      (await req(h, 'POST', '/empresas', { ...corpo, fim: iso(365), licencas: 0 })).json.erro,
      'A conta precisa de pelo menos 1 licença.',
    );
    const nova = await req(h, 'POST', '/empresas', { ...corpo, fim: iso(365) });
    assert.equal(nova.status, 200, JSON.stringify(nova.json));
    const id = nova.json.id as string;
    criadas.push(id);

    const alunos = (await req(h, 'GET', `/empresas/${id}?aba=alunos`)).json.dados;
    const livre = alunos.semEmpresa[0];
    const v = await req(h, 'POST', `/empresas/${id}/alunos`, { alunoId: livre.id });
    assert.equal(v.json.msg, `${livre.nome} agora é aluno de Empresa de teste api.`);
    assert.equal((await req(h, 'POST', `/empresas/${id}/alunos`, { alunoId: livre.id })).status, 409);
    const d = (await req(h, 'GET', `/empresas/${id}?aba=alunos`)).json.dados;
    assert.equal(d.alunos[0].paga, 'Empresa 40% · aluno 60%');

    const ren = await req(h, 'POST', `/empresas/${id}/renovar`, { fim: iso(10), licencas: 3, aulas: 20, valor: 310 });
    assert.match(ren.json.erro, /^O novo fim precisa ser depois de/);
    assert.match(
      (await req(h, 'POST', `/empresas/${id}/renovar`, { fim: iso(730), licencas: 3, aulas: 20, valor: 310 })).json.msg,
      /^Contrato renovado até/,
    );
    const geral = (await req(h, 'GET', `/empresas/${id}`)).json;
    assert.equal(geral.form.aulas, 100);
    assert.equal(geral.form.licencas, 3);

    const rel = await req(h, 'POST', `/empresas/${id}/relatorio`);
    assert.equal(rel.json.email.para, 'rh@teste.teste');
    assert.match(rel.json.email.corpo, new RegExp(livre.nome));

    assert.match((await req(h, 'DELETE', `/empresas/${id}/alunos/${livre.id}`)).json.msg, /passa a B2C/);
    const hist = (await req(h, 'GET', `/empresas/${id}?aba=historico`)).json.dados.linhas;
    assert.deepEqual(
      hist.map((x: { acao: string }) => x.acao),
      [
        'Aluno desvinculado',
        'Relatório enviado ao RH',
        'Contrato renovado',
        'Aluno vinculado',
        'Empresa criada',
        'Contrato assinado',
      ],
    );
  });
});
