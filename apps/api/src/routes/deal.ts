/**
 * Rotas do Deal (23/09/2026). Acesso emprestado das telas vizinhas, como no protótipo 23:
 * Vendas = acFunil · Contratos = acFechamento · Financeiro = acCobranca · Ofertas e presets = catalogo.
 * As telas moram em Atividades › Comercial (Vendas), nas fichas do aluno e da empresa (Contratos) e no menu Financeiro.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.ts';
import { podeAcao } from '../domain/acesso.ts';
import { agAulasEntre, alMat, alSit, fxPresenca } from '../domain/agenda.ts';
import {
  cnpjFmt,
  criaPedido,
  ctVig,
  DEAL_FORMAS,
  DEAL_PRESETS,
  type DealCtx,
  dealCtx,
  dlH,
  forma,
  histDeal,
  type Linha,
  MOTIVOS_CANCEL,
  mesDe,
  mesRot,
  N,
  type PedidoDb,
  preset,
  vendedores,
} from '../domain/deal.ts';
import { finPct, finR } from '../domain/financeiro.ts';
import { podeChave } from '../domain/mapa.ts';
import { fmt } from '../lib/fmt.ts';
import { registra } from '../lib/log.ts';
import type { UsuarioSessao } from '../plugins/sessao.ts';

export const DEAL_CH = { vendas: 'acFunil', contratos: 'acFechamento', fin: 'acCobranca', cat: 'catalogo' };
const podeOperar = (u: UsuarioSessao) => !u.ehAluno && podeAcao(u.nivel, 'criar');
const exige =
  (...chaves: string[]) =>
  async (req: FastifyRequest, rep: FastifyReply) => {
    const u = req.usuario;
    if (!u) return rep.code(401).send({ erro: 'Sessão expirada. Entre de novo.' });
    if (u.ehAluno || !chaves.some((c) => podeChave(u, c)))
      return rep.code(403).send({ erro: 'Sem acesso a esta tela.' });
  };
const operar = async (req: FastifyRequest, rep: FastifyReply) => {
  if (!podeOperar(req.usuario!)) return rep.code(403).send({ erro: 'Seu acesso é só de leitura.' });
};
const erro400 = (rep: FastifyReply, e: z.ZodError) => rep.code(400).send({ erro: e.issues[0].message });
const R = (n: number) => finR(n);
const SIT_LINHA: Record<string, [string, string]> = {
  paga: ['Paga', 'green'],
  vencida: ['Vencida', 'red'],
  aVencer: ['A vencer', 'gray'],
};
const idN = (req: FastifyRequest) => Number((req.params as { id: string }).id);
const log = (u: UsuarioSessao, id: string, nome: string, acao: string, detalhe: string) =>
  registra({ tipo: 'deal', id, nome, acao, detalhe, autor: u.nome });

/* ---------- serializações ---------- */
function pedidoLinha(c: DealCtx, p: PedidoDb) {
  return {
    id: p.id,
    data: fmt.data(p.data),
    dataIso: p.data.toISOString(),
    alunoId: p.alunoId,
    cliente: p.cliente,
    curso: p.curso,
    oferta: p.ofertaNome,
    tipo: p.tipo,
    forma: forma(p.forma).nome,
    vendedor: p.vendedor,
    renovacao: p.renovacao,
    total: R(N(p.total)),
    totalN: N(p.total),
    contrato: p.contratoId ? (c.contratos.find((x) => x.id === p.contratoId)?.nome ?? null) : null,
    contratoId: p.contratoId,
    situacao: c.sitPedido(p),
  };
}
const linhaParcela = (c: DealCtx, x: Linha) => {
  const nf = c.nfs.find((n) => n.chave === x.key);
  return {
    key: x.key,
    parcela: x.parcela,
    competencia: mesRot(mesDe(x.venc)),
    venc: fmt.data(x.venc),
    valor: R(x.valor),
    pago: x.pago ? fmt.data(x.pago) : null,
    nota: nf ? `NF ${nf.numero}` : x.pago && c.fila.some((f) => f.chave === x.key) ? 'na fila' : null,
    situacao: SIT_LINHA[x.sit],
    atraso: x.atraso,
    pagador: x.pagador,
    item: x.tipo === 'turma' ? x.item : null,
  };
};
function contratoLinha(c: DealCtx, ct: DealCtx['contratos'][number]) {
  const pos = c.ctPos(ct.id);
  return {
    id: ct.id,
    nome: ct.nome,
    empresa: ct.empresa,
    empresaId: ct.empresaId,
    cnpj: cnpjFmt(ct.cnpj),
    preset: ct.preset,
    vigencia: `${fmt.data(ct.inicio)} — ${fmt.data(ct.fim)}`,
    vig: ctVig(ct.fim, c.agora),
    beneficiarios: `${ct.turmas.length || ct.benef.length} / ${ct.max}`,
    vendido: R(pos.vendido),
    vencido: R(pos.vencido),
    temVencido: pos.vencido > 0,
    status: ct.status,
  };
}
const notaLinha = (c: DealCtx, n: DealCtx['nfs'][number]) => ({
  id: n.id,
  numero: `NF ${n.numero}`,
  competencia: mesRot(n.competencia),
  pagador: n.pagador,
  alunoId: n.alunoId,
  origem: n.ordemId
    ? `Ordem ${c.ordens.find((o) => o.id === n.ordemId)?.numero ?? ''}`
    : n.pedidoId
      ? `Pedido #${n.pedidoId} · ${n.parcela}`
      : '—',
  pedidoId: n.pedidoId,
  valor: R(N(n.total)),
  emitida: fmt.data(n.emitida),
  situacao: ['autorizada', 'green'] as [string, string],
});
const filaLinha = (f: DealCtx['fila'][number]) => ({
  id: null,
  numero: '—',
  competencia: mesRot(f.competencia),
  pagador: f.pagador,
  alunoId: f.alunoId,
  origem: f.ordemId ? 'Ordem liberada' : `Pedido #${f.pedidoId} · ${f.parcela}`,
  pedidoId: f.pedidoId,
  valor: R(f.total),
  emitida: null,
  situacao: ['na fila', 'amber'] as [string, string],
});

