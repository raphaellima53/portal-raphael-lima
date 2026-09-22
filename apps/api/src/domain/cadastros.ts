/**
 * Cadastros simples: as tabelas que chegaram com a adequação ao Portal Alumni (19. Portal Alumni - Banco de dados).
 * Cada cadastro é uma especificação — campos, colunas, filtros, de onde vêm as opções e quem pode ver —, e a mesma
 * rota (routes/cadastros.ts) e a mesma tela (components/cadastro) servem todos.
 * O acesso segue a tela vizinha que já existia (ex.: Datas bloqueadas usa a chave da Disponibilidade do aluno).
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '../db.ts';
import { fmt } from '../lib/fmt.ts';
import { agOfertas, alMat } from './agenda.ts';
import { alHistorico } from './alunos.ts';
import { base } from './base.ts';

export type TipoCampo =
  | 'texto'
  | 'longo'
  | 'numero'
  | 'dinheiro'
  | 'data'
  | 'mes'
  | 'sim'
  | 'escolha'
  | 'email'
  | 'url'
  | 'cor'
  | 'telefone'
  | 'cep'
  | 'uf';

/** de onde vêm as opções de uma escolha */
export type Fonte =
  | { lista: string[] }
  | { catalogo: string }
  | {
      tabela:
        | 'cursos'
        | 'professores'
        | 'calendarios'
        | 'matriculas'
        | 'matriculasDoPai'
        | 'aulasDoPai'
        | 'alocacoesDoPai'
        | 'extratos'
        | 'extratosDoPai'
        | 'colaboradores'
        | 'cursosTurma'
        | 'salas'
        | 'empresas';
    };

export type Campo = {
  k: string;
  rotulo: string;
  tipo: TipoCampo;
  req?: boolean;
  fonte?: Fonte;
  /** a escolha guarda o id numérico */
  int?: boolean;
  /** aparece como coluna da lista */
  coluna?: boolean;
  /** vira filtro em linha acima da lista (só escolha e sim) */
  filtro?: boolean;
  /** ocupa a linha inteira do formulário */
  largo?: boolean;
  ajuda?: string;
  padrao?: string | number | boolean;
  /** some do formulário quando o cadastro é aberto dentro de uma ficha (o pai já diz quem é) */
  somePai?: boolean;
  /** só coluna: o valor é calculado ao salvar, não se digita */
  soLista?: boolean;
  /** a coluna aceita nulo: vazio grava null (sem a marca, texto vazio grava '' e número vazio fica no padrão) */
  nulo?: boolean;
};

export type Pai = 'aluno' | 'professor' | 'usuario';
type Ctx = { pai: string | null; autor: string };
type Linha = Record<string, unknown> & { id: number | string };

export type Cadastro = {
  id: string;
  titulo: string;
  um: string;
  /** "um" é feminino (data bloqueada, ausência…): as mensagens dizem criada, salva, excluída */
  fem?: boolean;
  novo: string;
  /** texto curto que explica a tela */
  sobre: string;
  modelo: string;
  /** qualquer uma destas chaves de acesso libera a tela */
  chaves: string[];
  pai?: Pai;
  /** o pai é obrigatório (sem ele a tela não abre) */
  soComPai?: boolean;
  /** filtro da lista pelo pai */
  onde?: (pai: string) => Record<string, unknown>;
  /** campos gravados a partir do pai e de quem salva */
  fixa?: (c: Ctx) => Record<string, unknown>;
  campos: Campo[];
  ordem: Record<string, 'asc' | 'desc'>[];
  include?: Record<string, unknown>;
  geraId?: () => string;
  /** colunas calculadas depois das colunas dos campos */
  extras?: { k: string; rotulo: string; valor: (r: Linha) => string }[];
  /** confere e completa os dados antes de gravar (devolve o erro para o usuário) */
  antes?: (dados: Record<string, unknown>, c: Ctx, atual: Linha | null) => Promise<string | null> | string | null;
  /** trava a exclusão (devolve o motivo) */
  podeExcluir?: (r: Linha) => Promise<string | null>;
  /** depois de gravar (ex.: só um principal) */
  depois?: (r: Linha, c: Ctx) => Promise<void>;
  rotulo: (r: Linha) => string;
};

const CEFR = ['A0', 'A1', 'A1+', 'A2', 'A2+', 'B1', 'B1+', 'B2', 'B2+', 'C1', 'C2'];
const NOTA = ['1', '2', '3', '4', '5'];
/** colunas @db.Date chegam à meia-noite UTC: formatar no fuso local voltaria um dia */
const p2 = (n: number) => String(n).padStart(2, '0');
const isoUTC = (v: Date) => `${v.getUTCFullYear()}-${p2(v.getUTCMonth() + 1)}-${p2(v.getUTCDate())}`;
const dataUTC = (v: Date) => `${p2(v.getUTCDate())}/${p2(v.getUTCMonth() + 1)}/${v.getUTCFullYear()}`;
const d = (v: unknown) => (v instanceof Date ? dataUTC(v) : '');
const soUmPrincipal = (modelo: 'usuarioEmail' | 'usuarioTelefone' | 'usuarioEndereco') => async (r: Linha) => {
  if (!r.principal) return;
  // biome-ignore lint/suspicious/noExplicitAny: delegate escolhido pelo nome do modelo
  await (prisma as any)[modelo].updateMany({
    where: { usuarioId: r.usuarioId, id: { not: r.id } },
    data: { principal: false },
  });
};
const intervalo = (dados: Record<string, unknown>) =>
  dados.inicio instanceof Date && dados.fim instanceof Date && dados.fim < dados.inicio
    ? 'O fim não pode vir antes do início.'
    : null;

