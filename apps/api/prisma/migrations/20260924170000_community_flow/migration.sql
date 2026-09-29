-- 24/09/2026: "Private FLOW" vira "Community Flow" (adesão com créditos de aula particular) e a grade de cada
-- nível do Community live classes é carregada (sem professor fixo: o portal escolhe pelo cadastro do professor).

UPDATE "Modulo" SET "nome" = 'Community Flow', "vagas" = 1 WHERE "nome" = 'Private FLOW' AND "cursoId" IN (SELECT "id" FROM "Curso" WHERE "nome" = 'Community live classes');
UPDATE "Matricula" SET "modulo" = 'Community Flow' WHERE "modulo" = 'Private FLOW';
UPDATE "Curriculo" SET "aplicado" = array_replace("aplicado", 'Private FLOW', 'Community Flow'), "nome" = replace("nome", 'Private FLOW', 'Community Flow') WHERE 'Private FLOW' = ANY("aplicado") OR "nome" LIKE '%Private FLOW%';
UPDATE "Professor" SET "habilitacao" = replace("habilitacao"::text, '"Private FLOW"', '"Community Flow"')::jsonb WHERE "habilitacao"::text LIKE '%"Private FLOW"%';
UPDATE "Usuario" SET "personaModulos" = array_replace("personaModulos", 'Private FLOW', 'Community Flow') WHERE 'Private FLOW' = ANY("personaModulos");
UPDATE "AulaAjuste" SET "chave" = replace("chave", '|Private FLOW|', '|Community Flow|') WHERE "chave" LIKE '%|Private FLOW|%';
UPDATE "AulaAvulsa" SET "modulo" = 'Community Flow' WHERE "modulo" = 'Private FLOW';

