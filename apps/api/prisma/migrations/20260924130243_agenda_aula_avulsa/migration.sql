-- AlterTable
ALTER TABLE "ModuloHorario" ADD COLUMN     "ate" DATE;

-- CreateTable
CREATE TABLE "AulaAvulsa" (
    "id" TEXT NOT NULL,
    "cursoId" INTEGER NOT NULL,
    "modulo" TEXT NOT NULL,
    "topico" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL DEFAULT '',
    "professorId" TEXT,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "local" TEXT NOT NULL DEFAULT '',
    "descricao" TEXT NOT NULL DEFAULT '',
    "alunos" TEXT[],
    "criadoPor" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AulaAvulsa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AulaAvulsa_inicio_idx" ON "AulaAvulsa"("inicio");

-- AddForeignKey
ALTER TABLE "AulaAvulsa" ADD CONSTRAINT "AulaAvulsa_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE CASCADE ON UPDATE CASCADE;
