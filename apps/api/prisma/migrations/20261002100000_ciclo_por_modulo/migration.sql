-- 02/10/2026: ciclo de aprendizagem por módulo ou turma, com a definição e as datas validadas
ALTER TABLE "CicloAprendizagem" ADD COLUMN "item" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CicloAprendizagem" ADD COLUMN "inicio" DATE;
ALTER TABLE "CicloAprendizagem" ADD COLUMN "modo" TEXT NOT NULL DEFAULT 'periodo';
ALTER TABLE "CicloAprendizagem" ADD COLUMN "fim" DATE;
ALTER TABLE "CicloAprendizagem" ADD COLUMN "quantidade" INTEGER;
ALTER TABLE "CicloAprendizagem" ADD COLUMN "porSemana" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "CicloAprendizagem" ADD COLUMN "distribuicao" TEXT NOT NULL DEFAULT 'repeticao';
ALTER TABLE "CicloAprendizagem" ADD COLUMN "curriculoId" TEXT;
ALTER TABLE "CicloAprendizagem" ADD COLUMN "datas" JSONB NOT NULL DEFAULT '[]';
