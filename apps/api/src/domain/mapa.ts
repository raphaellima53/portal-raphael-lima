/**
 * Mapa de ações (mapa.js do artefato): menus, seções, telas e a chave de acesso de cada uma.
 * O menu lateral, as abas de seção e a checagem de acesso das rotas saem daqui.
 * Nó: {t, tela, aba?, chave?} folha · {t, c:[…]} grupo.
 */
import { type TelaAcesso, telaPermitida, type UsuarioAcesso } from './acesso.ts';
import { hrefTela } from './rotas.ts';

type No = { t: string; tela?: string; aba?: string; chave?: string; c?: No[]; id?: string };
type Menu = { id: string; nome: string; nav: 'direto' | 'secoes'; icon: string; etapas: No[] };

export const MENUS: Menu[] = [
  {
    id: 'agenda',
    nome: 'Agenda',
    nav: 'direto',
    icon: 'cal',
    etapas: [{ t: 'Agenda e grade', c: [{ t: 'Agenda e grade', tela: 'agenda', chave: 'agenda' }] }],
  },
  {
    id: 'cursos',
    nome: 'Cursos',
    nav: 'direto',
    icon: 'bookOpen',
    etapas: [
      { t: 'Catálogo', c: [{ t: 'Catálogo', tela: 'cursos', chave: 'catalogo' }] },
      {
        t: 'Cada curso',
        c: [
          { t: 'Visão geral', tela: 'curso', aba: 'geral' },
          { t: 'Regras', tela: 'curso', aba: 'regras' },
          { t: 'Currículo', tela: 'curso', aba: 'curriculo' },
          { t: 'Grade semanal', tela: 'curso', aba: 'grade' },
        ],
      },
    ],
  },
  {
    id: 'alunos',
    nome: 'Alunos',
    nav: 'direto',
    icon: 'user',
    etapas: [
      { t: 'Lista de alunos', c: [{ t: 'Lista de alunos', tela: 'pedAlunos', chave: 'alunos' }] },
      {
        t: 'Ficha do aluno',
        c: [
          {
            t: 'Dados',
            c: [
              { t: 'Perfil', tela: 'alunoFicha', aba: 'perfil' },
              { t: 'Log', tela: 'alunoFicha', aba: 'log' },
            ],
          },
          {
            t: 'Matrícula',
            c: [
              { t: 'Cursos', tela: 'alunoFicha', aba: 'cursos' },
              { t: 'Disponibilidade', tela: 'alunoFicha', aba: 'disponibilidade' },
            ],
          },
          /* Financeiro na ficha do aluno (21/09/2026): as parcelas das matrículas */
          { t: 'Financeiro', c: [{ t: 'Parcelas', tela: 'alunoFicha', aba: 'financeiro' }] },
          {
            t: 'Histórico',
            c: [
              { t: 'Agendamentos', tela: 'alunoFicha', aba: 'agendamentos' },
              { t: 'Feedbacks', tela: 'alunoFicha', aba: 'feedbacks' },
            ],
          },
          /* a gestão de acessos mora dentro de cada pessoa (21/09/2026) */
          { t: 'Acesso', c: [{ t: 'Conta de acesso', tela: 'alunoFicha', aba: 'acesso' }] },
        ],
      },
    ],
  },
  {
    id: 'empresas',
    nome: 'Empresas',
    nav: 'direto',
    icon: 'building',
    etapas: [{ t: 'Empresas', c: [{ t: 'Empresas', tela: 'empresas', chave: 'empresas' }] }],
  },
  {
    id: 'professores',
    nome: 'Professores',
    nav: 'direto',
    icon: 'cap',
    etapas: [
      { t: 'Lista de professores', c: [{ t: 'Lista de professores', tela: 'professores', chave: 'professores' }] },
      {
        t: 'Ficha do professor',
        c: [
          {
            t: 'Dados',
            c: [
              { t: 'Perfil', tela: 'professorFicha', aba: 'perfil' },
              { t: 'Log', tela: 'professorFicha', aba: 'log' },
            ],
          },
          {
            t: 'Habilitação',
            c: [
              { t: 'Cursos', tela: 'professorFicha', aba: 'cursos' },
              { t: 'Disponibilidade', tela: 'professorFicha', aba: 'disponibilidade' },
            ],
          },
          {
            t: 'Histórico',
            c: [
              { t: 'Agenda', tela: 'professorFicha', aba: 'agenda' },
              { t: 'Feedbacks', tela: 'professorFicha', aba: 'feedbacks' },
            ],
          },
          { t: 'Acesso', c: [{ t: 'Conta de acesso', tela: 'professorFicha', aba: 'acesso' }] },
        ],
      },
    ],
  },
  {
    id: 'acoes',
    /* Ações virou Atividades (21/09/2026) */
    nome: 'Atividades',
    nav: 'secoes',
    icon: 'zap',
    etapas: [
      {
        t: 'Pedagógico',
        c: [
          { t: 'Alocação', tela: 'acAlocacao' },
          { t: 'Substituição de professor', tela: 'acSubstituicao' },
        ],
      },
      {
        t: 'Acadêmico',
        c: [
          { t: 'Mudança de nível', tela: 'acNivel' },
          { t: 'Reposição de aula', tela: 'acReposicao' },
        ],
      },
      { t: 'Administrativo', c: [{ t: 'Admissão de professor', tela: 'acAdmissao' }] },
      {
        t: 'Financeiro/Fiscal',
        c: [
          { t: 'Fechamento', tela: 'acFechamento' },
          { t: 'Cobrança', tela: 'acCobranca' },
        ],
      },
      {
        t: 'Comercial',
        c: [
          { t: 'Funil de vendas', tela: 'acFunil' },
          { t: 'Renovação de contrato', tela: 'acRenovacao' },
        ],
      },
      { t: 'Marketing', c: [{ t: 'Campanhas', tela: 'acCampanhas' }] },
      {
        t: 'CX',
        c: [
          { t: 'Atendimentos', tela: 'acAtendimentos' },
          { t: 'Cancelamento e retenção', tela: 'acRetencao' },
        ],
      },
    ],
  },
  {
    id: 'auditoria',
    nome: 'Auditoria',
    nav: 'direto',
    icon: 'shield',
    etapas: [
      { t: 'Histórico de alterações', c: [{ t: 'Histórico de alterações', tela: 'auditoria', chave: 'auditoria' }] },
    ],
  },
  {
    id: 'relatorios',
    nome: 'Relatórios',
    nav: 'secoes',
    icon: 'report',
    etapas: [
      { t: 'Seletores', c: [{ t: 'Relatório por seletores', tela: 'relatorio' }] },
      {
        t: 'Alunos',
        c: [
          { t: 'Presença por aluno', tela: 'rpPresenca' },
          { t: 'Consumo do pacote', tela: 'rpPacote' },
        ],
      },
      {
        t: 'Professores',
        c: [
          { t: 'Aulas por professor', tela: 'rpProfessores' },
          { t: 'Avaliação dos alunos', tela: 'rpAvaliacao' },
        ],
      },
      {
        t: 'Cursos',
        c: [
          { t: 'Aulas por curso', tela: 'rpAulas' },
          { t: 'Ocupação da grade', tela: 'rpOcupacao' },
        ],
      },
      { t: 'Financeiro', c: [{ t: 'Dashboard financeiro', tela: 'rpFinanceiro' }] },
    ],
  },
  {
    id: 'config',
    nome: 'Configurações',
    nav: 'secoes',
    icon: 'sliders',
    etapas: [
      {
        t: 'Pessoas e acessos',
        c: [
          { t: 'Usuários', tela: 'usuarios' },
          { t: 'Perfis e hierarquias', tela: 'perfis' },
          { t: 'Sessões e acessos', tela: 'sessoes' },
          {
            t: 'Pessoas e cargos',
            c: [
              { t: 'Colaboradores', tela: 'colaboradores' },
              { t: 'Prestadores', tela: 'prestadores' },
              { t: 'Departamentos', tela: 'departamentos' },
              { t: 'Cargos', tela: 'cargos' },
            ],
          },
        ],
      },
      {
        t: 'Regras de negócio',
        c: [
          { t: 'Condições e vigência', tela: 'politicas' },
          {
            t: 'Calendário',
            c: [
              { t: 'Dias e horários', tela: 'dias' },
              { t: 'Feriados e recessos', tela: 'feriados' },
            ],
          },
          { t: 'Salas', tela: 'salas' },
          { t: 'Currículos e acervos', tela: 'curriculo' },
          {
            t: 'Catálogos',
            c: [
              { t: 'Tipos de curso', tela: 'tiposcurso' },
              { t: 'Tipos de sala', tela: 'tiposala' },
              { t: 'Idiomas dos cursos', tela: 'idiomas' },
              { t: 'Skills dos professores', tela: 'skills' },
              { t: 'Gêneros', tela: 'generos' },
              { t: 'Responsáveis financeiros', tela: 'responsaveis' },
              { t: 'Categorias de serviço', tela: 'categoriasservico' },
              { t: 'Tipos de conteúdo', tela: 'tiposconteudo' },
              { t: 'Fontes de conteúdo', tela: 'fontes' },
              { t: 'Categorias de currículo', tela: 'categoriascurriculo' },
              { t: 'Progressões', tela: 'progressoes' },
              { t: 'Tipos de geração', tela: 'tiposgeracao' },
              { t: 'Visibilidades de oferta', tela: 'visibilidades' },
            ],
          },
        ],
      },
      {
        t: 'Alertas',
        c: [
          { t: 'Alertas automáticos', tela: 'alertas' },
          { t: 'Painel administrativo', tela: 'admPainel' },
          { t: 'Execuções do Relógio', tela: 'execucoes' },
        ],
      },
      {
        t: 'Documentação',
        c: [
          { t: 'Personas de teste', tela: 'docPersonas' },
          { t: 'Mapa de telas', tela: 'docTelas' },
          { t: 'Design system', tela: 'docDesign' },
        ],
      },
    ],
  },
  /* Menu próprio pedido em 17/09/2026: GitHub (saúde dos repositórios) e IA (três provedores) */
  {
    id: 'engenharia',
    nome: 'Engenharia',
    nav: 'secoes',
    icon: 'code',
    etapas: [
      { t: 'GitHub', c: [{ t: 'Repositórios', tela: 'engRepos', chave: 'engenharia' }] },
      { t: 'IA', c: [{ t: 'Provedores de IA', tela: 'engIA', chave: 'engenharia' }] },
    ],
  },
];

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const PREFIXO_FICHA: Record<string, string> = { curso: 'curso', alunoFicha: 'aluno', professorFicha: 'prof' };