-- grades por nível (substitui a grade que houver nesses módulos)
DELETE FROM "ModuloHorario" WHERE "moduloId" IN (SELECT m."id" FROM "Modulo" m JOIN "Curso" c ON c."id" = m."cursoId" WHERE c."nome" = 'Community live classes' AND m."nome" IN ('Confidence', 'Essential 1', 'Essential 2', 'Essential 3', 'Essential 4', 'Rise 1', 'Rise 2', 'Rise 3', 'Apex 1', 'Apex 2', 'Apex 3', 'Community Flow'));
INSERT INTO "ModuloHorario" ("moduloId", "dia", "hora")
SELECT m."id", g.dia, g.hora FROM "Modulo" m JOIN "Curso" c ON c."id" = m."cursoId"
CROSS JOIN (VALUES (1, '11:00'), (3, '11:00'), (5, '11:00'), (6, '11:00'), (2, '12:00'), (4, '12:00'), (2, '13:00'), (4, '13:00'), (1, '17:00'), (3, '17:00'), (5, '17:00'), (2, '18:00'), (4, '18:00'), (1, '19:00'), (3, '19:00'), (5, '19:00'), (2, '20:00'), (4, '20:00'), (2, '08:00'), (4, '08:00')) AS g(dia, hora)
WHERE c."nome" = 'Community live classes' AND m."nome" = 'Confidence';
INSERT INTO "ModuloHorario" ("moduloId", "dia", "hora")
SELECT m."id", g.dia, g.hora FROM "Modulo" m JOIN "Curso" c ON c."id" = m."cursoId"
CROSS JOIN (VALUES (6, '10:00'), (2, '11:00'), (4, '11:00'), (1, '12:00'), (3, '12:00'), (5, '12:00'), (1, '17:00'), (3, '17:00'), (5, '17:00'), (2, '18:00'), (4, '18:00'), (1, '19:00'), (3, '19:00'), (5, '19:00'), (1, '20:00'), (2, '20:00'), (3, '20:00'), (4, '20:00'), (5, '20:00'), (1, '08:00'), (3, '08:00'), (5, '08:00'), (1, '09:00'), (3, '09:00'), (5, '09:00')) AS g(dia, hora)
WHERE c."nome" = 'Community live classes' AND m."nome" = 'Essential 1';
INSERT INTO "ModuloHorario" ("moduloId", "dia", "hora")
SELECT m."id", g.dia, g.hora FROM "Modulo" m JOIN "Curso" c ON c."id" = m."cursoId"
CROSS JOIN (VALUES (6, '11:00'), (1, '12:00'), (3, '12:00'), (5, '12:00'), (1, '18:00'), (2, '18:00'), (3, '18:00'), (4, '18:00'), (5, '18:00'), (1, '19:00'), (3, '19:00'), (5, '19:00'), (2, '20:00'), (4, '20:00'), (2, '07:00'), (4, '07:00'), (1, '08:00'), (3, '08:00'), (5, '08:00'), (2, '09:00'), (4, '09:00'), (6, '09:00')) AS g(dia, hora)
WHERE c."nome" = 'Community live classes' AND m."nome" = 'Essential 2';
INSERT INTO "ModuloHorario" ("moduloId", "dia", "hora")
SELECT m."id", g.dia, g.hora FROM "Modulo" m JOIN "Curso" c ON c."id" = m."cursoId"
CROSS JOIN (VALUES (1, '11:00'), (3, '11:00'), (5, '11:00'), (1, '12:00'), (2, '12:00'), (3, '12:00'), (4, '12:00'), (5, '12:00'), (2, '17:00'), (4, '17:00'), (1, '18:00'), (3, '18:00'), (5, '18:00'), (1, '19:00'), (2, '19:00'), (3, '19:00'), (4, '19:00'), (5, '19:00'), (1, '20:00'), (3, '20:00'), (5, '20:00'), (1, '07:00'), (3, '07:00'), (5, '07:00'), (1, '08:00'), (2, '08:00'), (3, '08:00'), (4, '08:00'), (5, '08:00'), (6, '09:00')) AS g(dia, hora)
WHERE c."nome" = 'Community live classes' AND m."nome" = 'Essential 3';
INSERT INTO "ModuloHorario" ("moduloId", "dia", "hora")
SELECT m."id", g.dia, g.hora FROM "Modulo" m JOIN "Curso" c ON c."id" = m."cursoId"
CROSS JOIN (VALUES (2, '11:00'), (4, '11:00'), (1, '12:00'), (2, '12:00'), (3, '12:00'), (4, '12:00'), (5, '12:00'), (1, '17:00'), (3, '17:00'), (5, '17:00'), (2, '18:00'), (4, '18:00'), (1, '19:00'), (3, '19:00'), (5, '19:00'), (1, '20:00'), (2, '20:00'), (3, '20:00'), (4, '20:00'), (5, '20:00'), (1, '07:00'), (3, '07:00'), (5, '07:00'), (2, '08:00'), (4, '08:00'), (6, '08:00'), (1, '09:00'), (3, '09:00'), (5, '09:00')) AS g(dia, hora)
WHERE c."nome" = 'Community live classes' AND m."nome" = 'Essential 4';
INSERT INTO "ModuloHorario" ("moduloId", "dia", "hora")
SELECT m."id", g.dia, g.hora FROM "Modulo" m JOIN "Curso" c ON c."id" = m."cursoId"
CROSS JOIN (VALUES (6, '10:00'), (1, '12:00'), (2, '12:00'), (3, '12:00'), (4, '12:00'), (5, '12:00'), (1, '13:00'), (3, '13:00'), (5, '13:00'), (2, '17:00'), (4, '17:00'), (2, '18:00'), (4, '18:00'), (1, '19:00'), (3, '19:00'), (5, '19:00'), (1, '20:00'), (2, '20:00'), (3, '20:00'), (4, '20:00'), (5, '20:00'), (1, '07:00'), (2, '07:00'), (3, '07:00'), (4, '07:00'), (5, '07:00'), (2, '08:00'), (4, '08:00'), (1, '09:00'), (3, '09:00'), (5, '09:00')) AS g(dia, hora)
WHERE c."nome" = 'Community live classes' AND m."nome" = 'Rise 1';
INSERT INTO "ModuloHorario" ("moduloId", "dia", "hora")
SELECT m."id", g.dia, g.hora FROM "Modulo" m JOIN "Curso" c ON c."id" = m."cursoId"
CROSS JOIN (VALUES (6, '10:00'), (2, '12:00'), (4, '12:00'), (1, '13:00'), (3, '13:00'), (5, '13:00'), (1, '17:00'), (2, '17:00'), (3, '17:00'), (4, '17:00'), (5, '17:00'), (1, '18:00'), (3, '18:00'), (5, '18:00'), (2, '19:00'), (4, '19:00'), (1, '20:00'), (2, '20:00'), (3, '20:00'), (4, '20:00'), (5, '20:00'), (1, '07:00'), (3, '07:00'), (5, '07:00'), (1, '08:00'), (2, '08:00'), (3, '08:00'), (4, '08:00'), (5, '08:00')) AS g(dia, hora)
WHERE c."nome" = 'Community live classes' AND m."nome" = 'Rise 2';
INSERT INTO "ModuloHorario" ("moduloId", "dia", "hora")
SELECT m."id", g.dia, g.hora FROM "Modulo" m JOIN "Curso" c ON c."id" = m."cursoId"
CROSS JOIN (VALUES (6, '10:00'), (2, '11:00'), (4, '11:00'), (1, '12:00'), (3, '12:00'), (5, '12:00'), (1, '18:00'), (3, '18:00'), (5, '18:00'), (2, '19:00'), (4, '19:00'), (1, '20:00'), (2, '20:00'), (3, '20:00'), (4, '20:00'), (5, '20:00'), (1, '07:00'), (3, '07:00'), (5, '07:00')) AS g(dia, hora)
WHERE c."nome" = 'Community live classes' AND m."nome" = 'Rise 3';
INSERT INTO "ModuloHorario" ("moduloId", "dia", "hora")
SELECT m."id", g.dia, g.hora FROM "Modulo" m JOIN "Curso" c ON c."id" = m."cursoId"
CROSS JOIN (VALUES (6, '10:00'), (5, '12:00'), (1, '18:00'), (3, '18:00'), (5, '18:00'), (1, '20:00'), (3, '20:00'), (5, '20:00'), (2, '08:00'), (4, '08:00'), (1, '09:00'), (3, '09:00'), (5, '09:00')) AS g(dia, hora)
WHERE c."nome" = 'Community live classes' AND m."nome" = 'Apex 1';
INSERT INTO "ModuloHorario" ("moduloId", "dia", "hora")
SELECT m."id", g.dia, g.hora FROM "Modulo" m JOIN "Curso" c ON c."id" = m."cursoId"
CROSS JOIN (VALUES (1, '12:00'), (3, '12:00'), (5, '12:00'), (1, '20:00'), (3, '20:00'), (5, '20:00'), (2, '07:00'), (4, '07:00'), (6, '09:00')) AS g(dia, hora)
WHERE c."nome" = 'Community live classes' AND m."nome" = 'Apex 2';
INSERT INTO "ModuloHorario" ("moduloId", "dia", "hora")
SELECT m."id", g.dia, g.hora FROM "Modulo" m JOIN "Curso" c ON c."id" = m."cursoId"
CROSS JOIN (VALUES (1, '11:00'), (3, '11:00'), (5, '11:00'), (6, '11:00'), (2, '19:00'), (4, '19:00'), (1, '08:00'), (3, '08:00'), (5, '08:00')) AS g(dia, hora)
WHERE c."nome" = 'Community live classes' AND m."nome" = 'Apex 3';
INSERT INTO "ModuloHorario" ("moduloId", "dia", "hora")
SELECT m."id", g.dia, g.hora FROM "Modulo" m JOIN "Curso" c ON c."id" = m."cursoId"
CROSS JOIN (VALUES (6, '11:00'), (2, '12:00'), (4, '12:00'), (6, '12:00'), (1, '13:00'), (2, '13:00'), (3, '13:00'), (4, '13:00'), (5, '13:00'), (2, '14:00'), (4, '14:00'), (1, '17:00'), (3, '17:00'), (5, '17:00'), (2, '18:00'), (4, '18:00'), (5, '18:00'), (2, '19:00'), (4, '19:00'), (5, '19:00'), (2, '20:00'), (3, '20:00'), (4, '20:00'), (5, '20:00'), (1, '07:00'), (2, '07:00'), (3, '07:00'), (4, '07:00'), (5, '07:00'), (2, '08:00'), (4, '08:00'), (6, '08:00')) AS g(dia, hora)
WHERE c."nome" = 'Community live classes' AND m."nome" = 'Community Flow';
