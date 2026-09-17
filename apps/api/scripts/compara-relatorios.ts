/**
 * Confere Relatórios (os 6 por perspectiva, os seletores e o Dashboard financeiro) contra o portal recém-aberto.
 * 1) node tools/extrai-portal/sonda.cjs tools/extrai-portal/relatorios.expr.js tools/extrai-portal/relatorios.json
 * 2) pnpm tsx --env-file=.env scripts/compara-relatorios.ts ../../tools/extrai-portal/relatorios.json
 */
import { readFileSync } from 'node:fs';
import { prisma } from '../src/db.ts';
import { fecMeses } from '../src/domain/acoes.ts';
import { finMesDe } from '../src/domain/aulas.ts';
import { finCarteira, finCobrancas, finCompetencia } from '../src/domain/financeiro.ts';
import { type Pers, QR_QUAL, RP, relatorio, relLinhas, relQual } from '../src/domain/relatorios.ts';
import { recorte } from '../src/routes/relatorios.ts';
/* o seed tem e-mails fictícios: o lado do portal passa pela mesma troca antes de comparar */
import { anonimizaEmails } from './anonimiza.ts';

type Rp = { cols: string[]; linhas: Record<string, unknown>[]; resumo: [string, string][] };
const portal = JSON.parse(anonimizaEmails(readFileSync(process.argv[2], 'utf8'))) as {
  rp: Record<string, { base: Rp; quals: Record<string, number>; cursoItem60: Rp }>;
  seletores: Record<Pers, { linhas: Record<string, unknown>[]; quals: Record<string, number> }>;
  financeiro: {
    serie: unknown[];
    cursos: unknown[];
    profs: unknown[];
    anteriorParcial: number[];
    cob: Record<string, number>;
  };
};
let ok = 0;
let erros = 0;
const ordena = (o: Record<string, unknown>) =>
  Object.fromEntries(
    Object.keys(o)
      .filter((k) => k[0] !== '_' && k !== 'href')
      .sort()
      .map((k) => [k, o[k]]),
  );
const confere = (nome: string, p: unknown, a: unknown) => {
  const jp = JSON.stringify(p);
  const ja = JSON.stringify(a);
  if (jp === ja) ok++;
  else {
    erros++;
    console.log(`DIFERE ${nome}\n  portal: ${jp.slice(0, 1500)}\n  api:    ${ja.slice(0, 1500)}`);
  }
};
const le = (r: Awaited<ReturnType<typeof recorte>>, k: string) => {
  const rel = RP[k];
  return {
    cols: rel.cols(r).map((c) => c[1]),
    linhas: rel.linhas(r).map(ordena),
    resumo: relatorio(r, k, '').resumo.map((x) => [x.v, x.t]),
  };
};

const r30 = await recorte({ dias: 30, curso: '', grupo: 'curso' });
const r60 = await recorte({ dias: 60, curso: 'Community live classes', grupo: 'item' });
for (const k of Object.keys(RP)) {
  const p = portal.rp[k];
  const a = le(r30, k);
  confere(`${k} colunas`, p.base.cols, a.cols);
  confere(`${k} linhas`, p.base.linhas.map(ordena), a.linhas);
  confere(`${k} resumo`, p.base.resumo, a.resumo);
  const todas = RP[k].linhas(r30);
  for (const [q] of QR_QUAL[RP[k].pers])
    confere(`${k} qualidade ${q}`, p.quals[q], todas.filter((l) => l._q?.[q]).length);
  const b = le(r60, k);
  confere(`${k} 60 dias por item`, p.cursoItem60.linhas.map(ordena), b.linhas);
  confere(`${k} 60 dias resumo`, p.cursoItem60.resumo, b.resumo);
}
for (const pers of ['aluno', 'professor', 'curso'] as Pers[]) {
  const ls = relLinhas(r30.b, pers, r30.ofs);
  confere(`seletores ${pers}`, portal.seletores[pers].linhas.map(ordena), ls.map(ordena));
  const m = relQual(r30, pers);
  for (const [q] of QR_QUAL[pers])
    confere(
      `seletores ${pers} qualidade ${q}`,
      portal.seletores[pers].quals[q],
      ls.filter((l) => m[String(l.nome)]?.[q]).length,
    );
}

const b = r30.b;
const agora = new Date();
const meses = fecMeses(agora);
const c2 = (n: number) => Math.round(n * 100) / 100;
confere(
  'financeiro série',
  portal.financeiro.serie,
  meses
    .slice()
    .reverse()
    .map((m) => {
      const d = finCompetencia(b, m, '', agora);
      return [m, c2(d.receita), c2(d.custo), d.dadas, d.min, c2(d.perdida), d.parcial];
    }),
);
const d = finCompetencia(b, meses[0], '', agora);
confere(
  'financeiro por curso',
  portal.financeiro.cursos,
  d.cursos.map((c) => [c.curso, c.valor, c.dadas, c.alunosAula, c2(c.receita), c2(c.custo), c.canc]),
);
confere(
  'financeiro por professor',
  portal.financeiro.profs,
  d.profs.map((p) => [p.prof, p.dadas, c2(p.horas), p.valorHora, c2(p.custo)]),
);
const da = finCompetencia(b, meses[1], '', agora, agora.getDate());
confere('financeiro mês anterior no mesmo trecho', portal.financeiro.anteriorParcial, [c2(da.receita), c2(da.custo)]);
const pagas = new Map((await prisma.parcelaPaga.findMany()).map((p) => [p.chave, p.quando]));
const cobs = finCobrancas(b, pagas, agora);
const noMes = (x: Date) => finMesDe(x) === meses[0];
confere('financeiro cobranças', portal.financeiro.cob, {
  vencidas: cobs.filter((c) => c.sit === 'vencida').length,
  aVencer: cobs.filter((c) => !c.pago && noMes(c.venc) && c.sit === 'aVencer').length,
  pagas: cobs.filter((c) => c.pago && noMes(c.pago)).length,
  carteira: c2(finCarteira(b, cobs, '')),
});

console.log(`${ok} conferências iguais, ${erros} diferentes`);
await prisma.$disconnect();
process.exit(erros ? 1 : 0);