export type Folha = {
  id: string;
  label: string;
  tela: string;
  aba?: string;
  chave: string;
  menu: string;
  menuLabel: string;
  etapa: string;
  pai: string | null;
};

/* id estável menu-seção-grupo-folha e chave de acesso de cada nó — os mesmos ids do portal */
for (const m of MENUS) {
  for (const e of m.etapas) {
    e.id = `${m.id}-${slug(e.t)}`;
    const vai = (nos: No[], pai: string) => {
      for (const n of nos) {
        const s = slug(n.t);
        n.id = (s === slug(e.t) && pai === e.id ? pai : `${pai}-${s}`).slice(0, 64);
        if (n.c) {
          vai(n.c, n.id);
          continue;
        }
        n.chave = n.chave || (n.aba ? `${PREFIXO_FICHA[n.tela!]}.${n.aba}` : m.id === 'config' ? 'cfg' : n.tela);
      }
    };
    vai(e.c!, e.id);
  }
}

/** Todas as folhas, em ordem (inclui as abas das fichas). */
export const TELAS_MAPA: Folha[] = (() => {
  const out: Folha[] = [];
  for (const m of MENUS) {
    for (const e of m.etapas) {
      const vai = (nos: No[], pai: string | null) => {
        for (const n of nos) {
          if (n.c) vai(n.c, n.t);
          else
            out.push({
              id: n.id!,
              label: n.t,
              tela: n.tela!,
              aba: n.aba,
              chave: n.chave!,
              menu: m.id,
              menuLabel: m.nome,
              etapa: e.t,
              pai,
            });
        }
      };
      vai(e.c!, null);
    }
  }
  return out;
})();

