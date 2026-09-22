/**
 * Modelo de acesso do portal (acesso.js do artefato) — fonte única das permissões.
 * Quatro dimensões: TIPO DE PERFIL · CARGO · HIERARQUIA (o que faz) · SETOR (onde atua).
 * No cadastro: hierarquia + setores; em cada setor, Total (todas as telas) ou Restrito (recorte fixo do cargo).
 */

export const TIPOS_PERFIL = ['Admin', 'Colaborador', 'Prestador', 'Aluno'] as const;
export type TipoPerfil = (typeof TIPOS_PERFIL)[number];

export type Perfil = {
  id: number;
  perfil: TipoPerfil;
  cargo: string;
  idCargo: number | null;
  area: string;
  hierarquia: string;
  /** perfil inativo não aparece para novos usuários; quem já tem continua com ele */
  ativo?: boolean;
};

export const PERFIS: Perfil[] = [
  { id: 1, perfil: 'Admin', cargo: '', idCargo: null, area: '', hierarquia: 'Administrador' },
  {
    id: 2,
    perfil: 'Colaborador',
    cargo: 'Analista de Relacionamento',
    idCargo: 1,
    area: 'CX',
    hierarquia: 'Colaborador',
  },
  { id: 3, perfil: 'Colaborador', cargo: 'Analista marketing', idCargo: 2, area: 'Marketing', hierarquia: 'Editor' },
  {
    id: 4,
    perfil: 'Colaborador',
    cargo: 'Auxiliar Administrativo',
    idCargo: 3,
    area: 'Administrativo',
    hierarquia: 'Colaborador',
  },
  {
    id: 5,
    perfil: 'Colaborador',
    cargo: 'Consultor de Vendas',
    idCargo: 4,
    area: 'Comercial',
    hierarquia: 'Colaborador',
  },
  { id: 6, perfil: 'Colaborador', cargo: 'Gerente comercial', idCargo: 5, area: 'Comercial', hierarquia: 'Gestor' },
  {
    id: 7,
    perfil: 'Colaborador',
    cargo: 'Coordenador Pedagógico',
    idCargo: 6,
    area: 'Pedagógico',
    hierarquia: 'Gestor',
  },
  {
    id: 8,
    perfil: 'Colaborador',
    cargo: 'Plantonista pedagógico',
    idCargo: 7,
    area: 'Pedagógico',
    hierarquia: 'Colaborador',
  },
  { id: 9, perfil: 'Colaborador', cargo: 'Supervisor acadêmico', idCargo: 8, area: 'Acadêmico', hierarquia: 'Gestor' },
  {
    id: 10,
    perfil: 'Colaborador',
    cargo: 'Diretoria',
    idCargo: 9,
    area: 'Administrativo',
    hierarquia: 'Administrador',
  },
  {
    id: 11,
    perfil: 'Colaborador',
    cargo: 'Analista administrativo',
    idCargo: 10,
    area: 'Financeiro/Fiscal',
    hierarquia: 'Colaborador',
  },
  {
    id: 12,
    perfil: 'Colaborador',
    cargo: 'Especialista financeiro',
    idCargo: 11,
    area: 'Financeiro/Fiscal',
    hierarquia: 'Editor',
  },
  { id: 13, perfil: 'Prestador', cargo: 'Professor', idCargo: 12, area: 'Pedagógico', hierarquia: 'Colaborador' },
  {
    id: 14,
    perfil: 'Colaborador',
    cargo: 'Head de operações',
    idCargo: 13,
    area: 'Administrativo',
    hierarquia: 'Gestor',
  },
  { id: 16, perfil: 'Colaborador', cargo: 'Gerente B2B', idCargo: 14, area: 'Comercial', hierarquia: 'Gestor' },
  { id: 15, perfil: 'Aluno', cargo: '', idCargo: null, area: '', hierarquia: 'Visualizador' },
];

/** Menus por tipo de perfil (tabela Menu da planilha). */
export const MENU_PERFIS: Record<string, readonly TipoPerfil[]> = {
  inicio: TIPOS_PERFIL,
  agenda: TIPOS_PERFIL,
  cursos: ['Admin', 'Colaborador'],
  alunos: ['Admin', 'Colaborador', 'Prestador'],
  empresas: ['Admin', 'Colaborador'],
  professores: ['Admin', 'Colaborador'],
  acoes: ['Admin', 'Colaborador'],
  relatorios: ['Admin', 'Colaborador'],
  auditoria: ['Admin'],
  config: ['Admin'],
  /* GitHub e IA (menu próprio, 17/09/2026): ferramentas de engenharia, só do tipo Admin */
  engenharia: ['Admin'],
};

