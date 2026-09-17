-- AlterTable
ALTER TABLE "LogAlteracao" ADD COLUMN     "vezes" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "Evento" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "local" TEXT NOT NULL DEFAULT '',
    "descricao" TEXT NOT NULL DEFAULT '',
    "participantes" JSONB NOT NULL,
    "criadoPor" TEXT NOT NULL,
    "exemplo" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FechamentoCompetencia" (
    "ym" TEXT NOT NULL,
    "por" TEXT NOT NULL,
    "quando" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dados" JSONB NOT NULL,

    CONSTRAINT "FechamentoCompetencia_pkey" PRIMARY KEY ("ym")
);

-- CreateIndex
CREATE INDEX "Evento_inicio_idx" ON "Evento"("inicio");