/** menu de uma chave de acesso (a tabela Menu por tipo de perfil vale dentro de telaPermitida) */
const menuDaChave = (chave: string) => TELAS_MAPA.find((x) => x.chave === chave)?.menu ?? '';

export type Pessoa = UsuarioAcesso & { ehAluno: boolean };

/** personaPodeChave: a chave de acesso abre para a pessoa? */
/*
 * Atividades em cartões (23/09/2026): cada setor tem uma frente (Comercial ou Operações) e as telas que liberam o setor.
 * As chaves atv.* abrem para quem vê pelo menos um setor da frente (atv.dash: de qualquer frente).
 */
export const ATV_FRENTES: [string, string[]][] = [
  ['Comercial', ['Comercial', 'Marketing']],
  ['Operações', ['Pedagógico', 'Acadêmico', 'Administrativo', 'Financeiro/Fiscal', 'CX']],
];
export const ATV_SETOR_TELAS: Record<string, string[]> = {
  Comercial: ['acFunil', 'acRenovacao'],
  Marketing: ['acCampanhas'],
  Pedagógico: ['acAlocacao', 'acSubstituicao'],
  Acadêmico: ['acNivel', 'acReposicao'],
  Administrativo: ['acAdmissao'],
  'Financeiro/Fiscal': ['acFechamento', 'acCobranca'],
  CX: ['acAtendimentos', 'acRetencao'],
};
export const atvFrenteDe = (setor: string) => ATV_FRENTES.find(([, ss]) => ss.includes(setor))?.[0] ?? 'Operações';
const chaveDaTela = (t: string) => TELAS_MAPA.find((n) => n.tela === t && !n.aba)?.chave ?? t;
/** setores que a pessoa vê (de uma frente, ou de todas) */
export const atvSetores = (p: Pessoa, frente?: string) =>
  ATV_FRENTES.filter(([f]) => !frente || f === frente)
    .flatMap(([, ss]) => ss)
    .filter((s) => ATV_SETOR_TELAS[s].some((t) => podeChave(p, chaveDaTela(t))));
