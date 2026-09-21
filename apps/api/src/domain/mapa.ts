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
    nome: 'Ações',
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
export function podeChave(p: Pessoa, chave: string): boolean {
  if (p.ehAluno) return false;
  if (chave === 'inicio') return true;
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
 * Menu enxuto (brainstorming de 18/09/2026): a equipe vê Usuários, Produtos e serviços e Ações, mais a Agenda do dia a dia.
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
};

const sec = (t: string, ...telas: (string | TelaNav)[]) => ({
  t,
  telas: telas.map((x) => (typeof x === 'string' ? { tela: x } : x)),
});

export const NAV_EQUIPE: ItemDef[] = [
  { id: 'agenda', nome: 'Agenda', icon: 'cal', secoes: [sec('Agenda', 'agenda')] },
  {
    id: 'usuarios',
    nome: 'Usuários',
    icon: 'users',
    prefixos: ['/professores'],
    secoes: [
      sec('Alunos', 'pedAlunos'),
      sec('Equipe', { tela: 'professores', label: 'Equipe' }, 'departamentos', 'cargos'),
      sec('Empresas', 'empresas'),
    ],
  },
  {
    id: 'produtos',
    nome: 'Produtos e serviços',
    icon: 'bookOpen',
    secoes: [sec('Cursos', { tela: 'cursos', label: 'Catálogo' }, 'curriculo'), sec('Serviços', 'servicos')],
  },
  {
    id: 'acoes',
    nome: 'Ações',
    icon: 'zap',
    secoes: [
      sec('Pedagógico', 'acAlocacao', 'acSubstituicao'),
      sec('Acadêmico', 'acNivel', 'acReposicao'),
      sec('Administrativo', 'acAdmissao'),
      sec('Financeiro/Fiscal', 'acFechamento', 'acCobranca', 'rpFinanceiro'),
      sec('Comercial', 'acFunil', 'acRenovacao'),
      sec('Marketing', 'acCampanhas'),
      sec('CX', 'acAtendimentos', 'acRetencao'),
      sec(
        'Relatórios',
        'relatorio',
        { tela: 'rpPresenca', pai: 'Alunos' },
        { tela: 'rpPacote', pai: 'Alunos' },
        { tela: 'rpProfessores', pai: 'Professores' },
        { tela: 'rpAvaliacao', pai: 'Professores' },
        { tela: 'rpAulas', pai: 'Cursos' },
        { tela: 'rpOcupacao', pai: 'Cursos' },
      ),
      sec('Auditoria', { tela: 'auditoria', label: 'Histórico de alterações' }),
    ],
  },
  {
    id: 'config',
    nome: 'Configurações',
    icon: 'sliders',
    lugar: 'conta',
    secoes: [
      /* a gestão de cada acesso fica na ficha da pessoa; aqui, a visão de todas as contas, perfis e sessões */
      sec('Acessos', { tela: 'usuarios', label: 'Contas de acesso' }, 'perfis', 'sessoes'),
      sec(
        'Regras de negócio',
        'politicas',
        { tela: 'dias', pai: 'Calendário' },
        { tela: 'feriados', pai: 'Calendário' },
        'salas',
        ...['tiposcurso', 'tiposala', 'idiomas', 'skills', 'generos', 'responsaveis'].map((tela) => ({
          tela,
          pai: 'Catálogos',
        })),
      ),
      sec('Alertas', 'alertas', 'admPainel', 'execucoes'),
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

/** a visão de aluno de quem também estuda: a mesma área do aluno, com o próprio aluno vinculado */
const visaoAluno = (): ItemNav[] => [
  { ...direto('vAlunoAgenda', 'Agenda', 'cal', 'alunoAgenda'), visao: 'aluno' },
  {
    ...direto('vAlunoHistorico', 'Histórico', 'report', 'alunoHistorico'),
    href: '/historico-de-aulas?visao=aluno',
    visao: 'aluno',
  },
  {
    ...direto('vAlunoAjuda', 'Central de ajuda', 'help', 'centralAjuda'),
    href: '/central-de-ajuda?visao=aluno',
    visao: 'aluno',
  },
];

/** Menu lateral da pessoa (itens com lugar 'conta' aparecem no menu da conta; visao 'aluno' atrás do botão Aluno). */
export function navDe(p: Pessoa & { temAluno: boolean }): ItemNav[] {
  const ajuda = direto('centralAjuda', 'Central de ajuda', 'help', 'centralAjuda');
  if (p.ehAluno)
    return [
      direto('alunoAgenda', 'Agenda', 'cal', 'alunoAgenda'),
      direto('alunoHistorico', 'Histórico', 'report', 'alunoHistorico'),
      ajuda,
    ];
  if (p.tipoPerfil === 'Prestador')
    return [
      direto('agenda', 'Agenda', 'cal', 'agenda'),
      direto('historico', 'Histórico', 'report', 'alunoHistorico'),
      ajuda,
      ...(p.temAluno ? visaoAluno() : []),
    ];
  const out: ItemNav[] = [direto('inicio', 'Início', 'home', 'dashboard')];
  out[0].folha = 'inicio';
  for (const m of NAV_EQUIPE) {
    const secoes = m.secoes
      .map((sec) => ({
        etapa: sec.t,
        telas: sec.telas.flatMap((x) => {
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
    out.push({
      key: m.id,
      label: m.nome,
      icon: m.icon,
      tela: f.tela,
      folha: f.id,
      href: f.href,
      ...(m.lugar ? { lugar: m.lugar } : {}),
      ...(m.prefixos ? { prefixos: m.prefixos } : {}),
      /* a Agenda é uma tela só: sem abas */
      ...(m.id === 'agenda' ? {} : { secoes }),
    });
  }
  if (p.temAluno) out.push(...visaoAluno());
  return out;
}

/** Chaves liberadas para a pessoa (o front esconde abas e blocos com isto). */
export function chavesDe(p: Pessoa): string[] {
  const todas = new Set<string>(['inicio', ...TELAS_MAPA.map((n) => n.chave), 'aluno.alocacao']);
  return [...todas].filter((c) => podeChave(p, c));
}
