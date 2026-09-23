-- AlterTable
ALTER TABLE "Aluno" ADD COLUMN     "emailSecundario" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Colaborador" ADD COLUMN     "cnpj" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "emailSecundario" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "vinculo" TEXT NOT NULL DEFAULT 'Colaborador';

-- AlterTable
ALTER TABLE "Modulo" ADD COLUMN     "agendamentoMin" INTEGER,
ADD COLUMN     "cancelamentoMin" INTEGER,
ADD COLUMN     "cefr" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Professor" ADD COLUMN     "admissao" DATE,
ADD COLUMN     "cnpj" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "emailSecundario" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Turma" ADD COLUMN     "cefr" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "cor" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "descricao" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "ModuloHorario" (
    "id" SERIAL NOT NULL,
    "moduloId" INTEGER NOT NULL,
    "dia" INTEGER NOT NULL,
    "hora" TEXT NOT NULL,
    "professorId" TEXT,

    CONSTRAINT "ModuloHorario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CursoAlocacao" (
    "id" SERIAL NOT NULL,
    "cursoId" INTEGER NOT NULL,
    "responsavel" TEXT NOT NULL,
    "vagas" INTEGER NOT NULL DEFAULT 1,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CursoAlocacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModuloHorario_moduloId_idx" ON "ModuloHorario"("moduloId");

-- AddForeignKey
ALTER TABLE "ModuloHorario" ADD CONSTRAINT "ModuloHorario_moduloId_fkey" FOREIGN KEY ("moduloId") REFERENCES "Modulo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursoAlocacao" ADD CONSTRAINT "CursoAlocacao_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE CASCADE ON UPDATE CASCADE;
