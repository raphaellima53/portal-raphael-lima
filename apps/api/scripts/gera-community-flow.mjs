// Gera a migração de 24/09/2026: renomeia o módulo "Private FLOW" para "Community Flow" (com matrículas, currículos,
// habilitação dos professores, personas, ajustes de aula e aulas avulsas) e carrega a grade de cada nível do
// Community live classes (planilha do usuário, 24/09/2026). Horários sem professor: o professor sai do cadastro de
// cada um (habilitação + disponibilidade). Uso: node scripts/gera-community-flow.mjs <pasta da migração>
import { mkdirSync, writeFileSync } from 'node:fs';

/* dias: S=segunda T=terça Q=quarta U=quinta X=sexta B=sábado */
const GRADE = {
  Confidence: { '08': 'TU', 11: 'SQXB', 12: 'TU', 13: 'TU', 17: 'SQX', 18: 'TU', 19: 'SQX', 20: 'TU' },
  'Essential 1': {
    '08': 'SQX',
    '09': 'SQX',
    10: 'B',
    11: 'TU',
    12: 'SQX',
    17: 'SQX',
    18: 'TU',
    19: 'SQX',
    20: 'STQUX',
  },
  'Essential 2': { '07': 'TU', '08': 'SQX', '09': 'TUB', 11: 'B', 12: 'SQX', 18: 'STQUX', 19: 'SQX', 20: 'TU' },
  'Essential 3': {
    '07': 'SQX',
    '08': 'STQUX',
    '09': 'B',
    11: 'SQX',
    12: 'STQUX',
    17: 'TU',
    18: 'SQX',
    19: 'STQUX',
    20: 'SQX',
  },
  'Essential 4': {
    '07': 'SQX',
    '08': 'TUB',
    '09': 'SQX',
    11: 'TU',
    12: 'STQUX',
    17: 'SQX',
    18: 'TU',
    19: 'SQX',
    20: 'STQUX',
  },
  'Rise 1': {
    '07': 'STQUX',
    '08': 'TU',
    '09': 'SQX',
    10: 'B',
    12: 'STQUX',
    13: 'SQX',
    17: 'TU',
    18: 'TU',
    19: 'SQX',
    20: 'STQUX',
  },
  'Rise 2': { '07': 'SQX', '08': 'STQUX', 10: 'B', 12: 'TU', 13: 'SQX', 17: 'STQUX', 18: 'SQX', 19: 'TU', 20: 'STQUX' },
  'Rise 3': { '07': 'SQX', 10: 'B', 11: 'TU', 12: 'SQX', 18: 'SQX', 19: 'TU', 20: 'STQUX' },
  'Apex 1': { '08': 'TU', '09': 'SQX', 10: 'B', 12: 'X', 18: 'SQX', 20: 'SQX' },
  'Apex 2': { '07': 'TU', '09': 'B', 12: 'SQX', 20: 'SQX' },
  'Apex 3': { '08': 'SQX', 11: 'SQXB', 19: 'TU' },
  'Community Flow': {
    '07': 'STQUX',
    '08': 'TUB',
    11: 'B',
    12: 'TUB',
    13: 'STQUX',
    14: 'TU',
    17: 'SQX',
    18: 'TUX',
    19: 'TUX',
    20: 'TQUX',
  },
};
const DIA = { S: 1, T: 2, Q: 3, U: 4, X: 5, B: 6 };
const CURSO = 'Community live classes';
const q = (s) => `'${s.replace(/'/g, "''")}'`;

const sql = [];
sql.push(
  '-- 24/09/2026: "Private FLOW" vira "Community Flow" (adesão com créditos de aula particular) e a grade de cada',
);
sql.push(
  '-- nível do Community live classes é carregada (sem professor fixo: o portal escolhe pelo cadastro do professor).',
);
sql.push('');
const velho = q('Private FLOW'),
  novo = q('Community Flow');
sql.push(
  `UPDATE "Modulo" SET "nome" = ${novo}, "vagas" = 1 WHERE "nome" = ${velho} AND "cursoId" IN (SELECT "id" FROM "Curso" WHERE "nome" = ${q(CURSO)});`,
);
sql.push(`UPDATE "Matricula" SET "modulo" = ${novo} WHERE "modulo" = ${velho};`);
sql.push(
  `UPDATE "Curriculo" SET "aplicado" = array_replace("aplicado", ${velho}, ${novo}), "nome" = replace("nome", ${velho}, ${novo}) WHERE ${velho} = ANY("aplicado") OR "nome" LIKE '%Private FLOW%';`,
);
sql.push(
  `UPDATE "Professor" SET "habilitacao" = replace("habilitacao"::text, '"Private FLOW"', '"Community Flow"')::jsonb WHERE "habilitacao"::text LIKE '%"Private FLOW"%';`,
);
sql.push(
  `UPDATE "Usuario" SET "personaModulos" = array_replace("personaModulos", ${velho}, ${novo}) WHERE ${velho} = ANY("personaModulos");`,
);
sql.push(
  `UPDATE "AulaAjuste" SET "chave" = replace("chave", '|Private FLOW|', '|Community Flow|') WHERE "chave" LIKE '%|Private FLOW|%';`,
);
sql.push(`UPDATE "AulaAvulsa" SET "modulo" = ${novo} WHERE "modulo" = ${velho};`);
sql.push('');
sql.push('-- grades por nível (substitui a grade que houver nesses módulos)');
const nomes = Object.keys(GRADE).map(q).join(', ');
sql.push(
  `DELETE FROM "ModuloHorario" WHERE "moduloId" IN (SELECT m."id" FROM "Modulo" m JOIN "Curso" c ON c."id" = m."cursoId" WHERE c."nome" = ${q(CURSO)} AND m."nome" IN (${nomes}));`,
);
let total = 0;
for (const [mod, horas] of Object.entries(GRADE)) {
  const linhas = [];
  for (const [h, dias] of Object.entries(horas))
    for (const d of dias) linhas.push(`(${DIA[d]}, '${String(h).padStart(2, '0')}:00')`);
  total += linhas.length;
  sql.push(`INSERT INTO "ModuloHorario" ("moduloId", "dia", "hora")`);
  sql.push(`SELECT m."id", g.dia, g.hora FROM "Modulo" m JOIN "Curso" c ON c."id" = m."cursoId"`);
  sql.push(`CROSS JOIN (VALUES ${linhas.join(', ')}) AS g(dia, hora)`);
  sql.push(`WHERE c."nome" = ${q(CURSO)} AND m."nome" = ${q(mod)};`);
}
const pasta = process.argv[2];
mkdirSync(pasta, { recursive: true });
writeFileSync(`${pasta}/migration.sql`, `${sql.join('\n')}\n`);
console.log(`migração gerada: ${Object.keys(GRADE).length} módulos, ${total} horários`);
