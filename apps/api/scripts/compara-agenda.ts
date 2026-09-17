/**
 * Confere a agenda da API contra o portal original: todas as aulas do mês (estado, professor, substituto, alunos, sala),
 * a régua de horas, os eventos da semana e o filtro de qualidade do Kanban.
 * 1) node tools/extrai-portal/sonda.cjs tools/extrai-portal/agenda.expr.js tools/extrai-portal/agenda.json
 * 2) pnpm tsx --env-file=.env scripts/compara-agenda.ts ../../tools/extrai-portal/agenda.json
 */
import { readFileSync } from 'node:fs';
import { prisma } from '../src/db.ts';
import { agAulasEntre, agInicioSemana } from '../src/domain/agenda.ts';
import { AG_QUAL, agRegua } from '../src/domain/agenda-vista.ts';
import { base } from '../src/domain/base.ts';
import { agEvEntre, evHora } from '../src/domain/eventos.ts';
/* o seed tem e-mails fictícios: o lado do portal passa pela mesma troca antes de comparar */
import { anonimizaEmails } from './anonimiza.ts';

const p = JSON.parse(anonimizaEmails(readFileSync(process.argv[2], 'utf8')));
const agora = new Date(p.agora);
const b = await base();
const r = new Date(agora);
r.setHours(0, 0, 0, 0);
const ini = new Date(r.getFullYear(), r.getMonth(), 1);
const fim = new Date(r.getFullYear(), r.getMonth() + 1, 0);
const mes = agAulasEntre(b, ini, fim, agora).map((a) =>
  [a.k, a.estado, a.prof, a.sub || '', a.n, a.vagas, a.sala].join('~'),
);
const s0 = agInicioSemana(r);
const s6 = new Date(s0);
s6.setDate(s0.getDate() + 6);
const evs = (await agEvEntre(s0, s6, {})).map((e) =>
  [e.id, e.titulo, e.ini.getDay(), evHora(e.ini), evHora(e.fim)].join('~'),
);
const qual = AG_QUAL.map((q) => [q[0], agAulasEntre(b, s0, s6, agora).filter((a) => q[2](b, a)).length]);
let erros = 0;
const confere = (nome: string, a: unknown, bb: unknown) => {
  const ok = JSON.stringify(a) === JSON.stringify(bb);
  if (!ok) erros++;
  console.log(`${ok ? 'ok  ' : 'DIF '} ${nome}`);
  if (!ok) console.log('  portal:', JSON.stringify(bb).slice(0, 600), '\n  api:   ', JSON.stringify(a).slice(0, 600));
};
confere(`aulas do mês (${p.mes.length})`, mes, p.mes);
confere('régua de horas', agRegua(b), p.regua);
confere('eventos da semana', evs, p.semanaEventos);
confere('filtro de qualidade na semana', qual, p.qual);
console.log(erros ? `${erros} diferença(s)` : 'agenda igual ao portal');
await prisma.$disconnect();
process.exitCode = erros ? 1 : 0;
