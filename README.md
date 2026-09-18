# Portal Raphael Lima

Réplica, como aplicação real, do artefato **01. Portal Raphael Lima.html** (portal da operação Alumni by Better).
Monorepo por pastas, sem workspaces: cada app tem o próprio `package.json` e lockfile.

```
apps/
  api/   Fastify 5 · Zod 4 · Prisma 7 · PostgreSQL 18
  web/   Next.js 16 (App Router, Turbopack) · React 19 · Tailwind 4 · shadcn/ui · TanStack Query 5 · Zustand 5 · RHF + Zod · Recharts 3
tools/
  extrai-portal/   lê o portal original no Edge headless: dados do seed e conferências de fidelidade
```

## Rodar local

Requisitos: Node 22+, pnpm 11 e Docker (ou o PostgreSQL embutido, veja abaixo).

```bash
pnpm install              # Biome, na raiz
pnpm install:all          # dependências da API e do front

pnpm db:up                # PostgreSQL 18 no docker compose
#   sem Docker: pnpm db:local   (PostgreSQL 18 embutido em apps/api/.pgdata; deixe o terminal aberto)

cp apps/api/.env.example apps/api/.env      # troque o COOKIE_SECRET
cp apps/web/.env.example apps/web/.env.local
pnpm db:setup             # migrações + seed com a base do portal

pnpm dev:api              # http://localhost:3333
pnpm dev:web              # http://localhost:3000
```

Entre com qualquer persona de teste da tela de login (botão **usar**) — por exemplo `admin@alumni.teste` / `alumni-admin`.

O menu **Engenharia** é opcional e depende de chaves no `.env` da API, todas vazias por padrão:

- `GITHUB_TOKEN` e `GITHUB_OWNER`: sem token, a lista de repositórios usa a API pública do GitHub (60 consultas por hora, só repositório público); com token, entram os privados.
- `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` e `GEMINI_API_KEY` (e os `*_MODEL`): cada provedor sem chave responde dizendo qual variável falta. As chaves ficam só na API e nunca chegam ao navegador.

## Publicar (Vercel + Railway + Supabase)

O front chama `/api/...` no próprio domínio e o Next repassa para a API (rewrite em `apps/web/next.config.ts`),
então o cookie de sessão é do mesmo site. A API roda como servidor contínuo (cache da base, clone de repositórios, rate-limit).

1. **Supabase (banco)** — em *Connect*, copiar a URL do **Session pooler** (host `*.pooler.supabase.com`, porta 5432) e
   acrescentar `?sslmode=require&uselibpqcompat=true`. Carregar uma vez, da máquina local:
   `DATABASE_URL="<url>" pnpm db:setup` (migrações + seed).
2. **Railway (API)** — novo serviço a partir do GitHub com **Root Directory `apps/api`**; o build usa o `Dockerfile` e o
   `railway.json` (migrações antes de cada deploy, saúde em `/saude`). Variáveis: `DATABASE_URL`, `COOKIE_SECRET` (longo e aleatório),
   `WEB_ORIGIN` (URL da Vercel) e, se quiser a Engenharia, `GITHUB_*` e as chaves de IA. Gerar o domínio público do serviço.
3. **Vercel (front)** — **Root Directory `apps/web`** e a variável `API_ORIGIN` com a URL pública da API (sem barra no fim).
   `apps/web/vercel.json` fixa a região em São Paulo (`gru1`) e instala com pnpm 11.

## Verificação

