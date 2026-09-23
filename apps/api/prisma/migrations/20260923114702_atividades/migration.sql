-- CreateTable
CREATE TABLE "AtividadeModelo" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL DEFAULT '',
    "cadencia" TEXT NOT NULL,
    "setor" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "responsavel" TEXT NOT NULL DEFAULT '',
    "prioridade" TEXT NOT NULL DEFAULT 'Média',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AtividadeModelo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Atividade" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL DEFAULT '',
    "setor" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "responsavel" TEXT NOT NULL DEFAULT '',
    "prioridade" TEXT NOT NULL DEFAULT 'Média',
    "prazo" TIMESTAMP(3),
    "situacao" TEXT NOT NULL DEFAULT 'afazer',
    "relTipo" TEXT,
    "relId" TEXT,
    "relNome" TEXT,
    "modeloId" INTEGER,
    "periodo" TEXT,
    "criado" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPor" TEXT NOT NULL,
    "concluida" TIMESTAMP(3),
    "hist" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "Atividade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Atividade_setor_situacao_idx" ON "Atividade"("setor", "situacao");

-- CreateIndex
CREATE UNIQUE INDEX "Atividade_modeloId_periodo_key" ON "Atividade"("modeloId", "periodo");

-- AddForeignKey
ALTER TABLE "Atividade" ADD CONSTRAINT "Atividade_modeloId_fkey" FOREIGN KEY ("modeloId") REFERENCES "AtividadeModelo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
