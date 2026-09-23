-- CreateTable
CREATE TABLE "OfertaPadrao" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "curso" TEXT NOT NULL,
    "aulas" INTEGER NOT NULL,
    "meses" INTEGER NOT NULL,
    "preco" DECIMAL(12,2) NOT NULL,
    "parcelasMax" INTEGER NOT NULL,
    "recorrente" BOOLEAN NOT NULL DEFAULT false,
    "forma" INTEGER NOT NULL,
    "faturamento" TEXT NOT NULL,
    "mercado" TEXT NOT NULL,
    "nicho" TEXT NOT NULL,
    "planoVindi" TEXT NOT NULL DEFAULT '',
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "itens" JSONB NOT NULL DEFAULT '[]',
    "criada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfertaPadrao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContratoEmpresa" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "empresa" TEXT NOT NULL,
    "empresaId" TEXT,
    "cnpj" TEXT NOT NULL,
    "preset" TEXT NOT NULL,
    "tipoB2B" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Ativo',
    "motivoFim" TEXT NOT NULL DEFAULT '',
    "max" INTEGER NOT NULL,
    "benef" INTEGER[],
    "kam" TEXT NOT NULL,
    "retencao" TEXT NOT NULL,
    "ofertas" INTEGER[],
    "turmas" TEXT[],
    "hist" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "ContratoEmpresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pedido" (
    "id" SERIAL NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "alunoId" INTEGER,
    "cliente" TEXT NOT NULL,
    "curso" TEXT NOT NULL,
    "ofertaId" INTEGER,
    "ofertaNome" TEXT NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "forma" INTEGER NOT NULL,
    "parcelas" INTEGER NOT NULL,
    "preset" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "contratoId" INTEGER,
    "vendedor" TEXT NOT NULL,
    "renovacao" BOOLEAN NOT NULL DEFAULT false,
    "cancelado" BOOLEAN NOT NULL DEFAULT false,
    "motivoCancel" TEXT NOT NULL DEFAULT '',
    "cupom" TEXT NOT NULL DEFAULT '',
    "desconto" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "chave" TEXT NOT NULL,
    "obs" TEXT NOT NULL DEFAULT '',
    "hist" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "Pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParcelaPedido" (
    "chave" TEXT NOT NULL,
    "pedidoId" INTEGER NOT NULL,
    "n" INTEGER NOT NULL,
    "de" INTEGER NOT NULL,
    "venc" TIMESTAMP(3) NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "pago" TIMESTAMP(3),

    CONSTRAINT "ParcelaPedido_pkey" PRIMARY KEY ("chave")
);

-- CreateTable
CREATE TABLE "OrdemFaturamento" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL DEFAULT '',
    "competencia" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "contratoId" INTEGER NOT NULL,
    "pagador" TEXT NOT NULL,
    "linhas" INTEGER NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "venc" TIMESTAMP(3) NOT NULL,
    "turmas" TEXT[],
    "liberadaEm" TIMESTAMP(3),

    CONSTRAINT "OrdemFaturamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotaFiscal" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "competencia" TEXT NOT NULL,
    "emitida" TIMESTAMP(3) NOT NULL,
    "pagador" TEXT NOT NULL,
    "alunoId" INTEGER,
    "pedidoId" INTEGER,
    "ordemId" INTEGER,
    "parcela" TEXT NOT NULL DEFAULT '—',
    "chave" TEXT,
    "escopo" TEXT NOT NULL,

    CONSTRAINT "NotaFiscal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cupom" (
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "validade" TIMESTAMP(3) NOT NULL,
    "limite" INTEGER NOT NULL,
    "ofertas" INTEGER[],
    "criado" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cupom_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "Bolsa" (
    "id" SERIAL NOT NULL,
    "alunoId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "caso" TEXT NOT NULL,
    "curso" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "aulas" INTEGER NOT NULL,
    "usadas" INTEGER NOT NULL,
    "custo" DECIMAL(12,2) NOT NULL,
    "motivo" TEXT NOT NULL,
    "concedida" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bolsa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportacaoVindi" (
    "id" TEXT NOT NULL,
    "aba" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "quando" TIMESTAMP(3) NOT NULL,
    "oferta" TEXT NOT NULL,
    "critica" TEXT NOT NULL DEFAULT '',
    "pronta" BOOLEAN NOT NULL,
    "acao" TEXT NOT NULL,
    "importadaEm" TIMESTAMP(3),
    "importadaPor" TEXT,

    CONSTRAINT "ImportacaoVindi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealCarga" (
    "chave" TEXT NOT NULL,
    "quando" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealCarga_pkey" PRIMARY KEY ("chave")
);

-- CreateIndex
CREATE UNIQUE INDEX "OfertaPadrao_codigo_key" ON "OfertaPadrao"("codigo");

-- CreateIndex
CREATE INDEX "Pedido_alunoId_idx" ON "Pedido"("alunoId");

-- CreateIndex
CREATE INDEX "ParcelaPedido_pedidoId_idx" ON "ParcelaPedido"("pedidoId");

-- CreateIndex
CREATE UNIQUE INDEX "NotaFiscal_chave_key" ON "NotaFiscal"("chave");
