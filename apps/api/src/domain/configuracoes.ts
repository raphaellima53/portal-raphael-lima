/**
 * Configurações: porte de ADM · POLÍTICAS, USUÁRIOS, PERFIS E ACESSOS, ALERTAS, PARÂMETROS, PESSOAS E RH, GOVERNANÇA,
 * PAINEL ADMINISTRATIVO e do pacote "o que era só desenho" (16/09/2026), que deixou os botões funcionais.
 */
import {
  AREAS,
  type AreaId,
  type Areas,
  areasDaTela,
  MATRIZ,
  RECORTES,
  telaPermitida,
  type UsuarioAcesso,
} from './acesso.ts';
import { agAulasEntre, agOfertas, alMat, alSit } from './agenda.ts';
import { alSaldo } from './alunos.ts';
import type { Base } from './base.ts';
import { TELAS_MAPA } from './mapa.ts';

/* ---------------- catálogos: departamentos, cargos e os seis simples ---------------- */
export const CAT = {
  departamentos: { t: 'Departamentos', um: 'departamento', novo: 'Novo departamento', tela: 'departamentos' },
  cargos: { t: 'Cargos', um: 'cargo', novo: 'Novo cargo', tela: 'cargos' },
  tiposcurso: { t: 'Tipos de curso', um: 'tipo de curso', novo: 'Novo tipo de curso', tela: 'tiposcurso' },
  tiposala: { t: 'Tipos de sala', um: 'tipo de sala', novo: 'Novo tipo de sala', tela: 'tiposala' },
  idiomas: { t: 'Idiomas dos cursos', um: 'idioma', novo: 'Novo idioma', tela: 'idiomas' },
  skills: { t: 'Skills dos professores', um: 'skill', novo: 'Nova skill', tela: 'skills' },
  generos: { t: 'Gêneros', um: 'gênero', novo: 'Novo gênero', tela: 'generos' },
  responsaveis: {
    t: 'Responsáveis financeiros',
    um: 'responsável financeiro',
    novo: 'Novo responsável financeiro',
    tela: 'responsaveis',
  },
  /* catálogos da adequação ao Portal Alumni (22/09/2026) */
  categoriasservico: {
    t: 'Categorias de serviço',
    um: 'categoria de serviço',
    novo: 'Nova categoria de serviço',
    tela: 'categoriasservico',
  },
  tiposconteudo: {
    t: 'Tipos de conteúdo',
    um: 'tipo de conteúdo',
    novo: 'Novo tipo de conteúdo',
    tela: 'tiposconteudo',
  },
  fontes: { t: 'Fontes de conteúdo', um: 'fonte', novo: 'Nova fonte', tela: 'fontes' },
  categoriascurriculo: {
    t: 'Categorias de currículo',
    um: 'categoria de currículo',
    novo: 'Nova categoria de currículo',
    tela: 'categoriascurriculo',
  },
  progressoes: { t: 'Progressões', um: 'progressão', novo: 'Nova progressão', tela: 'progressoes' },
  tiposgeracao: { t: 'Tipos de geração', um: 'tipo de geração', novo: 'Novo tipo de geração', tela: 'tiposgeracao' },
  visibilidades: {
    t: 'Visibilidades de oferta',
    um: 'visibilidade',
    novo: 'Nova visibilidade',
    tela: 'visibilidades',
  },
} as const;
export type CatK = keyof typeof CAT;
/** tipo do Catalogo no banco para cada catálogo simples */
export const CAT_TIPO: Record<Exclude<CatK, 'departamentos' | 'cargos'>, string> = {
  tiposcurso: 'courseTypes',
  tiposala: 'roomTypes',
  idiomas: 'languages',
  skills: 'skills',
  generos: 'genders',
  responsaveis: 'finResp',
  categoriasservico: 'categoriasServico',
  tiposconteudo: 'tiposConteudo',
  fontes: 'fontes',
  categoriascurriculo: 'categoriasCurriculo',
  progressoes: 'progressoes',
  tiposgeracao: 'tiposGeracao',
  visibilidades: 'visibilidadesOferta',
};
/** telas dos catálogos simples, na ordem do menu */
export const CAT_TELAS = Object.keys(CAT).filter((k) => k !== 'departamentos' && k !== 'cargos');

