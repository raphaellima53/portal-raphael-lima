/**
 * Endereços do front (apps/web). No portal eram rotas de hash (go('curso:0:grade')); aqui são caminhos.
 * A API devolve os links prontos para que Dashboard, alertas e menu apontem para o mesmo lugar.
 */
const SECAO: Record<string, string> = {};
const MENU_DAS_TELAS: Record<string, string[]> = {
  acoes: [
    'atividades',
    'acAlocacao',
    'acSubstituicao',
    'acNivel',
    'acReposicao',
    'acAdmissao',
    'acFechamento',
    'acCobranca',
    'acFunil',
    'acRenovacao',
    'acCampanhas',
    'acAtendimentos',
    'acRetencao',
    'ofertas',
    'extratos',
    'lancamentos',
    'relatoriosMatricula',
  ],
  relatorios: [
    'relatorio',
    'rpPresenca',
    'rpPacote',
    'rpProfessores',
    'rpAvaliacao',
    'rpAulas',
    'rpOcupacao',
    'rpFinanceiro',
  ],
  configuracoes: [
    'usuarios',
    'perfis',
    'sessoes',
    'colaboradores',
    'prestadores',
    'departamentos',
    'cargos',
    'politicas',
    'dias',
    'feriados',
    'salas',
    'curriculo',
    'tiposcurso',
    'tiposala',
    'idiomas',
    'skills',
    'generos',
    'responsaveis',
    'categoriasservico',
    'tiposconteudo',
    'fontes',
    'categoriascurriculo',
    'progressoes',
    'tiposgeracao',
    'visibilidades',
    'alertas',
    'admPainel',
    'execucoes',
    'docPersonas',
    'docTelas',
    'docDesign',
  ],
  engenharia: ['engRepos', 'engIA'],
  /* Produtos e serviços (menu de 21/09/2026): serviços ainda sem cadastro */
  produtos: ['turmas', 'servicos', 'conteudos', 'ciclos', 'calendarios'],
};
for (const [menu, telas] of Object.entries(MENU_DAS_TELAS)) for (const t of telas) SECAO[t] = menu;

const DIRETAS: Record<string, string> = {
  dashboard: '/inicio',
  agenda: '/agenda',
  cursos: '/cursos',
  pedAlunos: '/alunos',
  empresas: '/empresas',
  /* Equipe: professores e colaboradores numa lista só (21/09/2026); a ficha continua em /professores/:id */
  professores: '/equipe',
  auditoria: '/auditoria',
  /* a Minha área virou o Meu perfil (21/09/2026) */
  alunoInicio: '/meu-perfil',
  alunoAgenda: '/minha-agenda',
  alunoHistorico: '/historico-de-aulas',
  centralAjuda: '/central-de-ajuda',
  meuPerfil: '/meu-perfil',
};

type Params = Record<string, string | number | null | undefined>;
const qs = (p?: Params) => {
  const e = Object.entries(p ?? {}).filter(([, v]) => v != null && v !== '');
  return e.length ? `?${new URLSearchParams(e.map(([k, v]): [string, string] => [k, String(v)])).toString()}` : '';
};

/** caminho da tela (as de seção ficam em /<menu>/<tela>) */
export function hrefTela(tela: string, p?: Params): string {
  if (DIRETAS[tela]) return DIRETAS[tela] + qs(p);
  if (SECAO[tela]) return `/${SECAO[tela]}/${tela}${qs(p)}`;
  return `/inicio${qs(p)}`;
}

export const hrefCurso = (id: number, aba = 'geral') => `/cursos/${id}/${aba}`;
export const hrefAluno = (id: number | string, aba = 'perfil', p?: Params) => `/alunos/${id}/${aba}${qs(p)}`;
export const hrefProf = (id: string, aba = 'perfil', p?: Params) => `/professores/${id}/${aba}${qs(p)}`;
export const hrefAgenda = (p?: Params) => `/agenda${qs(p)}`;
