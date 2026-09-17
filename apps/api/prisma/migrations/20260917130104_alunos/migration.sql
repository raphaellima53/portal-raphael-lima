-- AlterTable
ALTER TABLE "Aluno" ADD COLUMN     "fbGerado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ordem" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "statusAntes" TEXT;

-- AlterTable
ALTER TABLE "Sessao" ADD COLUMN     "comoAlunoId" INTEGER,
ADD COLUMN     "comoVolta" TEXT;

-- CreateTable
CREATE TABLE "FeedbackAluno" (
    "id" SERIAL NOT NULL,
    "alunoId" INTEGER NOT NULL,
    "quando" TIMESTAMP(3) NOT NULL,
    "tipo" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "curso" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "por" TEXT NOT NULL,

    CONSTRAINT "FeedbackAluno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Anexo" (
    "id" SERIAL NOT NULL,
    "feedbackId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "tam" INTEGER NOT NULL,
    "dados" BYTEA NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Anexo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedbackAluno_alunoId_idx" ON "FeedbackAluno"("alunoId");

-- CreateIndex
CREATE INDEX "Anexo_feedbackId_idx" ON "Anexo"("feedbackId");

-- AddForeignKey
ALTER TABLE "FeedbackAluno" ADD CONSTRAINT "FeedbackAluno_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anexo" ADD CONSTRAINT "Anexo_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "FeedbackAluno"("id") ON DELETE CASCADE ON UPDATE CASCADE;