const ATV_CHAVES: Record<string, string | undefined> = {
  'atv.dash': undefined,
  'atv.comercial': 'Comercial',
  'atv.operacoes': 'Operações',
};

export function podeChave(p: Pessoa, chave: string): boolean {
  if (p.ehAluno) return false;
  if (chave === 'inicio') return true;
  if (chave in ATV_CHAVES) return atvSetores(p, ATV_CHAVES[chave]).length > 0;
  /* aba Contratos das fichas: quem vê as parcelas e atua em contratos ou vendas */
  if (chave === 'deal.contratos')
    return podeChave(p, 'aluno.financeiro') && (podeChave(p, 'acFechamento') || podeChave(p, 'acFunil'));
  const t: TelaAcesso = { id: '', m: menuDaChave(chave) || (chave ? '' : 'fora'), chave };
  return telaPermitida(p, t);
}

export type ItemNav = {
  key: string;
  label: string;
  icon: string;
  /** tela que o item abre (a primeira liberada nos menus com seções) */
  tela: string;
  folha: string;
  href: string;
  /** 'conta': o item mora no menu da conta (Configurações e Engenharia), não na lista lateral */
  lugar?: 'conta';
  /** caminhos de fichas que acendem o item sem serem abas */
  prefixos?: string[];
  /** 'aluno': item da visão de aluno de quem também estuda (o botão Aluno troca a visão) */
  visao?: 'aluno';
  secoes?: { etapa: string; telas: { id: string; tela: string; label: string; pai: string | null; href: string }[] }[];
};