/** campos a mais de um catálogo, guardados em Catalogo.dados (atributos do tipo de curso, categoria da skill) */
export type CatExtra = {
  k: string;
  rotulo: string;
  tipo: 'sim' | 'texto' | 'escolha';
  opcoes?: string[];
  ajuda?: string;
};
export const CAT_EXTRAS: Partial<Record<CatK, CatExtra[]>> = {
  tiposcurso: [
    { k: 'allowsModules', rotulo: 'Permite módulos', tipo: 'sim', ajuda: 'o curso se divide em módulos (níveis)' },
    { k: 'ofereceVagas', rotulo: 'Oferece vagas na grade', tipo: 'sim', ajuda: 'aulas em grupo com vagas abertas' },
    { k: 'exigeTurma', rotulo: 'Exige turma', tipo: 'sim', ajuda: 'a matrícula precisa de uma turma' },
    { k: 'grupoComercial', rotulo: 'Grupo comercial', tipo: 'texto' },
    {
      k: 'abordagemMaterial',
      rotulo: 'Abordagem de material',
      tipo: 'escolha',
      opcoes: ['Currículo próprio', 'Material do parceiro', 'Livre'],
    },
    {
      k: 'abordagemEnsino',
      rotulo: 'Abordagem de ensino',
      tipo: 'escolha',
      opcoes: ['Trilha fixa', 'Personalizada', 'Conversação'],
    },
    { k: 'natureza', rotulo: 'Natureza', tipo: 'escolha', opcoes: ['Curso', 'Serviço', 'Assinatura'] },
  ],
  skills: [
    {
      k: 'categoria',
      rotulo: 'Categoria',
      tipo: 'escolha',
      opcoes: ['Idioma', 'Pedagógica', 'Técnica', 'Comportamental'],
    },
  ],
};
export const FORMATOS_CURSO = ['Grupo', 'Particular', 'Híbrido', 'Turma'];

/** o que usa o item: é o que trava a exclusão (catUso) */
export function catUso(
  k: CatK,
  nome: string,
  x: { b: Base; colaboradores: { departamento: string; cargo: string }[]; cargos: { departamento: string }[] },
) {
  if (k === 'departamentos')
    return (
      x.colaboradores.filter((e) => e.departamento === nome).length +
      x.cargos.filter((p) => p.departamento === nome).length
    );
  if (k === 'cargos') return x.colaboradores.filter((e) => e.cargo === nome).length;
  if (k === 'tiposcurso')
    return x.b.cursos.filter((c) => c.tipo === nome).length + x.b.salas.filter((r) => r.atende === nome).length;
  if (k === 'tiposala') return x.b.salas.filter((r) => r.tipo === nome).length;
  if (k === 'idiomas') return x.b.cursos.filter((c) => c.idioma === nome).length;
  return 0;
}
export const normaliza = (s: string) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

/* ---------------- feriados ---------------- */
export function ferPascoa(y: number) {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, mes - 1, dia);
}
export function ferNacionais(y: number): [Date, string][] {
  const p = ferPascoa(y);
  const rel = (n: number) => {
    const d = new Date(p);
    d.setDate(d.getDate() + n);
    return d;
  };
  return [
    [new Date(y, 0, 1), 'Confraternização Universal'],
    [rel(-48), 'Carnaval'],
    [rel(-47), 'Carnaval'],
    [rel(-2), 'Sexta-feira Santa'],
    [new Date(y, 3, 21), 'Tiradentes'],
    [new Date(y, 4, 1), 'Dia do Trabalho'],
    [rel(60), 'Corpus Christi'],
    [new Date(y, 8, 7), 'Independência do Brasil'],
    [new Date(y, 9, 12), 'Nossa Senhora Aparecida'],
    [new Date(y, 10, 2), 'Finados'],
    [new Date(y, 10, 15), 'Proclamação da República'],
    [new Date(y, 10, 20), 'Dia Nacional de Zumbi e da Consciência Negra'],
    [new Date(y, 11, 25), 'Natal'],
  ];
}

/* ---------------- condições e vigência (políticas) ---------------- */
export type CampoPol =
  | { k: string; t: string; tipo: 'texto'; padrao: string; req?: boolean }
  | { k: string; t: string; tipo: 'radio'; ops: string[]; padrao: string }
  | { k: string; t: string; tipo: 'chave'; d: string; padrao: boolean };
