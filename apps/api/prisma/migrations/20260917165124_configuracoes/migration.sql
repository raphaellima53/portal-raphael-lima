-- AlterTable
ALTER TABLE "Cargo" ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Departamento" ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Sessao" ADD COLUMN     "encerradaPor" TEXT,
ADD COLUMN     "vistaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "colaborador" TEXT,
ADD COLUMN     "justificativa" TEXT,
ADD COLUMN     "observacoes" TEXT,
ADD COLUMN     "pessoa" TEXT,
ADD COLUMN     "responsavel" TEXT,
ADD COLUMN     "seguranca" JSONB,
ADD COLUMN     "telefone" TEXT,
ADD COLUMN     "validoAte" DATE;

-- CreateTable
CREATE TABLE "AcessoLog" (
    "id" SERIAL NOT NULL,
    "quando" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quem" TEXT NOT NULL,
    "evento" TEXT NOT NULL,
    "resultado" TEXT NOT NULL,
    "detalhe" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "AcessoLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuracao" (
    "chave" TEXT NOT NULL,
    "valor" JSONB NOT NULL,
    "salvoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "por" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Configuracao_pkey" PRIMARY KEY ("chave")
);

-- CreateIndex
CREATE INDEX "AcessoLog_quando_idx" ON "AcessoLog"("quando");