/** Menu do portal original (um item por menu do mapa): só a conferência scripts/compara-acesso.ts usa. */
export function navPortal(p: Pessoa & { temAluno: boolean }): ItemNav[] {
  if (p.ehAluno) {
    return [
      {
        key: 'alunoInicio',
        label: 'Minha área',
        icon: 'home',
        tela: 'alunoInicio',
        folha: 'alunoInicio',
        href: hrefTela('alunoInicio'),
      },
      {
        key: 'alunoAgenda',
        label: 'Minha agenda',
        icon: 'cal',
        tela: 'alunoAgenda',
        folha: 'alunoAgenda',
        href: hrefTela('alunoAgenda'),
      },
      {
        key: 'alunoHistorico',
        label: 'Histórico de aulas',
        icon: 'report',
        tela: 'alunoHistorico',
        folha: 'alunoHistorico',
        href: hrefTela('alunoHistorico'),
      },
    ];
  }
  const out: ItemNav[] = [
    { key: 'inicio', label: 'Início', icon: 'home', tela: 'dashboard', folha: 'inicio', href: '/inicio' },
  ];
  for (const m of MENUS) {
    if (m.nav === 'secoes') {
      const fs = TELAS_MAPA.filter((n) => n.menu === m.id && !n.aba && podeChave(p, n.chave));
      if (!fs.length) continue;
      const etapas = [...new Set(fs.map((n) => n.etapa))];
      out.push({
        key: m.id,
        label: m.nome,
        icon: m.icon,
        tela: fs[0].tela,
        folha: fs[0].id,
        href: hrefTela(fs[0].tela),
        secoes: etapas.map((etapa) => ({
          etapa,
          telas: fs
            .filter((n) => n.etapa === etapa)
            .map((n) => ({
              id: n.id,
              tela: n.tela,
              label: n.label,
              pai: n.pai && n.pai !== etapa ? n.pai : null,
              href: hrefTela(n.tela),
            })),
        })),
      });
      continue;
    }
    const f = TELAS_MAPA.find((n) => n.menu === m.id)!;
    if (f.chave && !podeChave(p, f.chave)) continue;
    out.push({ key: m.id, label: m.nome, icon: m.icon, tela: f.tela, folha: f.id, href: hrefTela(f.tela) });
  }
  if (p.temAluno) {
    out.push(
      {
        key: 'alunoInicio',
        label: 'Minha área',
        icon: 'user',
        tela: 'alunoInicio',
        folha: 'alunoInicio',
        href: hrefTela('alunoInicio'),
      },
      {
        key: 'alunoAgenda',
        label: 'Minha agenda',
        icon: 'cal',
        tela: 'alunoAgenda',
        folha: 'alunoAgenda',
        href: hrefTela('alunoAgenda'),
      },
      {
        key: 'alunoHistorico',
        label: 'Histórico de aulas',
        icon: 'report',
        tela: 'alunoHistorico',
        folha: 'alunoHistorico',
        href: hrefTela('alunoHistorico'),
      },
    );
  }
  return out;
}

/*
 * Menu enxuto (brainstorming de 18/09/2026): a equipe vê Usuários, Produtos e serviços e Atividades (antes Ações), mais a Agenda do dia a dia.
 * Relatórios, financeiro e auditoria moram dentro de Ações; Configurações e Engenharia vão para o menu da conta.
 * Aluno e professor: Agenda, Histórico e Central de ajuda. As telas e as chaves de acesso continuam as do mapa acima.
 */
type TelaNav = { tela: string; label?: string; pai?: string };
type ItemDef = {
  id: string;
  nome: string;
  icon: string;
  lugar?: 'conta';
  /** caminhos de fichas que moram debaixo do item sem serem abas (a ficha do professor) */
  prefixos?: string[];
  secoes: { t: string; telas: TelaNav[] }[];
};

