-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "curso" TEXT NOT NULL,
    "consultor" TEXT NOT NULL,
    "etapa" TEXT NOT NULL,
    "etapaAntes" TEXT,
    "motivo" TEXT NOT NULL DEFAULT '',
    "alunoId" INTEGER,
    "entrou" TIMESTAMP(3) NOT NULL,
    "mudou" TIMESTAMP(3) NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParcelaPaga" (
    "chave" TEXT NOT NULL,
    "quando" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "por" TEXT NOT NULL,

    CONSTRAINT "ParcelaPaga_pkey" PRIMARY KEY ("chave")
);

-- CreateTable
CREATE TABLE "FluxoCard" (
    "id" TEXT NOT NULL,
    "fluxo" TEXT NOT NULL,
    "etapa" TEXT NOT NULL,
    "valores" JSONB NOT NULL,
    "criado" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mudou" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quem" TEXT NOT NULL,
    "hist" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "FluxoCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FluxoSemeado" (
    "fluxo" TEXT NOT NULL,
    "quando" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FluxoSemeado_pkey" PRIMARY KEY ("fluxo")
);

-- CreateIndex
CREATE INDEX "FluxoCard_fluxo_idx" ON "FluxoCard"("fluxo");
