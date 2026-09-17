/**
 * Confere Cursos da API contra o portal original: catálogo, e as abas Visão geral, Regras, Currículo e Grade de cada curso.
 * 1) node tools/extrai-portal/sonda.cjs tools/extrai-portal/cursos.expr.js tools/extrai-portal/cursos.json
 * 2) pnpm tsx --env-file=.env scripts/compara-cursos.ts ../../tools/extrai-portal/cursos.json
 */
import { readFileSync } from 'node:fs';
import { prisma } from '../src/db.ts';
import { crsItens, crsRegras } from '../src/domain/agenda.ts';
import { base } from '../src/domain/base.ts';
import { catalogo, cursoCurriculo, cursoGeral, cursoGrade, finValorAula } from '../src/domain/cursos.ts';
/* o seed tem e-mails fictícios: o lado do portal passa pela mesma troca antes de comparar */
import { anonimizaEmails } from './anonimiza.ts';

type P = {
  catalogo: [string, number, number, number][];
  cursos: {
    nome: string;
    geral: { stats: string[]; linhas: string[] };
    curriculo: { stats: string[]; linhas: string[] };
    grade: { stats: string[]; linhas: string[] };
    regras: unknown[];
  }[];
};
const p = JSON.parse(anonimizaEmails(readFileSync(process.argv[2], 'utf8'))) as P;
const b = await base();
let erros = 0;
const confere = (nome: string, api: unknown, portal: unknown) => {
  const ok = JSON.stringify(api) === JSON.stringify(portal);
  if (!ok) erros++;
  console.log(`${ok ? 'ok  ' : 'DIF '} ${nome}`);
  if (!ok)
    console.log('  portal:', JSON.stringify(portal).slice(0, 700), '\n  api:   ', JSON.stringify(api).slice(0, 700));
};
const st = (s: { valor: string; rotulo: string }[]) => s.map((x) => `${x.valor} ${x.rotulo}`);
const semTraco = (s: string) => (s === '—' ? '' : s);

confere(
  'catálogo',
  catalogo(b).map((c) => [c.nome, c.itens.length, c.profs, c.alunos]),
  p.catalogo,
);
for (const pc of p.cursos) {
  const c = b.cursos.find((x) => x.name === pc.nome)!;
  const curs = await prisma.curriculo.findMany({ where: { grupo: c.name }, orderBy: { ordem: 'asc' } });
  const g = cursoGeral(b, c, curs);
  const roster = (l: { nome: string; usadas: number; total: number; modalidade: string; situacao: string }[]) =>
    l.map((a) => [a.nome, `${a.usadas}/${a.total}`, a.modalidade || 'Online', a.situacao, '•••'].join(' | '));
  let linhas: string[] = [];
  if (g.estrutura === 'modulos') {
    linhas = g.modulos
      .map((m) => [m.n, m.nome, m.alunos, m.presenciais, m.curriculo ? m.curriculoNome : '—'].join(' | '))
      .concat(roster(g.alunos));
  } else if (g.estrutura === 'turmas') {
    const t = g.turmas[0];
    linhas = g.turmas
      .map((x) =>
        [x.n, x.nome, x.grupo, x.professor, x.grade, x.sala, x.modalidade, `${x.ocupadas}/${x.vagas}`].join(' | '),
      )
      .concat(t.alunos.length ? roster(t.alunos) : ['nenhum aluno desta turma tem matrícula no portal ainda']);
  } else linhas = roster(g.alunos);
  confere(`${c.name} · Visão geral · números`, st(g.stats), pc.geral.stats);
  confere(`${c.name} · Visão geral · linhas`, linhas, pc.geral.linhas);
  const cu = cursoCurriculo(c, curs as never);
  confere(`${c.name} · Currículo · números`, st(cu.stats), pc.curriculo.stats);
  confere(
    `${c.name} · Currículo · linhas`,
    cu.lista.map((x) =>
      [
        x.nome,
        semTraco(x.aplicado),
        [x.publicada ? `${x.publicada} publicada` : '', x.rascunho ? `${x.rascunho} rascunho` : '']
          .filter(Boolean)
          .join(' '),
        x.conteudos,
        x.semLink || '—',
        x.publicadaEm ?? '—',
      ]
        .filter((v) => v !== '')
        .join(' | '),
    ),
    pc.curriculo.linhas,
  );
  const gr = cursoGrade(b, c);
  confere(`${c.name} · Grade · números`, st(gr.stats), pc.grade.stats);
  confere(
    `${c.name} · Grade · linhas`,
    gr.linhas.map((l) =>
      [l.item, l.quem, l.dias, l.horario, l.prof === '—' ? 'sem professor' : l.prof, l.sala, l.ocupacao].join(' | '),
    ),
    pc.grade.linhas,
  );
  const rg = crsRegras(c);
  confere(
    `${c.name} · Regras`,
    [
      rg.vagas,
      rg.duracao,
      rg.modalidades.join('/'),
      rg.pacote,
      rg.cancelamento,
      c.autoAgenda,
      !!rg.exigeDisp,
      finValorAula(c),
    ],
    pc.regras,
  );
  void crsItens;
}
console.log(erros ? `${erros} diferença(s)` : 'cursos iguais ao portal');
await prisma.$disconnect();
process.exitCode = erros ? 1 : 0;
