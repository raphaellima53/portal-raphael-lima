-- 25/09/2026: regras de agendamento e cancelamento do Community live classes (em minutos, por módulo).
-- Níveis e demais módulos: agendar até 30 min antes e cancelar até 3 h antes.
UPDATE "Modulo" SET "agendamentoMin" = 30, "cancelamentoMin" = 180
WHERE "nome" <> 'Community Flow' AND "cursoId" IN (SELECT "id" FROM "Curso" WHERE "nome" = 'Community live classes');

-- Community Flow: agendar até 24 h antes e cancelar até 48 h antes.
UPDATE "Modulo" SET "agendamentoMin" = 1440, "cancelamentoMin" = 2880
WHERE "nome" = 'Community Flow' AND "cursoId" IN (SELECT "id" FROM "Curso" WHERE "nome" = 'Community live classes');

-- O curso (módulos novos sem regra própria) passa a cancelar até 3 h antes.
UPDATE "Curso" SET "regras" = jsonb_set("regras"::jsonb, '{cancelamento}', '3')
WHERE "nome" = 'Community live classes';