/** telas que ainda não existem no mapa do portal */
const TELAS_NOVAS: Record<string, { label: string; chave: string }> = {
  servicos: { label: 'Serviços', chave: 'catalogo' },
  /* Atividades em cartões (23/09/2026) */
  atvDash: { label: 'Visão geral', chave: 'atv.dash' },
  atvCatalogo: { label: 'Catálogo de atividades', chave: 'atv.dash' },
  atvComercial: { label: 'Atividades', chave: 'atv.comercial' },
  atvOperacoes: { label: 'Atividades', chave: 'atv.operacoes' },
  /* Deal (23/09/2026): acesso emprestado da tela vizinha, como no protótipo 23 */
  dlPainel: { label: 'Painel de vendas', chave: 'acFunil' },
  dlPedidos: { label: 'Pedidos', chave: 'acFunil' },
  dlRenovacoes: { label: 'Renovações', chave: 'acFunil' },
  dlImportar: { label: 'Importações', chave: 'acFunil' },
  dlVendedores: { label: 'Vendedores', chave: 'acFunil' },
  dlDescontos: { label: 'Descontos', chave: 'acFunil' },
  dlBolsas: { label: 'Bolsas', chave: 'acFunil' },
  dlOrdens: { label: 'Ordem de faturamento', chave: 'acFechamento' },
  dlFechamento: { label: 'Fechamento por matrícula', chave: 'acFechamento' },
  dlNotas: { label: 'Notas fiscais', chave: 'acCobranca' },
  dlCobrancas: { label: 'Cobranças', chave: 'acCobranca' },
  dlLiquidacao: { label: 'Liquidação manual', chave: 'acCobranca' },
  dlConciliacao: { label: 'Conciliação', chave: 'acCobranca' },
  dlPosicao: { label: 'Posição financeira', chave: 'acCobranca' },
  dlContas: { label: 'Clientes empresariais', chave: 'acFechamento' },
  dlConferencia: { label: 'Conferência', chave: 'acCobranca' },
  dlOfertas: { label: 'Ofertas', chave: 'catalogo' },
  dlPresets: { label: 'Presets de venda', chave: 'catalogo' },
  /* adequação ao Portal Alumni (22/09/2026): cadastros simples (domain/cadastros.ts) com o acesso da tela vizinha */
  turmas: { label: 'Turmas', chave: 'catalogo' },
  conteudos: { label: 'Conteúdos', chave: 'curso.curriculo' },
  ciclos: { label: 'Ciclos de aprendizagem', chave: 'curso.curriculo' },
  calendarios: { label: 'Calendários', chave: 'curso.curriculo' },
  ofertas: { label: 'Ofertas', chave: 'acFunil' },
  extratos: { label: 'Extratos dos professores', chave: 'acFechamento' },
  lancamentos: { label: 'Acertos do extrato', chave: 'acFechamento' },
  relatoriosMatricula: { label: 'Relatórios de matrícula', chave: 'acAlocacao' },
};

const sec = (t: string, ...telas: (string | TelaNav)[]) => ({
  t,
  telas: telas.map((x) => (typeof x === 'string' ? { tela: x } : x)),
});

/*
 * Pirâmides de 21/09/2026: Operação (A Agenda · B Usuários · C Produtos e serviços · D Atividades · E Auditoria · F Configurações),
 * Professor e Aluno (A Agenda · B Histórico de aulas · C Meu perfil). O Início continua como primeiro item da equipe;
 * a Central de ajuda, o Meu perfil e o Trocar senha ficam no rodapé.
 */
