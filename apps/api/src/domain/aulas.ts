/**
 * Uma aula da agenda: popup "Detalhes da aula", página da aula (presença), modo apresentação e a folha do professor.
 * Porte de aula.src.js, folha.src.js e apresentacao.src.js. Os ajustes ficam em AulaAjuste (AG_OV).
 */
import { fmt } from '../lib/fmt.ts';
import type { AcessoArea, Areas, TipoPerfil } from './acesso.ts';
import {
  type Aula,
  agAulasEntre,
  agCor,
  agHabilitado,
  agHM,
  agRotulo,
  fxPresenca,
  MOD_FLOW,
  prazoAte,
  prazoHoras,
  prazoTxt,
  SEM_CONTA_ZOOM,
} from './agenda.ts';
import type { AjusteAula, Base, ConteudoCur, CurriculoB, Suporte } from './base.ts';
import { modoAluno } from './solicitacoes.ts';

export type QuemAula = {
  nome: string;
  nivel: number;
  areas: Areas;
  tipoPerfil: TipoPerfil | null;
  ehAluno: boolean;
  /** o aluno da sessão (o nome no cadastro de aluno pode diferir do nome do usuário) */
  alunoId?: number | null;
};
export const aulaNivel = (p: QuemAula) => (p.ehAluno ? 9 : p.nivel);
/** 25/09/2026: na visão do aluno, os outros alunos aparecem só pelo primeiro nome (sem sobrenome nem e-mail) */
export const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? '';

export const fxHash = (s: string) => {
  let h = 0;
  for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 1000003;
  return h;
};

export const AULA_EST: Record<string, [string, string]> = {
  semAlunos: ['Sem alunos', 'amber'],
  comAlunos: ['Aberta', 'blue'],
  semProfessor: ['Sem professor', 'red'],
  executada: ['Concluída', 'green'],
  substituida: ['Substituída', 'purple'],
  naoFinalizada: ['Não finalizada', 'amber'],
  cancelada: ['Cancelada', 'gray'],
};

const agCap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
export const isoDaChave = (k: string) => String(k).split('|')[3];

