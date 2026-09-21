/** Formatos devolvidos pela API (apps/api/src/routes). */

export type ItemNav = {
  key: string;
  label: string;
  icon: string;
  tela: string;
  folha: string;
  href: string;
  /** 'conta': o item mora no menu da conta (Configurações e Engenharia), não na lista lateral */
  lugar?: 'conta';
  /** caminhos de fichas que acendem o item sem serem abas */
  prefixos?: string[];
  secoes?: { etapa: string; telas: { id: string; tela: string; label: string; pai: string | null; href: string }[] }[];
};

export type Me = {
  usuario: {
    id: number;
    nome: string;
    email: string;
    papel: string;
    perfil: string;
    tipoPerfil: 'Admin' | 'Colaborador' | 'Prestador' | 'Aluno' | null;
    nivel: number;
    nivelNome: string;
    resumo: string;
    ehAluno: boolean;
    alunoId: number | null;
    temAluno: boolean;
    persona: string | null;
    agendaPresa: Record<string, string> | null;
    /** Acessar como: quem abriu a sessão e a tela de volta */
    como: { quem: string; volta: string } | null;
  };
  nav: ItemNav[];
  chaves: string[];
};

export type Persona = {
  letra: string;
  tipo: string;
  nome: string;
  hierarquia: string;
  cursos: string[];
  modulos: string[];
  login: string;
  senha: string;
};

export type Tom = 'red' | 'amber' | 'green' | 'blue' | 'purple' | 'gray';
export type Seg = { t: string; cor?: string; tom?: Tom };
export type Linha = {
  nome: Seg[];
  valor?: string;
  valorBadge?: { t: string; tom: Tom };
  href?: string;
  sub?: Seg[];
  barra?: { pct: number; cor: string };
};
export type CorpoBloco = {
  stats?: { valor: string; rotulo: string; tom?: Tom }[];
  kpis?: { valor: string; rotulo: string; tom?: Tom; ponto?: string }[];
  linhas?: Linha[];
  vazio?: string;
  pe?: string;
};
export type BlocoDef = {
  k: string;
  g: string;
  t: string;
  d: string;
  chave: string;
  semCard?: boolean;
  abrir?: { href: string; rotulo: string };
};
export type Dashboard = {
  grupos: string[];
  disponiveis: BlocoDef[];
  padrao: string[];
  marcados: string[];
  salvoEm: string | null;
  blocos: (BlocoDef & { corpo: CorpoBloco })[];
};

export type Alerta = { k: string; nivel: 'red' | 'amber'; n: number; t: string; d: string; href: string };

export type MinhaArea = {
  nome: string;
  matriculas: {
    id: number;
    curso: string;
    modulo: string | null;
    modalidade: string;
    usadas: number;
    total: number;
    cor: string;
  }[];
  restam: number;
  proximas: { quando: string; rotulo: string; cor: string; prof: string; sala: string }[];
  totalProximas: number;
};
