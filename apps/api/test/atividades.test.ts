/**
 * Atividades em cartões (23/09/2026): catálogo carregado da lista do usuário, cartões recorrentes por período,
 * cadastro com validação, mover no quadro, edição com histórico, acesso por setor e o Dashboard.
 * Cria atividades com o título "teste e2e" e as apaga no fim.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { montaApp } from '../src/app.ts';
import { prisma } from '../src/db.ts';
import { garanteRecorrentes, periodoDe } from '../src/domain/atividades.ts';
import catalogo from '../src/domain/dados/atividades-catalogo.json' with { type: 'json' };

let app: FastifyInstance;
before(async () => {
  app = await montaApp();
});
after(async () => {
  await prisma.atividade.deleteMany({ where: { titulo: { contains: 'teste e2e' } } });
  await prisma.atividadeModelo.deleteMany({ where: { nome: { contains: 'teste e2e' } } });
  await app.close();
  await prisma.$disconnect();
});

async function entra(login: string, senha: string) {
  const r = await app.inject({ method: 'POST', url: '/auth/login', payload: { login, senha } });
  return { cookie: `portal_sessao=${r.cookies.find((x) => x.name === 'portal_sessao')!.value}` };
}
const req = async (h: { cookie: string }, method: 'GET' | 'POST' | 'PATCH', url: string, payload?: unknown) => {
  const r = await app.inject({ method, url, headers: h, payload: payload as object });
  // biome-ignore lint/suspicious/noExplicitAny: corpo de resposta lido à vontade nos testes
  return { status: r.statusCode, json: r.json() as Record<string, any> };
};
const adm = () => entra('admin@alumni.teste', 'alumni-admin');
const nova = (o: Record<string, unknown> = {}) => ({
  titulo: 'Ligar para confirmar renovação teste e2e',
  descricao: '',
  setor: 'Comercial',
  tipo: 'Ligação',
  responsavel: 'Admin de teste',
  prioridade: 'Alta',
  data: '2026-09-30',
  hora: '14:30',
  situacao: 'afazer',
  relTipo: '',
  relId: '',
  modeloId: null,
  ...o,
});

describe('atividades', () => {
  test('períodos das cadências', () => {
    const qua = new Date(2026, 8, 23, 10);
    const f = new Set<string>();
    assert.equal(periodoDe('diaria', qua, f)?.chave, '2026-09-23');
    assert.equal(periodoDe('diaria', new Date(2026, 8, 26), f), null, 'sábado não gera a diária');
    assert.equal(periodoDe('diaria', qua, new Set(['2026-09-23'])), null, 'feriado não gera a diária');
    const s = periodoDe('semanal', qua, f)!;
    assert.equal(s.chave, '2026-S39');
    assert.equal(s.prazo.getDate(), 25, 'semanal vence na sexta');
    assert.equal(periodoDe('quinzenal', qua, f)?.chave, '2026-09-Q2');
    assert.equal(periodoDe('mensal', qua, f)?.prazo.getDate(), 30);
    assert.equal(periodoDe('bimestral', qua, f)?.chave, '2026-B5');
    assert.equal(periodoDe('trimestral', qua, f)?.prazo.getMonth(), 8);
  });

  test('catálogo e cartões recorrentes', async () => {
    const h = await adm();
    const cat = (await req(h, 'GET', '/atividades/catalogo')).json;
    assert.equal(cat.itens.length, catalogo.length);
    await garanteRecorrentes(new Date(), true);
    const semanais = catalogo.filter((c) => c.cadencia === 'semanal').length;
    const s = periodoDe('semanal', new Date(), new Set())!.chave;
    assert.equal(await prisma.atividade.count({ where: { periodo: s } }), semanais, 'um cartão por semanal');
    await garanteRecorrentes(new Date(), true);
    assert.equal(await prisma.atividade.count({ where: { periodo: s } }), semanais, 'rodar de novo não duplica');
  });

  test('cadastro, validação, mover e editar', async () => {
    const h = await adm();
    assert.match((await req(h, 'POST', '/atividades', nova({ titulo: 'x' }))).json.erro, /título/);
    assert.match((await req(h, 'POST', '/atividades', nova({ relTipo: 'aluno' }))).json.erro, /registro/);
    assert.match((await req(h, 'POST', '/atividades', nova({ data: '', hora: '10:00' }))).json.erro, /data do prazo/);
    const al = await prisma.aluno.findFirst({ orderBy: { id: 'asc' } });
    const c = await req(h, 'POST', '/atividades', nova({ relTipo: 'aluno', relId: String(al!.id) }));
    assert.equal(c.status, 200, JSON.stringify(c.json));
    const id = c.json.id;
    let a = (await req(h, 'GET', `/atividades/${id}`)).json;
    assert.equal(a.frente, 'Comercial');
    assert.equal(a.rel.nome, al!.nome);
    assert.equal(a.prazoTxt.includes('14:30') || a.prazoTxt.includes('30/09/2026'), true);
    await req(h, 'POST', `/atividades/${id}/situacao`, { situacao: 'andamento' });
    await req(h, 'POST', `/atividades/${id}/situacao`, { situacao: 'concluida' });
    a = (await req(h, 'GET', `/atividades/${id}`)).json;
    assert.equal(a.situacao, 'concluida');
    assert.ok(a.concluida);
    assert.deepEqual(a.hist.map((x: { det: string }) => x.det).slice(0, 2), [
      'Em andamento → Concluída',
      'A fazer → Em andamento',
    ]);
    const e = await req(
      h,
      'PATCH',
      `/atividades/${id}`,
      nova({
        prioridade: 'Baixa',
        situacao: 'concluida',
        relTipo: 'aluno',
        relId: String(al!.id),
        descricao: 'retorno na sexta',
      }),
    );
    assert.equal(e.status, 200);
    a = (await req(h, 'GET', `/atividades/${id}`)).json;
    assert.equal(a.hist[0].det, 'descrição, prioridade');
    /* setor de operações: vai para o quadro de Operações */
    const o = await req(
      h,
      'POST',
      '/atividades',
      nova({ setor: 'Financeiro/Fiscal', titulo: 'Conferir nota de setembro teste e2e' }),
    );
    assert.equal(o.json.frente, 'Operações');
    const q = (await req(h, 'GET', '/atividades/quadro?frente=Operações')).json;
    assert.ok(q.itens.some((x: { id: number }) => x.id === o.json.id));
    await req(h, 'POST', `/atividades/${o.json.id}/situacao`, { situacao: 'cancelada' });
    const q2 = (await req(h, 'GET', '/atividades/quadro?frente=Operações')).json;
    assert.ok(!q2.itens.some((x: { id: number }) => x.id === o.json.id), 'cancelada sai do quadro');
  });

  test('acesso por setor e Dashboard', async () => {
    const l = await entra('persona.l@alumni.teste', 'alumni-l');
    const op = (await req(l, 'GET', '/atividades/opcoes')).json;
    const setores = op.frentes.flatMap((f: { setores: string[] }) => f.setores);
    assert.ok(setores.includes('Comercial'));
    for (const f of ['Comercial', 'Operações']) {
      const r = await req(l, 'GET', `/atividades/quadro?frente=${encodeURIComponent(f)}`);
      if (r.status === 200) assert.ok(r.json.itens.every((x: { setor: string }) => setores.includes(x.setor)));
    }
    assert.equal(
      (await req(l, 'POST', '/atividades', nova({ setor: 'CX', titulo: 'fora do setor teste e2e' }))).status,
      setores.includes('CX') ? 200 : 403,
    );
    const d = (await req(await adm(), 'GET', '/atividades/dash')).json;
    assert.equal(d.porSetor.length, 7);
    assert.ok(d.stats.abertas > 0);
    const aluno = await entra('persona.a@alumni.teste', 'alumni-a');
    assert.equal((await req(aluno, 'GET', '/atividades/dash')).status, 403);
  });

  test('menu: Atividades com Dashboard, Comercial e Operações', async () => {
    const me = (await req(await adm(), 'GET', '/auth/me')).json;
    const at = me.nav.find((x: { key: string }) => x.key === 'acoes');
    assert.deepEqual(
      at.secoes.map((s: { etapa: string }) => s.etapa),
      ['Dashboard', 'Comercial', 'Operações'],
    );
    assert.equal(at.href, '/acoes/atvDash');
  });
});
