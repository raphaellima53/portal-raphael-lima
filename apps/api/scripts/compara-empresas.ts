/**
 * Confere Empresas da API contra o portal original: gerentes, ordem da lista, números, alertas, alunos e turmas de cada conta.
 * 1) node tools/extrai-portal/sonda.cjs tools/extrai-portal/empresas.expr.js tools/extrai-portal/empresas.json
 * 2) pnpm tsx --env-file=.env scripts/compara-empresas.ts ../../tools/extrai-portal/empresas.json
 */
import { readFileSync } from 'node:fs';
import { prisma } from '../src/db.ts';
import { agOfertas, alMat, alSit } from '../src/domain/agenda.ts';
import { base } from '../src/domain/base.ts';
import {
  aulas30,
  empAlertas,
  empCobranca,
  empDados,
  empDias,
  empPaga,
  empSit,
  presencaDe,
} from '../src/domain/empresas.ts';
import { carregaEmpresas, gerentes } from '../src/routes/empresas.ts';
/* o seed tem e-mails fictícios: o lado do portal passa pela mesma troca antes de comparar */
import { anonimizaEmails } from './anonimiza.ts';

type PE = {
  id: string;
  nome: string;
  sit: string;
  dias: number;
  cobranca: string;
  dados: unknown[];
  alertas: string[];
  alunos: string[][];
  turmas: string[][];
};
const p = JSON.parse(anonimizaEmails(readFileSync(process.argv[2], 'utf8'))) as {
  gerentes: string[];
  ordem: string[];
  semEmpresa: string[];
  empresas: PE[];
};
const b = await base();
const ofs = agOfertas(b);
const ps = aulas30(b, ofs);
let erros = 0;
let oks = 0;
const confere = (nome: string, api: unknown, portal: unknown) => {
  if (JSON.stringify(api) === JSON.stringify(portal)) return oks++;
  erros++;
  console.log(
    `DIF  ${nome}\n  portal: ${JSON.stringify(portal).slice(0, 700)}\n  api:    ${JSON.stringify(api).slice(0, 700)}`,
  );
};

const emps = await carregaEmpresas();
confere('gerentes', await gerentes(), p.gerentes);
confere(
  'ordem da lista',
  [...emps].sort((x, y) => empDias(x) - empDias(y)).map((e) => e.nome),
  p.ordem,
);
confere(
  'alunos sem empresa',
  b.alunos
    .filter((a) => !a.empresa && alSit(a) !== 'Inativo')
    .sort((x, y) => x.name.localeCompare(y.name))
    .map((a) => a.name),
  p.semEmpresa,
);
for (const pe of p.empresas) {
  const e = emps.find((x) => x.id === pe.id)!;
  const d = empDados(b, e, ps);
  const t = `${e.nome} ·`;
  confere(`${t} situação e dias`, [empSit(e)[0], empDias(e)], [pe.sit, pe.dias]);
  confere(`${t} cobrança`, empCobranca(e), pe.cobranca);
  confere(
    `${t} números`,
    [
      d.turma,
      d.ativos,
      d.licUsadas,
      d.licContr,
      d.consumo,
      d.contratadas,
      d.presenca,
      d.receitaEmpresa,
      d.receitaAluno,
      d.inad,
    ],
    pe.dados,
  );
  confere(
    `${t} alertas`,
    empAlertas(e, d).map(([x, c]) => `${x}|b-${c}`),
    pe.alertas,
  );
  confere(
    `${t} alunos`,
    d.alunos.map((a) => {
      const ms = alMat(a);
      return [
        a.name,
        ms.map((m) => m.curso).join(', ') || '—',
        `${ms.reduce((s, m) => s + m.usadas, 0)}/${ms.reduce((s, m) => s + m.total, 0)}`,
        presencaDe(b, a.name, ps),
        empPaga(e),
        alSit(a),
      ];
    }),
    pe.alunos,
  );
  const crs = e.turmaCurso ? b.cursos.find((c) => c.name === e.turmaCurso) : undefined;
  confere(
    `${t} turmas`,
    crs
      ? crs.turmas.map((x) => [
          x.name,
          x.grupo || '—',
          x.professor || '—',
          x.grade || '—',
          x.modalidade || '—',
          `${x.ocupadas || 0}/${x.vagas || 0}`,
        ])
      : [],
    pe.turmas,
  );
}
console.log(`${oks} conferências ok, ${erros} diferenças`);
console.log(erros ? 'HÁ DIFERENÇAS' : 'empresas iguais ao portal');
await prisma.$disconnect();
process.exit(erros ? 1 : 0);