export const POLITICAS: { n: number; t: string; d: string; campos: CampoPol[] }[] = [
  {
    n: 1,
    t: 'Crédito e promoção',
    d: 'como o saldo entra e sai da matrícula',
    campos: [
      { k: 'creditoGatilho', t: 'Aulas no grupo que geram 1 crédito private', tipo: 'texto', padrao: '5', req: true },
      { k: 'validadePromo', t: 'Validade do crédito promocional (dias)', tipo: 'texto', padrao: '90' },
      { k: 'validadeContrato', t: 'Validade do crédito contratado (dias)', tipo: 'texto', padrao: '365' },
      { k: 'consumoPrivate', t: 'Consumo por aula private', tipo: 'texto', padrao: '1' },
      { k: 'consumoGrupo', t: 'Consumo por aula em grupo', tipo: 'texto', padrao: '1' },
      {
        k: 'saldoNegativo',
        t: 'Permitir saldo negativo',
        tipo: 'radio',
        ops: ['Não', 'Até 2 créditos', 'Sim'],
        padrao: 'Não',
      },
    ],
  },
  {
    n: 2,
    t: 'Cancelamento e falta',
    d: 'janelas e penalidades aplicadas em runtime',
    campos: [
      { k: 'janela', t: 'Janela de cancelamento sem débito (h)', tipo: 'texto', padrao: '6', req: true },
      {
        k: 'foraJanela',
        t: 'Cancelamento fora da janela',
        tipo: 'radio',
        ops: ['Debita crédito', 'Não debita'],
        padrao: 'Debita crédito',
      },
      {
        k: 'noShow',
        t: 'No-show do aluno',
        tipo: 'radio',
        ops: ['Debita crédito', 'Não debita'],
        padrao: 'Debita crédito',
      },
      { k: 'faltasAlerta', t: 'Faltas consecutivas para alerta', tipo: 'texto', padrao: '3' },
      {
        k: 'presencaPendente',
        t: 'Presença pendente ao finalizar aula',
        tipo: 'radio',
        ops: ['Consolida como FALTA', 'Mantém pendente'],
        padrao: 'Consolida como FALTA',
      },
      {
        k: 'reposicaoAuto',
        t: 'Reposição automática por cancelamento do professor',
        tipo: 'radio',
        ops: ['Sim', 'Não'],
        padrao: 'Sim',
      },
    ],
  },
  {
    n: 3,
    t: 'Contrato e renovação',
    d: 'gatilhos que alimentam a Fila de Renovação',
    campos: [
      { k: 'filaDias', t: 'Entrar na fila com contrato vencendo em (dias)', tipo: 'texto', padrao: '30', req: true },
      { k: 'urgencia', t: 'Faixa de urgência crítica (dias)', tipo: 'texto', padrao: '10' },
      { k: 'saldoBaixo', t: 'Saldo baixo — alerta a partir de', tipo: 'texto', padrao: '10 créditos' },
      {
        k: 'bloquearVencido',
        t: 'Bloquear agendamento com contrato vencido',
        tipo: 'radio',
        ops: ['Sim', 'Não'],
        padrao: 'Sim',
      },
      {
        k: 'renovacaoGera',
        t: 'Renovação gera novo contrato',
        tipo: 'radio',
        ops: ['Sim — soma saldo', 'Sim — zera saldo'],
        padrao: 'Sim — soma saldo',
      },
      { k: 'ociosidade', t: 'Ociosidade do aluno — e-mails em (dias)', tipo: 'texto', padrao: '7, 14, 21' },
    ],
  },
  {
    n: 4,
    t: 'Automações comerciais',
    d: 'o que dispara sem intervenção humana',
    campos: [
      {
        k: 'promoAuto',
        t: 'Crédito promocional automático',
        tipo: 'chave',
        d: 'Ao completar o gatilho de aulas em grupo, o sistema lança 1 crédito private na matrícula.',
        padrao: true,
      },
      {
        k: 'alertaContrato',
        t: 'Alerta de contrato vencendo',
        tipo: 'chave',
        d: 'Notifica consultor responsável e administração conforme as faixas acima.',
        padrao: true,
      },
      {
        k: 'bloqueioInad',
        t: 'Bloqueio por inadimplência',
        tipo: 'chave',
        d: 'Suspende agendamento quando o responsável financeiro está em atraso.',
        padrao: false,
      },
      {
        k: 'reengajamento',
        t: 'Reengajamento por ociosidade',
        tipo: 'chave',
        d: 'Sequência de e-mails ao aluno sem aula agendada.',
        padrao: true,
      },
    ],
  },
];
export type ValoresPol = Record<string, string | boolean>;
export const polPadrao = (): ValoresPol =>
  Object.fromEntries(POLITICAS.flatMap((s) => s.campos.map((c) => [c.k, c.padrao])));