| Comando | O que confere |
| --- | --- |
| `pnpm lint` | Biome 2 no repositório inteiro |
| `pnpm typecheck` | TypeScript 7 na API e no front |
| `pnpm test` | testes da API (login, sessão, menu por persona, agenda, ações na aula com a hierarquia, eventos, Dashboard, alertas, cursos, regras e currículos com versões, alunos: ações por nível, matrículas, alocação, disponibilidade, feedbacks com anexo e Acessar como, empresas: Minhas contas, nova conta, renovar, relatório ao RH, vincular aluno, professores: habilitação com titular, cadastro, avaliação e Acessar como, ações: alocação, fechamento, funil, atendimentos e fluxos com kanban, auditoria, relatórios: recorte, qualidade, seletores por acesso e pagamento no financeiro, configurações: só Admin, novo e editar usuário com governança, bloqueio encerrando sessões, catálogos, feriados, políticas com justificativa, alertas e mapa de telas, engenharia: 16 critérios de saúde do repositório e os três provedores de IA) |
| `node apps/web/scripts/e2e-base.mjs` | fluxo no navegador (Edge instalado): login, Personalizar, alertas, atalhos, sair |
| `node apps/web/scripts/e2e-agenda.mjs` | Agenda no navegador: visões, filtros, popup e página da aula, presença, apresentação, eventos, layout salvo, aluno e Professora |
| `node apps/web/scripts/e2e-cursos.mjs` | Cursos no navegador: catálogo, abas por setor, regras, novo e editar curso, currículo com rascunho e publicação, Professora sem acesso |
| `node apps/web/scripts/e2e-alunos.mjs` | Alunos no navegador: lista com busca e filtros, ficha em abas, matrícula, disponibilidade, ocorrência com anexo, alocação, desativar, Acessar como e acesso por setor |
| `node apps/web/scripts/e2e-empresas.mjs` | Empresas no navegador: lista com renovações, Minhas contas do Gerente B2B, ficha, nova conta, vincular e desvincular aluno, renovar, editar e quem só lê |
| `node apps/web/scripts/e2e-professores.mjs` | Professores no navegador: lista, ficha em abas, habilitação e recorte, disponibilidade, avaliação, novo e editar, desativar, Acessar como e abas por setor |
| `node apps/web/scripts/e2e-acoes.mjs` | Ações no navegador: alertas, alocação, fechar e reabrir a competência, funil, atendimentos, admissão, substituição, campanhas e acesso por setor |
| `node apps/web/scripts/e2e-auditoria.mjs` | Auditoria no navegador: histórico da base, alteração feita no portal com link para o log da ficha, busca e acesso só do Administrador |
| `node apps/web/scripts/e2e-relatorios.mjs` | Relatórios no navegador: qualidade e CSV, agrupar por módulo, seletores com colunas e perspectivas, gráfico do financeiro abre o mês, registrar pagamento e acesso por setor |
| `node apps/web/scripts/e2e-configuracoes.mjs` | Configurações no navegador: filtro de usuários e novo usuário a partir de uma pessoa, departamento criado/renomeado/excluído, importar feriados, salvar políticas com justificativa, política de sessão, executar alertas, mapa de telas e Entrar como persona |
| `node apps/web/scripts/e2e-engenharia.mjs` | Engenharia no navegador (**usa a internet**): lista os repositórios de um dono no GitHub, clona e roda os 16 critérios, e mostra os provedores de IA sem chave |
| `pnpm build` | build de produção da API e do front |

### Fidelidade ao portal

As regras foram portadas do artefato e são conferidas contra ele rodando (precisa do HTML do portal e do Edge):

