/**
 * Confere Professores da API contra o portal original: linha da lista e o que a ficha de cada professor lê.
 * 1) node tools/extrai-portal/sonda.cjs tools/extrai-portal/professores.expr.js tools/extrai-portal/professores.json
 * 2) pnpm tsx --env-file=.env scripts/compara-professores.ts ../../tools/extrai-portal/professores.json
 */
import { readFileSync } from 'node:fs';
import { prisma } from '../src/db.ts';
import { agHH, agOfertas, DN, dispConflitos, prDisp } from '../src/domain/agenda.ts';
import { fxPassadas, fxProximas } from '../src/domain/alunos.ts';
import { base } from '../src/domain/base.ts';
import {
  fbProf,
  fxDadas,
  permDe,
  prHistorico,
  prLogBase,
  prOfertas,
  prResumo,
  titularDe,
} from '../src/domain/professores.ts';
/* o seed tem e-mails fictícios: o lado do portal passa pela mesma troca antes de comparar */
import { anonimizaEmails } from './anonimiza.ts';

type PP = {
  id: string;
  linha: unknown[];
  resumo: unknown[];
  habilitacao: unknown[];
  disp: { horas: string[]; conflitos: string[] };
  proximas: string[];
  passadas: string[];
  histStats: number[];
  dadas: number;
  avaliacoes: unknown[];
  logBase: unknown[];
};
const p = JSON.parse(anonimizaEmails(readFileSync(process.argv[2], 'utf8'))) as { professores: PP[] };
const b = await base();
const ofs = agOfertas(b);
const agora = new Date();
let erros = 0;
let oks = 0;
const confere = (nome: string, api: unknown, portal: unknown) => {
  if (JSON.stringify(api) === JSON.stringify(portal)) return oks++;
  erros++;
  console.log(
    `DIF  ${nome}\n  portal: ${JSON.stringify(portal).slice(0, 800)}\n  api:    ${JSON.stringify(api).slice(0, 800)}`,
  );
};
confere(
  'ordem',
  b.professores.map((t) => t.id),
  p.professores.map((x) => x.id),
);
for (const pp of p.professores) {
  const t = b.professores.find((x) => x.id === pp.id)!;
  const n = `${t.name} ·`;
  const meus = prOfertas(ofs, t);
  const r = prResumo(b, t, ofs);
  confere(`${n} linha`, [t.name, t.email, t.cursos, r.aulas, t.teto, t.active], pp.linha);
  confere(`${n} resumo`, [r.horarios, r.aulas, r.alunos, r.fora], pp.resumo);
  confere(
    `${n} habilitação`,
    b.cursos.map((c) => [
      c.name,
      t.cursos.includes(c.name),
      permDe(t, c),
      titularDe(t, c),
      ofs.filter((o) => o.prod === c.name && o.prof === t.name).length,
    ]),
    pp.habilitacao,
  );
  const disp = prDisp(b, t, ofs).slice().sort();
  confere(
    `${n} disponibilidade`,
    {
      horas: disp,
      conflitos: dispConflitos(disp, meus).map(
        ({ o, d }) => `${DN[d]} ${agHH(o.hora)} · ${o.prod}${o.mod ? ` · ${o.mod}` : ''}`,
      ),
    },
    pp.disp,
  );
  confere(
    `${n} próximas`,
    fxProximas(b, (x) => x.prof === t.name, 14, ofs, agora).map((x) => `${x.k} ${x.estado} ${x.n}/${x.vagas}`),
    pp.proximas,
  );
  const todas = fxPassadas(b, (x) => x.prof === t.name || x.sub === t.name, 60, ofs, agora);
  confere(
    `${n} passadas`,
    todas.map(
      (x) =>
        `${x.k} ${x.estado} ${x.sub === t.name ? `substituído por ${x.prof}` : x.sub ? `deu no lugar de ${x.sub}` : ''}`,
    ),
    pp.passadas,
  );
  confere(
    `${n} números do histórico`,
    prHistorico(b, t, 60, ofs, agora).stats.map((s) => Number(s.valor)),
    pp.histStats,
  );
  confere(`${n} aulas dadas`, fxDadas(b, t.name, 60, ofs, agora).length, pp.dadas);
  confere(
    `${n} avaliações`,
    fbProf(b, t, 60, ofs, [], agora).map((x) => [x.quando.toISOString(), x.aluno, x.curso, x.aula, x.nota, x.texto]),
    pp.avaliacoes,
  );
  const lb = prLogBase(t);
  confere(`${n} log da base`, [[lb.acao, lb.detalhe, lb.quem]], pp.logBase);
}
console.log(`${oks} conferências ok, ${erros} diferenças`);
console.log(erros ? 'HÁ DIFERENÇAS' : 'professores iguais ao portal');
await prisma.$disconnect();
process.exit(erros ? 1 : 0);