/* ---------------- sessões: políticas de acesso ---------------- */
export const SES_POL: [string, string, string, boolean][] = [
  ['mfa', 'Autenticação em duas etapas', 'obrigatória para Administrador, Financeiro e Coordenação', true],
  ['mfaVerbo', 'MFA para verbo sensível', 'segunda confirmação no momento da execução', true],
  ['expira', 'Expiração por inatividade', 'encerra a sessão após 30 minutos parada', true],
  ['unica', 'Sessão única por usuário', 'entrar em outro dispositivo derruba a anterior', false],
  ['ip', 'Restrição por faixa de IP', 'só a rede da instituição', false],
  ['bloqueio', 'Bloqueio por tentativa', 'trava a conta após 5 senhas erradas seguidas', true],
  ['revisao', 'Revisão periódica de acessos', 'a cada 90 dias, priorizando exceções e inativos', true],
];
/** o dispositivo lido do user-agent: Chrome · Windows */
export function dispositivo(ua: string | null) {
  const u = ua ?? '';
  const nav = /Edg\//.test(u)
    ? 'Edge'
    : /OPR\//.test(u)
      ? 'Opera'
      : /Firefox\//.test(u)
        ? 'Firefox'
        : /Chrome\//.test(u)
          ? 'Chrome'
          : /Safari\//.test(u)
            ? 'Safari'
            : u
              ? 'Navegador'
              : 'Desconhecido';
  const so = /iPhone/.test(u)
    ? 'iPhone'
    : /iPad/.test(u)
      ? 'iPad'
      : /Android/.test(u)
        ? 'Android'
        : /Windows/.test(u)
          ? 'Windows'
          : /Mac OS X/.test(u)
            ? 'macOS'
            : /Linux/.test(u)
              ? 'Linux'
              : '';
  return so ? `${nav} · ${so}` : nav;
}
/** IP com os dois últimos blocos escondidos, como no portal (189.45.x.x) */
export const ipCurto = (ip: string | null) => {
  const v = String(ip ?? '').replace(/^::ffff:/, '');
  if (!v) return '—';
  if (v === '::1' || v === '127.0.0.1') return 'rede local';
  const p = v.split('.');
  return p.length === 4 ? `${p[0]}.${p[1]}.x.x` : `${v.split(':').slice(0, 2).join(':')}:…`;
};

/* ---------------- alertas automáticos ---------------- */
export const ALERTAS_PADRAO: [string, string, string, string][] = [
  ['ocioso', 'relogio', 'Ociosidade do aluno', 'E-mails ao aluno que fica dias sem agendar aula (7, 14 e 21 dias).'],
  [
    'contrato',
    'contrato',
    'Fim de contrato',
    'Notifica a administração quando o contrato de um aluno está perto de acabar (30 dias).',
  ],
  ['saldo', 'dinheiro', 'Saldo baixo de créditos', 'Avisa consultor e aluno quando o saldo cai abaixo de 10 aulas.'],
  [
    'semProf',
    'alerta',
    'Aula sem professor a ≤7 dias',
    'Escala para a coordenação as aulas sem professor dentro do prazo.',
  ],
];
export const ALERTA_GATILHOS: [string, string, string][] = [
  ['saldo', 'Saldo do aluno abaixo de', 'aulas'],
  ['contrato', 'Contrato do aluno vence em até', 'dias'],
  ['semProf', 'Aula sem professor nos próximos', 'dias'],
  ['inad', 'Aluno inadimplente há mais de', 'dias'],
];
export const ALERTA_PARA = ['Aluno', 'Consultor', 'Coordenação', 'Administração', 'Financeiro'];
export const ALERTA_CANAIS = ['E-mail', 'App', 'E-mail e app'];
export type AlertaPers = {
  id: string;
  nome: string;
  tipo: string;
  n: number;
  para: string[];
  canal: string;
  on: boolean;
};
export type AlertasConfig = { on: Record<string, boolean>; pers: AlertaPers[] };
export const alertasPadrao = (): AlertasConfig => ({
  on: { ocioso: true, contrato: true, saldo: true, semProf: true },
  pers: [],
});
/** quantos avisos o alerta geraria hoje (alertaConta) */
export function alertaConta(b: Base, tipo: string, n = 0, agora = new Date()) {
  if (tipo === 'saldo') return b.alunos.filter((a) => alMat(a).length && alSaldo(a) < n).length;
  if (tipo === 'contrato')
    return b.alunos.filter((a) => {
      if (!a.contratoFim) return false;
      const d = new Date(a.contratoFim);
      d.setHours(12, 0, 0, 0);
      const x = (+d - +agora) / 864e5;
      return x >= 0 && x <= n;
    }).length;
  if (tipo === 'semProf')
    return agAulasEntre(b, agora, new Date(+agora + n * 864e5), agora).filter((a) => a.estado === 'semProfessor')
      .length;
  if (tipo === 'inad') return b.alunos.filter((a) => alSit(a) === 'Inadimplente').length;
  if (tipo === 'ocioso') {
    const ofs = agOfertas(b);
    return b.alunos.filter(
      (a) => alSit(a) === 'Ativo' && alMat(a).length && !ofs.some((o) => o.alunos.includes(a.name)),
    ).length;
  }
  return 0;
}