export function aulaDe(b: Base, k: string, agora = new Date()): Aula | null {
  const iso = isoDaChave(k);
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T00:00:00`);
  return agAulasEntre(b, d, d, agora).find((a) => a.k === k) ?? null;
}

export function aulaCur(b: Base, a: Aula): { c: CurriculoB; x: ConteudoCur; trocado?: boolean } | null {
  const tr = b.ajustes[a.k]?.conteudo;
  if (tr) {
    const c = b.curriculos.find((x) => x.id === tr.cur);
    if (c?.conteudos[tr.i]) return { c, x: c.conteudos[tr.i], trocado: true };
  }
  /* aula avulsa: o tópico escolhido na criação (conteúdo do currículo) ou tópico livre (sem currículo) */
  if (a.avulsa) {
    const v = avulsaDe(b, a);
    const [cur, i] = (v?.conteudo ?? '').split('|');
    const c = cur ? b.curriculos.find((x) => x.id === cur) : undefined;
    return c?.conteudos[Number(i)] ? { c, x: c.conteudos[Number(i)] } : null;
  }
  const cs = b.curriculos.filter((x) => x.grupo === a.prod && (!a.mod || x.aplicado.includes(a.mod)));
  const c = cs[0] || b.curriculos.find((x) => x.grupo === a.prod);
  if (!c?.conteudos.length) return null;
  return { c, x: c.conteudos[Math.floor(a.quando.getTime() / 864e5) % c.conteudos.length] };
}

export const avulsaDe = (b: Base, a: Aula) => (a.avulsa ? b.avulsas.find((v) => v.id === a.avulsa) : undefined);

export const aulaFim = (a: Aula) => {
  const m = a.quando.getHours() * 60 + a.quando.getMinutes() + (a.duracao || 50);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
export const aulaDataTxt = (d: Date) => `${agCap(d.toLocaleDateString('pt-BR', { weekday: 'long' }))}, ${fmt.data(d)}`;
export const aulaSala = (b: Base, a: { sala: string }) => {
  /* aula avulsa com link no Local: o link é a sala */
  if (/^https?:\/\//i.test(a.sala)) return { zoom: /zoom\.us/i.test(a.sala), nome: 'Link da aula', url: a.sala };
  /* 30/09/2026: salas do Zoom = contas; a aula abre dentro do portal (sem link externo nem login) */
  if (a.sala === SEM_CONTA_ZOOM) return { zoom: true, nome: a.sala, url: '', conta: '', semConta: true };
  const r = b.salas.find((x) => x.name === a.sala);
  if (!r?.zoom) return { zoom: false, nome: a.sala, url: '', conta: '', semConta: false };
  return { zoom: true, nome: a.sala, url: '', conta: r.zoomEmail, semConta: false };
};
export const aulaPassou = (a: Aula, agora = new Date()) => a.quando <= agora;
export const aulaHojeOuAntes = (a: Aula, agora = new Date()) => {
  const f = new Date(agora);
  f.setHours(23, 59, 59, 999);
  return a.quando <= f;
};
export const aulaRot = (a: Aula) => `${agRotulo(a)} · ${fmt.data(a.quando)} ${agHM(a.quando)}`;
export const aulaAlunos = (b: Base, a: Aula) =>
  a.alunos.map((n) => {
    const al = b.alunos.find((x) => x.name === n);
    return {
      nome: n,
      email: al?.email ?? '—',
      alunoId: al?.id ?? null,
      fora: !!b.ajustes[a.k]?.fora?.[n],
      /* incluído só nesta aula (Gerenciar alunos › Adicionar) */
      incluido: !!b.ajustes[a.k]?.extras?.includes(n),
    };
  });

/* ---------------- folha do professor ---------------- */
export const BLACK_VALOR_PADRAO = 120;
const FIN_HORA = [55, 60, 65, 70, 75, 80, 90];
export const FOLHA_MOTIVOS = [
  'Pedagógico — conteúdo ou turma',
  'Técnico — plataforma, Zoom ou material',
  'Comportamento do aluno',
  'Substituição parcial durante a aula',
  'Outro',
];
export const FOLHA_SIT: Record<string, [string, string]> = {
  paga: ['Paga', 'green'],
  descontada: ['Descontada · suporte', 'red'],
  pendente: ['Pendente · não finalizada', 'amber'],
  fora: ['Não entra', 'gray'],
};
export const finMesDe = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export const finValorHora = (b: Base, nome: string) => {
  const i = b.professores.findIndex((t) => t.name === nome);
  if (i < 0) return 0;
  return b.professores[i].valorHora || FIN_HORA[i % FIN_HORA.length];
};
export const folhaBlack = (b: Base, a: Aula) => b.cursos.find((x) => x.name === a.prod)?.estrutura === 'nenhuma';
export const folhaValorBase = (b: Base, a: Aula) =>
  folhaBlack(b, a)
    ? a.valorAloc != null
      ? a.valorAloc
      : BLACK_VALOR_PADRAO
    : Math.round((finValorHora(b, a.prof) * (a.duracao || 50)) / 60);
export const folhaValor = (b: Base, a: Aula) => {
  const ov = b.ajustes[a.k];
  return ov && ov.valor != null ? ov.valor : folhaValorBase(b, a);
};
/** pedido de suporte: o registrado na aula vale; sem registro, a base traz alguns pedidos antigos (1 a cada 31 aulas dadas) */
export function folhaSuporte(b: Base, a: Aula): (Suporte & { base?: boolean }) | null {
  const ov = b.ajustes[a.k];
  if (ov && ov.suporte !== undefined) return ov.suporte || null;
  if (!['executada', 'substituida'].includes(a.estado) || a.prof === '—') return null;
  return fxHash(`${a.k}|suporte`) % 31 === 0
    ? {
        motivo: FOLHA_MOTIVOS[fxHash(a.k) % 2],
        detalhe: 'registrado pelo professor ao fim da aula',
        quem: a.prof,
        quando: a.quando.toISOString(),
        base: true,
      }
    : null;
}
export const folhaPresenca = (b: Base, a: Aula) => {
  if (!a.alunos.length) return a.n ? 'presença' : '—';
  return a.alunos.some((n) => fxPresenca(b, n, a) === 'presente')
    ? 'presença'
    : a.alunos.some((n) => fxPresenca(b, n, a) === 'falta')
      ? 'falta'
      : '—';
};
export const folhaSit = (b: Base, a: Aula) =>
  a.estado === 'cancelada' || a.prof === '—'
    ? 'fora'
    : a.estado === 'naoFinalizada'
      ? 'pendente'
      : !['executada', 'substituida'].includes(a.estado)
        ? 'fora'
        : folhaSuporte(b, a)
          ? 'descontada'
          : 'paga';
/** quem vê valor hora/aula: Admin e colaborador dos setores Pedagógico, Administrativo ou Financeiro/Fiscal */
export const folhaVeValor = (p: QuemAula) => {
  if (p.ehAluno) return false;
  if (p.tipoPerfil === 'Admin') return true;
  if (p.tipoPerfil !== 'Colaborador') return false;
  return (['ped', 'adm', 'fin'] as const).some((k) => {
    const x: AcessoArea | undefined = p.areas[k];
    return !!x && ['total', 'restrito'].includes(x.acesso);
  });
};
export const folhaR = (n: number) => `R$ ${Math.round(n).toLocaleString('pt-BR')}`;
export const folhaPodeValor = (b: Base, p: QuemAula, a: Aula) =>
  folhaVeValor(p) &&
  folhaBlack(b, a) &&
  aulaNivel(p) <= 3 &&
  a.estado !== 'cancelada' &&
  !b.fechadas.has(finMesDe(a.quando));
export const folhaPodeSuporte = (b: Base, p: QuemAula, a: Aula, agora = new Date()) =>
  aulaNivel(p) <= 4 &&
  a.estado !== 'cancelada' &&
  aulaHojeOuAntes(a, agora) &&
  a.prof !== '—' &&
  !b.fechadas.has(finMesDe(a.quando));

function folhaModelo(b: Base, p: QuemAula, a: Aula, agora: Date) {
  if (aulaNivel(p) === 9 || a.prof === '—') return null;
  const s = folhaSit(b, a);
  const sup = folhaSuporte(b, a);
  const ov = b.ajustes[a.k] ?? {};
  const ve = folhaVeValor(p);
  const v = folhaValor(b, a);
  return {
    ve,
    valor: ve ? v : null,
    valorTxt: ve ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null,
    valorBase: ve ? folhaValorBase(b, a) : null,
    origem: folhaBlack(b, a)
      ? ov.valor != null
        ? `valor alterado nesta aula${ov.valorMotivo ? ` · ${ov.valorMotivo}` : ''}`
        : 'valor hora/aula da alocação'
      : `valor hora de ${a.prof}`,
    alterado: ov.valor != null,
    valorMotivo: ov.valorMotivo ?? '',
    sit: FOLHA_SIT[s],
    suporte: sup ? { motivo: sup.motivo, detalhe: sup.detalhe } : null,
    fechada: b.fechadas.has(finMesDe(a.quando)),
    podeValor: folhaPodeValor(b, p, a),
    podeSuporte: folhaPodeSuporte(b, p, a, agora) && !sup,
    podeTirarSuporte: folhaPodeSuporte(b, p, a, agora) && !!sup && aulaNivel(p) <= 3,
    motivos: FOLHA_MOTIVOS,
  };
}

/* ---------------- modo apresentação: slides ---------------- */
const APR_TXT = {
  Inglês: {
    capa: "Today's lesson",
    aq: 'Warm-up',
    aqP: (t: string) => `What comes to mind when you hear “${t}”? Share one idea or experience.`,
    voc: 'Vocabulary',
    vocP: 'Use each word in a sentence about your own life.',
    gram: 'Grammar focus',
    gramP: (g: string) => `Notice how we use ${g}. Try three examples of your own.`,
    pr: 'Your turn',
    prP: (t: string) => `In pairs: talk about “${t}” for 3 minutes using at least 3 words from today.`,
    mat: 'Class material',
    fim: 'Wrap-up',
    fimP: 'What did you learn today? The Post-class review is released when the class ends.',
  },
  Espanhol: {
    capa: 'Clase de hoy',
    aq: 'Calentamiento',
    aqP: (t: string) => `¿Qué te viene a la mente con “${t}”? Comparte una idea o experiencia.`,
    voc: 'Vocabulario',
    vocP: 'Usa cada palabra en una frase sobre tu vida.',
    gram: 'Gramática',
    gramP: (g: string) => `Observa cómo usamos ${g}. Crea tres ejemplos propios.`,
    pr: 'Tu turno',
    prP: (t: string) => `En parejas: habla sobre “${t}” durante 3 minutos con al menos 3 palabras de hoy.`,
    mat: 'Material de clase',
    fim: 'Cierre',
    fimP: '¿Qué aprendiste hoy? El repaso Post-class se libera al terminar la clase.',
  },
};
const VOC_CLASSE: Record<string, string> = {
  n: 'substantivo',
  v: 'verbo',
  adj: 'adjetivo',
  col: 'colocação',
  id: 'expressão',
};

export type Slide =
  | { k: 'capa'; rot: string; titulo: string; sub: string; meta: string }
  | { k: 'aq' | 'pr' | 'fim'; rot: string; texto: string }
  | { k: 'voc'; rot: string; palavras: { w: string; classe: string }[]; texto: string }
  | { k: 'gram'; rot: string; titulo: string; texto: string }
  | { k: 'mat'; rot: string; titulo: string; url: string };

function aprSlides(b: Base, a: Aula, cur: ReturnType<typeof aulaCur>): Slide[] {
  const idioma = b.cursos.find((c) => c.name === a.prod)?.idioma === 'Espanhol' ? 'Espanhol' : 'Inglês';
  const T = APR_TXT[idioma];
  const x = cur?.x;
  const tit = x ? x.titulo : agRotulo(a);
  const s: Slide[] = [
    {
      k: 'capa',
      rot: T.capa,
      titulo: tit,
      sub: `${a.prod}${a.mod ? ` · ${a.mod}` : ''}`,
      meta: `${aulaDataTxt(a.quando)} · ${agHM(a.quando)} – ${aulaFim(a)}${a.prof === '—' ? '' : ` · ${a.prof}`}`,
    },
    { k: 'aq', rot: T.aq, texto: T.aqP(tit) },
  ];
  if (x?.voc.length)
    s.push({
      k: 'voc',
      rot: T.voc,
      palavras: x.voc.map(([w, cl]) => ({ w, classe: VOC_CLASSE[cl] || cl || '' })),
      texto: T.vocP,
    });
  if (x?.gram) s.push({ k: 'gram', rot: T.gram, titulo: x.gram, texto: T.gramP(x.gram) });
  s.push({ k: 'pr', rot: T.pr, texto: T.prP(tit) });
  if (x?.links.in) s.push({ k: 'mat', rot: T.mat, titulo: tit, url: x.links.in });
  s.push({ k: 'fim', rot: T.fim, texto: T.fimP });
  return s;
}

/** Tudo o que o popup, a página da aula e o modo apresentação mostram, com o que a pessoa pode fazer. */
export function aulaModelo(b: Base, a: Aula, p: QuemAula, agora = new Date()) {
  const nv = aulaNivel(p);
  const aluno = nv === 9;
  const ov: AjusteAula = b.ajustes[a.k] ?? {};
  const cancelada = a.estado === 'cancelada';
  const passou = aulaPassou(a, agora);
  const hoje = aulaHojeOuAntes(a, agora);
  const est = a.bloqueada
    ? (['Horário bloqueado', 'gray'] as [string, string])
    : ov.iniciada && !ov.concluida && !cancelada
      ? (['Em andamento', 'blue'] as [string, string])
      : AULA_EST[a.estado];
  const cur = aulaCur(b, a);
  const sala = aulaSala(b, a);
  /* 25/09/2026: na aula do Community Flow o aluno não vê quem mais agendou, só ele mesmo */
  const meuNome = (p.alunoId != null && b.alunos.find((x) => x.id === p.alunoId)?.name) || p.nome;
  /* o aluno vê o próprio nome inteiro; dos colegas, só o primeiro nome e nenhum e-mail */
  const verNome = (x: { nome: string; email: string }) =>
    !aluno || x.nome === meuNome ? { nome: x.nome, email: x.email } : { nome: primeiroNome(x.nome), email: '' };
  const soEu = aluno && a.mod === MOD_FLOW;
  const al = aulaAlunos(b, a).filter((x) => !soEu || x.nome === meuNome);
  const n = soEu ? al.length : a.n;
  const podeGer = !aluno && nv <= 3 && !cancelada && !passou;
  const concluidaPg = !!ov.concluida || ['executada', 'substituida'].includes(a.estado);
  const podePres = nv <= 4 && hoje && !cancelada && !ov.concluida;
  const presentesDaLista = al.filter((x) => !x.fora);
  const marcados = presentesDaLista.filter((x) => ['presente', 'falta'].includes(ov.pres?.[x.nome] ?? '')).length;
  const idioma = b.cursos.find((c) => c.name === a.prod)?.idioma;
  const doCurso = b.curriculos.filter(
    (c) => c.grupo === a.prod && c.conteudos.length && (!a.mod || c.aplicado.includes(a.mod) || c.tipo !== 'produto'),
  );
  const acervos = b.curriculos.filter(
    (c) => c.tipo === 'acervo' && c.idioma === idioma && c.conteudos.length && !doCurso.includes(c),
  );
  const z = ov.zoom ?? {};
  const concluidaApr = !!ov.concluida;
  const aprEst: [string, string] = cancelada
    ? ['Cancelada', 'gray']
    : concluidaApr
      ? ['Concluída', 'green']
      : ov.iniciada
        ? ['Em andamento', 'blue']
        : hoje
          ? ['Aguardando início', 'amber']
          : ['Agendada', 'gray'];
  const presApr = presentesDaLista.filter((x) => ov.pres?.[x.nome] === 'presente').length;
  const v = avulsaDe(b, a);
  const c = b.cursos.find((x) => x.name === a.prod);
  /* 24/09/2026: a grade do módulo tem este horário? (Encerrar disponibilidade na grade) */
  const hm = agHM(a.quando);
  const naGrade =
    !a.avulsa &&
    !!a.mod &&
    !!c?.modInfo[a.mod]?.horarios.some((h) => h.dia === a.quando.getDay() && h.hora === hm && !h.ate);
  /* 25/09/2026: o aluno cancela a própria aula até o prazo de cancelamento do módulo (ou do curso) */
  const eu = aluno ? al.find((x) => x.nome === meuNome && !x.fora) : undefined;
  const cancelarAte = prazoAte(c, a.mod, 'cancelamento', a.quando);
  const meuCancelamento =
    eu && !cancelada && !passou && !a.bloqueada
      ? {
          pode: agora < cancelarAte,
          ate: `${fmt.data(cancelarAte)} às ${agHM(cancelarAte)}`,
          regra: prazoTxt(prazoHoras(c, a.mod, 'cancelamento')),
          flow: a.mod === MOD_FLOW,
          /* 30/09/2026: Regular = o aluno solicita e a equipe decide; Open-Entry e Particular = cancela direto */
          modo: modoAluno(c).cancelar,
          /* Particular: o aluno pode pedir mudança de dias e horários */
          mudanca: modoAluno(c).mudanca,
          /* preenchido na rota: já há uma solicitação de cancelamento pendente desta aula */
          pendente: false,
        }
      : null;
  const candidatos = b.alunos
    .filter((x) => !a.alunos.includes(x.name) && x.matriculas.some((e) => !e.desativadoEm && e.curso === a.prod))
    .map((x) => x.name)
    .sort((x, y) => x.localeCompare(y, 'pt-BR'));

  return {
    k: a.k,
    rot: aulaRot(a),
    estado: a.estado,
    est,
    tipo: a.vagas === 1 ? 'Particular' : 'Em grupo',
    prod: a.prod,
    mod: a.mod,
    modRot: a.mod ? (/^Turma /.test(a.mod) ? 'Turma' : 'Módulo') : null,
    corCurso: b.corCurso[a.prod] || '#1a4fd6',
    /* 30/09/2026: o chip do módulo leva a cor do módulo, a mesma da agenda */
    corMod: a.mod ? agCor(b, a) : null,
    trava: a.bloqueada ? 'horário bloqueado' : cancelada ? 'aula cancelada' : passou ? 'aula já aconteceu' : '',
    titulo: cur ? cur.x.titulo : (v?.topico ?? agRotulo(a)),
    /* campos da aula (24/09/2026): Tópico, Início e Término separados */
    topico: cur ? cur.x.titulo : (v?.topico ?? ''),
    inicio: hm,
    termino: aulaFim(a),
    avulsa: v ? { local: v.local, descricao: v.descricao } : null,
    bloqueada: !!a.bloqueada,
    podeBloquear: !aluno && nv <= 3 && !passou && (!cancelada || !!a.bloqueada),
    encerrarGrade: {
      pode: !aluno && nv <= 2 && !passou && naGrade,
      motivo: naGrade
        ? ''
        : a.avulsa
          ? 'aula avulsa não é horário da grade'
          : 'só horários da grade de um módulo (Cursos › Módulos) podem ser encerrados',
    },
    candidatos: !aluno && nv <= 3 ? candidatos : [],
    meuCancelamento,
    transcricao: sala.zoom && passou && !cancelada,
    rotulo: agRotulo(a),
    dataTxt: aulaDataTxt(a.quando),
    horario: `${hm} – ${aulaFim(a)}`,
    iso: fmt.iso(a.quando),
    prof: a.prof,
    sub: a.sub,
    podeAlterarProf: !aluno && nv <= 3 && !cancelada,
    profsHabilitados: b.professores.filter((t) => t.active && agHabilitado(t, a.prod, a.mod)).map((t) => t.name),
    sala,
    ehAluno: aluno,
    materiais: { pre: cur?.x.links.pre ?? '', in: cur?.x.links.in ?? '', post: cur?.x.links.post ?? '' },
    gravacao: sala.zoom && passou && !cancelada ? 'sem coleta' : 'sem gravação',
    n,
    alunos: al.map((x) => ({ ...verNome(x), fora: x.fora, incluido: x.incluido })),
    extra: Math.max(0, (n || 0) - al.filter((x) => !x.fora).length),
    podeGerenciar: podeGer,
    cancelada,
    podeCancelar: !aluno && nv <= 2 && !passou && !cancelada,
    podeReabrir: !aluno && nv <= 2 && !passou && cancelada && !a.bloqueada,
    folha: folhaModelo(b, p, a, agora),
    /* página da aula */
    pagina: {
      concluida: concluidaPg,
      iniciada: !!ov.iniciada,
      podePresenca: podePres,
      marcados,
      aviso: cancelada
        ? 'Aula cancelada: não há sala nem presença.'
        : !hoje
          ? 'A lista de presença abre no dia da aula.'
          : ov.concluida
            ? 'Aula concluída: a presença está registrada.'
            : '',
      lista: presentesDaLista.map((x) => ({
        ...verNome(x),
        p: ov.pres?.[x.nome] ?? (concluidaPg ? fxPresenca(b, x.nome, a) : null),
      })),
      semCadastro: Math.max(0, (n || 0) - presentesDaLista.length),
    },
    /* modo apresentação */
    apresentacao: {
      est: aprEst,
      podeOperar: nv <= 4 && hoje && !cancelada && !concluidaApr,
      podeConteudo: nv <= 4 && !cancelada && !concluidaApr,
      podeNotas: nv <= 4 && !cancelada,
      trava: cancelada
        ? 'Aula cancelada: sem sala nem presença.'
        : !hoje
          ? 'A sala e a presença abrem no dia da aula. Os slides já dá para revisar.'
          : concluidaApr
            ? 'Aula concluída: presença registrada e reunião encerrada.'
            : nv > 4
              ? 'Só leitura para o seu acesso.'
              : '',
      slides: aprSlides(b, a, cur),
      curriculo: cur
        ? `${cur.c.nome}${ov.conteudo ? ' · trocado para esta aula' : ''}`
        : 'sem currículo para esta aula',
      conteudoAtual: ov.conteudo ? `${ov.conteudo.cur}|${ov.conteudo.i}` : '',
      conteudos: [...doCurso, ...acervos].map((c) => ({
        grupo: c.nome,
        itens: c.conteudos.map((x, i) => ({ v: `${c.id}|${i}`, l: `${i + 1}. ${x.titulo}` })),
      })),
      zoom: {
        aberta: !!z.aberta,
        minutos: z.aberta && z.desde ? Math.max(0, Math.floor((+agora - +new Date(z.desde)) / 6e4)) : null,
        durou: z.durou ?? null,
        gravando: !!z.gravando,
        gravou: !!z.gravou,
        enviado: z.enviado ? fmt.hora(new Date(z.enviado)) : null,
      },
      emAulaHa: ov.inicioEm && !concluidaApr ? Math.max(0, Math.floor((+agora - +new Date(ov.inicioEm)) / 6e4)) : null,
      presentes: presApr,
      notas: ov.notas ?? '',
    },
  };
}
export type AulaModelo = ReturnType<typeof aulaModelo>;
