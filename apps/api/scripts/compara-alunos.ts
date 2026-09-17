/**
 * Confere Alunos da API contra o portal original: a linha da lista e o que a ficha de cada aluno lê.
 * 1) node tools/extrai-portal/sonda.cjs tools/extrai-portal/alunos.expr.js tools/extrai-portal/alunos.json
 * 2) pnpm tsx --env-file=.env scripts/compara-alunos.ts ../../tools/extrai-portal/alunos.json
 */
import { readFileSync } from 'node:fs';
import { prisma } from '../src/db.ts';
import {
  agDiasTxt,
  agFaixa,
  agHabilitado,
  agIndividual,
  agOfertas,
  alDisp,
  alMat,
  alSit,
  crsItens,
  dispConflitos,
  fxPresenca,
} from '../src/domain/agenda.ts';
import {
  alLog,
  alMatriculas,
  alOfertas,
  alocAvalia,
  alQualidade,
  alSaldo,
  alTemMod,
  fbGera,
  fichaTopo,
  fxPassadas,
  fxProximas,
} from '../src/domain/alunos.ts';
import { base } from '../src/domain/base.ts';
/* o seed tem e-mails fictícios: o lado do portal passa pela mesma troca antes de comparar */
import { anonimizaEmails } from './anonimiza.ts';

type PA = {
  id: number;
  nome: string;
  linha: unknown[];
  sub: string;
  resumo: unknown[];
  matriculas: unknown[];
  encerradas: unknown[];
  alocacoes: unknown[];
  disp: { horas: string[]; conflitos: string[] };
  proximas: string[];
  passadas: string[];
  qualidade: unknown[];
  feedbacks: unknown[];
  logBase: unknown[];
  persona: boolean;
};
const p = JSON.parse(anonimizaEmails(readFileSync(process.argv[2], 'utf8'))) as { ordem: number[]; alunos: PA[] };
const b = await base();
const ofs = agOfertas(b);
const agora = new Date();
let erros = 0;
let oks = 0;
const confere = (nome: string, api: unknown, portal: unknown) => {
  const ok = JSON.stringify(api) === JSON.stringify(portal);
  if (!ok) {
    erros++;
    console.log(`DIF  ${nome}`);
    console.log('  portal:', JSON.stringify(portal).slice(0, 900), '\n  api:   ', JSON.stringify(api).slice(0, 900));
  } else oks++;
};

const ordem = await prisma.aluno.findMany({ orderBy: { ordem: 'asc' }, select: { id: true } });
confere(
  'ordem da lista',
  ordem.map((x) => x.id),
  p.ordem,
);
const personas = new Set(
  (
    await prisma.usuario.findMany({
      where: { personaLetra: { not: null }, alunoId: { not: null } },
      select: { alunoId: true },
    })
  ).map((u) => u.alunoId),
);
const hoje = new Date(agora);
hoje.setHours(0, 0, 0, 0);