/* ---------------- Painel administrativo e Execuções do Relógio (dados de exemplo do portal) ---------------- */
export const ADM_PAINEL = {
  stats: [
    ['128', 'regras no catálogo', ''],
    ['6', 'bloqueantes', 'red'],
    ['3', 'desativadas em runtime', 'amber'],
    ['12', 'parâmetros pendentes', 'amber'],
    ['0', 'rejeições hoje', 'green'],
    ['241', 'inconsistências (vigia)', 'red'],
  ],
  dominios: [
    ['Schedule · aulas e presença', 42, 38, 4, 'red'],
    ['Control · pessoas e acessos', 26, 26, 0, 'green'],
    ['Commerce · contratos e créditos', 31, 29, 2, 'amber'],
    ['Academic · cursos e turmas', 19, 19, 0, 'green'],
    ['Data · vigia e integridade', 10, 10, 0, 'green'],
  ],
  prontidao: [
    ['Dias e horários de funcionamento', 100, 'green'],
    ['Feriados e recessos (2026)', 58, 'amber'],
    ['Tipos de curso', 0, 'red'],
    ['Idiomas dos cursos', 100, 'green'],
    ['Skills dos professores', 100, 'green'],
    ['Tipos de sala', 100, 'green'],
    ['Responsáveis financeiros', 100, 'green'],
  ],
  alteracoes: [
    [
      '11/08/2026 07:12',
      'Admin User',
      'fn_rule_credito_promocional',
      'ativada',
      'green',
      '5 aulas no grupo = 1 crédito private',
    ],
    [
      '10/08/2026 18:44',
      'Admin User',
      'fn_rule_cancelamento_janela',
      'alterada',
      'amber',
      'janela de cancelamento 4h → 6h',
    ],
    [
      '09/08/2026 09:03',
      'Maria Emilia Wendler',
      'fn_rule_professor_carga_max',
      'alterada',
      'amber',
      'teto semanal 24 → 26 aulas',
    ],
    ['07/08/2026 16:20', 'Admin User', 'fn_rule_sala_obrigatoria', 'desativada', 'red', 'formatos Private Presencial'],
    ['05/08/2026 11:31', 'Sistema', 'fn_rule_vigia_integridade', 'executada', 'blue', '241 inconsistências apontadas'],
  ],
};
export const EXECUCOES: [string, string, string, string, string, string, string][] = [
  ['10/08/2026 22:58', 'sistema', 'verb_control_pessoa_criar', '4300', 'executado', 'green', ''],
  [
    '10/08/2026 20:53',
    'Polly Windson Rufino',
    'verb_schedule_aula_abrir',
    '158987',
    'com atenção',
    'amber',
    'Aula de 14/08/2026 iniciada em 10/08/2026 — conferir',
  ],
  [
    '10/08/2026 20:52',
    'Polly Windson Rufino',
    'verb_schedule_aula_finalizar',
    '158986',
    'com atenção',
    'amber',
    '1 presenças pendentes consolidadas como FALTA',
  ],
  ['10/08/2026 20:52', 'Polly Windson Rufino', 'verb_schedule_presenca_registrar', '90569', 'executado', 'green', ''],
  ['10/08/2026 17:06', 'sistema', 'verb_control_pessoa_criar', '4299', 'executado', 'green', ''],
  ['10/08/2026 16:57', 'Polly Windson Rufino', 'verb_schedule_aula_abrir', '158986', 'executado', 'green', ''],
  [
    '10/08/2026 03:53',
    'Polly Windson Rufino',
    'verb_schedule_aula_finalizar',
    '158985',
    'com atenção',
    'amber',
    '1 presenças pendentes consolidadas como FALTA',
  ],
  [
    '07/08/2026 20:13',
    'Polly Windson Rufino',
    'verb_schedule_aula_observacao_registrar',
    '433',
    'executado',
    'green',
    '',
  ],
  ['07/08/2026 15:01', 'sistema', 'verb_control_pessoa_criar', '4297', 'executado', 'green', ''],
];

