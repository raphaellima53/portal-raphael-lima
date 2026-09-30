-- CreateTable
CREATE TABLE "SolicitacaoAluno" (
    "id" SERIAL NOT NULL,
    "alunoId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "curso" TEXT NOT NULL,
    "aula" TEXT NOT NULL DEFAULT '',
    "aulaRot" TEXT NOT NULL DEFAULT '',
    "pedido" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Pendente',
    "resposta" TEXT NOT NULL DEFAULT '',
    "decididoPor" TEXT,
    "decididoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolicitacaoAluno_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SolicitacaoAluno_alunoId_idx" ON "SolicitacaoAluno"("alunoId");

-- AddForeignKey
ALTER TABLE "SolicitacaoAluno" ADD CONSTRAINT "SolicitacaoAluno_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE CASCADE ON UPDATE CASCADE;