/** Hierarquia: 1 = pode · 0 = não pode · null = não se aplica. */
export const ACOES = [
  'Visualizar',
  'Criar',
  'Editar',
  'Editar próprios',
  'Inativar',
  'Excluir',
  'Usuários',
  'Configurações',
];
export type Nivel = { n: number; nome: string; acoes: (number | null)[]; nota?: string };
export const NIVEIS: Nivel[] = [
  { n: 1, nome: 'Administrador', acoes: [1, 1, 1, null, 1, 1, 1, 1] },
  { n: 2, nome: 'Gestor', acoes: [1, 1, 1, null, 1, 0, 0, 0] },
  { n: 3, nome: 'Editor', acoes: [1, 1, 1, null, 0, 0, 0, 0] },
  { n: 4, nome: 'Colaborador', acoes: [1, 1, 0, 1, 0, 0, 0, 0] },
  {
    n: 5,
    nome: 'Visualizador',
    acoes: [1, 0, 0, 0, 0, 0, 0, 0],
    nota: 'somente o próprio escopo: seus dados, aulas, agenda e progresso',
  },
];
export const nivelDe = (n: number) => NIVEIS.find((v) => v.n === +n);

export const AREAS = [
  { id: 'adm', nome: 'Administrativo', desc: 'Gestão administrativa e suporte à operação' },
  { id: 'com', nome: 'Comercial', desc: 'Captação, negociação e vendas' },
  { id: 'ped', nome: 'Pedagógico', desc: 'Gestão de professores e qualidade pedagógica' },
  { id: 'aca', nome: 'Acadêmico', desc: 'Gestão de alunos, cursos e operação acadêmica' },
  { id: 'cx', nome: 'CX', desc: 'Experiência e relacionamento com o aluno' },
  { id: 'fin', nome: 'Financeiro/Fiscal', desc: 'Gestão financeira, faturamento, pagamentos e obrigações fiscais' },
  { id: 'mkt', nome: 'Marketing', desc: 'Aquisição, comunicação, marca e performance de marketing' },
] as const;
export type AreaId = (typeof AREAS)[number]['id'];

const REL_ALUNOS = ['relatorio', 'rpPresenca', 'rpPacote'];
const REL_EQUIPE = ['rpProfessores', 'rpAvaliacao', 'rpAulas', 'rpOcupacao'];
const CURSO_TODAS = ['curso.geral', 'curso.regras', 'curso.curriculo', 'curso.grade'];

/** O que cada setor enxerga com acesso Total. */
export const AREA_TELAS: Record<AreaId, string[]> = {
  adm: [
    'agenda',
    'curso.geral',
    'curso.grade',
    'alunos',
    'aluno.perfil',
    'aluno.cursos',
    'aluno.financeiro',
    'aluno.disponibilidade',
    'aluno.agendamentos',
    'professores',
    'prof.perfil',
    'prof.disponibilidade',
    'prof.agenda',
    'acAlocacao',
    'acAdmissao',
    ...REL_ALUNOS,
  ],
  com: [
    'agenda',
    'acFunil',
    'acRenovacao',
    'curso.geral',
    'curso.regras',
    'curso.grade',
    'alunos',
    'aluno.perfil',
    'aluno.cursos',
    'aluno.financeiro',
    'aluno.disponibilidade',
    'aluno.agendamentos',
    ...REL_ALUNOS,
    'rpOcupacao',
    'empresas',
  ],
  ped: [
    'agenda',
    'acAlocacao',
    'acSubstituicao',
    ...CURSO_TODAS,
    'professores',
    'prof.perfil',
    'prof.log',
    'prof.cursos',
    'prof.disponibilidade',
    'prof.agenda',
    'prof.feedbacks',
    'relatorio',
    ...REL_EQUIPE,
  ],
  aca: [
    'agenda',
    'acAlocacao',
    'acNivel',
    'acReposicao',
    ...CURSO_TODAS,
    'alunos',
    'aluno.perfil',
    'aluno.log',
    'aluno.cursos',
    'aluno.alocacao',
    'aluno.disponibilidade',
    'aluno.agendamentos',
    'aluno.feedbacks',
    'professores',
    'prof.perfil',
    'prof.agenda',
    ...REL_ALUNOS,
    'rpAulas',
    'rpOcupacao',
  ],
  cx: [
    'agenda',
    'acAtendimentos',
    'acRetencao',
    'curso.geral',
    'curso.regras',
    'alunos',
    'aluno.perfil',
    'aluno.log',
    'aluno.cursos',
    'aluno.financeiro',
    'aluno.alocacao',
    'aluno.disponibilidade',
    'aluno.agendamentos',
    'aluno.feedbacks',
    ...REL_ALUNOS,
  ],
  fin: [
    'alunos',
    'aluno.perfil',
    'aluno.cursos',
    'aluno.financeiro',
    'professores',
    'prof.perfil',
    'prof.agenda',
    'acFechamento',
    'acCobranca',
    'relatorio',
    'rpPacote',
    'rpProfessores',
    'rpFinanceiro',
    'empresas',
  ],
  mkt: ['acFunil', 'acCampanhas', 'curso.geral', 'curso.grade', 'alunos', 'aluno.perfil', ...REL_ALUNOS, 'rpOcupacao'],
};

