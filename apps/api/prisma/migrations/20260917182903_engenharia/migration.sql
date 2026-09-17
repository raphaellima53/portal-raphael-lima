-- CreateTable
CREATE TABLE "AnaliseRepo" (
    "id" SERIAL NOT NULL,
    "dono" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "quando" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nota" INTEGER NOT NULL,
    "selo" TEXT NOT NULL,
    "tom" TEXT NOT NULL,
    "ok" INTEGER NOT NULL,
    "atencao" INTEGER NOT NULL,
    "falha" INTEGER NOT NULL,
    "itens" JSONB NOT NULL,
    "por" TEXT NOT NULL,

    CONSTRAINT "AnaliseRepo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnaliseRepo_dono_repo_quando_idx" ON "AnaliseRepo"("dono", "repo", "quando");