export const CADASTROS: Cadastro[] = [
  /* ---------------- A · Usuários: aluno ---------------- */
  {
    id: 'datas-bloqueadas',
    titulo: 'Datas bloqueadas',
    um: 'data bloqueada',
    fem: true,
    novo: 'Bloquear data',
    sobre: 'Dias em que o aluno não pode ter aula (viagem, prova). A alocação e o agendamento pulam essas datas.',
    modelo: 'dataBloqueada',
    chaves: ['aluno.disponibilidade'],
    pai: 'aluno',
    soComPai: true,
    onde: (pai) => ({ alunoId: Number(pai) }),
    fixa: (c) => ({ alunoId: Number(c.pai) }),
    campos: [
      { k: 'data', rotulo: 'Data', tipo: 'data', req: true, coluna: true },
      { k: 'motivo', rotulo: 'Motivo', tipo: 'texto', coluna: true, largo: true },
    ],
    ordem: [{ data: 'asc' }],
    rotulo: (r) => d(r.data),
  },
  {
    id: 'nivelamentos',
    titulo: 'Nivelamento',
    um: 'nivelamento',
    novo: 'Registrar nivelamento',
    sobre: 'Resultado do nivelamento (leveling) que abre cada matrícula: nível CEFR, nota e quando terminou.',
    modelo: 'nivelamento',
    chaves: ['aluno.cursos'],
    pai: 'aluno',
    soComPai: true,
    onde: (pai) => ({ matricula: { alunoId: Number(pai) } }),
    campos: [
      {
        k: 'matriculaId',
        rotulo: 'Matrícula',
        tipo: 'escolha',
        fonte: { tabela: 'matriculasDoPai' },
        int: true,
        req: true,
        coluna: true,
        largo: true,
      },
      {
        k: 'cefr',
        rotulo: 'Nível CEFR',
        tipo: 'escolha',
        fonte: { lista: CEFR },
        req: true,
        coluna: true,
        filtro: true,
      },
      { nulo: true, k: 'nota', rotulo: 'Nota (0 a 100)', tipo: 'numero', coluna: true },
      { k: 'concluidoEm', rotulo: 'Concluído em', tipo: 'data', coluna: true },
      { k: 'codigo', rotulo: 'Código do teste', tipo: 'texto' },
    ],
    ordem: [{ id: 'asc' }],
    antes: (x) => (x.nota != null && (Number(x.nota) < 0 || Number(x.nota) > 100) ? 'A nota vai de 0 a 100.' : null),
    rotulo: (r) => String(r.cefr),
  },
  {
    id: 'feedbacks-aula',
    titulo: 'Feedbacks das aulas',
    um: 'feedback de aula',
    novo: 'Registrar feedback',
    sobre: 'O que o aluno achou de cada aula, de 1 a 5: estado emocional, clareza, participação e aprendizado.',
    modelo: 'feedbackAula',
    chaves: ['aluno.feedbacks'],
    pai: 'aluno',
    soComPai: true,
    onde: (pai) => ({ alunoId: Number(pai) }),
    fixa: (c) => ({ alunoId: Number(c.pai) }),
    campos: [
      {
        k: 'aulaChave',
        rotulo: 'Aula',
        tipo: 'escolha',
        fonte: { tabela: 'aulasDoPai' },
        req: true,
        largo: true,
        ajuda: 'aulas dos últimos 90 dias',
      },
      { k: 'curso', rotulo: 'Curso', tipo: 'texto', coluna: true, soLista: true },
      { k: 'professor', rotulo: 'Professor', tipo: 'texto', coluna: true, soLista: true },
      {
        k: 'estadoEmocional',
        rotulo: 'Estado emocional',
        tipo: 'escolha',
        fonte: { lista: NOTA },
        req: true,
        coluna: true,
      },
      { k: 'clareza', rotulo: 'Clareza', tipo: 'escolha', fonte: { lista: NOTA }, req: true, coluna: true },
      { k: 'participacao', rotulo: 'Participação', tipo: 'escolha', fonte: { lista: NOTA }, req: true, coluna: true },
      { k: 'aprendizado', rotulo: 'Aprendizado', tipo: 'escolha', fonte: { lista: NOTA }, req: true, coluna: true },
      { k: 'observacoes', rotulo: 'Observações', tipo: 'longo', largo: true },
    ],
    ordem: [{ criadoEm: 'desc' }],
    extras: [{ k: 'dataAula', rotulo: 'Data da aula', valor: (r) => dataDaChave(String(r.aulaChave)) }],
    antes: async (x, c) => {
      /* curso e professor saem da própria aula escolhida */
      const aula = (await aulasDoAluno(Number(c.pai))).find((a) => a.v === x.aulaChave);
      if (!aula) return 'Escolha uma aula da lista.';
      x.curso = aula.curso;
      x.professor = aula.prof;
      for (const k of ['estadoEmocional', 'clareza', 'participacao', 'aprendizado']) x[k] = Number(x[k]);
      return null;
    },
    rotulo: (r) => `${r.curso} · ${dataDaChave(String(r.aulaChave))}`,
  },

  /* ---------------- A · Usuários: professor ---------------- */
  {
    id: 'ausencias',
    titulo: 'Ausências',
    um: 'ausência',
    fem: true,
    novo: 'Nova ausência',
    sobre: 'Férias, licenças e faltas planejadas. Durante a ausência o professor não recebe aulas novas.',
    modelo: 'ausenciaProfessor',
    chaves: ['prof.disponibilidade'],
    pai: 'professor',
    soComPai: true,
    onde: (pai) => ({ professorId: pai }),
    fixa: (c) => ({ professorId: c.pai, criadoPor: c.autor }),
    campos: [
      { k: 'inicio', rotulo: 'Início', tipo: 'data', req: true, coluna: true },
      { k: 'fim', rotulo: 'Fim', tipo: 'data', req: true, coluna: true },
      { k: 'motivo', rotulo: 'Motivo', tipo: 'texto', coluna: true, largo: true },
    ],
    ordem: [{ inicio: 'desc' }],
    extras: [{ k: 'criadoPor', rotulo: 'Registrado por', valor: (r) => String(r.criadoPor ?? '') }],
    antes: intervalo,
    rotulo: (r) => `${d(r.inicio)} a ${d(r.fim)}`,
  },
  {
    id: 'pedidos-cancelamento',
    titulo: 'Pedidos de cancelamento de alocação',
    um: 'pedido',
    novo: 'Novo pedido',
    sobre: 'O professor pede para largar uma alocação fixa; a coordenação aprova ou recusa.',
    modelo: 'pedidoCancelamentoAlocacao',
    chaves: ['prof.disponibilidade'],
    pai: 'professor',
    soComPai: true,
    onde: (pai) => ({ professorId: pai }),
    fixa: (c) => ({ professorId: c.pai }),
    campos: [
      {
        k: 'alvo',
        rotulo: 'Alocação',
        tipo: 'escolha',
        fonte: { tabela: 'alocacoesDoPai' },
        req: true,
        coluna: true,
        largo: true,
      },
      { k: 'motivo', rotulo: 'Motivo', tipo: 'longo', coluna: true, largo: true },
      {
        k: 'status',
        rotulo: 'Situação',
        tipo: 'escolha',
        fonte: { lista: ['Pendente', 'Aprovado', 'Recusado'] },
        padrao: 'Pendente',
        coluna: true,
        filtro: true,
      },
    ],
    ordem: [{ criadoEm: 'desc' }],
    extras: [
      {
        k: 'decisao',
        rotulo: 'Decidido',
        valor: (r) => (r.decididoPor ? `${r.decididoPor} · ${d(r.decididoEm)}` : '—'),
      },
    ],
    antes: (x, c, atual) => {
      if (x.status !== 'Pendente' && (!atual || atual.status !== x.status)) {
        x.decididoPor = c.autor;
        x.decididoEm = new Date();
      }
      if (x.status === 'Pendente') {
        x.decididoPor = null;
        x.decididoEm = null;
      }
      return null;
    },
    rotulo: (r) => String(r.alvo),
  },
  {
    id: 'sessoes-pedagogicas',
    titulo: 'Sessões pedagógicas',
    um: 'sessão pedagógica',
    fem: true,
    novo: 'Nova sessão',
    sobre: 'Observação de aula e devolutiva ao professor, com nota de 1 a 5.',
    modelo: 'sessaoPedagogica',
    chaves: ['prof.feedbacks'],
    pai: 'professor',
    soComPai: true,
    onde: (pai) => ({ professorId: pai }),
    fixa: (c) => ({ professorId: c.pai }),
    campos: [
      { k: 'data', rotulo: 'Data', tipo: 'data', req: true, coluna: true },
      {
        k: 'avaliador',
        rotulo: 'Avaliador',
        tipo: 'escolha',
        fonte: { tabela: 'colaboradores' },
        req: true,
        coluna: true,
      },
      { k: 'nota', rotulo: 'Nota', tipo: 'escolha', fonte: { lista: NOTA }, coluna: true },
      { k: 'observacoes', rotulo: 'Devolutiva', tipo: 'longo', coluna: true, largo: true },
    ],
    ordem: [{ data: 'desc' }],
    antes: (x) => {
      x.nota = x.nota == null || x.nota === '' ? null : Number(x.nota);
      return null;
    },
    rotulo: (r) => d(r.data),
  },

  /* ---------------- A · Usuários: conta de acesso ---------------- */
  {
    id: 'usuario-emails',
    titulo: 'E-mails',
    um: 'e-mail',
    novo: 'Novo e-mail',
    sobre: 'Vários e-mails na mesma conta; o principal é o de login e avisos.',
    modelo: 'usuarioEmail',
    chaves: ['cfg'],
    pai: 'usuario',
    soComPai: true,
    onde: (pai) => ({ usuarioId: Number(pai) }),
    fixa: (c) => ({ usuarioId: Number(c.pai) }),
    campos: [
      { k: 'email', rotulo: 'E-mail', tipo: 'email', req: true, coluna: true, largo: true },
      { k: 'principal', rotulo: 'Principal', tipo: 'sim', coluna: true },
    ],
    ordem: [{ principal: 'desc' }, { id: 'asc' }],
    depois: soUmPrincipal('usuarioEmail'),
    rotulo: (r) => String(r.email),
  },
  {
    id: 'usuario-telefones',
    titulo: 'Telefones',
    um: 'telefone',
    novo: 'Novo telefone',
    sobre: 'Vários telefones na mesma conta; o principal é o de contato.',
    modelo: 'usuarioTelefone',
    chaves: ['cfg'],
    pai: 'usuario',
    soComPai: true,
    onde: (pai) => ({ usuarioId: Number(pai) }),
    fixa: (c) => ({ usuarioId: Number(c.pai) }),
    campos: [
      { k: 'telefone', rotulo: 'Telefone', tipo: 'telefone', req: true, coluna: true, largo: true },
      { k: 'principal', rotulo: 'Principal', tipo: 'sim', coluna: true },
    ],
    ordem: [{ principal: 'desc' }, { id: 'asc' }],
    depois: soUmPrincipal('usuarioTelefone'),
    rotulo: (r) => String(r.telefone),
  },
  {
    id: 'usuario-enderecos',
    titulo: 'Endereços',
    um: 'endereço',
    novo: 'Novo endereço',
    sobre: 'Vários endereços na mesma conta; o principal é o de correspondência.',
    modelo: 'usuarioEndereco',
    chaves: ['cfg'],
    pai: 'usuario',
    soComPai: true,
    onde: (pai) => ({ usuarioId: Number(pai) }),
    fixa: (c) => ({ usuarioId: Number(c.pai) }),
    campos: [
      { k: 'cep', rotulo: 'CEP', tipo: 'cep', coluna: true },
      { k: 'rua', rotulo: 'Rua', tipo: 'texto', req: true, coluna: true },
      { k: 'numero', rotulo: 'Número', tipo: 'texto', coluna: true },
      { k: 'complemento', rotulo: 'Complemento', tipo: 'texto' },
      { k: 'bairro', rotulo: 'Bairro', tipo: 'texto' },
      { k: 'cidade', rotulo: 'Cidade', tipo: 'texto', coluna: true },
      { k: 'uf', rotulo: 'UF', tipo: 'uf', coluna: true },
      { k: 'principal', rotulo: 'Principal', tipo: 'sim', coluna: true },
    ],
    ordem: [{ principal: 'desc' }, { id: 'asc' }],
    depois: soUmPrincipal('usuarioEndereco'),
    rotulo: (r) => `${r.rua}, ${r.numero}`,
  },

  /* ---------------- B · Produtos e serviços ---------------- */
  {
    id: 'servicos',
    titulo: 'Serviços',
    um: 'serviço',
    novo: 'Novo serviço',
    sobre: 'Atendimento, acompanhamento e consultoria: ficam ao lado dos cursos e podem se ligar a um deles.',
    modelo: 'servico',
    chaves: ['catalogo'],
    campos: [
      { k: 'nome', rotulo: 'Nome', tipo: 'texto', req: true, coluna: true },
      { k: 'sigla', rotulo: 'Sigla', tipo: 'texto', coluna: true },
      {
        k: 'categoria',
        rotulo: 'Categoria',
        tipo: 'escolha',
        fonte: { catalogo: 'categoriasServico' },
        coluna: true,
        filtro: true,
      },
      {
        k: 'cursoId',
        nulo: true,
        rotulo: 'Curso ligado',
        tipo: 'escolha',
        fonte: { tabela: 'cursos' },
        int: true,
        coluna: true,
      },
      { k: 'vagas', rotulo: 'Vagas por atendimento', tipo: 'numero', padrao: 1, coluna: true },
      { k: 'cor', rotulo: 'Cor', tipo: 'cor', padrao: '#003FB0' },
      { k: 'descricao', rotulo: 'Descrição', tipo: 'longo', largo: true },
      { k: 'ativo', rotulo: 'Ativo', tipo: 'sim', padrao: true, coluna: true, filtro: true },
    ],
    ordem: [{ ordem: 'asc' }, { nome: 'asc' }],
    rotulo: (r) => String(r.nome),
  },
  {
    id: 'conteudos',
    titulo: 'Conteúdos',
    um: 'conteúdo',
    novo: 'Novo conteúdo',
    sobre: 'Acervo de links, arquivos e pacotes SCORM usados nas aulas dos currículos.',
    modelo: 'conteudo',
    chaves: ['curso.curriculo'],
    campos: [
      { k: 'nome', rotulo: 'Nome', tipo: 'texto', req: true, coluna: true, largo: true },
      { k: 'url', rotulo: 'Endereço (URL)', tipo: 'url', largo: true },
      {
        k: 'tipo',
        rotulo: 'Tipo',
        tipo: 'escolha',
        fonte: { catalogo: 'tiposConteudo' },
        req: true,
        coluna: true,
        filtro: true,
      },
      { k: 'fonte', rotulo: 'Fonte', tipo: 'escolha', fonte: { catalogo: 'fontes' }, coluna: true, filtro: true },
      { k: 'idioma', rotulo: 'Idioma', tipo: 'escolha', fonte: { catalogo: 'languages' }, coluna: true },
      {
        k: 'momento',
        rotulo: 'Momento da aula',
        tipo: 'escolha',
        fonte: { lista: ['Pré-aula', 'Aula', 'Pós-aula'] },
        padrao: 'Aula',
        coluna: true,
        filtro: true,
      },
      { k: 'scorm', rotulo: 'Pacote SCORM', tipo: 'texto', ajuda: 'identificador do pacote, se houver' },
      { k: 'ativo', rotulo: 'Ativo', tipo: 'sim', padrao: true, coluna: true },
    ],
    ordem: [{ nome: 'asc' }],
    rotulo: (r) => String(r.nome),
  },
  {
    id: 'calendarios',
    titulo: 'Calendários',
    um: 'calendário',
    novo: 'Novo calendário',
    sobre: 'Períodos letivos em que os ciclos de aprendizagem geram aulas.',
    modelo: 'calendario',
    chaves: ['curso.curriculo'],
    campos: [
      { k: 'nome', rotulo: 'Nome', tipo: 'texto', req: true, coluna: true, largo: true },
      { k: 'inicio', rotulo: 'Início', tipo: 'data', req: true, coluna: true },
      { k: 'fim', rotulo: 'Fim', tipo: 'data', req: true, coluna: true },
      { k: 'ativo', rotulo: 'Ativo', tipo: 'sim', padrao: true, coluna: true },
    ],
    ordem: [{ inicio: 'desc' }],
    antes: intervalo,
    rotulo: (r) => String(r.nome),
  },
  {
    id: 'ciclos',
    titulo: 'Ciclos de aprendizagem',
    um: 'ciclo',
    novo: 'Novo ciclo',
    sobre: 'Como o currículo de um curso vira aulas num calendário: progressão e forma de gerar.',
    modelo: 'cicloAprendizagem',
    chaves: ['curso.curriculo'],
    campos: [
      { k: 'nome', rotulo: 'Nome', tipo: 'texto', req: true, coluna: true },
      {
        k: 'cursoId',
        rotulo: 'Curso',
        tipo: 'escolha',
        fonte: { tabela: 'cursos' },
        int: true,
        req: true,
        coluna: true,
        filtro: true,
      },
      {
        k: 'calendarioId',
        nulo: true,
        rotulo: 'Calendário',
        tipo: 'escolha',
        fonte: { tabela: 'calendarios' },
        int: true,
        coluna: true,
      },
      { k: 'progressao', rotulo: 'Progressão', tipo: 'escolha', fonte: { catalogo: 'progressoes' }, coluna: true },
      {
        k: 'tipoGeracao',
        rotulo: 'Tipo de geração',
        tipo: 'escolha',
        fonte: { catalogo: 'tiposGeracao' },
        coluna: true,
      },
      { k: 'nascimento', rotulo: 'Ciclo de entrada do aluno novo', tipo: 'sim', coluna: true },
      { k: 'ativo', rotulo: 'Ativo', tipo: 'sim', padrao: true, coluna: true },
    ],
    ordem: [{ cursoId: 'asc' }, { nome: 'asc' }],
    rotulo: (r) => String(r.nome),
  },

  {
    id: 'turmas',
    titulo: 'Turmas',
    um: 'turma',
    fem: true,
    novo: 'Nova turma',
    sobre:
      'Turmas dedicadas (grupo fechado com grade fixa). A grade diz os dias e a hora: Seg e Qua · 08:00. Turma inativa sai da agenda.',
    modelo: 'turma',
    chaves: ['catalogo'],
    campos: [
      {
        k: 'cursoId',
        rotulo: 'Curso',
        tipo: 'escolha',
        fonte: { tabela: 'cursosTurma' },
        int: true,
        req: true,
        coluna: true,
        filtro: true,
      },
      { k: 'nome', rotulo: 'Nome', tipo: 'texto', req: true, coluna: true },
      { k: 'grupo', rotulo: 'Grupo', tipo: 'texto', coluna: true },
      {
        k: 'professorId',
        nulo: true,
        rotulo: 'Professor titular',
        tipo: 'escolha',
        fonte: { tabela: 'professores' },
        coluna: true,
        filtro: true,
      },
      {
        k: 'grade',
        rotulo: 'Grade',
        tipo: 'texto',
        req: true,
        coluna: true,
        ajuda: 'dias e hora: Seg e Qua · 08:00',
      },
      { k: 'vagas', rotulo: 'Vagas', tipo: 'numero', req: true, padrao: 20, coluna: true },
      { k: 'sala', rotulo: 'Sala', tipo: 'escolha', fonte: { tabela: 'salas' }, coluna: true },
      {
        k: 'modalidade',
        rotulo: 'Modalidade',
        tipo: 'escolha',
        fonte: { lista: ['Online', 'Presencial'] },
        req: true,
        padrao: 'Presencial',
      },
      { k: 'periodo', rotulo: 'Período', tipo: 'texto', ajuda: 'ex.: 2º semestre de 2026' },
      { k: 'curriculo', rotulo: 'Currículo', tipo: 'texto' },
      { k: 'inicio', rotulo: 'Início', tipo: 'data' },
      { k: 'fim', rotulo: 'Fim', tipo: 'data' },
      {
        k: 'empresaId',
        nulo: true,
        rotulo: 'Empresa (turma dedicada)',
        tipo: 'escolha',
        fonte: { tabela: 'empresas' },
      },
      { k: 'ativa', rotulo: 'Ativa', tipo: 'sim', padrao: true, filtro: true },
    ],
    ordem: [{ cursoId: 'asc' }, { ordem: 'asc' }],
    extras: [{ k: 'ocupadas', rotulo: 'Ocupadas', valor: (r) => `${r.ocupadas ?? 0} de ${r.vagas}` }],
    antes: (x, _c, atual) => {
      const g = String(x.grade ?? '');
      if (!/^(Seg|Ter|Qua|Qui|Sex|Sáb)( e (Seg|Ter|Qua|Qui|Sex|Sáb))* · ([01]\d|2[0-3]):[0-5]\d$/.test(g))
        return 'Grade no formato Seg e Qua · 08:00 (dias de segunda a sábado).';
      if (x.sala == null) x.sala = '—';
      for (const k of ['grupo', 'periodo', 'curriculo']) if (x[k] == null) x[k] = '—';
      if (!atual) x.ocupadas = 0;
      return intervalo(x);
    },
    podeExcluir: async (r) => {
      const t = await prisma.turma.findUnique({ where: { id: Number(r.id) }, include: { curso: true } });
      if (!t) return null;
      const n = await prisma.matricula.count({
        where: { cursoId: t.cursoId, modulo: t.nome, desativadoEm: null },
      });
      return n
        ? `${n} ${n === 1 ? 'aluno está matriculado' : 'alunos estão matriculados'} nesta turma: inative em vez de excluir.`
        : null;
    },
    rotulo: (r) => String(r.nome),
  },

  /* ---------------- C · Atividades ---------------- */
  {
    id: 'ofertas',
    titulo: 'Ofertas',
    um: 'oferta',
    fem: true,
    novo: 'Nova oferta',
    sobre: 'Propostas comerciais: o que foi vendido, por quanto e para quem. A matrícula nasce de uma oferta.',
    modelo: 'oferta',
    chaves: ['acFunil', 'acRenovacao'],
    geraId: () => `of-${randomUUID().slice(0, 8)}`,
    campos: [
      { k: 'codigo', rotulo: 'Código', tipo: 'texto', req: true, coluna: true },
      { k: 'nome', rotulo: 'Nome da oferta', tipo: 'texto', req: true, coluna: true },
      { k: 'beneficiario', rotulo: 'Beneficiário', tipo: 'texto', req: true, coluna: true },
      { k: 'pessoaFisica', rotulo: 'Pessoa física', tipo: 'sim', padrao: true },
      {
        k: 'cursoId',
        rotulo: 'Curso',
        tipo: 'escolha',
        fonte: { tabela: 'cursos' },
        int: true,
        req: true,
        coluna: true,
        filtro: true,
      },
      { k: 'pacote', rotulo: 'Pacote de aulas', tipo: 'numero', req: true, coluna: true },
      { k: 'preco', rotulo: 'Preço', tipo: 'dinheiro', req: true, coluna: true },
      { k: 'parcelas', rotulo: 'Parcelas', tipo: 'numero', padrao: 1 },
      { nulo: true, k: 'duracao', rotulo: 'Duração (meses)', tipo: 'numero' },
      { nulo: true, k: 'cargaHoraria', rotulo: 'Carga horária (h)', tipo: 'numero' },
      { k: 'negocioId', rotulo: 'Negócio no CRM', tipo: 'texto' },
      {
        k: 'negocioStatus',
        rotulo: 'Status do negócio',
        tipo: 'escolha',
        fonte: { lista: ['Aberto', 'Ganho', 'Perdido'] },
        padrao: 'Aberto',
        coluna: true,
        filtro: true,
      },
      { k: 'negocioData', rotulo: 'Data do negócio', tipo: 'data' },
      {
        k: 'situacao',
        rotulo: 'Situação',
        tipo: 'escolha',
        fonte: { lista: ['Aberta', 'Vinculada', 'Descartada'] },
        padrao: 'Aberta',
        coluna: true,
        filtro: true,
      },
    ],
    ordem: [{ criadoEm: 'desc' }],
    include: { _count: { select: { matriculas: true } } },
    extras: [
      {
        k: 'vinculadas',
        rotulo: 'Matrículas',
        valor: (r) => String((r._count as { matriculas: number } | undefined)?.matriculas ?? 0),
      },
    ],
    rotulo: (r) => `${r.codigo} · ${r.nome}`,
  },
  {
    id: 'relatorios-matricula',
    titulo: 'Relatórios de matrícula',
    um: 'relatório',
    novo: 'Novo relatório',
    sobre: 'Relatório de acompanhamento de cada matrícula, para o aluno ou para o RH da empresa.',
    modelo: 'relatorioMatricula',
    chaves: ['aluno.cursos', 'acAlocacao'],
    pai: 'aluno',
    onde: (pai) => ({ matricula: { alunoId: Number(pai) } }),
    fixa: (c) => ({ por: c.autor }),
    campos: [
      {
        k: 'matriculaId',
        rotulo: 'Matrícula',
        tipo: 'escolha',
        fonte: { tabela: 'matriculasDoPai' },
        int: true,
        req: true,
        coluna: true,
        largo: true,
      },
      { k: 'periodo', rotulo: 'Período', tipo: 'mes', req: true, coluna: true, filtro: true },
      {
        k: 'status',
        rotulo: 'Situação',
        tipo: 'escolha',
        fonte: { lista: ['Rascunho', 'Enviado', 'Silenciado'] },
        padrao: 'Rascunho',
        coluna: true,
        filtro: true,
      },
      { k: 'texto', rotulo: 'Relatório', tipo: 'longo', req: true, largo: true },
    ],
    ordem: [{ periodo: 'desc' }, { id: 'desc' }],
    extras: [
      { k: 'por', rotulo: 'Por', valor: (r) => String(r.por ?? '') },
      { k: 'enviado', rotulo: 'Enviado em', valor: (r) => (r.enviadoEm ? fmt.dataHora(r.enviadoEm as Date) : '—') },
    ],
    antes: (x, _c, atual) => {
      if (x.status === 'Enviado' && atual?.status !== 'Enviado') x.enviadoEm = new Date();
      return null;
    },
    rotulo: (r) => `relatório de ${r.periodo}`,
  },
  {
    id: 'extratos',
    titulo: 'Extratos dos professores',
    um: 'extrato',
    novo: 'Abrir extrato',
    sobre: 'Extrato mensal de cada professor: fecha no fim do mês, recebe a nota fiscal e é pago.',
    modelo: 'extratoProfessor',
    chaves: ['acFechamento'],
    pai: 'professor',
    onde: (pai) => ({ professorId: pai }),
    fixa: (c) => (c.pai ? { professorId: c.pai } : {}),
    include: { professor: { select: { nome: true } }, lancamentos: { where: { cancelado: false } } },
    campos: [
      {
        k: 'professorId',
        rotulo: 'Professor',
        tipo: 'escolha',
        fonte: { tabela: 'professores' },
        req: true,
        coluna: true,
        filtro: true,
        somePai: true,
      },
      { k: 'mes', rotulo: 'Mês', tipo: 'mes', req: true, coluna: true, filtro: true },
      {
        k: 'estado',
        rotulo: 'Estado',
        tipo: 'escolha',
        fonte: { lista: ['Aberto', 'Fechado', 'Pago'] },
        padrao: 'Aberto',
        coluna: true,
        filtro: true,
      },
      { k: 'notaFiscal', rotulo: 'Nota fiscal', tipo: 'texto', coluna: true },
      { k: 'pagoEm', rotulo: 'Pago em', tipo: 'data', coluna: true },
      { k: 'observacoes', rotulo: 'Observações', tipo: 'longo', largo: true },
    ],
    ordem: [{ mes: 'desc' }, { professorId: 'asc' }],
    extras: [
      {
        k: 'acertos',
        rotulo: 'Acertos',
        valor: (r) => {
          const ls = (r.lancamentos as { valor: unknown; tipo: string }[] | undefined) ?? [];
          const s = ls.reduce((t, l) => t + (l.tipo === 'Débito' ? -1 : 1) * Number(l.valor), 0);
          return ls.length ? `R$ ${fmt.numero(s, 2)}` : '—';
        },
      },
    ],
    antes: (x, _c, atual) => {
      if (x.estado === 'Pago' && !x.pagoEm) return 'Informe a data do pagamento.';
      if (x.estado !== 'Aberto' && (!atual || atual.estado === 'Aberto')) x.fechadoEm = new Date();
      if (x.estado === 'Aberto') x.fechadoEm = null;
      return null;
    },
    rotulo: (r) => `${(r.professor as { nome: string } | undefined)?.nome ?? ''} · ${r.mes}`,
  },
  {
    id: 'lancamentos',
    titulo: 'Acertos do extrato',
    um: 'acerto',
    novo: 'Novo acerto',
    sobre: 'Bônus, descontos e reembolsos lançados à mão no extrato do mês.',
    modelo: 'lancamentoExtrato',
    chaves: ['acFechamento'],
    pai: 'professor',
    onde: (pai) => ({ extrato: { professorId: pai } }),
    fixa: (c) => ({ criadoPor: c.autor }),
    include: { extrato: { select: { mes: true, professor: { select: { nome: true } } } } },
    campos: [
      {
        k: 'extratoId',
        rotulo: 'Extrato',
        tipo: 'escolha',
        fonte: { tabela: 'extratosDoPai' },
        int: true,
        req: true,
        coluna: true,
        largo: true,
      },
      { k: 'descricao', rotulo: 'Descrição', tipo: 'texto', req: true, coluna: true, largo: true },
      {
        k: 'tipo',
        rotulo: 'Tipo',
        tipo: 'escolha',
        fonte: { lista: ['Crédito', 'Débito'] },
        padrao: 'Crédito',
        coluna: true,
        filtro: true,
      },
      { k: 'valor', rotulo: 'Valor', tipo: 'dinheiro', req: true, coluna: true },
      { k: 'cancelado', rotulo: 'Cancelado', tipo: 'sim', coluna: true },
    ],
    ordem: [{ criadoEm: 'desc' }],
    rotulo: (r) => String(r.descricao),
  },
];

