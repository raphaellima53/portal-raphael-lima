-- AlterTable
ALTER TABLE "Sessao" ADD COLUMN     "comoProfId" TEXT;

-- CreateTable
CREATE TABLE "AvaliacaoProfessor" (
    "id" SERIAL NOT NULL,
    "professorId" TEXT NOT NULL,
    "quando" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aluno" TEXT NOT NULL,
    "curso" TEXT NOT NULL,
    "aula" TEXT NOT NULL,
    "nota" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "por" TEXT NOT NULL,

    CONSTRAINT "AvaliacaoProfessor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AvaliacaoProfessor_professorId_idx" ON "AvaliacaoProfessor"("professorId");

-- AddForeignKey
ALTER TABLE "AvaliacaoProfessor" ADD CONSTRAINT "AvaliacaoProfessor_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
