-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT,
    "perfilId" INTEGER,
    "nivel" INTEGER NOT NULL DEFAULT 5,
    "areas" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'Ativo',
    "mfa" BOOLEAN NOT NULL DEFAULT false,
    "perfilLegado" TEXT,
    "escopoLegado" TEXT,
    "ultimoAcesso" TEXT,
    "personaLetra" TEXT,
    "personaTipo" TEXT,
    "personaCursos" TEXT[],
    "personaModulos" TEXT[],
    "objetivo" TEXT,
    "agendaPresa" JSONB,
    "alunoId" INTEGER,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sessao" (
    "id" TEXT NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "encerradaEm" TIMESTAMP(3),
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "Sessao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardConfig" (
    "usuarioId" INTEGER NOT NULL,
    "blocos" TEXT[],
    "salvoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DashboardConfig_pkey" PRIMARY KEY ("usuarioId")
);

-- CreateTable
CREATE TABLE "Preferencia" (
    "usuarioId" INTEGER NOT NULL,
    "chave" TEXT NOT NULL,
    "valor" JSONB NOT NULL,
    "salvoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Preferencia_pkey" PRIMARY KEY ("usuarioId","chave")
);

-- CreateTable
CREATE TABLE "Catalogo" (
    "id" SERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "dados" JSONB,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Catalogo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Departamento" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL DEFAULT '',
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Departamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cargo" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "departamento" TEXT NOT NULL,
    "descricao" TEXT NOT NULL DEFAULT '',
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Cargo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Colaborador" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "departamento" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Colaborador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Segmento" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "Segmento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "segmento" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "gerente" TEXT NOT NULL,
    "representante" TEXT,
    "rhNome" TEXT NOT NULL,
    "rhEmail" TEXT NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE NOT NULL,
    "licencas" INTEGER NOT NULL,
    "aulas" INTEGER NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "subsidio" INTEGER NOT NULL,
    "desconto" INTEGER NOT NULL,
    "renovaAuto" BOOLEAN NOT NULL,
    "turmaCurso" TEXT,
    "cursos" TEXT[],
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Curso" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "cor" TEXT NOT NULL,
    "estrutura" TEXT NOT NULL,
    "formato" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "idioma" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "autoAgenda" BOOLEAN NOT NULL DEFAULT false,
    "descricao" TEXT NOT NULL DEFAULT '',
    "regras" JSONB NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Curso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Modulo" (
    "id" SERIAL NOT NULL,
    "cursoId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "cor" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Modulo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Turma" (
    "id" SERIAL NOT NULL,
    "cursoId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "grupo" TEXT NOT NULL,
    "professorId" TEXT,
    "grade" TEXT NOT NULL,
    "vagas" INTEGER NOT NULL,
    "ocupadas" INTEGER NOT NULL,
    "sala" TEXT NOT NULL,
    "modalidade" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "curriculo" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Turma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Professor" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "cursos" TEXT[],
    "habilitacao" JSONB,
    "carga" INTEGER NOT NULL DEFAULT 3,
    "teto" INTEGER NOT NULL DEFAULT 24,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "valorHora" DECIMAL(10,2),
    "disponibilidade" TEXT[],
    "dispDefinida" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Professor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sala" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "atende" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "zoom" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Sala_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feriado" (
    "id" SERIAL NOT NULL,
    "data" DATE NOT NULL,
    "nome" TEXT NOT NULL,
    "origem" TEXT NOT NULL,

    CONSTRAINT "Feriado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Funcionamento" (
    "dia" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "aberto" BOOLEAN NOT NULL,
    "inicio" TEXT NOT NULL,
    "fim" TEXT NOT NULL,

    CONSTRAINT "Funcionamento_pkey" PRIMARY KEY ("dia")
);

-- CreateTable
CREATE TABLE "Aluno" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "emailPlaceholder" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'Ativo',
    "desativadoEm" TIMESTAMP(3),
    "empresaId" TEXT,
    "contratoFim" DATE,
    "disponibilidade" TEXT[],
    "dispDefinida" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Aluno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Matricula" (
    "id" SERIAL NOT NULL,
    "alunoId" INTEGER NOT NULL,
    "cursoId" INTEGER NOT NULL,
    "modulo" TEXT,
    "usadas" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "modalidade" TEXT NOT NULL DEFAULT 'Online',
    "desativadoEm" TIMESTAMP(3),
    "alocacao" JSONB,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Matricula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Curriculo" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "grupo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "idioma" TEXT NOT NULL,
    "aplicado" TEXT[],
    "versoes" JSONB NOT NULL,
    "conteudos" JSONB NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Curriculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AulaAjuste" (
    "chave" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AulaAjuste_pkey" PRIMARY KEY ("chave")
);

-- CreateTable
CREATE TABLE "LogAlteracao" (
    "id" SERIAL NOT NULL,
    "quando" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "autor" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT,
    "nome" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "detalhe" TEXT,
    "origem" TEXT NOT NULL DEFAULT 'portal',

    CONSTRAINT "LogAlteracao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_personaLetra_key" ON "Usuario"("personaLetra");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_alunoId_key" ON "Usuario"("alunoId");

-- CreateIndex
CREATE INDEX "Sessao_usuarioId_idx" ON "Sessao"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Catalogo_tipo_nome_key" ON "Catalogo"("tipo", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "Departamento_nome_key" ON "Departamento"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Cargo_nome_key" ON "Cargo"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Colaborador_email_key" ON "Colaborador"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Segmento_nome_key" ON "Segmento"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_nome_key" ON "Empresa"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Curso_nome_key" ON "Curso"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Modulo_cursoId_nome_key" ON "Modulo"("cursoId", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "Turma_cursoId_nome_key" ON "Turma"("cursoId", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "Professor_nome_key" ON "Professor"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Sala_nome_key" ON "Sala"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Feriado_data_key" ON "Feriado"("data");

-- CreateIndex
CREATE INDEX "Matricula_alunoId_idx" ON "Matricula"("alunoId");

-- CreateIndex
CREATE INDEX "LogAlteracao_quando_idx" ON "LogAlteracao"("quando");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sessao" ADD CONSTRAINT "Sessao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardConfig" ADD CONSTRAINT "DashboardConfig_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Preferencia" ADD CONSTRAINT "Preferencia_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Modulo" ADD CONSTRAINT "Modulo_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turma" ADD CONSTRAINT "Turma_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turma" ADD CONSTRAINT "Turma_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aluno" ADD CONSTRAINT "Aluno_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matricula" ADD CONSTRAINT "Matricula_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matricula" ADD CONSTRAINT "Matricula_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
