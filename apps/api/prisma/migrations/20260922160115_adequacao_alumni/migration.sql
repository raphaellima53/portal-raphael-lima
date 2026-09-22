-- AlterTable
ALTER TABLE "Aluno" ADD COLUMN     "endereco" JSONB,
ADD COLUMN     "genero" TEXT,
ADD COLUMN     "nascimento" DATE,
ADD COLUMN     "origemExterna" TEXT,
ADD COLUMN     "responsavelFinanceiro" TEXT,
ADD COLUMN     "telefone" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Colaborador" ADD COLUMN     "admissao" DATE,
ADD COLUMN     "cpf" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "endereco" JSONB,
ADD COLUMN     "genero" TEXT,
ADD COLUMN     "nascimento" DATE,
ADD COLUMN     "telefone" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Curriculo" ADD COLUMN     "categoria" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Curso" ADD COLUMN     "configAgenda" JSONB,
ADD COLUMN     "natureza" TEXT NOT NULL DEFAULT 'Curso',
ADD COLUMN     "sigla" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "tipoSala" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "visibilidadeOferta" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "endereco" JSONB,
ADD COLUMN     "funcionarios" INTEGER,
ADD COLUMN     "rhDepartamento" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "rhTelefone" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "LogAlteracao" ADD COLUMN     "antes" JSONB,
ADD COLUMN     "depois" JSONB,
ADD COLUMN     "motivo" TEXT;

-- AlterTable
ALTER TABLE "Matricula" ADD COLUMN     "congeladaEm" TIMESTAMP(3),
ADD COLUMN     "fim" DATE,
ADD COLUMN     "inicio" DATE,
ADD COLUMN     "ofertaId" TEXT,
ADD COLUMN     "origem" TEXT NOT NULL DEFAULT 'Venda',
ADD COLUMN     "statusTipo" TEXT NOT NULL DEFAULT 'Regular',
ADD COLUMN     "vinculadaId" INTEGER;

-- AlterTable
ALTER TABLE "Modulo" ADD COLUMN     "descricao" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sigla" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "vagas" INTEGER;

-- AlterTable
ALTER TABLE "Professor" ADD COLUMN     "cpf" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "endereco" JSONB,
ADD COLUMN     "genero" TEXT,
ADD COLUMN     "nascimento" DATE,
ADD COLUMN     "skills" TEXT[],
ADD COLUMN     "telefone" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Sala" ADD COLUMN     "zoomEmail" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "zoomLicencaAte" DATE;