export type AcessoArea = { acesso: 'total' | 'restrito' | 'proprio'; rotulo: string };
export type Areas = Partial<Record<AreaId, AcessoArea>>;
const T = (r?: string): AcessoArea => ({ acesso: 'total', rotulo: r || 'Total' });
const R = (r: string): AcessoArea => ({ acesso: 'restrito', rotulo: r });
const PROPRIO = (r: string): AcessoArea => ({ acesso: 'proprio', rotulo: r });

/** Hierarquia sugerida e acesso por setor de cada perfil (chave = ID_perfil). */
export const MATRIZ: Record<number, { nivel: number; areas: Areas }> = {
  1: { nivel: 1, areas: { adm: T(), com: T(), ped: T(), aca: T(), cx: T(), fin: T(), mkt: T() } },
  2: { nivel: 4, areas: { cx: T(), aca: R('Dados necessários do aluno') } },
  3: { nivel: 3, areas: { mkt: T() } },
  4: { nivel: 4, areas: { adm: T(), cx: R('Necessário') } },
  5: { nivel: 4, areas: { com: T('Operacional') } },
  6: { nivel: 2, areas: { com: T() } },
  7: { nivel: 2, areas: { ped: T(), aca: R('Conforme necessidade') } },
  8: { nivel: 4, areas: { ped: R('Plantão'), aca: R('Operacional') } },
  9: { nivel: 2, areas: { aca: T(), ped: R('Integração necessária') } },
  10: { nivel: 1, areas: { adm: T(), com: T(), ped: T(), aca: T(), cx: T(), fin: T(), mkt: T() } },
  11: { nivel: 4, areas: { fin: T() } },
  12: { nivel: 3, areas: { fin: T() } },
  13: { nivel: 4, areas: { ped: R('Operacional'), aca: R('Dados necessários do aluno') } },
  14: { nivel: 2, areas: { adm: T(), aca: T(), cx: R('Necessário') } },
  16: { nivel: 2, areas: { com: T(), aca: R('Dados necessários do aluno') } },
  15: {
    nivel: 5,
    areas: { aca: PROPRIO('Próprios dados'), cx: PROPRIO('Próprios dados'), ped: PROPRIO('Próprios conteúdos') },
  },
};

