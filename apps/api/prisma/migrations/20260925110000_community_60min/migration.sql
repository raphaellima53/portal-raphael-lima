-- 25/09/2026: todas as aulas do Community live classes (níveis, suporte e Community Flow) têm 60 minutos.
UPDATE "Curso" SET "regras" = jsonb_set("regras"::jsonb, '{duracao}', '60')
WHERE "nome" = 'Community live classes';

-- Aulas particulares do Community Flow já agendadas e ainda por vir passam a terminar 60 minutos depois do início.
UPDATE "AulaAvulsa" SET "fim" = "inicio" + INTERVAL '60 minutes'
WHERE "modulo" = 'Community Flow' AND "inicio" > now()
  AND "cursoId" IN (SELECT "id" FROM "Curso" WHERE "nome" = 'Community live classes');