export const NAV_EQUIPE: ItemDef[] = [
  {
    id: 'produtos',
    nome: 'Produtos e serviços',
    icon: 'bookOpen',
    secoes: [
      /* 24/09/2026: Cursos e Ofertas primeiro (pirâmide nova); Materiais e Serviços continuam depois */
      sec('Cursos', { tela: 'cursos', label: 'Catálogo' }, 'turmas'),
      sec('Ofertas', 'dlOfertas', 'dlPresets'),
      sec('Materiais', { tela: 'curriculo', label: 'Currículos e acervos' }, 'conteudos', 'ciclos', 'calendarios'),
      sec('Serviços', 'servicos'),
    ],
  },
  {
    id: 'usuarios',
    nome: 'Usuários',
    icon: 'users',
    prefixos: ['/professores', '/contratos'],
    secoes: [
      sec('Alunos', 'pedAlunos'),
      /* 24/09/2026: Equipe vira Time; Departamentos e Cargos ganham seção própria */
      sec('Time', { tela: 'professores', label: 'Time' }),
      sec('Departamentos', 'departamentos'),
      sec('Cargos', 'cargos'),
      sec('Empresas', 'empresas'),
    ],
  },
  { id: 'agenda', nome: 'Agenda', icon: 'cal', secoes: [sec('Agenda', 'agenda')] },
  {
    id: 'acoes',
    /*
     * Ações virou Atividades (21/09/2026). Em 23/09/2026 (rascunho "D - Atividades (Cartões)"): Dashboard · Comercial · Operações.
     * Comercial e Operações abrem no quadro de cartões; as telas dos setores viram subabas agrupadas pelo setor.
     */
    nome: 'Atividades',
    icon: 'zap',
    /* a ficha e o Novo pedido acendem Atividades */
    prefixos: ['/pedidos'],
    secoes: [
      sec(
        'Dashboard',
        'atvDash',
        'atvCatalogo',
        { tela: 'dlPainel', label: 'Vendas' },
        { tela: 'rpFinanceiro', label: 'Financeiro' },
        { tela: 'relatorio', pai: 'Relatórios' },
        { tela: 'rpPresenca', pai: 'Alunos' },
        { tela: 'rpPacote', pai: 'Alunos' },
        { tela: 'rpProfessores', pai: 'Professores' },
        { tela: 'rpAvaliacao', pai: 'Professores' },
        { tela: 'rpAulas', pai: 'Cursos' },
        { tela: 'rpOcupacao', pai: 'Cursos' },
      ),
      sec(
        'Comercial',
        'atvComercial',
        { tela: 'acFunil', pai: 'Funil' },
        { tela: 'acRenovacao', pai: 'Funil' },
        { tela: 'ofertas', label: 'Ofertas do CRM', pai: 'Funil' },
        /* o antigo menu Vendas (Deal) mora aqui desde 23/09/2026 */
        { tela: 'dlPedidos', pai: 'Vendas' },
        { tela: 'dlRenovacoes', pai: 'Vendas' },
        { tela: 'dlImportar', pai: 'Vendas' },
        { tela: 'dlVendedores', pai: 'Vendas' },
        { tela: 'dlDescontos', pai: 'Vendas' },
        { tela: 'dlBolsas', pai: 'Vendas' },
        { tela: 'acCampanhas', pai: 'Marketing' },
      ),
      sec(
        'Operações',
        'atvOperacoes',
        { tela: 'acAlocacao', pai: 'Pedagógico' },
        { tela: 'acSubstituicao', pai: 'Pedagógico' },
        { tela: 'relatoriosMatricula', pai: 'Pedagógico' },
        { tela: 'acNivel', pai: 'Acadêmico' },
        { tela: 'acReposicao', pai: 'Acadêmico' },
        { tela: 'acAdmissao', pai: 'Administrativo' },
        { tela: 'acFechamento', pai: 'Financeiro/Fiscal' },
        { tela: 'acCobranca', pai: 'Financeiro/Fiscal' },
        { tela: 'extratos', pai: 'Financeiro/Fiscal' },
        { tela: 'lancamentos', pai: 'Financeiro/Fiscal' },
        { tela: 'acAtendimentos', pai: 'CX' },
        { tela: 'acRetencao', pai: 'CX' },
      ),
    ],
  },
  /* Financeiro do Deal (23/09/2026): faturamento, recebimento e posição; os contratos ficam nas fichas */
  {
    id: 'financeiro',
    nome: 'Financeiro',
    icon: 'money',
    secoes: [
      sec('Faturamento', 'dlOrdens', 'dlFechamento', 'dlNotas'),
      sec('Recebimento', 'dlCobrancas', 'dlLiquidacao', 'dlConciliacao'),
      sec('Posição', 'dlPosicao', 'dlContas', 'dlConferencia'),
    ],
  },
  /* Auditoria e Configurações voltam ao menu lateral, só para o Admin (a regra de acesso já é essa) */
  {
    id: 'auditoria',
    nome: 'Auditoria',
    icon: 'shield',
    secoes: [sec('Auditoria', { tela: 'auditoria', label: 'Histórico de alterações' })],
  },
  {
    id: 'config',
    nome: 'Configurações',
    icon: 'sliders',
    secoes: [
      sec('Painel', { tela: 'admPainel', label: 'Painel administrativo' }),
      /* a gestão de cada acesso fica na ficha da pessoa; aqui, a visão de todas as contas, perfis e sessões */
      sec('Acessos', { tela: 'usuarios', label: 'Contas de acesso' }, 'perfis', 'sessoes'),
      sec(
        'Regras de negócio',
        'politicas',
        { tela: 'dias', pai: 'Calendário' },
        { tela: 'feriados', pai: 'Calendário' },
        'salas',
        ...[
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
        ].map((tela) => ({
          tela,
          pai: 'Catálogos',
        })),
      ),
      sec('Alertas', 'alertas', 'execucoes'),
      sec('Documentação', 'docPersonas', 'docTelas', 'docDesign'),
    ],
  },
  {
    id: 'engenharia',
    nome: 'Engenharia',
    icon: 'code',
    lugar: 'conta',
    secoes: [sec('GitHub', 'engRepos'), sec('IA', 'engIA')],
  },
];