type Recorte = { desc: string; chaves: string[] };
/** Recorte fixo de cada acesso Restrito (subconjunto do Total do setor). */
export const RECORTES: Record<AreaId, Record<string, Recorte>> = {
  adm: {
    padrao: {
      desc: 'Agenda, perfil e agendamentos de alunos e professores',
      chaves: ['agenda', 'alunos', 'aluno.perfil', 'aluno.agendamentos', 'professores', 'prof.perfil', 'prof.agenda'],
    },
  },
  com: {
    padrao: {
      desc: 'Regras dos cursos, perfil e matrículas do aluno',
      chaves: ['agenda', 'curso.regras', 'alunos', 'aluno.perfil', 'aluno.cursos'],
    },
  },
  ped: {
    Operacional: {
      desc: 'Agenda, cursos e currículo, perfil, disponibilidade, agenda e feedbacks do professor',
      chaves: [
        'agenda',
        'curso.geral',
        'curso.curriculo',
        'curso.grade',
        'professores',
        'prof.perfil',
        'prof.disponibilidade',
        'prof.agenda',
        'prof.feedbacks',
      ],
    },
    Plantão: {
      desc: 'Agenda, alocação, perfil, disponibilidade e agenda dos professores',
      chaves: [
        'agenda',
        'acAlocacao',
        'acSubstituicao',
        'professores',
        'prof.perfil',
        'prof.disponibilidade',
        'prof.agenda',
      ],
    },
    'Integração necessária': {
      desc: 'Agenda, habilitação, disponibilidade e aulas dos professores',
      chaves: [
        'agenda',
        'professores',
        'prof.perfil',
        'prof.cursos',
        'prof.disponibilidade',
        'prof.agenda',
        'rpProfessores',
      ],
    },
    padrao: { desc: 'Agenda e perfil dos professores', chaves: ['agenda', 'professores', 'prof.perfil'] },
  },
  aca: {
    'Conforme necessidade': {
      desc: 'Cursos (regras, currículo e grade), perfil, matrículas e agendamentos do aluno, aulas por curso',
      chaves: [...CURSO_TODAS, 'alunos', 'aluno.perfil', 'aluno.cursos', 'aluno.agendamentos', 'rpAulas'],
    },
    Operacional: {
      desc: 'Agenda, alocação, perfil, matrículas, disponibilidade e agendamentos do aluno, e a presença',
      chaves: [
        'agenda',
        'acAlocacao',
        'alunos',
        'aluno.perfil',
        'aluno.cursos',
        'aluno.alocacao',
        'aluno.disponibilidade',
        'aluno.agendamentos',
        'professores',
        'prof.perfil',
        'prof.agenda',
        'rpPresenca',
      ],
    },
    'Dados necessários do aluno': {
      desc: 'Agenda, perfil, matrículas e agendamentos do aluno, e a presença',
      chaves: ['agenda', 'alunos', 'aluno.perfil', 'aluno.cursos', 'aluno.agendamentos', 'rpPresenca'],
    },
    padrao: { desc: 'Agenda e perfil do aluno', chaves: ['agenda', 'alunos', 'aluno.perfil'] },
  },
  cx: {
    Necessário: {
      desc: 'Atendimento do aluno: perfil, matrículas, agendamentos, feedbacks e qualidade, presença, pacote e atendimentos',
      chaves: [
        'alunos',
        'aluno.perfil',
        'aluno.cursos',
        'aluno.agendamentos',
        'aluno.feedbacks',
        'rpPresenca',
        'rpPacote',
        'acAtendimentos',
      ],
    },
    padrao: { desc: 'Perfil e agendamentos do aluno', chaves: ['alunos', 'aluno.perfil', 'aluno.agendamentos'] },
  },
  fin: {
    padrao: {
      desc: 'Perfil e matrículas do aluno e consumo do pacote',
      chaves: ['alunos', 'aluno.perfil', 'aluno.cursos', 'rpPacote'],
    },
  },
  mkt: {
    padrao: {
      desc: 'Funil de vendas e relatórios de alunos',
      chaves: ['acFunil', 'relatorio', 'rpPresenca', 'rpPacote'],
    },
  },
};

for (const [ar, rs] of Object.entries(RECORTES)) {
  for (const [rot, r] of Object.entries(rs)) {
    for (const c of r.chaves) {
      if (!AREA_TELAS[ar as AreaId].includes(c))
        throw new Error(`recorte ${ar}/${rot} libera ${c}, que o setor não tem`);
    }
  }
}

export type UsuarioAcesso = { nivel: number; areas: Areas; tipoPerfil?: TipoPerfil | null };
export type TelaAcesso = { id?: string; m?: string; chave?: string | null };

/** Setores que liberam a tela. Configurações não é de setor nenhum. */
export function areasDaTela(t: TelaAcesso): AreaId[] {
  if (t.m === 'config' || !t.chave) return [];
  const ids = Object.keys(AREA_TELAS) as AreaId[];
  if (t.chave === 'catalogo') return ids.filter((a) => AREA_TELAS[a].some((c) => c.startsWith('curso.')));
  return ids.filter((a) => AREA_TELAS[a].includes(t.chave!));
}