export const cadastroDe = (id: string) => CADASTROS.find((c) => c.id === id) ?? null;

/* ---------------- opções das escolhas ---------------- */
export type Opcao = { v: string; l: string };

function dataDaChave(k: string) {
  const iso = k.split('|').find((p) => /^\d{4}-\d{2}-\d{2}$/.test(p));
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—';
}

async function aulasDoAluno(alunoId: number) {
  const b = await base();
  const a = b.alunos.find((x) => x.id === alunoId);
  if (!a) return [];
  return alHistorico(b, a, 90, agOfertas(b)).aulas.map((x) => ({
    v: x.k,
    l: `${x.data} · ${x.horario} · ${x.rotulo}${x.prof ? ` · ${x.prof}` : ''}`,
    curso: x.prod,
    prof: x.prof ?? '',
  }));
}

export async function opcoesDe(f: Fonte, pai: string | null): Promise<Opcao[]> {
  if ('lista' in f) return f.lista.map((x) => ({ v: x, l: x }));
  if ('catalogo' in f) {
    const cs = await prisma.catalogo.findMany({
      where: { tipo: f.catalogo, ativo: true },
      orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
    });
    return cs.map((c) => ({ v: c.nome, l: c.nome }));
  }
  const b = await base();
  switch (f.tabela) {
    case 'cursos':
      return b.cursos.map((c) => ({ v: String(c.id), l: c.name }));
    case 'professores':
      return b.professores.filter((p) => p.active).map((p) => ({ v: p.id, l: p.name }));
    case 'cursosTurma':
      return b.cursos.filter((c) => c.estrutura === 'turmas').map((c) => ({ v: String(c.id), l: c.name }));
    case 'salas':
      return b.salas.filter((s) => s.active).map((s) => ({ v: s.name, l: s.name }));
    case 'empresas':
      return (await prisma.empresa.findMany({ orderBy: { nome: 'asc' }, select: { id: true, nome: true } })).map(
        (e) => ({ v: e.id, l: e.nome }),
      );
    case 'colaboradores':
      return b.colaboradores.filter((c) => c.ativo).map((c) => ({ v: c.nome, l: c.nome }));
    case 'calendarios':
      return (await prisma.calendario.findMany({ orderBy: { inicio: 'desc' } })).map((c) => ({
        v: String(c.id),
        l: c.nome,
      }));
    case 'matriculas':
    case 'matriculasDoPai': {
      const alunos = f.tabela === 'matriculasDoPai' && pai ? b.alunos.filter((a) => a.id === Number(pai)) : b.alunos;
      return alunos.flatMap((a) =>
        alMat(a).map((m) => ({
          v: String(m.id),
          l: `${f.tabela === 'matriculas' || !pai ? `${a.name} · ` : ''}${m.curso}${m.modulo ? ` · ${m.modulo}` : ''}`,
        })),
      );
    }
    case 'aulasDoPai':
      return pai ? (await aulasDoAluno(Number(pai))).map(({ v, l }) => ({ v, l })) : [];
    case 'alocacoesDoPai': {
      /* o que o professor dá na grade: turmas, módulos e aulas individuais alocadas (agOfertas) */
      const p = b.professores.find((x) => x.id === pai);
      if (!p) return [];
      const DIA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
      const ls = agOfertas(b)
        .filter((o) => o.prof === p.name)
        .map((o) => {
          const quem = o.quem && o.quem !== o.mod ? ` · ${o.quem}` : '';
          const hora = `${String(Math.floor(o.hora)).padStart(2, '0')}:${o.hora % 1 ? '30' : '00'}`;
          return `${o.prod}${o.mod ? ` · ${o.mod}` : ''}${quem} · ${o.dias.map((x) => DIA[x]).join(' e ')} ${hora}`;
        });
      return [...new Set(ls)].map((l) => ({ v: l, l }));
    }
    case 'extratos':
    case 'extratosDoPai':
      return (
        await prisma.extratoProfessor.findMany({
          where: f.tabela === 'extratosDoPai' && pai ? { professorId: pai } : {},
          orderBy: [{ mes: 'desc' }],
          include: { professor: { select: { nome: true } } },
        })
      ).map((e) => ({ v: String(e.id), l: pai ? e.mes : `${e.professor.nome} · ${e.mes}` }));
  }
}

