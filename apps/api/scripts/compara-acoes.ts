/**
 * Confere Ações da API contra o portal original: pendências de alocação, folha da competência anterior, cobranças,
 * carga inicial dos fluxos, leads e alertas.
 * 1) node tools/extrai-portal/sonda.cjs tools/extrai-portal/acoes.expr.js tools/extrai-portal/acoes.json
 * 2) pnpm tsx --env-file=.env scripts/compara-acoes.ts ../../tools/extrai-portal/acoes.json
 */
import { readFileSync } from 'node:fs';
import { prisma } from '../src/db.ts';
import { acAlocItens, fecMeses, folhaDados } from '../src/domain/acoes.ts';
import { agOfertas } from '../src/domain/agenda.ts';
import { alertasDe, extrasAlertas } from '../src/domain/alertas.ts';
import { base } from '../src/domain/base.ts';
import { finCobrancas } from '../src/domain/financeiro.ts';
import { type Ctx, FLUXOS } from '../src/domain/fluxos.ts';
/* o seed tem e-mails fictícios: o lado do portal passa pela mesma troca antes de comparar */
import { anonimizaEmails } from './anonimiza.ts';
import { usuarioDeTeste } from './usuario-teste.ts';

type P = {
  meses: string[];
  alocacao: unknown[];
  fechamento: { ym: string; parcial: boolean; naoFin: number; folha: unknown[]; tot: Record<string, number> };
  cobrancas: unknown[];
  fluxos: Record<string, unknown[]>;
  alertas: unknown[];
  leads: [string, string, string, string, string, string, string, number][];
  atendimentosAbertos: number;
};
const p = JSON.parse(anonimizaEmails(readFileSync(process.argv[2], 'utf8'))) as P;
const b = await base();
const agora = new Date();
let erros = 0;
let oks = 0;
const confere = (nome: string, api: unknown, portal: unknown) => {
  if (JSON.stringify(api) === JSON.stringify(portal)) return oks++;
  erros++;
  console.log(
    `DIF  ${nome}\n  portal: ${JSON.stringify(portal).slice(0, 900)}\n  api:    ${JSON.stringify(api).slice(0, 900)}`,
  );
};
const r2 = (n: number) => Math.round(n * 100) / 100;

confere('meses', fecMeses(agora), p.meses);
confere(
  'alocação',
  acAlocItens(b).map((x) => [x.tipo, x.curso, x.quem, x.oque, x.quando, x.det]),
  p.alocacao,
);
const d = folhaDados(b, fecMeses(agora)[1], agora);
confere(
  'fechamento',
  {
    ym: d.ym,
    parcial: d.parcial,
    naoFin: d.naoFin,
    folha: d.folha.map((x) => [
      x.nome,
      x.pagas,
      x.presenca,
      x.falta,
      x.descontadas,
      x.pendentes,
      x.min,
      r2(x.bruto),
      r2(x.desconto),
      r2(x.liquido),
    ]),
    tot: {
      pagas: d.tot.pagas,
      presenca: d.tot.presenca,
      falta: d.tot.falta,
      descontadas: d.tot.descontadas,
      pendentes: d.tot.pendentes,
      bruto: d.tot.bruto,
      desconto: d.tot.desconto,
      liquido: d.tot.liquido,
    },
  },
  p.fechamento,
);
const pagas = new Map<string, Date>();
confere(
  'cobranças',
  finCobrancas(b, pagas, agora).map((c) => [
    c.key,
    c.parcela,
    c.sit,
    c.atraso,
    r2(c.valor),
    c.pagador,
    c.curso,
    c.item,
  ]),
  p.cobrancas,
);
const ctx: Ctx = { b, agora, pagas, autor: 'teste', ajuste: async () => {} };
for (const [k, F] of Object.entries(FLUXOS)) {
  confere(
    `fluxo ${k}`,
    (F.seed?.(ctx) ?? []).map((c) => [c.etapa, F.titulo(ctx, c.v), F.sub(ctx, c.v)]),
    p.fluxos[k],
  );
}
const leads = await prisma.lead.findMany({ orderBy: { ordem: 'asc' } });
confere(
  'leads (sem o tempo)',
  leads.map((l) => [l.id, l.nome, l.etapa, l.curso, l.origem, l.consultor, l.motivo]),
  p.leads.map((l) => l.slice(0, 7)),
);
const ofs = agOfertas(b);
const admin = await usuarioDeTeste('admin@alumni.teste');
const al = alertasDe(b, admin, await extrasAlertas(b, ofs, agora), agora);
confere(
  'alertas do Admin',
  al.map((a) => [a.k, a.n, a.t, a.d]),
  p.alertas,
);
console.log(`${oks} conferências ok, ${erros} diferenças`);
console.log(erros ? 'HÁ DIFERENÇAS' : 'ações iguais ao portal');
await prisma.$disconnect();
process.exit(erros ? 1 : 0);