const direto = (key: string, label: string, icon: string, tela: string): ItemNav => ({
  key,
  label,
  icon,
  tela,
  folha: tela,
  href: hrefTela(tela),
});

/** A Agenda · B Histórico de aulas · C Meu perfil (a área do aluno, e a do professor) */
const agendaAluno = () => direto('alunoAgenda', 'Agenda', 'cal', 'alunoAgenda');
const historico = () => direto('alunoHistorico', 'Histórico de aulas', 'report', 'alunoHistorico');
const meuPerfil = () => direto('meuPerfil', 'Meu perfil', 'user', 'meuPerfil');

/** a visão de aluno de quem também estuda: a mesma área do aluno, com o próprio aluno vinculado */
const visaoAluno = (): ItemNav[] => [
  { ...agendaAluno(), key: 'vAlunoAgenda', visao: 'aluno' },
  { ...historico(), key: 'vAlunoHistorico', href: '/historico-de-aulas?visao=aluno', visao: 'aluno' },
  { ...meuPerfil(), key: 'vAlunoPerfil', href: '/meu-perfil?visao=aluno', visao: 'aluno' },
];

/** Menu lateral da pessoa (itens com lugar 'conta' aparecem no menu da conta; visao 'aluno' atrás do botão Aluno). */
export function navDe(p: Pessoa & { temAluno: boolean }): ItemNav[] {
  if (p.ehAluno) return [agendaAluno(), historico(), meuPerfil()];
  if (p.tipoPerfil === 'Prestador')
    return [
      direto('agenda', 'Agenda', 'cal', 'agenda'),
      { ...historico(), key: 'historico' },
      meuPerfil(),
      ...(p.temAluno ? visaoAluno() : []),
    ];
  /* o Início (Dashboard) continua no alto do menu da equipe (pedido de 21/09/2026) */
  const out: ItemNav[] = [{ ...direto('inicio', 'Início', 'home', 'dashboard'), folha: 'inicio' }];
  for (const m of NAV_EQUIPE) {
    const secoes = m.secoes
      .map((sec) => ({
        etapa: sec.t,
        telas: sec.telas.flatMap((x) => {
          if (x.tela === 'atividades') return [];
          const f = TELAS_MAPA.find((n) => n.tela === x.tela && !n.aba);
          const nova = TELAS_NOVAS[x.tela];
          const chave = f?.chave ?? nova?.chave;
          if (!chave || !podeChave(p, chave)) return [];
          return [
            {
              id: f?.id ?? `${m.id}-${x.tela}`,
              tela: x.tela,
              label: x.label ?? f?.label ?? nova!.label,
              pai: x.pai ?? null,
              href: hrefTela(x.tela),
            },
          ];
        }),
      }))
      .filter((sec) => sec.telas.length);
    if (!secoes.length) continue;
    const f = secoes[0].telas[0];
    const umaTela = secoes.length === 1 && secoes[0].telas.length === 1;
    out.push({
      key: m.id,
      label: m.nome,
      icon: m.icon,
      tela: f.tela,
      folha: f.id,
      href: f.href,
      ...(m.lugar ? { lugar: m.lugar } : {}),
      ...(m.prefixos ? { prefixos: m.prefixos } : {}),
      /* menu de uma tela só (Agenda, Auditoria): sem abas */
      ...(umaTela ? {} : { secoes }),
    });
  }
  if (p.temAluno) out.push(...visaoAluno());
  return out;
}

/** Chaves liberadas para a pessoa (o front esconde abas e blocos com isto). */
export function chavesDe(p: Pessoa): string[] {
  const todas = new Set<string>([
    'inicio',
    ...TELAS_MAPA.map((n) => n.chave),
    'aluno.alocacao',
    ...Object.keys(ATV_CHAVES),
  ]);
  return [...todas].filter((c) => podeChave(p, c));
}