/* ---------------- conversões ---------------- */
/** valor do banco para o formulário (texto) */
export function paraForm(c: Campo, v: unknown): string | boolean {
  if (c.tipo === 'sim') return !!v;
  if (v == null) return '';
  if (v instanceof Date) return c.tipo === 'data' ? isoUTC(v) : fmt.iso(v);
  if (c.tipo === 'dinheiro') return Number(v).toFixed(2);
  return String(v);
}
/** valor do banco para a coluna da lista (formato pt-BR) */
export function paraLista(c: Campo, v: unknown, ops: Opcao[] | undefined): string {
  if (c.tipo === 'sim') return v ? 'Sim' : 'Não';
  if (v == null || v === '') return '—';
  if (v instanceof Date) return c.tipo === 'data' ? dataUTC(v) : fmt.data(v);
  if (c.tipo === 'dinheiro') return `R$ ${fmt.numero(Number(v), 2)}`;
  if (c.tipo === 'mes') {
    const [y, m] = String(v).split('-');
    return m ? `${m}/${y}` : String(v);
  }
  if (c.tipo === 'escolha' && ops) return ops.find((o) => o.v === String(v))?.l ?? String(v);
  return String(v);
}

const RE: Partial<Record<TipoCampo, [RegExp, string]>> = {
  data: [/^\d{4}-\d{2}-\d{2}$/, 'data inválida'],
  mes: [/^\d{4}-\d{2}$/, 'mês inválido (AAAA-MM)'],
  email: [/^[^@\s]+@[^@\s]+\.[^@\s]+$/, 'e-mail inválido'],
  cor: [/^#[0-9a-fA-F]{6}$/, 'cor inválida (#RRGGBB)'],
  uf: [/^[A-Z]{2}$/, 'UF com duas letras'],
  cep: [/^\d{5}-?\d{3}$/, 'CEP inválido'],
  url: [/^https?:\/\/\S+$/, 'endereço precisa começar com http:// ou https://'],
};

/** texto do formulário para o banco; devolve o erro em pt-BR */
export function doForm(c: Campo, bruto: unknown): { v: unknown } | { erro: string } {
  if (c.tipo === 'sim') return { v: bruto === true || bruto === 'true' };
  const s = String(bruto ?? '').trim();
  if (!s) return c.req ? { erro: `Preencha ${c.rotulo.toLowerCase()}.` } : { v: null };
  const re = RE[c.tipo];
  if (re && !re[0].test(c.tipo === 'uf' ? s.toUpperCase() : s)) return { erro: `${c.rotulo}: ${re[1]}.` };
  switch (c.tipo) {
    case 'numero': {
      const n = Number(s);
      return Number.isInteger(n) && n >= 0 ? { v: n } : { erro: `${c.rotulo}: use um número inteiro.` };
    }
    case 'dinheiro': {
      /* 1.500,50 (pt-BR) ou 1500.50: com vírgula, o ponto é separador de milhar */
      const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
      return Number.isFinite(n) && n >= 0 ? { v: n.toFixed(2) } : { erro: `${c.rotulo}: valor inválido.` };
    }
    case 'data':
      return { v: new Date(`${s}T00:00:00Z`) };
    case 'uf':
      return { v: s.toUpperCase() };
    case 'escolha':
      return { v: c.int ? Number(s) : s };
    default:
      return { v: s.slice(0, c.tipo === 'longo' ? 5000 : 300) };
  }
}