```bash
node tools/extrai-portal/sonda.cjs tools/extrai-portal/dashboard.expr.js tools/extrai-portal/dashboard.json
node tools/extrai-portal/sonda.cjs tools/extrai-portal/acesso.expr.js tools/extrai-portal/acesso.json
cd apps/api
npx tsx --env-file=.env scripts/compara-portal.ts ../../tools/extrai-portal/dashboard.json   # 15 blocos do Dashboard
npx tsx --env-file=.env scripts/compara-acesso.ts ../../tools/extrai-portal/acesso.json      # menu e chaves das 20 personas
# (antes: node tools/extrai-portal/sonda.cjs tools/extrai-portal/agenda.expr.js tools/extrai-portal/agenda.json)
npx tsx --env-file=.env scripts/compara-agenda.ts ../../tools/extrai-portal/agenda.json      # aulas do mês, régua, eventos e qualidade
npx tsx --env-file=.env scripts/compara-cursos.ts ../../tools/extrai-portal/cursos.json      # catálogo e as 4 abas de cada curso
npx tsx --env-file=.env scripts/compara-alunos.ts ../../tools/extrai-portal/alunos.json      # lista e ficha de cada aluno (521 conferências)
npx tsx --env-file=.env scripts/compara-empresas.ts ../../tools/extrai-portal/empresas.json  # contas B2B e B2B2C: números, alertas, alunos e turmas
npx tsx --env-file=.env scripts/compara-professores.ts ../../tools/extrai-portal/professores.json  # lista e ficha de cada professor (101 conferências)
npx tsx --env-file=.env scripts/compara-acoes.ts ../../tools/extrai-portal/acoes.json            # alocação, folha, cobranças, fluxos, leads e alertas
npx tsx --env-file=.env scripts/compara-auditoria.ts ../../tools/extrai-portal/auditoria.json   # histórico de alterações (logo depois do seed)
npx tsx --env-file=.env scripts/compara-relatorios.ts ../../tools/extrai-portal/relatorios.json # 6 relatórios, qualidade, seletores e financeiro (77 conferências)
npx tsx --env-file=.env scripts/compara-configuracoes.ts ../../tools/extrai-portal/configuracoes.json # usuários, personas, catálogos, feriados, alertas, prestadores, mapa de telas e currículos
```

O seed sai do portal: `node tools/extrai-portal/sonda.cjs tools/extrai-portal/snapshot.expr.js tools/extrai-portal/snapshot.json`
e depois `node tools/extrai-portal/gera-seed.mjs` (grava `apps/api/prisma/seed-data/base.json`).
O caminho do HTML vem de `PORTAL_HTML` (padrão: `~/.claude/tools/portal-alumni/out/01. Portal Raphael Lima.html`).

## Como está organizado

- **Acesso** (`apps/api/src/domain/acesso.ts`, `mapa.ts`): tipo de perfil, cargo, hierarquia e setores; o menu, as abas de seção e as chaves
  liberadas saem daqui e a API devolve tudo em `/auth/me`. O front não decide acesso.
- **Agenda** (`apps/api/src/domain/agenda.ts`): as aulas são geradas do cadastro (turmas, grade por módulo, aulas individuais), com estado estável
  por data; o que se muda numa aula fica em `AulaAjuste`.
- **Aula** (`aulas.ts`, `routes/agenda.ts`): popup, página, apresentação e folha do professor saem de um modelo só, com o que a pessoa pode fazer; toda ação grava o ajuste e o histórico (LogAlteracao).
- **Dashboard** (`dashboard.ts`): a API devolve dados dos blocos (linhas, KPIs, barras e links), o front desenha. A escolha dos blocos é salva por usuário.
- **Design system** (`apps/web/src/app/globals.css`, `components/ui`, `components/ds.tsx`): tokens do `ds.css` do portal — fonte mínima de 14px,
  destaque por sombra (sem borda lateral colorida), foco visível, tema claro por padrão.

## Etapas da réplica