for (const pa of p.alunos) {
  const a = b.alunos.find((x) => x.id === pa.id)!;
  const ms = alMat(a);
  const t = `${a.name} ·`;
  confere(
    `${t} linha`,
    [
      a.name,
      ms.map((e) => e.curso),
      ms.map((e) => (alTemMod(b, e) ? e.modulo : '—')),
      ms.map((e) => e.modalidade || 'Online'),
      ms.map((e) => `${e.usadas}/${e.total}`),
      ms.length ? alSaldo(a) : '—',
      alSit(a),
    ],
    pa.linha,
  );
  const topo = fichaTopo(b, a, ofs, 60, agora);
  confere(`${t} subtítulo`, topo.sub, pa.sub);
  confere(
    `${t} resumo`,
    [topo.resumo.matriculas, topo.resumo.restantes, topo.resumo.porSemana, topo.resumo.presenca],
    pa.resumo,
  );
  const m = alMatriculas(b, a, ofs);
  confere(
    `${t} matrículas`,
    m.ativas.map((e) => [
      e.curso,
      e.item?.nome ?? null,
      e.horarios.map((h) => `${h.txt} · ${h.prof ?? 'sem professor'}`),
    ]),
    pa.matriculas,
  );
  confere(
    `${t} encerradas`,
    m.encerradas.map((e) => [e.curso, e.item?.nome ?? null]),
    pa.encerradas,
  );
  const meus = alOfertas(ofs, a);
  confere(
    `${t} alocação`,
    ms.map((e) => {
      const c = b.cursos.find((x) => x.name === e.curso);
      if (!c) return null;
      const mod = e.modulo;
      const o = ofs.find((x) => x.prod === c.name && x.mod === mod && x.alunos.includes(a.name));
      if (agIndividual(c, mod)) {
        const x = o ?? { prof: '—', dias: [], hora: 18 };
        return {
          ind: 1,
          profs: b.professores.filter((pr) => agHabilitado(pr, c.name, mod)).map((pr) => pr.name),
          prof: x.prof,
          dias: x.dias,
          hora: x.hora,
          av: alocAvalia(b, a, c.name, mod, x.prof, x.dias, x.hora, ofs),
        };
      }
      const eTurma = c.estrutura === 'turmas';
      return {
        ind: 0,
        horario: o ? `${agDiasTxt(o)} · ${agFaixa(o)}` : null,
        prof: o ? o.prof : null,
        sala: o ? o.sala : null,
        ocupacao: o ? `${o.ocupadas != null ? o.ocupadas : o.alunos.length} de ${o.vagas}` : null,
        av: o ? alocAvalia(b, a, c.name, mod, o.prof, o.dias, o.hora, ofs) : null,
        opc: crsItens(c)
          .filter((x) => x !== 'Private FLOW')
          .map((it) => {
            const y = ofs.find((z) => z.prod === c.name && z.mod === it && z.vagas !== 1);
            const tu = eTurma ? c.turmas.find((z) => z.name === it) : undefined;
            return [
              it,
              y ? `${agDiasTxt(y)} ${String(y.hora).padStart(2, '0')}:00` : null,
              tu ? `${tu.ocupadas}/${tu.vagas}` : null,
              !!(tu && tu.ocupadas >= tu.vagas && it !== mod),
            ];
          }),
      };
    }),
    pa.alocacoes,
  );
  const disp = alDisp(b, a, ofs).slice().sort();
  confere(
    `${t} disponibilidade`,
    {
      horas: disp,
      conflitos: dispConflitos(disp, meus).map(
        ({ o, d }) =>
          `${['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][d]} ${String(o.hora).padStart(2, '0')}:00 · ${o.prod}${o.mod ? ` · ${o.mod}` : ''}`,
      ),
    },
    pa.disp,
  );
  confere(
    `${t} próximas`,
    fxProximas(b, (x) => x.alunos.includes(a.name), 14, ofs, agora).map((x) => `${x.k} ${x.estado}`),
    pa.proximas,
  );
  confere(
    `${t} passadas`,
    fxPassadas(b, (x) => x.alunos.includes(a.name), 60, ofs, agora).map(
      (x) => `${x.k} ${x.estado} ${fxPresenca(b, a.name, x)}`,
    ),
    pa.passadas,
  );
  confere(
    `${t} qualidade`,
    alQualidade(b, a, 60, ofs, agora).map((q) => [q.k, q.n, q.nivel, q.d]),
    pa.qualidade,
  );
  confere(
    `${t} feedbacks`,
    fbGera(a, ofs, agora).map((f) => [
      Math.round((+hoje - +new Date(f.quando.getFullYear(), f.quando.getMonth(), f.quando.getDate())) / 864e5),
      f.quando.getHours(),
      f.quando.getMinutes(),
      f.tipo,
      f.area,
      f.curso,
      f.canal,
      f.texto,
      f.status,
    ]),
    pa.feedbacks,
  );
  confere(
    `${t} log da base`,
    alLog(a, [], agora).linhas.map((x) => [x.acao, x.detalhe, x.quem]),
    pa.logBase,
  );
  confere(`${t} persona`, personas.has(a.id), pa.persona);
}
console.log(`${oks} conferências ok, ${erros} diferenças`);
console.log(erros ? 'HÁ DIFERENÇAS' : 'alunos iguais ao portal');
await prisma.$disconnect();
process.exit(erros ? 1 : 0);