-- AlterTable
ALTER TABLE "Turma" ADD COLUMN     "ativa" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "empresaId" TEXT,
ADD COLUMN     "fim" DATE,
ADD COLUMN     "inicio" DATE;

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "foto" TEXT,
ADD COLUMN     "trocarSenha" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "UsuarioEmail" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UsuarioEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsuarioTelefone" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "telefone" TEXT NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UsuarioTelefone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsuarioEndereco" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "cep" TEXT NOT NULL DEFAULT '',
    "rua" TEXT NOT NULL DEFAULT '',
    "numero" TEXT NOT NULL DEFAULT '',
    "complemento" TEXT NOT NULL DEFAULT '',
    "bairro" TEXT NOT NULL DEFAULT '',
    "cidade" TEXT NOT NULL DEFAULT '',
    "uf" TEXT NOT NULL DEFAULT '',
    "principal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UsuarioEndereco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacao" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL DEFAULT '',
    "link" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lidaEm" TIMESTAMP(3),

    CONSTRAINT "Notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AusenciaProfessor" (
    "id" SERIAL NOT NULL,
    "professorId" TEXT NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE NOT NULL,
    "motivo" TEXT NOT NULL DEFAULT '',
    "criadoPor" TEXT NOT NULL DEFAULT '',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AusenciaProfessor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoCancelamentoAlocacao" (
    "id" SERIAL NOT NULL,
    "professorId" TEXT NOT NULL,
    "alvo" TEXT NOT NULL,
    "motivo" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Pendente',
    "decididoPor" TEXT,
    "decididoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PedidoCancelamentoAlocacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessaoPedagogica" (
    "id" SERIAL NOT NULL,
    "professorId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "avaliador" TEXT NOT NULL,
    "nota" INTEGER,
    "observacoes" TEXT NOT NULL DEFAULT '',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessaoPedagogica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtratoProfessor" (
    "id" SERIAL NOT NULL,
    "professorId" TEXT NOT NULL,
    "mes" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'Aberto',
    "notaFiscal" TEXT NOT NULL DEFAULT '',
    "fechadoEm" TIMESTAMP(3),
    "pagoEm" DATE,
    "observacoes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "ExtratoProfessor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LancamentoExtrato" (
    "id" SERIAL NOT NULL,
    "extratoId" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'Crédito',
    "cancelado" BOOLEAN NOT NULL DEFAULT false,
    "criadoPor" TEXT NOT NULL DEFAULT '',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LancamentoExtrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataBloqueada" (
    "id" SERIAL NOT NULL,
    "alunoId" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "motivo" TEXT NOT NULL DEFAULT '',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataBloqueada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackAula" (
    "id" SERIAL NOT NULL,
    "alunoId" INTEGER NOT NULL,
    "aulaChave" TEXT NOT NULL,
    "curso" TEXT NOT NULL,
    "professor" TEXT NOT NULL DEFAULT '',
    "estadoEmocional" INTEGER NOT NULL,
    "clareza" INTEGER NOT NULL,
    "participacao" INTEGER NOT NULL,
    "aprendizado" INTEGER NOT NULL,
    "observacoes" TEXT NOT NULL DEFAULT '',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackAula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Nivelamento" (
    "id" SERIAL NOT NULL,
    "matriculaId" INTEGER NOT NULL,
    "cefr" TEXT NOT NULL,
    "nota" INTEGER,
    "concluidoEm" DATE,
    "codigo" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Nivelamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Oferta" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "cursoId" INTEGER NOT NULL,
    "pacote" INTEGER NOT NULL,
    "preco" DECIMAL(12,2) NOT NULL,
    "parcelas" INTEGER NOT NULL DEFAULT 1,
    "duracao" INTEGER,
    "cargaHoraria" INTEGER,
    "negocioId" TEXT NOT NULL DEFAULT '',
    "negocioStatus" TEXT NOT NULL DEFAULT 'Aberto',
    "negocioData" TIMESTAMP(3),
    "beneficiario" TEXT NOT NULL,
    "pessoaFisica" BOOLEAN NOT NULL DEFAULT true,
    "situacao" TEXT NOT NULL DEFAULT 'Aberta',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Oferta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelatorioMatricula" (
    "id" SERIAL NOT NULL,
    "matriculaId" INTEGER NOT NULL,
    "periodo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Rascunho',
    "enviadoEm" TIMESTAMP(3),
    "por" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelatorioMatricula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conteudo" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "url" TEXT NOT NULL DEFAULT '',
    "tipo" TEXT NOT NULL,
    "fonte" TEXT NOT NULL DEFAULT '',
    "idioma" TEXT NOT NULL DEFAULT '',
    "momento" TEXT NOT NULL DEFAULT 'Aula',
    "scorm" TEXT NOT NULL DEFAULT '',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conteudo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Servico" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "sigla" TEXT NOT NULL DEFAULT '',
    "cor" TEXT NOT NULL DEFAULT '#003FB0',
    "descricao" TEXT NOT NULL DEFAULT '',
    "categoria" TEXT NOT NULL DEFAULT '',
    "vagas" INTEGER NOT NULL DEFAULT 1,
    "cursoId" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Servico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Calendario" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Calendario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CicloAprendizagem" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "cursoId" INTEGER NOT NULL,
    "calendarioId" INTEGER,
    "progressao" TEXT NOT NULL DEFAULT '',
    "tipoGeracao" TEXT NOT NULL DEFAULT '',
    "nascimento" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CicloAprendizagem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UsuarioEmail_usuarioId_email_key" ON "UsuarioEmail"("usuarioId", "email");

-- CreateIndex
CREATE INDEX "UsuarioTelefone_usuarioId_idx" ON "UsuarioTelefone"("usuarioId");

-- CreateIndex
CREATE INDEX "UsuarioEndereco_usuarioId_idx" ON "UsuarioEndereco"("usuarioId");

-- CreateIndex
CREATE INDEX "Notificacao_usuarioId_lidaEm_idx" ON "Notificacao"("usuarioId", "lidaEm");

-- CreateIndex
CREATE INDEX "AusenciaProfessor_professorId_idx" ON "AusenciaProfessor"("professorId");

-- CreateIndex
CREATE INDEX "PedidoCancelamentoAlocacao_professorId_idx" ON "PedidoCancelamentoAlocacao"("professorId");

-- CreateIndex
CREATE INDEX "SessaoPedagogica_professorId_idx" ON "SessaoPedagogica"("professorId");

-- CreateIndex
CREATE UNIQUE INDEX "ExtratoProfessor_professorId_mes_key" ON "ExtratoProfessor"("professorId", "mes");

-- CreateIndex
CREATE INDEX "LancamentoExtrato_extratoId_idx" ON "LancamentoExtrato"("extratoId");

-- CreateIndex
CREATE UNIQUE INDEX "DataBloqueada_alunoId_data_key" ON "DataBloqueada"("alunoId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackAula_alunoId_aulaChave_key" ON "FeedbackAula"("alunoId", "aulaChave");

-- CreateIndex
CREATE UNIQUE INDEX "Nivelamento_matriculaId_key" ON "Nivelamento"("matriculaId");

-- CreateIndex
CREATE UNIQUE INDEX "Oferta_codigo_key" ON "Oferta"("codigo");

-- CreateIndex
CREATE INDEX "RelatorioMatricula_matriculaId_idx" ON "RelatorioMatricula"("matriculaId");

-- CreateIndex
CREATE UNIQUE INDEX "Servico_nome_key" ON "Servico"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Calendario_nome_key" ON "Calendario"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "CicloAprendizagem_cursoId_nome_key" ON "CicloAprendizagem"("cursoId", "nome");

-- AddForeignKey
ALTER TABLE "UsuarioEmail" ADD CONSTRAINT "UsuarioEmail_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioTelefone" ADD CONSTRAINT "UsuarioTelefone_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioEndereco" ADD CONSTRAINT "UsuarioEndereco_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turma" ADD CONSTRAINT "Turma_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AusenciaProfessor" ADD CONSTRAINT "AusenciaProfessor_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoCancelamentoAlocacao" ADD CONSTRAINT "PedidoCancelamentoAlocacao_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessaoPedagogica" ADD CONSTRAINT "SessaoPedagogica_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtratoProfessor" ADD CONSTRAINT "ExtratoProfessor_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LancamentoExtrato" ADD CONSTRAINT "LancamentoExtrato_extratoId_fkey" FOREIGN KEY ("extratoId") REFERENCES "ExtratoProfessor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataBloqueada" ADD CONSTRAINT "DataBloqueada_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackAula" ADD CONSTRAINT "FeedbackAula_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matricula" ADD CONSTRAINT "Matricula_ofertaId_fkey" FOREIGN KEY ("ofertaId") REFERENCES "Oferta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nivelamento" ADD CONSTRAINT "Nivelamento_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Oferta" ADD CONSTRAINT "Oferta_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelatorioMatricula" ADD CONSTRAINT "RelatorioMatricula_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Servico" ADD CONSTRAINT "Servico_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CicloAprendizagem" ADD CONSTRAINT "CicloAprendizagem_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CicloAprendizagem" ADD CONSTRAINT "CicloAprendizagem_calendarioId_fkey" FOREIGN KEY ("calendarioId") REFERENCES "Calendario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