export default async function rotasDeal(app: FastifyInstance) {
  /* ================= VENDAS ================= */
  app.get('/deal/painel', { preHandler: exige(DEAL_CH.vendas) }, async () => {
    const c = await dealCtx();
    const hoje = c.agora;
    const meses: string[] = [];
    for (let k = 5; k >= 0; k--) meses.push(mesDe(new Date(hoje.getFullYear(), hoje.getMonth() - k, 1)));
    const L = meses.map((m) => ({
      mes: mesRot(m),
      vendido: c.pedidos.filter((p) => !p.cancelado && mesDe(p.data) === m).reduce((s, p) => s + N(p.total), 0),
      pago: c.cobs.filter((x) => x.pago && mesDe(x.pago) === m).reduce((s, x) => s + x.valor, 0),
      faturado: c.nfs.filter((n) => mesDe(n.emitida) === m).reduce((s, n) => s + N(n.total), 0),
    }));
    const mes = L[L.length - 1];
    const venc = c.cobs.filter((x) => x.sit === 'vencida');
    const faixa = (a: number, b: number) => venc.filter((x) => x.atraso > a && x.atraso <= b);
    const aConf = c.ordens.filter((o) => o.status !== 'liberada');
    const soma = (ls: { valor: number }[]) => ls.reduce((s, x) => s + x.valor, 0);
    return {
      stats: [
        { v: R(mes.vendido), l: 'vendido no mês' },
        { v: R(mes.pago), l: 'pago no mês', tom: 'green' },
        { v: R(mes.faturado), l: 'faturado no mês' },
        {
          v: R(soma(venc)),
          l: `a cobrar · ${venc.length} ${venc.length === 1 ? 'parcela' : 'parcelas'}`,
          tom: venc.length ? 'red' : undefined,
        },
        {
          v: R(aConf.reduce((s, o) => s + N(o.total), 0)),
          l: `a faturar · ${aConf.length} ${aConf.length === 1 ? 'ordem' : 'ordens'}`,
        },
      ],
      meses: L.map((l) => ({
        mes: l.mes,
        vendido: l.vendido,
        pago: l.pago,
        faturado: l.faturado,
        vendidoR: R(l.vendido),
        pagoR: R(l.pago),
        faturadoR: R(l.faturado),
      })),
      pendencias: [
        ['Parcelas vencidas até 30 dias', faixa(0, 30)],
        ['Vencidas de 31 a 60 dias', faixa(30, 60)],
        ['Vencidas de 61 a 90 dias', faixa(60, 90)],
        ['Vencidas há mais de 90 dias', faixa(90, 1e9)],
      ]
        .map(([t, ls]) => ({ t: t as string, n: (ls as unknown[]).length, v: R(soma(ls as { valor: number }[])) }))
        .concat([
          { t: 'Notas na fila de emissão', n: c.fila.length, v: R(c.fila.reduce((s, f) => s + f.total, 0)) },
          { t: 'Ordens de faturamento a confirmar', n: aConf.length, v: R(aConf.reduce((s, o) => s + N(o.total), 0)) },
        ]),
      ultimas: c.pedidos.slice(0, 6).map((p) => pedidoLinha(c, p)),
    };
  });

  app.get('/deal/pedidos', { preHandler: exige(DEAL_CH.vendas) }, async () => {
    const c = await dealCtx();
    return {
      vendedores: (await vendedores()).map((v) => v.nome),
      itens: c.pedidos.map((p) => ({
        ...pedidoLinha(c, p),
        aberto: c
          .linhas(p)
          .filter((x) => x.sit !== 'paga')
          .reduce((s, x) => s + x.valor, 0),
      })),
    };
  });

  app.get('/deal/pedidos/:id', { preHandler: exige(DEAL_CH.vendas) }, async (req, rep) => {
    const c = await dealCtx();
    const p = c.pedidos.find((x) => x.id === idN(req));
    if (!p) return rep.code(404).send({ erro: 'Pedido não encontrado.' });
    const pos = c.posicao(p);
    const pr = preset(p.preset);
    const of = c.ofertas.find((o) => o.id === p.ofertaId);
    const ct = p.contratoId ? c.contratos.find((x) => x.id === p.contratoId) : undefined;
    const itens = (
      (of?.itens as { tipologia: string; produto: string }[]) ?? [{ tipologia: 'Serviço', produto: p.ofertaNome }]
    ).map((it, i) => ({
      tipologia: it.tipologia,
      descricao: i ? it.produto : p.ofertaNome,
      qtd: 1,
      unitario: R(i ? 0 : N(p.total)),
      total: R(i ? 0 : N(p.total)),
    }));
    const ev = [
      ...(p.hist as { quando: string; quem: string; acao: string; det: string }[]).map((h) => ({
        q: new Date(h.quando),
        o: h.quem,
        t: h.acao,
        d: h.det,
      })),
      ...pos.ls
        .filter((x) => x.pago)
        .map((x) => ({ q: x.pago!, o: 'Vindi', t: 'Pagamento confirmado', d: `Parcela ${x.parcela} · ${R(x.valor)}` })),
      ...pos.notas.map((n) => ({
        q: n.emitida,
        o: 'Omie',
        t: 'Nota fiscal autorizada',
        d: `NF ${n.numero} · ${R(N(n.total))}`,
      })),
    ].sort((a, b) => +b.q - +a.q);
    return {
      ...pedidoLinha(c, p),
      cancelado: p.cancelado,
      motivoCancel: p.motivoCancel,
      podeOperar: podeOperar(req.usuario!),
      motivos: MOTIVOS_CANCEL,
      stats: [
        { v: R(pos.emitido), l: 'emitido' },
        { v: R(pos.pago), l: 'pago', tom: 'green' },
        { v: R(pos.aReceber), l: 'a receber' },
        { v: R(pos.vencido), l: 'vencido', tom: pos.vencido ? 'red' : undefined },
      ],
      passo: pos.passo,
      pagamento: {
        total: R(N(p.total)),
        forma: forma(p.forma).nome,
        gateway: forma(p.forma).gateway,
        parcelas: `${p.parcelas}x de ${R(N(p.total) / p.parcelas)}`,
        cupom: p.cupom ? `${p.cupom} · − ${R(N(p.desconto))}` : null,
      },
      acordo: {
        preset: pr.code,
        presetDesc: pr.desc,
        regime: `${pr.regime} · ${pr.forma}`,
        renovacao: p.renovacao ? 'sim' : 'não',
      },
      contrato: ct ? { id: ct.id, nome: ct.nome } : null,
      obs: p.obs,
      itens,
      cronograma: pos.ls.map((x) => linhaParcela(c, x)),
      notas: [...pos.notas.map((n) => notaLinha(c, n)), ...c.fila.filter((f) => f.pedidoId === p.id).map(filaLinha)],
      linha: ev.map((e) => ({ quando: fmt.dataHora(e.q), origem: e.o, evento: e.t, detalhe: e.d })),
    };
  });

  /* dar baixa numa parcela: do pedido novo (ParcelaPedido) ou do Portal (ParcelaPaga, a mesma da Cobrança) */
  app.post('/deal/baixa', { preHandler: [exige(DEAL_CH.vendas, DEAL_CH.fin), operar] }, async (req, rep) => {
    const u = req.usuario!;
    const r = z.object({ key: z.string().min(1).max(300) }).safeParse(req.body);
    if (!r.success) return rep.code(400).send({ erro: 'Parcela não informada.' });
    const key = r.data.key;
    const c = await dealCtx();
    const p = c.pedidos.find((x) => c.linhas(x).some((l) => l.key === key));
    const x = p ? c.linhas(p).find((l) => l.key === key) : c.cobs.find((l) => l.key === key);
    if (!x) return rep.code(404).send({ erro: 'Parcela não encontrada. A lista pode ter mudado; recarregue.' });
    if (x.pago) return rep.code(409).send({ erro: `Parcela ${x.parcela} de ${x.pagador} já está paga.` });
    if (key.startsWith('novo|'))
      await prisma.parcelaPedido.update({ where: { chave: key }, data: { pago: new Date() } });
    else await prisma.parcelaPaga.create({ data: { chave: key, por: u.nome } });
    if (p)
      await prisma.pedido.update({
        where: { id: p.id },
        data: { hist: [histDeal(u.nome, 'Baixa manual', `parcela ${x.parcela}`), ...(p.hist as object[])] },
      });
    await log(
      u,
      p ? `pedido-${p.id}` : key,
      x.pagador,
      'Baixa manual',
      `${x.curso} · parcela ${x.parcela} · ${R(x.valor)}`,
    );
    return { msg: `Parcela ${x.parcela} de ${x.pagador} liquidada: ${R(x.valor)}.` };
  });

  app.post('/deal/pedidos/:id/cancelar', { preHandler: [exige(DEAL_CH.vendas), operar] }, async (req, rep) => {
    const u = req.usuario!;
    const r = z
      .object({ motivo: z.string().refine((m) => MOTIVOS_CANCEL.includes(m), 'Escolha o motivo.') })
      .safeParse(req.body);
    if (!r.success) return erro400(rep, r.error);
    const p = await prisma.pedido.findUnique({ where: { id: idN(req) } });
    if (!p) return rep.code(404).send({ erro: 'Pedido não encontrado.' });
    if (p.cancelado) return rep.code(409).send({ erro: 'O pedido já está cancelado.' });
    await prisma.pedido.update({
      where: { id: p.id },
      data: {
        cancelado: true,
        motivoCancel: r.data.motivo,
        hist: [histDeal(u.nome, 'Pedido cancelado', r.data.motivo), ...(p.hist as object[])],
      },
    });
    await log(u, `pedido-${p.id}`, p.cliente, 'Pedido cancelado', r.data.motivo);
    return { msg: `Pedido #${p.id} cancelado. As parcelas em aberto deixam de ser cobradas.` };
  });

  /* Novo pedido: opções dos 4 passos e a criação */
  app.get('/deal/novo-pedido', { preHandler: exige(DEAL_CH.vendas) }, async (req) => {
    const c = await dealCtx();
    return {
      podeOperar: podeOperar(req.usuario!),
      presets: DEAL_PRESETS.filter((p) => p.nivel !== 'B2B' && p.regime !== 'Bolsa').map((p) => ({
        code: p.code,
        desc: p.desc,
        nivel: p.nivel,
      })),
      vendedores: (await vendedores()).filter((v) => v.ativo).map((v) => v.nome),
      alunos: c.b.alunos
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
        .map((a) => ({ v: String(a.id), l: a.name, empresa: a.empresa })),
      ofertas: c.ofertas
        .filter((o) => o.ativa && o.mercado !== 'B2B')
        .map((o) => ({
          id: o.id,
          nome: o.nome,
          curso: o.curso,
          aulas: o.aulas,
          preco: N(o.preco),
          precoR: R(N(o.preco)),
          parcelasMax: o.parcelasMax,
          mercado: o.mercado,
        })),
      formas: DEAL_FORMAS.filter((f) => f.id !== 4).map((f) => ({ id: f.id, nome: f.nome })),
      cupons: c.cupons
        .filter((x) => x.validade > c.agora)
        .map((x) => ({ codigo: x.codigo, tipo: x.tipo, valor: N(x.valor), ofertas: x.ofertas })),
    };
  });
  const PedidoIn = z.object({
    tipo: z.enum(['B2C', 'B2B2C']),
    preset: z.string().refine((p) => DEAL_PRESETS.some((x) => x.code === p), 'Escolha o preset.'),
    vendedor: z.string().min(1, 'Escolha o vendedor e o cliente.'),
    alunoId: z.number().int(),
    ofertaId: z.number().int({ message: 'Escolha uma oferta.' }),
    forma: z.number().int().min(1).max(3),
    parcelas: z.number().int().min(1).max(12),
    cupom: z.string().default(''),
    obs: z.string().max(2000).default(''),
  });
  app.post('/deal/pedidos', { preHandler: [exige(DEAL_CH.vendas), operar] }, async (req, rep) => {
    const u = req.usuario!;
    const r = PedidoIn.safeParse(req.body);
    if (!r.success) return erro400(rep, r.error);
    const v = r.data;
    const c = await dealCtx();
    const a = c.b.alunos.find((x) => x.id === v.alunoId);
    const of = c.ofertas.find((o) => o.id === v.ofertaId);
    if (!a) return rep.code(400).send({ erro: 'Escolha o vendedor e o cliente.' });
    if (!of) return rep.code(400).send({ erro: 'Escolha uma oferta.' });
    if (v.parcelas > of.parcelasMax) return rep.code(400).send({ erro: `Esta oferta vai até ${of.parcelasMax}x.` });
    const cod = v.cupom.trim().toUpperCase();
    const cp = cod ? c.cupons.find((x) => x.codigo === cod && x.validade > c.agora) : undefined;
    if (cod && !cp) return rep.code(400).send({ erro: 'Cupom inválido ou vencido.' });
    const usos = cp ? c.pedidos.filter((p) => p.cupom === cp.codigo).length : 0;
    if (cp && usos >= cp.limite) return rep.code(400).send({ erro: 'Cupom esgotado.' });
    const preco = N(of.preco);
    const desc = cp ? (cp.tipo === '%' ? (preco * N(cp.valor)) / 100 : N(cp.valor)) : 0;
    const total = Math.max(0, preco - desc);
    const ct =
      v.tipo === 'B2B2C' && a.empresa
        ? c.contratos.find((x) => x.empresa === a.empresa && x.status === 'Ativo')
        : undefined;
    const p = await criaPedido({
      alunoId: a.id,
      cliente: a.name,
      oferta: of,
      total,
      forma: v.forma,
      parcelas: v.parcelas,
      preset: v.preset,
      tipo: v.tipo,
      contrato: ct ?? null,
      vendedor: v.vendedor,
      cupom: cp?.codigo ?? '',
      desconto: desc,
      obs: v.obs,
      autor: u.nome,
      origem: 'pelo Novo pedido',
    });
    await log(u, `pedido-${p.id}`, a.name, 'Venda criada', `${of.nome} · ${R(total)}`);
    return { id: p.id, msg: `Pedido #${p.id} criado para ${a.name}: ${R(total)} em ${v.parcelas}x.` };
  });

  /* Importações da Vindi */
  app.get('/deal/importacoes', { preHandler: exige(DEAL_CH.vendas) }, async (req) => {
    await dealCtx();
    const ls = await prisma.importacaoVindi.findMany({ where: { importadaEm: null }, orderBy: { quando: 'desc' } });
    return {
      podeOperar: podeOperar(req.usuario!),
      itens: ls.map((x) => ({
        id: x.id,
        aba: x.aba,
        quando: fmt.dataHora(x.quando),
        nome: x.nome,
        oferta: x.oferta,
        valor: R(N(x.valor)),
        critica: x.critica,
        pronta: x.pronta,
        acao: x.acao,
      })),
    };
  });
  app.post('/deal/importacoes/:id', { preHandler: [exige(DEAL_CH.vendas), operar] }, async (req, rep) => {
    const u = req.usuario!;
    const id = (req.params as { id: string }).id;
    const x = await prisma.importacaoVindi.findUnique({ where: { id } });
    if (!x || x.importadaEm) return rep.code(404).send({ erro: 'Cobrança não está mais na fila.' });
    if (!x.pronta) return rep.code(409).send({ erro: `Ajuste antes: ${x.critica}.` });
    await prisma.importacaoVindi.update({ where: { id }, data: { importadaEm: new Date(), importadaPor: u.nome } });
    await log(u, `vindi-${id}`, x.nome, 'Importado da Vindi', `${x.acao} · ${R(N(x.valor))}`);
    return { msg: `${x.nome}: ${x.acao} feito.` };
  });

  /* Renovações: quem já usou 30% ou mais do pacote */
  app.get('/deal/renovacoes', { preHandler: exige(DEAL_CH.vendas) }, async () => {
    const c = await dealCtx();
    const porTurma = (n: string) => c.b.cursos.find((x) => x.name === n)?.estrutura === 'turmas';
    return {
      itens: c.b.alunos
        .flatMap((a) => alMat(a).map((e) => ({ a, e, pct: (e.usadas || 0) / (e.total || 1) })))
        .filter((x) => x.pct >= 0.3 && !porTurma(x.e.curso))
        .sort((x, y) => y.pct - x.pct)
        .map((x) => {
          const ped = c.pedidos.find((p) => p.alunoId === x.a.id && p.curso === x.e.curso);
          return {
            alunoId: x.a.id,
            nome: x.a.name,
            empresa: x.a.empresa,
            curso: x.e.curso,
            cor: c.b.corCurso[x.e.curso] ?? '#003fb0',
            pct: Math.round(x.pct * 100),
            usadas: x.e.usadas,
            total: x.e.total,
            restam: Math.max(0, x.e.total - x.e.usadas),
            pedidoId: ped?.id ?? null,
          };
        }),
    };
  });

  app.get('/deal/vendedores', { preHandler: exige(DEAL_CH.vendas) }, async () => {
    const c = await dealCtx();
    return {
      itens: (await vendedores()).map((v) => {
        const ps = c.pedidos.filter((p) => p.vendedor === v.nome && !p.cancelado);
        return {
          nome: v.nome,
          email: v.email,
          nichos: v.nichos,
          pedidos: ps.length,
          quitados: ps.filter((p) => c.sitPedido(p)[0] === 'Quitado').length,
          vendido: R(ps.reduce((s, p) => s + N(p.total), 0)),
          ultimo: ps[0] ? fmt.data(ps[0].data) : null,
          ativo: v.ativo,
        };
      }),
    };
  });

  app.get('/deal/descontos', { preHandler: exige(DEAL_CH.vendas) }, async (req) => {
    const c = await dealCtx();
    return {
      podeOperar: podeOperar(req.usuario!),
      stats: [
        { v: String(c.cupons.length), l: 'cupons' },
        { v: String(c.pedidos.filter((p) => p.cupom).length), l: 'usos' },
        { v: R(c.pedidos.reduce((s, p) => s + N(p.desconto), 0)), l: 'desconto concedido' },
      ],
      itens: c.cupons.map((x) => {
        const usos = c.pedidos.filter((p) => p.cupom === x.codigo).length;
        const sit: [string, string] =
          x.validade < c.agora
            ? ['Vencido', 'gray']
            : usos >= x.limite
              ? ['Esgotado', 'amber']
              : !x.ofertas.length
                ? ['Sem oferta', 'amber']
                : ['Ativo', 'green'];
        return {
          codigo: x.codigo,
          descricao: x.descricao,
          desconto: x.tipo === '%' ? `${N(x.valor)}%` : R(N(x.valor)),
          validade: fmt.data(x.validade),
          usos: `${usos} de ${x.limite}`,
          ofertas: x.ofertas.length,
          situacao: sit,
        };
      }),
    };
  });
  app.post('/deal/cupons', { preHandler: [exige(DEAL_CH.vendas), operar] }, async (req, rep) => {
    const u = req.usuario!;
    const r = z
      .object({
        codigo: z.string().trim().min(3, 'Informe o código.').max(30),
        descricao: z.string().max(200).default(''),
        valor: z.number().min(1, 'Informe o desconto.').max(90, 'Desconto de até 90%.'),
        validade: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a validade.'),
        limite: z.number().int().min(1).default(50),
      })
      .safeParse(req.body);
    if (!r.success) return erro400(rep, r.error);
    const cod = r.data.codigo.toUpperCase().replace(/\s+/g, '');
    if (await prisma.cupom.findUnique({ where: { codigo: cod } }))
      return rep.code(409).send({ erro: 'Já existe um cupom com esse código.' });
    const [y, m, d] = r.data.validade.split('-').map(Number);
    const c = await dealCtx();
    await prisma.cupom.create({
      data: {
        codigo: cod,
        descricao: r.data.descricao || '—',
        tipo: '%',
        valor: r.data.valor,
        validade: new Date(y, m - 1, d, 23, 59),
        limite: r.data.limite,
        ofertas: c.ofertas.filter((o) => o.mercado === 'B2C').map((o) => o.id),
      },
    });
    await log(u, `cupom-${cod}`, cod, 'Cupom criado', `${r.data.valor}% até ${fmt.data(new Date(y, m - 1, d))}`);
    return { msg: `Cupom ${cod} criado.` };
  });

  app.get('/deal/bolsas', { preHandler: exige(DEAL_CH.vendas) }, async () => {
    const c = await dealCtx();
    const ls = await prisma.bolsa.findMany({ orderBy: { concedida: 'desc' } });
    return {
      stats: [
        { v: String(ls.length), l: 'bolsas' },
        { v: String(ls.filter((x) => x.fim > c.agora).length), l: 'vigentes' },
        { v: R(ls.reduce((s, x) => s + N(x.custo), 0)), l: 'custo das bolsas' },
      ],
      itens: ls.map((x) => ({
        id: x.id,
        alunoId: x.alunoId,
        nome: x.nome,
        caso: x.caso,
        curso: x.curso,
        vigencia: `${fmt.data(x.inicio)} — ${fmt.data(x.fim)}`,
        aulas: `${x.usadas} de ${x.aulas}`,
        custo: R(N(x.custo)),
        motivo: x.motivo,
        situacao: (x.fim > c.agora ? ['Vigente', 'green'] : ['Encerrada', 'gray']) as [string, string],
      })),
    };
  });

  /* ================= CONTRATOS (nas fichas) ================= */
  app.get('/deal/contratos', { preHandler: exige(DEAL_CH.contratos, DEAL_CH.vendas) }, async (req) => {
    const q = req.query as { alunoId?: string; empresaId?: string };
    const c = await dealCtx();
    let cts = c.contratos;
    let pedidos: ReturnType<typeof pedidoLinha>[] | null = null;
    let empresa: string | null = null;
    if (q.alunoId) {
      const a = c.b.alunos.find((x) => String(x.id) === q.alunoId);
      empresa = a?.empresa ?? null;
      cts = c.contratos.filter((x) => (a && x.benef.includes(a.id)) || (empresa && x.empresa === empresa));
      pedidos = podeChave(req.usuario!, DEAL_CH.vendas)
        ? c.pedidos.filter((p) => String(p.alunoId) === q.alunoId).map((p) => pedidoLinha(c, p))
        : null;
    } else if (q.empresaId) {
      const e = await prisma.empresa.findUnique({ where: { id: q.empresaId } });
      empresa = e?.nome ?? null;
      cts = c.contratos.filter((x) => x.empresaId === q.empresaId || (empresa && x.empresa === empresa));
    }
    return {
      podeCriar: podeOperar(req.usuario!) && podeChave(req.usuario!, DEAL_CH.contratos),
      empresa,
      contratos: cts.map((ct) => contratoLinha(c, ct)),
      pedidos,
    };
  });

  app.get('/deal/contratos/:id', { preHandler: exige(DEAL_CH.contratos, DEAL_CH.vendas) }, async (req, rep) => {
    const c = await dealCtx();
    const ct = c.contratos.find((x) => x.id === idN(req));
    if (!ct) return rep.code(404).send({ erro: 'Contrato não encontrado.' });
    const pos = c.ctPos(ct.id);
    const pr = preset(ct.preset);
    const hist = [
      { q: ct.inicio, t: 'Contrato criado', d: `preset ${ct.preset} · ${ct.max} vagas`, quem: ct.kam },
      ...pos.ords
        .filter((o) => o.liberadaEm)
        .map((o) => ({
          q: o.liberadaEm!,
          t: 'Ordem liberada',
          d: `${o.numero} · ${R(N(o.total))}`,
          quem: 'Financeiro',
        })),
      ...(ct.hist as { quando: string; quem: string; acao: string; det: string }[]).map((h) => ({
        q: new Date(h.quando),
        t: h.acao,
        d: h.det,
        quem: h.quem,
      })),
    ].sort((a, b) => +b.q - +a.q);
    return {
      ...contratoLinha(c, ct),
      podeOperar: podeOperar(req.usuario!) && podeChave(req.usuario!, DEAL_CH.contratos),
      kam: ct.kam,
      tipoB2B: ct.tipoB2B,
      retencao: ct.retencao,
      presetDesc: pr.desc,
      regime: `${pr.regime} · ${pr.forma}`,
      motivoFim: ct.motivoFim,
      stats: [
        { v: R(pos.vendido), l: 'vendido' },
        { v: R(pos.emitido), l: 'emitido' },
        { v: R(pos.pago), l: 'pago', tom: 'green' },
        { v: R(pos.vencido), l: 'vencido', tom: pos.vencido ? 'red' : undefined },
        {
          v: R(pos.aConfirmar.reduce((s, o) => s + N(o.total), 0)),
          l: `a confirmar · ${pos.aConfirmar.length} ${pos.aConfirmar.length === 1 ? 'ordem' : 'ordens'}`,
        },
      ],
      passo: pos.aConfirmar.length
        ? `Confirmar ${pos.aConfirmar.length} ${pos.aConfirmar.length === 1 ? 'ordem' : 'ordens'} de ${mesRot(pos.aConfirmar[0].competencia)}`
        : null,
      pedidosN: pos.ps.length,
      ofertas: ct.ofertas
        .map((oid) => c.ofertas.find((o) => o.id === oid))
        .filter((o) => !!o)
        .map((o) => ({
          nome: o.nome,
          curso: o.curso,
          aulas: o.aulas,
          preco: R(N(o.preco)),
          forma: forma(o.forma).nome,
          matriculas: pos.ps.filter((p) => p.ofertaId === o.id).length,
        })),
      pedidos: pos.ps.map((p) => pedidoLinha(c, p)),
      cronograma: pos.ls
        .slice()
        .sort((a, b) => +a.venc - +b.venc)
        .map((x) => linhaParcela(c, x)),
      turmas: ct.turmas,
      benefLista: ct.benef
        .map((aid) => c.b.alunos.find((a) => a.id === aid))
        .filter((a) => !!a)
        .map((a) => {
          const p = pos.ps.find((x) => x.alunoId === a.id);
          return { id: a.id, nome: a.name, cpf: a.cpf, pedidoId: p?.id ?? null, situacao: alSit(a) };
        }),
      historico: hist.map((h) => ({ quando: fmt.dataHora(h.q), quem: h.quem, acao: h.t, detalhe: h.d })),
    };
  });

  app.get('/deal/novo-contrato', { preHandler: exige(DEAL_CH.contratos) }, async () => {
    const c = await dealCtx();
    return {
      empresas: (await prisma.empresa.findMany({ orderBy: { nome: 'asc' } })).map((e) => ({ v: e.id, l: e.nome })),
      presets: DEAL_PRESETS.filter((p) => p.contrato).map((p) => ({
        code: p.code,
        desc: p.desc,
        regime: p.regime,
        forma: p.forma,
        fat: p.fat,
      })),
      ofertas: c.ofertas
        .filter((o) => o.mercado !== 'B2C')
        .map((o) => ({ id: o.id, nome: o.nome, preco: R(N(o.preco)) })),
    };
  });
  app.post('/deal/contratos', { preHandler: [exige(DEAL_CH.contratos), operar] }, async (req, rep) => {
    const u = req.usuario!;
    const r = z
      .object({
        empresaId: z.string().min(1, 'Escolha a empresa e dê um nome ao contrato.'),
        nome: z.string().trim().min(3, 'Escolha a empresa e dê um nome ao contrato.'),
        preset: z.string().refine((p) => DEAL_PRESETS.some((x) => x.code === p && x.contrato), 'Escolha o preset.'),
        ofertas: z.array(z.number().int()).min(1, 'Escolha pelo menos uma oferta.'),
        inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe o início.'),
        fim: z.string().default(''),
        max: z.number().int().min(1).nullable().default(null),
      })
      .safeParse(req.body);
    if (!r.success) return erro400(rep, r.error);
    const v = r.data;
    const e = await prisma.empresa.findUnique({ where: { id: v.empresaId } });
    if (!e) return rep.code(400).send({ erro: 'Empresa não encontrada.' });
    const dt = (s: string) => {
      const [y, m, d] = s.split('-').map(Number);
      return new Date(y, m - 1, d);
    };
    const benef = (await prisma.aluno.findMany({ where: { empresaId: e.id }, select: { id: true } })).map((a) => a.id);
    const ct = await prisma.contratoEmpresa.create({
      data: {
        nome: v.nome,
        empresa: e.nome,
        empresaId: e.id,
        cnpj: e.cnpj,
        preset: v.preset,
        tipoB2B: preset(v.preset).desc,
        inicio: dt(v.inicio),
        fim: v.fim ? dt(v.fim) : new Date(dt(v.inicio).getFullYear() + 10, 0, 1),
        max: v.max ?? 999,
        benef,
        kam: u.nome,
        retencao: 'Sem retenção',
        ofertas: v.ofertas,
        turmas: [],
        hist: [histDeal(u.nome, 'Contrato criado', 'pelo Novo contrato')],
      },
    });
    await log(u, `contrato-${ct.id}`, ct.nome, 'Contrato criado', `${e.nome} · ${v.preset}`);
    return { id: ct.id, msg: `Contrato ${ct.nome} criado.` };
  });
  app.post('/deal/contratos/:id/encerrar', { preHandler: [exige(DEAL_CH.contratos), operar] }, async (req, rep) => {
    const u = req.usuario!;
    const r = z
      .object({
        data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data de encerramento.'),
        motivo: z.string().trim().min(3, 'Informe o motivo.'),
      })
      .safeParse(req.body);
    if (!r.success) return erro400(rep, r.error);
    const ct = await prisma.contratoEmpresa.findUnique({ where: { id: idN(req) } });
    if (!ct) return rep.code(404).send({ erro: 'Contrato não encontrado.' });
    if (ct.status !== 'Ativo') return rep.code(409).send({ erro: 'O contrato já está encerrado.' });
    const [y, m, d] = r.data.data.split('-').map(Number);
    await prisma.contratoEmpresa.update({
      where: { id: ct.id },
      data: {
        status: 'Encerrado',
        fim: new Date(y, m - 1, d),
        motivoFim: r.data.motivo,
        hist: [histDeal(u.nome, 'Contrato encerrado', r.data.motivo), ...(ct.hist as object[])],
      },
    });
    await log(u, `contrato-${ct.id}`, ct.nome, 'Contrato encerrado', r.data.motivo);
    return { msg: `${ct.nome} encerrado.` };
  });

  /* ================= FINANCEIRO ================= */
  app.get('/deal/ordens', { preHandler: exige(DEAL_CH.contratos, DEAL_CH.fin) }, async (req) => {
    const c = await dealCtx();
    const n = (s: string) => c.ordens.filter((o) => o.status === s);
    return {
      podeOperar: podeOperar(req.usuario!),
      stats: ['a confirmar', 'proposta', 'liberada'].map((s) => ({
        v: R(n(s).reduce((t, o) => t + N(o.total), 0)),
        l: `${s} · ${n(s).length}`,
      })),
      itens: c.ordens
        .slice()
        .sort((a, b) => b.competencia.localeCompare(a.competencia))
        .map((o) => {
          const ct = c.contratos.find((x) => x.id === o.contratoId);
          return {
            id: o.id,
            numero: o.numero,
            competencia: mesRot(o.competencia),
            pagador: o.pagador,
            contrato: ct ? { id: ct.id, nome: ct.nome } : null,
            linhas: o.linhas,
            total: R(N(o.total)),
            venc: fmt.data(o.venc),
            status: o.status,
          };
        }),
    };
  });
  app.post('/deal/ordens/:id', { preHandler: [exige(DEAL_CH.contratos, DEAL_CH.fin), operar] }, async (req, rep) => {
    const u = req.usuario!;
    const o = await prisma.ordemFaturamento.findUnique({ where: { id: idN(req) } });
    if (!o) return rep.code(404).send({ erro: 'Ordem não encontrada.' });
    if (o.status === 'a confirmar') {
      const numero = `OF-${o.competencia.replace('-', '')}-${String(o.id).padStart(4, '0')}`;
      await prisma.ordemFaturamento.update({ where: { id: o.id }, data: { status: 'proposta', numero } });
      await log(u, `ordem-${o.id}`, o.pagador, 'Ordem proposta', `${numero} · ${R(N(o.total))}`);
      return { msg: `Linhas confirmadas: ordem ${numero} proposta.` };
    }
    if (o.status === 'proposta') {
      await prisma.ordemFaturamento.update({
        where: { id: o.id },
        data: { status: 'liberada', liberadaEm: new Date() },
      });
      await log(u, `ordem-${o.id}`, o.pagador, 'Ordem liberada', `${o.numero} · ${R(N(o.total))}`);
      return { msg: `Ordem ${o.numero} liberada: a nota entrou na fila de emissão.` };
    }
    return rep.code(409).send({ erro: 'Esta ordem já foi liberada.' });
  });

  app.get('/deal/fechamento', { preHandler: exige(DEAL_CH.contratos, DEAL_CH.fin) }, async () => {
    const c = await dealCtx();
    const hoje = c.agora;
    const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const mes = mesDe(hoje);
    const aulas = agAulasEntre(c.b, ini, hoje).filter((x) => x.quando <= hoje);
    return {
      competencia: mesRot(mes),
      itens: c.contratos
        .filter((ct) => ct.status === 'Ativo' && ct.preset !== 'B2B_TURMA_DEDICADA')
        .map((ct) => {
          const al = ct.benef.map((id) => c.b.alunos.find((a) => a.id === id)).filter((a) => !!a);
          const nomes = al.map((a) => a.name);
          const dele = aulas.filter((x) => x.alunos.some((n) => nomes.includes(n)));
          let pres = 0;
          let falt = 0;
          for (const x of dele)
            for (const n of x.alunos.filter((y) => nomes.includes(y))) {
              const p = fxPresenca(c.b, n, x);
              if (p === 'presente') pres++;
              else if (p === 'falta') falt++;
            }
          const ps = c.pedidos.filter((p) => p.contratoId === ct.id);
          const ls = ps.flatMap(c.linhas).filter((x) => mesDe(x.venc) === mes);
          const comNf = c.nfs.filter((n) => ps.some((p) => p.id === n.pedidoId) && n.competencia === mes).length;
          return {
            id: ct.id,
            nome: ct.nome,
            vigentes: `${al.filter((a) => alSit(a) === 'Ativo').length} de ${al.length}`,
            aulas: dele.length,
            presencas: pres,
            faltas: falt,
            linhas: ls.length,
            aFaturar: R(ls.reduce((s, x) => s + x.valor, 0)),
            comNota: comNf,
            etapa: (comNf >= ls.length && ls.length
              ? ['fechado', 'green']
              : ls.length
                ? ['em decisão', 'amber']
                : ['sem linha', 'gray']) as [string, string],
          };
        }),
    };
  });

  app.get('/deal/contas', { preHandler: exige(DEAL_CH.contratos, DEAL_CH.fin) }, async () => {
    const c = await dealCtx();
    const mes = mesDe(c.agora);
    const empresas = await prisma.empresa.findMany({ orderBy: { nome: 'asc' } });
    const linhas = empresas.map((e) => {
      const cts = c.contratos.filter(
        (x) =>
          (x.empresaId === e.id || x.empresa === e.nome) && x.status === 'Ativo' && x.preset !== 'B2B_TURMA_DEDICADA',
      );
      const membros = c.b.alunos.filter((a) => a.empresa === e.nome);
      const ps = c.pedidos.filter((p) => cts.some((x) => x.id === p.contratoId));
      const ls = ps.flatMap(c.linhas);
      return {
        empresaId: e.id,
        nome: e.nome,
        cnpj: cnpjFmt(e.cnpj),
        classe: cts.length ? 'Contrato' : 'Sem contrato',
        kam: cts[0]?.kam ?? '—',
        contratos: cts.length,
        membros: membros.length,
        matriculas: membros.reduce((s, a) => s + alMat(a).length, 0),
        aFaturar: R(ls.filter((x) => mesDe(x.venc) === mes).reduce((s, x) => s + x.valor, 0)),
        vencido: R(ls.filter((x) => x.sit === 'vencida').reduce((s, x) => s + x.valor, 0)),
        temVencido: ls.some((x) => x.sit === 'vencida'),
      };
    });
    const turmas = c.contratos
      .filter((ct) => ct.preset === 'B2B_TURMA_DEDICADA')
      .map((ct) => ({
        empresaId: ct.empresaId,
        nome: ct.empresa,
        cnpj: cnpjFmt(ct.cnpj),
        classe: 'Turma dedicada',
        kam: ct.kam,
        contratos: 1,
        membros: 0,
        matriculas: ct.turmas.length,
        aFaturar: R(
          c.ordens.filter((o) => o.contratoId === ct.id && o.competencia === mes).reduce((s, o) => s + N(o.total), 0),
        ),
        vencido: R(c.ctPos(ct.id).vencido),
        temVencido: c.ctPos(ct.id).vencido > 0,
      }));
    return { itens: [...linhas, ...turmas] };
  });

  app.get('/deal/notas', { preHandler: exige(DEAL_CH.fin) }, async (req) => {
    const c = await dealCtx();
    const ls = [
      ...c.fila.map(filaLinha),
      ...c.nfs
        .slice()
        .sort((a, b) => +b.emitida - +a.emitida)
        .map((n) => notaLinha(c, n)),
    ];
    return {
      podeOperar: podeOperar(req.usuario!),
      fila: c.fila.length,
      stats: [
        { v: String(c.nfs.length), l: 'autorizadas' },
        { v: String(c.fila.length), l: 'na fila', tom: c.fila.length ? 'red' : undefined },
        { v: R(c.nfs.reduce((s, n) => s + N(n.total), 0)), l: 'emitido' },
      ],
      competencias: [...new Set(ls.map((n) => n.competencia))],
      itens: ls,
    };
  });
  app.post('/deal/notas/emitir', { preHandler: [exige(DEAL_CH.fin), operar] }, async (req) => {
    const u = req.usuario!;
    const c = await dealCtx();
    let n = Math.max(4200, ...c.nfs.map((x) => Number(x.numero) || 0));
    const agora = new Date();
    await prisma.notaFiscal.createMany({
      data: c.fila.map((f) => ({
        numero: String(++n),
        total: f.total,
        competencia: f.competencia,
        emitida: agora,
        pagador: f.pagador,
        alunoId: f.alunoId,
        pedidoId: f.pedidoId,
        ordemId: f.ordemId,
        parcela: f.parcela,
        chave: f.chave,
        escopo: f.ordemId ? 'Empresa' : 'Aluno',
      })),
      skipDuplicates: true,
    });
    await log(u, 'notas', 'Notas fiscais', 'Notas emitidas', `${c.fila.length} da fila`);
    return { msg: `${c.fila.length} ${c.fila.length === 1 ? 'nota emitida' : 'notas emitidas'}.` };
  });

  app.get('/deal/cobrancas', { preHandler: exige(DEAL_CH.fin) }, async () => {
    const c = await dealCtx();
    const limite = new Date(+c.agora + 35 * 864e5);
    const ls = c.pedidos
      .filter((p) => p.alunoId && !p.cancelado)
      .flatMap((p) => c.linhas(p).map((x) => ({ p, x })))
      .filter(({ x }) => x.venc <= limite)
      .sort((a, b) => +b.x.venc - +a.x.venc);
    const soma = (s: string) => R(ls.filter(({ x }) => x.sit === s).reduce((t, { x }) => t + x.valor, 0));
    return {
      stats: [
        { v: soma('paga'), l: 'pagas', tom: 'green' },
        { v: soma('vencida'), l: 'vencidas', tom: 'red' },
        { v: soma('aVencer'), l: 'agendadas (35 dias)' },
      ],
      itens: ls.map(({ p, x }) => ({
        cobranca: `V${100000 + (dlH(x.key) % 900000)}`,
        pagador: x.pagador,
        alunoId: p.alunoId,
        pedidoId: p.id,
        parcela: x.parcela,
        curso: x.curso,
        meio: forma(p.forma).modo,
        venc: fmt.data(x.venc),
        pago: x.pago ? fmt.data(x.pago) : null,
        valor: R(x.valor),
        sit: x.sit,
        situacao: (x.sit === 'aVencer' ? ['Agendada', 'gray'] : SIT_LINHA[x.sit]) as [string, string],
      })),
    };
  });

  app.get('/deal/posicao', { preHandler: exige(DEAL_CH.fin) }, async (req) => {
    const eixo = String((req.query as { eixo?: string }).eixo ?? 'curso');
    const c = await dealCtx();
    const chave = (x: Linha) =>
      eixo === 'tipo' ? (x.tipo === 'turma' ? 'Empresa (turma)' : 'Aluno') : eixo === 'mes' ? mesDe(x.venc) : x.curso;
    const g = new Map<string, { k: string; n: number; pago: number; vencido: number; aVencer: number }>();
    for (const x of c.cobs) {
      const k = chave(x);
      const o = g.get(k) ?? { k, n: 0, pago: 0, vencido: 0, aVencer: 0 };
      o.n++;
      if (x.sit === 'paga') o.pago += x.valor;
      else if (x.sit === 'vencida') o.vencido += x.valor;
      else o.aVencer += x.valor;
      g.set(k, o);
    }
    const ls = [...g.values()].sort((a, b) =>
      eixo === 'mes' ? a.k.localeCompare(b.k) : b.pago + b.vencido + b.aVencer - (a.pago + a.vencido + a.aVencer),
    );
    const T = (k: 'pago' | 'vencido' | 'aVencer') => ls.reduce((s, x) => s + x[k], 0);
    return {
      stats: [
        { v: R(T('pago')), l: 'pago', tom: 'green' },
        { v: R(T('vencido')), l: 'vencido', tom: 'red' },
        { v: R(T('aVencer')), l: 'a vencer' },
        { v: String(c.cobs.length), l: 'parcelas' },
      ],
      itens: ls.map((x) => ({
        k: eixo === 'mes' ? mesRot(x.k) : x.k,
        n: x.n,
        pago: R(x.pago),
        vencido: R(x.vencido),
        aVencer: R(x.aVencer),
        inad: finPct(x.vencido, x.pago + x.vencido),
      })),
    };
  });

  app.get('/deal/liquidacao', { preHandler: exige(DEAL_CH.fin) }, async (req) => {
    const c = await dealCtx();
    const novas = c.pedidos.filter((p) => p.chave.startsWith('novo|') && !p.cancelado).flatMap(c.linhas);
    const ls = [...c.cobs, ...novas].filter((x) => x.sit === 'vencida').sort((a, b) => b.atraso - a.atraso);
    return {
      podeOperar: podeOperar(req.usuario!),
      stats: [
        { v: String(ls.length), l: 'parcelas aguardando baixa' },
        { v: R(ls.reduce((s, x) => s + x.valor, 0)), l: 'em aberto', tom: 'red' },
        { v: String(ls.filter((x) => x.atraso > 30).length), l: 'com mais de 30 dias' },
      ],
      itens: ls.map((x) => ({
        key: x.key,
        pagador: x.pagador,
        alunoId: x.tipo === 'aluno' ? x.alunoId : null,
        curso: x.curso,
        parcela: x.parcela,
        venc: fmt.data(x.venc),
        atraso: x.atraso,
        valor: R(x.valor),
      })),
    };
  });

  app.get('/deal/conciliacao', { preHandler: exige(DEAL_CH.fin) }, async () => {
    const c = await dealCtx();
    const ls = c.cobs
      .filter((x) => x.pago && x.tipo === 'aluno' && (+c.agora - +x.pago) / 864e5 <= 60)
      .sort((a, b) => +b.pago! - +a.pago!)
      .map((x) => {
        const d = (+c.agora - +x.pago!) / 864e5;
        const rec = d >= 2 ? new Date(+x.pago! + 2 * 864e5) : null;
        const dif = rec && dlH(x.key) % 17 === 0 ? -3.49 : 0;
        return { x, rec, dif, est: !rec ? 'a receber' : dif ? 'diferença' : 'conciliada' };
      });
    const n = (e: string) => ls.filter((x) => x.est === e).length;
    return {
      stats: [
        { v: String(n('conciliada')), l: 'conciliadas', tom: 'green' },
        { v: String(n('a receber')), l: 'a receber' },
        { v: String(n('diferença')), l: 'com diferença', tom: n('diferença') ? 'red' : undefined },
      ],
      itens: ls.map(({ x, rec, dif, est }) => ({
        pagador: x.pagador,
        parcela: `${x.parcela} · ${x.curso}`,
        pago: fmt.data(x.pago!),
        gateway: 'Vindi',
        valor: R(x.valor),
        recebido: rec ? fmt.data(rec) : null,
        diferenca: dif ? R(dif) : null,
        estado: [est, est === 'conciliada' ? 'green' : est === 'diferença' ? 'red' : 'gray'] as [string, string],
      })),
    };
  });

  app.get('/deal/conferencia', { preHandler: exige(DEAL_CH.fin) }, async () => {
    const c = await dealCtx();
    const meses: string[] = [];
    for (let k = 3; k >= 0; k--) meses.push(mesDe(new Date(c.agora.getFullYear(), c.agora.getMonth() - k, 1)));
    const prs = DEAL_PRESETS.filter((p) => c.pedidos.some((q) => q.preset === p.code));
    return {
      meses: meses.map(mesRot),
      itens: prs.map((p) => ({
        preset: p.code,
        desc: p.desc,
        celulas: meses.map((m) => {
          const pagas = c.pedidos
            .filter((q) => q.preset === p.code)
            .flatMap(c.linhas)
            .filter((x) => mesDe(x.venc) === m && x.pago);
          const fato = c.nfs.filter(
            (n) => n.competencia === m && c.pedidos.find((q) => q.id === n.pedidoId)?.preset === p.code,
          );
          return { fato: fato.length, cron: pagas.length, sem: Math.max(0, pagas.length - fato.length) };
        }),
      })),
    };
  });

  /* ================= PRODUTOS E SERVIÇOS › OFERTAS ================= */
  app.get('/deal/ofertas', { preHandler: exige(DEAL_CH.cat, DEAL_CH.vendas) }, async (req) => {
    const c = await dealCtx();
    const pend = (o: DealCtx['ofertas'][number]) =>
      !o.planoVindi && o.faturamento === 'Gateway' ? ['sem plano na Vindi'] : [];
    return {
      podeCriar: podeOperar(req.usuario!) && podeChave(req.usuario!, DEAL_CH.cat),
      cursos: c.b.cursos.filter((x) => x.active !== false).map((x) => x.name),
      stats: [
        { v: String(c.ofertas.filter((o) => o.ativa).length), l: 'ativas' },
        {
          v: String(c.ofertas.filter((o) => pend(o).length).length),
          l: 'com pendência',
          tom: c.ofertas.some((o) => pend(o).length) ? 'red' : undefined,
        },
        { v: String(c.ofertas.filter((o) => o.recorrente).length), l: 'recorrentes' },
      ],
      itens: c.ofertas.map((o) => ({
        id: o.id,
        codigo: o.codigo,
        mercado: o.mercado,
        nome: o.nome,
        curso: o.curso,
        itens: (o.itens as { tipologia: string; produto: string }[])
          .map((i) => `${i.tipologia} · ${i.produto}`)
          .join(' + '),
        preco: R(N(o.preco)),
        forma: forma(o.forma).nome,
        parcelas: `até ${o.parcelasMax}x${o.planoVindi ? ` · plano ${o.planoVindi}` : ''}`,
        pedidos: c.pedidos.filter((p) => p.ofertaId === o.id).length,
        pendencias: pend(o),
        ativa: o.ativa,
      })),
    };
  });
  /* Produtos e serviços › Ofertas › Nova oferta (24/09/2026): curso, horas ofertadas, valor e vigência em meses */
  app.post('/deal/ofertas', { preHandler: [exige(DEAL_CH.cat), operar] }, async (req, rep) => {
    const u = req.usuario!;
    const r = z
      .object({
        curso: z.string().min(1, 'Escolha o curso.'),
        horas: z.number().int().min(1, 'Informe as horas ofertadas.').max(2000),
        valor: z.number().positive('Informe o valor.').max(10_000_000),
        meses: z.number().int().min(1, 'Informe a vigência em meses.').max(60),
        mercado: z.enum(['B2C', 'B2B2C', 'B2B']).default('B2C'),
      })
      .safeParse(req.body);
    if (!r.success) return erro400(rep, r.error);
    const v = r.data;
    const c = await prisma.curso.findFirst({ where: { nome: v.curso } });
    if (!c) return rep.code(400).send({ erro: 'Curso não encontrado.' });
    await dealCtx();
    const base0 =
      `${c.nome.replace(/[^A-Za-z]/g, '').slice(0, 4)}-${v.horas}H${v.mercado === 'B2B2C' ? '-EMP' : v.mercado === 'B2B' ? '-B2B' : ''}`.toUpperCase();
    let codigo = base0;
    for (let i = 2; await prisma.ofertaPadrao.findUnique({ where: { codigo } }); i++) codigo = `${base0}-${i}`;
    const turma = c.estrutura === 'turmas';
    const o = await prisma.ofertaPadrao.create({
      data: {
        codigo,
        nome: `${turma ? 'Contrato de turma' : 'Pacote de aulas'} ${c.nome} · ${v.horas} horas (em até ${v.meses} ${v.meses === 1 ? 'mês' : 'meses'})`,
        curso: c.nome,
        aulas: v.horas,
        meses: v.meses,
        preco: v.valor,
        parcelasMax: Math.min(12, v.meses),
        recorrente: false,
        forma: v.mercado === 'B2B' ? 4 : 1,
        faturamento: v.mercado === 'B2B' ? 'Faturado contra NF' : 'Gateway',
        mercado: v.mercado,
        nicho: v.mercado === 'B2C' ? 'Pessoa física' : v.mercado === 'B2B2C' ? 'Benefício corporativo' : 'Empresas',
        itens: [{ tipologia: 'Serviço', produto: 'Aulas ao vivo', curso: c.nome }],
      },
    });
    await log(u, `oferta-${o.id}`, o.nome, 'Oferta criada', `${o.codigo} · ${R(v.valor)}`);
    return { id: o.id, msg: `Oferta ${o.codigo} criada.` };
  });

  app.get('/deal/presets', { preHandler: exige(DEAL_CH.cat, DEAL_CH.vendas) }, async () => {
    const c = await dealCtx();
    return {
      itens: DEAL_PRESETS.map((p) => ({
        code: p.code,
        desc: p.desc,
        nivel: p.nivel,
        regime: p.regime,
        forma: p.forma,
        faturamento: p.fat ? 'contra nota' : p.pag ? 'gateway' : 'sem cobrança',
        acordos:
          c.pedidos.filter((q) => q.preset === p.code).length + c.contratos.filter((x) => x.preset === p.code).length,
      })),
    };
  });
}