/** A tela abre para o usuário? Basta um setor liberar. */
export function telaPermitida(u: UsuarioAcesso | null | undefined, t: TelaAcesso): boolean {
  if (!u?.nivel) return false;
  if (t.id === 'inicio' || t.id === 'ajuda') return true;
  if (u.tipoPerfil) {
    const c = String(t.chave || '');
    const menu =
      t.m && t.m !== 'fora'
        ? t.m
        : c === 'cfg'
          ? 'config'
          : c === 'auditoria'
            ? 'auditoria'
            : c.startsWith('curso.')
              ? 'cursos'
              : c.startsWith('aluno.')
                ? 'alunos'
                : c.startsWith('prof.')
                  ? 'professores'
                  : '';
    if (menu && MENU_PERFIS[menu] && !MENU_PERFIS[menu].includes(u.tipoPerfil)) return false;
    /* a aba Acesso das fichas (gestão de acessos dentro de cada pessoa) é só do tipo Admin */
    if (c.endsWith('.acesso')) return u.tipoPerfil === 'Admin';
    if (menu === 'config' || menu === 'engenharia' || c === 'cfg' || c === 'auditoria' || t.m === 'fora' || !c)
      return u.tipoPerfil === 'Admin';
    if (c === 'agenda') return true;
  }
  if (t.m === 'config' || t.m === 'fora' || !t.chave) return u.nivel === 1;
  if (t.chave === 'auditoria') return u.nivel === 1;
  if (String(t.chave).endsWith('.acesso')) return u.nivel === 1;
  if (t.chave === 'cfg') return u.nivel === 1;
  if (t.chave === 'catalogo') {
    return ['geral', 'regras', 'curriculo', 'grade'].some((k) => telaPermitida(u, { ...t, chave: `curso.${k}` }));
  }
  return (Object.keys(AREA_TELAS) as AreaId[]).some((area) => {
    const a = u.areas?.[area];
    if (!a || !AREA_TELAS[area].includes(t.chave!)) return false;
    if (a.acesso === 'total') return true;
    if (a.acesso !== 'restrito') return false;
    const rs = RECORTES[area] || {};
    const rec = rs[a.rotulo] || rs.padrao;
    return !!rec && rec.chaves.includes(t.chave!);
  });
}

export const perfilNome = (p?: Perfil | null) => (p ? (p.cargo ? `${p.perfil} · ${p.cargo}` : p.perfil) : '—');

/** "Gestor · Pedagógico, Acadêmico (restrito)" */
export function acessoResumo(u: UsuarioAcesso, p?: Perfil | null): string {
  if (p && p.perfil === 'Aluno') return 'Visualizador · próprios dados';
  const ar = AREAS.filter((a) => u.areas[a.id] && ['total', 'restrito'].includes(u.areas[a.id]!.acesso)).map(
    (a) => a.nome + (u.areas[a.id]!.acesso === 'restrito' ? ' (restrito)' : ''),
  );
  if (u.nivel === 1 && (!p || p.perfil === 'Admin')) ar.push('Configurações');
  return `${nivelDe(u.nivel)?.nome || '—'} · ${ar.join(', ') || 'sem setores'}`;
}

/** coluna de ACOES que decide cada botão */
const COL_ACAO = { criar: 1, editar: 2, inativar: 4, excluir: 5 } as const;
/** O que cada hierarquia pode nos botões, pela tabela de hierarquias (editável em Configurações › Perfis). */
export function podeAcao(nivel: number, acao: keyof typeof COL_ACAO): boolean {
  if (nivel === 1) return true;
  return nivelDe(nivel)?.acoes[COL_ACAO[acao]] === 1;
}

/* ---------------- modelo editável ----------------
 * PERFIS, MATRIZ e NIVEIS acima são o padrão do portal. O Admin edita o modelo em Configurações › Perfis;
 * a versão salva (Configuracao "acessoModelo") substitui o conteúdo destas estruturas no lugar,
 * então quem já as importa passa a ler o modelo salvo sem mudar nada.
 */
export type ModeloAcesso = {
  perfis: Perfil[];
  matriz: Record<number, { nivel: number; areas: Areas }>;
  niveis: Nivel[];
};
const clona = <T>(x: T): T => JSON.parse(JSON.stringify(x));
export const MODELO_PADRAO: ModeloAcesso = clona({ perfis: PERFIS, matriz: MATRIZ, niveis: NIVEIS });
/** perfis que o código usa pelo ID (Admin, Aluno, Professor, gerentes de conta e consultores): não se excluem */
export const PERFIS_SISTEMA: Record<number, string> = {
  1: 'administrador do sistema',
  15: 'acesso do aluno',
  13: 'agenda presa do professor',
  5: 'consultor no funil de vendas',
  6: 'gerente de conta e consultor',
  16: 'gerente de conta das empresas',
};
export function aplicaModelo(m: ModeloAcesso) {
  const x = clona(m);
  PERFIS.splice(0, PERFIS.length, ...x.perfis);
  NIVEIS.splice(0, NIVEIS.length, ...x.niveis);
  for (const k of Object.keys(MATRIZ)) delete MATRIZ[Number(k)];
  Object.assign(MATRIZ, x.matriz);
}
export const modeloAtual = (): ModeloAcesso => clona({ perfis: PERFIS, matriz: MATRIZ, niveis: NIVEIS });
