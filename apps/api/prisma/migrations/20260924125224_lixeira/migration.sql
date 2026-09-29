-- CreateTable
CREATE TABLE "Lixeira" (
    "id" SERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "registroId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "resumo" TEXT NOT NULL DEFAULT '',
    "dados" JSONB NOT NULL,
    "por" TEXT NOT NULL,
    "em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lixeira_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lixeira_em_idx" ON "Lixeira"("em");