/* ---------------- usuários ---------------- */
export const USU_STATUS: Record<string, string> = {
  Ativo: 'green',
  'Convite pendente': 'amber',
  Bloqueado: 'red',
  Inativo: 'gray',
};
export const NU_SEG: [string, string, boolean][] = [
  ['convite', 'Enviar convite por e-mail com link de definição de senha (validade 48h)', true],
  ['mfa', 'Exigir autenticação em duas etapas (MFA) no primeiro acesso', true],
  ['mfaExcluir', 'Exigir MFA para excluir registros (nível Administrador)', true],
  ['ip', 'Restringir acesso à faixa de IP da instituição', false],
  ['expira', 'Encerrar sessão após 30 minutos de inatividade', true],
];

/* ---------------- acesso no cadastro do usuário (nuTelas, acessoTelas, nuAreasHtml) ---------------- */
/** todas as telas e abas do mapa com o rótulo do cadastro — Configurações inclusive; Engenharia é deste app e fica de fora */
export const nuTelas = () =>
  TELAS_MAPA.filter((n) => n.menu !== 'engenharia').map((n) => ({
    id: n.id,
    m: n.menu,
    chave: n.chave,
    menuLabel: n.menuLabel,
    label: n.menu === 'config' || n.etapa === n.label ? n.label : [n.etapa, n.pai, n.label].filter(Boolean).join(' › '),
  }));
/** + 1: o dashboard da tela inicial abre para todos */
export const acessoTelas = (u: UsuarioAcesso) => 1 + nuTelas().filter((t) => telaPermitida(u, t)).length;

/** o detalhe de cada setor no cadastro: quantas telas o Total libera, ou o recorte do Restrito e as telas dele */
export function setoresDetalhe(areas: Areas) {
  return AREAS.map((ar) => {
    const a = areas[ar.id];
    const telas = nuTelas().filter(
      (t) => areasDaTela(t).includes(ar.id) && telaPermitida({ nivel: 5, areas: a ? { [ar.id]: a } : {} }, t),
    );
    const rs = RECORTES[ar.id] ?? {};
    const acesso = a && a.acesso !== 'proprio' ? a.acesso : '';
    return {
      id: ar.id,
      nome: ar.nome,
      acesso,
      rotulo: a?.rotulo ?? '',
      total:
        acesso === 'total'
          ? `todas as ${telas.length} telas do setor${a!.rotulo && a!.rotulo !== 'Total' ? ` · ${a!.rotulo.toLowerCase()}` : ''}`
          : null,
      recorte:
        acesso === 'restrito'
          ? {
              nome: a!.rotulo === 'padrao' || !rs[a!.rotulo] ? 'Recorte padrão' : a!.rotulo,
              desc: (rs[a!.rotulo] ?? rs.padrao)?.desc.toLowerCase() ?? '',
              telas: telas.map((t) => t.label),
            }
          : null,
    };
  });
}
/** rótulo do Restrito: o do cargo, se a matriz tiver; senão o recorte padrão do setor (nuRotulo) */
export function nuRotulo(perfilId: number | null, area: AreaId, acesso: 'total' | 'restrito') {
  const c = perfilId != null ? MATRIZ[perfilId]?.areas[area] : undefined;
  if (acesso === 'total') return c?.acesso === 'total' ? c.rotulo : 'Total';
  return c?.acesso === 'restrito' ? c.rotulo : 'padrao';
}
