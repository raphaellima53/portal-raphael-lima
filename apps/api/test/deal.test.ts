/**
 * Deal dentro do Portal (23/09/2026): carga inicial, todas as telas, Novo pedido com cupom, baixa, cancelar,
 * Novo contrato, encerrar, ordem de faturamento, emitir notas, importação e acesso. Apaga o que criou no fim.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { montaApp } from '../src/app.ts';
import { prisma } from '../src/db.ts';

let app: FastifyInstance;
const criados = { pedidos: [] as number[], contratos: [] as number[], cupons: [] as string[] };
before(async () => {
  app = await montaApp();
});
after(async () => {
  await prisma.parcelaPedido.deleteMany({ where: { pedidoId: { in: criados.pedidos } } });
  await prisma.notaFiscal.deleteMany({ where: { pedidoId: { in: criados.pedidos } } });
  await prisma.pedido.deleteMany({ where: { id: { in: criados.pedidos } } });
  await prisma.contratoEmpresa.deleteMany({ where: { id: { in: criados.contratos } } });
  await prisma.cupom.deleteMany({ where: { codigo: { in: criados.cupons } } });
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
const adm = () => entra('admin@alumni.teste', 'alumni-admin');

describe('deal', () => {
  test('todas as telas respondem', async () => {
    const h = await adm();
    for (const u of [
      '/deal/painel',
      '/deal/pedidos',
      '/deal/importacoes',
      '/deal/renovacoes',
      '/deal/vendedores',
      '/deal/descontos',
      '/deal/bolsas',
      '/deal/contratos',
      '/deal/ordens',
      '/deal/fechamento',
      '/deal/contas',
      '/deal/notas',
      '/deal/cobrancas',
      '/deal/posicao?eixo=curso',
      '/deal/posicao?eixo=mes',
      '/deal/liquidacao',
      '/deal/conciliacao',
      '/deal/conferencia',
      '/deal/ofertas',
      '/deal/presets',
      '/deal/novo-pedido',
      '/deal/novo-contrato',
    ]) {
      const r = await req(h, 'GET', u);
      assert.equal(r.status, 200, `${u}: ${JSON.stringify(r.json).slice(0, 200)}`);
    }
    const ofs = (await req(h, 'GET', '/deal/ofertas')).json;
    assert.ok(ofs.itens.length > 0, 'ofertas padrão criadas dos cursos');
    const ps = (await req(h, 'GET', '/deal/pedidos')).json;
    assert.ok(ps.itens.length > 0, 'pedidos das matrículas');
    const p = (await req(h, 'GET', `/deal/pedidos/${ps.itens[0].id}`)).json;
    assert.ok(p.cronograma.length > 0);
    const cts = (await req(h, 'GET', '/deal/contratos')).json;
    assert.ok(cts.contratos.length > 0);
    assert.equal((await req(h, 'GET', `/deal/contratos/${cts.contratos[0].id}`)).status, 200);
  });

  test('novo pedido com cupom, baixa e cancelar', async () => {
    const h = await adm();
    const op = (await req(h, 'GET', '/deal/novo-pedido')).json;
    const al = op.alunos.find((a: { empresa: string | null }) => !a.empresa);
    const of = op.ofertas.find((o: { mercado: string }) => o.mercado === 'B2C');
    const base = {
      tipo: 'B2C',
      preset: 'B2C_DIRETO',
      vendedor: op.vendedores[0],
      alunoId: Number(al.v),
      ofertaId: of.id,
      forma: 1,
      parcelas: 3,
      obs: '',
    };
    assert.match((await req(h, 'POST', '/deal/pedidos', { ...base, cupom: 'NAOEXISTE' })).json.erro, /Cupom/);
    const r = await req(h, 'POST', '/deal/pedidos', { ...base, cupom: 'volta10' });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    criados.pedidos.push(r.json.id);
    let p = (await req(h, 'GET', `/deal/pedidos/${r.json.id}`)).json;
    assert.equal(p.cronograma.length, 3);
    assert.equal(p.cronograma[0].pago !== null, true, '1ª parcela no cartão entra paga');
    assert.match(p.pagamento.cupom, /VOLTA10/);
    const aberta = p.cronograma.find((x: { pago: string | null }) => !x.pago);
    assert.equal((await req(h, 'POST', '/deal/baixa', { key: aberta.key })).status, 200);
    assert.equal((await req(h, 'POST', '/deal/baixa', { key: aberta.key })).status, 409);
    const n0 = (await req(h, 'GET', '/deal/notas')).json.fila;
    assert.ok(n0 >= 2, 'parcelas pagas entram na fila de notas');
    assert.equal(
      (await req(h, 'POST', `/deal/pedidos/${r.json.id}/cancelar`, { motivo: 'Erro de cadastro' })).status,
      200,
    );
    p = (await req(h, 'GET', `/deal/pedidos/${r.json.id}`)).json;
    assert.equal(p.situacao[0], 'Cancelado');
  });

  test('contratos: aba do aluno e da empresa, novo e encerrar', async () => {
    const h = await adm();
    const aluno = await prisma.aluno.findFirst({ where: { empresaId: { not: null } } });
    if (aluno) {
      const t = (await req(h, 'GET', `/deal/contratos?alunoId=${aluno.id}`)).json;
      assert.ok(t.contratos.length >= 1, 'aluno de empresa vê o contrato da empresa');
      assert.ok(Array.isArray(t.pedidos));
    }
    const emp = await prisma.empresa.findFirst({ orderBy: { ordem: 'asc' } });
    const te = (await req(h, 'GET', `/deal/contratos?empresaId=${emp!.id}`)).json;
    assert.ok(te.contratos.length >= 1);
    const op = (await req(h, 'GET', '/deal/novo-contrato')).json;
    assert.match(
      (
        await req(h, 'POST', '/deal/contratos', {
          empresaId: emp!.id,
          nome: 'Teste e2e',
          preset: 'B2B_ABERTO_PER_CAPITA',
          ofertas: [],
          inicio: '2026-10-01',
        })
      ).json.erro,
      /oferta/,
    );
    const c = await req(h, 'POST', '/deal/contratos', {
      empresaId: emp!.id,
      nome: `${emp!.nome} — Teste e2e`,
      preset: 'B2B_ABERTO_PER_CAPITA',
      ofertas: [op.ofertas[0].id],
      inicio: '2026-10-01',
      fim: '2027-09-30',
      max: 10,
    });
    assert.equal(c.status, 200, JSON.stringify(c.json));
    criados.contratos.push(c.json.id);
    assert.equal(
      (await req(h, 'POST', `/deal/contratos/${c.json.id}/encerrar`, { data: '2026-12-31', motivo: 'fim do teste' }))
        .status,
      200,
    );
    assert.equal((await req(h, 'GET', `/deal/contratos/${c.json.id}`)).json.status, 'Encerrado');
  });

  test('cupom novo, ordem e acesso', async () => {
    const h = await adm();
    const cod = `E2E${Date.now() % 100000}`;
    assert.equal(
      (await req(h, 'POST', '/deal/cupons', { codigo: cod, valor: 15, validade: '2026-12-31', limite: 5 })).status,
      200,
    );
    criados.cupons.push(cod);
    assert.equal(
      (await req(h, 'POST', '/deal/cupons', { codigo: cod, valor: 15, validade: '2026-12-31' })).status,
      409,
    );
    const aluno = await entra('persona.a@alumni.teste', 'alumni-a');
    assert.equal((await req(aluno, 'GET', '/deal/pedidos')).status, 403);
    const l = await entra('persona.l@alumni.teste', 'alumni-l');
    assert.equal((await req(l, 'GET', '/deal/pedidos')).status, 200, 'comercial vê as vendas');
  });
});
