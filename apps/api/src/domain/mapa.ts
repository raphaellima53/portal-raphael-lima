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
            t: 'Matrículas',
            c: [
              { t: 'Cursos', tela: 'alunoFicha', aba: 'cursos' },
              { t: 'Disponibilidade', tela: 'alunoFicha', aba: 'disponibilidade' },
            ],
          },
          {
            t: 'Histórico',
            c: [
              { t: 'Agendamentos', tela: 'alunoFicha', aba: 'agendamentos' },
              { t: 'Feedbacks', tela: 'alunoFicha', aba: 'feedbacks' },
            ],
          },
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
            t: 'Acessos',
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
  secoes?: { etapa: string; telas: { id: string; tela: string; label: string; pai: string | null; href: string }[] }[];
};

/** Menu lateral da pessoa: Início, os menus liberados e, para quem também estuda, a área do aluno. */
export function navDe(p: Pessoa & { temAluno: boolean }): ItemNav[] {
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

/** Chaves liberadas para a pessoa (o front esconde abas e blocos com isto). */
export function chavesDe(p: Pessoa): string[] {
  const todas = new Set<string>(['inicio', ...TELAS_MAPA.map((n) => n.chave), 'aluno.alocacao']);
  return [...todas].filter((c) => podeChave(p, c));
}