1. **Base** — login e personas, sessão, acesso, menu lateral (minimizar, alertas, ajuda e atalhos, conta), Dashboard com Personalizar, Minha área. ✅
2. **Agenda** — Mensal, Semanal, Diária e Kanban com filtros e layout salvo; popup e página da aula (professor, cancelamento, agendamentos, presença, folha e suporte); modo apresentação (slides, Zoom, presença, anotações); eventos e reuniões; ação em massa e Zoom do dia; Minha agenda e Histórico de aulas do aluno. ✅
3. **Cursos** — catálogo; Visão geral (turmas e módulos com alunos e professores), Regras, Currículo e Grade semanal; novo e editar curso; currículos e acervos com versões (rascunho, publicar, descartar), conteúdos, links e ordem. ✅
4. **Alunos** — lista com busca, filtros, exportar e ações da linha (Editar, Acessar como, Desativar, Excluir por nível); novo e editar aluno; ficha com Perfil, Log, Cursos (matrículas e alocação), Disponibilidade, Agendamentos (próximas e passadas) e Feedbacks (pontos de qualidade, registros com anexos e tratativa). ✅
5. **Empresas** — contas B2B e B2B2C das que vencem antes, com aviso de renovações e Minhas contas do Gerente B2B; ficha com Visão geral (licenças, consumo, presença, receita, alertas), Alunos ou Turmas dedicadas e Histórico; nova e editar empresa, renovar contrato, relatório ao RH (abre o e-mail pronto) e vincular/desvincular aluno. ✅
6. **Professores** — lista com busca, curso e situação, e ações da linha (Editar, Acessar como, Desativar); novo e editar professor; ficha com Perfil, Log, Cursos (habilitação com recorte por módulo ou turma e trava do titular), Disponibilidade, Agenda (próximas e passadas) e Feedbacks (avaliações dos alunos e registro no portal). ✅
7. **Ações** — uma aba por departamento: Alocação (pendências da grade), Substituição, Mudança de nível, Reposição, Admissão, Fechamento (folha com fechar e reabrir), Cobrança, Funil de vendas, Renovação, Campanhas, Atendimentos e Cancelamento e retenção; os fluxos têm kanban (arrastar ou próxima etapa), lista e formulário com o que cada etapa exige e o efeito no portal; alertas de alocação, atendimentos, competência e propostas. ✅
8. **Auditoria** — todas as alterações do portal junto com o histórico da base: quando (com segundos), quem, entidade, o que mudou, registro com link para o log da ficha e detalhe; busca e filtros de entidade e autor; só o Administrador. ✅
9. **Relatórios** — Seletores (alunos, professores ou cursos, com colunas escolhidas e só as perspectivas do acesso); Presença por aluno, Consumo do pacote, Aulas por professor, Avaliação dos alunos, Aulas por curso (por curso ou por módulo) e Ocupação da grade, com curso, período, filtro de qualidade, resumo e CSV das mesmas linhas; Dashboard financeiro com receita, custo, margem e variação, gráfico de 6 meses (Recharts, clique abre o mês), por curso, por professor e cobranças com registrar pagamento. ✅
10. **Configurações** — Pessoas e acessos (Usuários com filtros, ações em massa, novo e editar com prévia do acesso, governança do próprio acesso e do último administrador; Perfis e hierarquias; Sessões e acessos reais com encerrar, políticas e histórico de login; Colaboradores, Prestadores, Departamentos e Cargos), Regras de negócio (Condições e vigência e Dias e horários com justificativa; Feriados e recessos que tiram aula da agenda; Salas; Currículos e acervos; seis catálogos), Alertas (automáticos, Painel administrativo, Execuções do Relógio) e Documentação (Personas de teste com Entrar como, Mapa de telas e Design system). ✅
11. **Engenharia** (menu próprio, só Admin) — GitHub › Repositórios: lista os repositórios de um usuário ou organização, clona o escolhido e roda os **16 critérios de saúde** (README, licença, descrição e tópicos, .gitignore, branch, lockfile, scripts, testes, CI, linter, tipagem, .env.example, segredo no código, atividade, arquivo pesado e guia de contribuição), com nota de 0 a 100 e histórico; IA › Provedores: Anthropic, OpenAI e Google Gemini chamados por fetch, com a mesma pergunta lado a lado e a explicação do que corrigir primeiro na análise. ✅

Telas de etapas futuras abrem com o cabeçalho, as abas de seção e um aviso da etapa; quem não tem acesso vê **Sem acesso a esta tela**, como no portal.

> `pnpm test` roda os arquivos em sequência (eles mexem na mesma base). Os testes e2e mexem em aulas, eventos, cursos, currículos, alunos, empresas, professores, ações, auditoria, pagamentos e configurações da base de teste. Para voltar ao estado inicial: `pnpm --dir apps/api db:seed`.
