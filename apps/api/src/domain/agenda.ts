/**
 * Agenda: uma lista de aulas gerada do cadastro — porte fiel de agOfertas/agAulasEntre do artefato.
 * Turmas (FAAP, Palmares) pela grade da turma; módulos em grupo por uma grade fixa de cada módulo;
 * Alumni Black por aluno; Community Flow é aula particular agendada pelo aluno com crédito (domain/flow.ts). Sem domingo e feriado. O estado de cada aula é estável
 * (mesma data, mesmo estado) e os ajustes feitos numa aula (AulaAjuste) valem por cima.
 */
import type { AlunoB, Base, CursoB, MatriculaB, ProfessorB } from './base.ts';

export const AG_DIAS: Record<string, number> = { Seg: 1, Ter: 2, Qua: 3, Qui: 4, Sex: 5, Sáb: 6 };
export const DN = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export const agISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** hora da oferta em horas (19.5 = 19:30, grade do módulo desde 24/09/2026) */
export const agHH = (h: number) => {
  const m = Math.round(h * 60);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
/** hora de uma data: 19:30 */
export const agHM = (d: Date) => agHH(d.getHours() + d.getMinutes() / 60);
/** "19:30" → 19.5 */
export const agHoraNum = (hm: string) => {
  const [h, m] = hm.split(':').map(Number);
  return (h || 0) + (m || 0) / 60;
};
/** a semana vai de domingo a sábado */
export const agInicioSemana = (d: Date) => {
  const s = new Date(d);
  s.setDate(d.getDate() - d.getDay());
  s.setHours(0, 0, 0, 0);
  return s;
};

export type Estado =
  | 'semAlunos'
  | 'comAlunos'
  | 'semProfessor'
  | 'executada'
  | 'substituida'
  | 'naoFinalizada'
  | 'cancelada';

export const AG_KB: [Estado, string, string, string][] = [
  [
    'semAlunos',
    'Sem alunos',
    '#e8a020',
    'Aula aberta sem nenhum aluno agendado. Decidir se mantém, junta com outra turma ou cancela.',
  ],
  ['comAlunos', 'Com alunos', '#1a4fd6', 'Aula futura com professor, sala e ao menos um aluno. Só acompanhar.'],
  [
    'semProfessor',
    'Sem professor',
    '#dc2f3c',
    'Tem aluno e ninguém escalado. Trava a aula e a folha — resolver antes do horário.',
  ],
  ['executada', 'Executada', '#0f9d6e', 'Dada pelo professor escalado e finalizada com presença registrada.'],
  [
    'substituida',
    'Substituída',
    '#6d28d9',
    'Dada por outro professor. A folha vai para quem deu a aula, com a taxa dele.',
  ],
  [
    'naoFinalizada',
    'Não finalizada',
    '#c8871a',
    'O horário passou e a aula não foi encerrada: falta presença ou fechamento.',
  ],
  ['cancelada', 'Cancelada', '#98a1b2', 'Retirada da agenda. O crédito do aluno volta ao extrato conforme a política.'],
];

export const FX_ESTADO: Record<Estado, [string, string]> = {
  semAlunos: ['sem alunos', 'amber'],
  comAlunos: ['agendada', 'blue'],
  semProfessor: ['sem professor', 'red'],
  executada: ['executada', 'green'],
  substituida: ['substituída', 'purple'],
  naoFinalizada: ['não finalizada', 'amber'],
  cancelada: ['cancelada', 'gray'],
};

export type Oferta = {
  prod: string;
  mod: string | null;
  quem: string;
  prof: string;
  sala: string;
  vagas: number;
  ocupadas?: number;
  duracao: number;
  dias: number[];
  hora: number;
  alunos: string[];
  aluno?: number;
  alocada?: boolean;
  valor?: number;
  /** 24/09/2026: primeiro e último dia da oferta (AAAA-MM-DD); o horário encerrado na grade tem `ate` */
  desde?: string;
  ate?: string;
  /** aula avulsa (Agenda › + Novo › Aula): id da AulaAvulsa */
  avulsa?: string;
  /** horário da grade do módulo (Novo curso › Grade): o aluno escolhe entre os horários, não está em todos */
  grade?: boolean;
};

/** módulo de aulas particulares com crédito do Community live classes (antes "Private FLOW") */
export const MOD_FLOW = 'Community Flow';

export type Aula = {
  k: string;
  quando: Date;
  prod: string;
  mod: string | null;
  quem: string;
  prof: string;
  sub: string | null;
  sala: string;
  alunos: string[];
  n: number;
  vagas: number;
  estado: Estado;
  duracao: number;
  valorAloc?: number;
  avulsa?: string;
  /** horário bloqueado (vale como cancelada, com o rótulo próprio) */
  bloqueada?: boolean;
};

/* ---- leitura do aluno ---- */
export const alMat = (a: AlunoB) => a.matriculas.filter((e) => !e.desativadoEm);
export const alSit = (a: AlunoB) => a.status || (a.desativadoEm ? 'Inativo' : 'Ativo');
export const AL_SIT = ['Ativo', 'Suspenso', 'Congelado', 'Inadimplente', 'Cancelado', 'Inativo'];

/** regras fechadas do curso (Cursos › curso › Regras) */
export const crsRegras = (c: CursoB) =>
  c.regras ?? {
    vagas: c.estrutura === 'nenhuma' ? 1 : 8,
    duracao: c.estrutura === 'turmas' ? 50 : c.idioma === 'Espanhol' ? 60 : 45,
    modalidades: c.estrutura === 'turmas' ? ['Presencial', 'Online'] : ['Online', 'Presencial'],
    pacote: c.estrutura === 'turmas' ? 36 : c.estrutura === 'nenhuma' ? 32 : 48,
    cancelamento: c.estrutura === 'nenhuma' ? 24 : 6,
    exigeDisp: c.estrutura !== 'turmas',
  };
export const crsItens = (c: CursoB) => (c.estrutura === 'turmas' ? c.turmas.map((t) => t.name) : c.modulos);

/**
 * Horas de antecedência para o aluno agendar ou cancelar uma aula: a regra do módulo (em minutos, Cursos › Módulos)
 * vale antes da do curso (Regras: cancelamento e antecedência, em horas).
 */
export function prazoHoras(c: CursoB | undefined, mod: string | null, regra: 'agendamento' | 'cancelamento') {
  const min = c && mod ? c.modInfo[mod]?.[`${regra}Min`] : null;
  if (min != null) return min / 60;
  const rg = c ? crsRegras(c) : null;
  return regra === 'cancelamento' ? (rg?.cancelamento ?? 6) : (rg?.antecedencia ?? 0);
}
/** último instante para agendar ou cancelar a aula que começa em `quando` */
export const prazoAte = (
  c: CursoB | undefined,
  mod: string | null,
  regra: 'agendamento' | 'cancelamento',
  quando: Date,
) => new Date(+quando - prazoHoras(c, mod, regra) * 36e5);
/** "até 3 horas antes", "até 30 minutos antes" */
export function prazoTxt(h: number) {
  if (!h) return 'até o início da aula';
  const [n, um, varios] = Number.isInteger(h) ? [h, 'hora', 'horas'] : [Math.round(h * 60), 'minuto', 'minutos'];
  return `até ${n} ${n === 1 ? um : varios} antes`;
}

/** professor habilitado no curso e, se a habilitação for recortada, no módulo ou turma */
export const agHabilitado = (t: ProfessorB, curso: string, item: string | null) =>
  t.active &&
  t.cursos.includes(curso) &&
  (item == null || !t.habil || !t.habil[curso] || t.habil[curso].includes(item));

const hashTxt = (s: string) => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return h;
};
/** quantos horários da grade do módulo cada aluno frequenta por semana */
export const GRADE_POR_ALUNO = 2;
/**
 * a grade do módulo são opções de horário (24/09/2026): cada aluno fica, estável, em até 2 horários em dias
 * diferentes, de preferência dentro da disponibilidade dele; os demais horários ficam abertos. Devolve os alunos
 * de cada horário, na ordem de `hs`.
 */
function gradeDoAluno(alunos: AlunoB[], mod: string, hs: { dia: number; hora: string }[]) {
  const out = hs.map((): string[] => []);
  for (const a of alunos) {
    const disp = a.disp ? new Set(a.disp) : null;
    const todos = hs.map((_, i) => i);
    const dentro = disp ? todos.filter((i) => disp.has(dispK(hs[i].dia, agHoraNum(hs[i].hora)))) : todos;
    const cand = dentro.length ? dentro : todos;
    const ini = hashTxt(`${a.name}|${mod}`) % cand.length;
    const dias = new Set<number>();
    /* passo 7 espalha pela semana (primo com o total, senão de 1 em 1) */
    const passo = cand.length % 7 ? 7 : 1;
    for (let n = 0; n < cand.length && dias.size < GRADE_POR_ALUNO; n++) {
      const i = cand[(ini + n * passo) % cand.length];
      if (dias.has(hs[i].dia) || out[i].includes(a.name)) continue;
      dias.add(hs[i].dia);
      out[i].push(a.name);
    }
  }
  return out;
}

/** ofertas: o que se repete toda semana — produto, módulo ou turma, dias, hora, professor, sala e alunos */
export function agOfertas(b: Base): Oferta[] {
  const out: Oferta[] = [];
  /* índices das ofertas da grade sem professor vinculado */
  const salasGrupo = ['Zoom 01', 'Zoom 02', 'Sala 12 — Paulista'];
  const salasPart = ['Zoom 03', 'Zoom 04'];
  const HORAS = [7, 8, 10, 12, 17, 18, 19, 20];
  const PARES = [
    [1, 3],
    [2, 4],
    [3, 5],
    [1, 4],
    [2, 5],
  ];
  const profsDe = (nome: string, item: string | null) =>
    b.professores.filter((t) => agHabilitado(t, nome, item)).map((t) => t.name);
  const um = (l: string[], k: number) => (l.length ? l[k % l.length] : '—');
  const casa = (e: MatriculaB, prod: string, mod: string | null) =>
    e.curso === prod && (mod == null || e.modulo === mod);
  const alunosDe = (prod: string, mod: string | null) =>
    b.alunos.filter((a) => alMat(a).some((e) => casa(e, prod, mod)));
  const alocDe = (a: AlunoB, prod: string, mod: string | null) => alMat(a).find((e) => casa(e, prod, mod))?.aloc;
  const individual = (
    c: CursoB,
    mod: string | null,
    a: AlunoB,
    j: number,
    prof: string,
    dias: number[],
    hora: number,
  ) => {
    const x = alocDe(a, c.name, mod) || {};
    out.push({
      prod: c.name,
      mod,
      quem: a.name,
      prof: x.prof || prof,
      sala: salasPart[j % 2],
      vagas: 1,
      dias: x.dias || dias,
      hora: x.hora != null ? x.hora : hora,
      alunos: [a.name],
      aluno: a.id,
      duracao: crsRegras(c).duracao,
      alocada: !!x.prof,
      valor: x.valor,
    });
  };
  b.cursos
    .filter((c) => c.active !== false)
    .forEach((c, ci) => {
      const rg = crsRegras(c);
      if (c.estrutura === 'turmas') {
        for (const t of c.turmas) {
          if (t.ativa === false) continue;
          const [d, h] = String(t.grade || '').split(' · ');
          if (!h) continue;
          out.push({
            prod: c.name,
            mod: t.name,
            quem: t.grupo,
            prof: t.professor || '—',
            sala: t.sala,
            vagas: t.vagas,
            ocupadas: t.ocupadas,
            duracao: rg.duracao,
            dias: d
              .split(' e ')
              .map((x) => AG_DIAS[x])
              .filter(Boolean),
            hora: Number.parseInt(h, 10),
            alunos: alunosDe(c.name, t.name).map((a) => a.name),
          });
        }
      } else if (c.estrutura === 'modulos') {
        c.modulos.forEach((m, k) => {
          /* Community Flow (24/09/2026): a grade do módulo é só a disponibilidade para o aluno agendar com crédito;
             a aula agendada é uma aula avulsa. Fica a aula fixa de quem tem alocação gravada na ficha. */
          if (m === MOD_FLOW) {
            alunosDe(c.name, m).forEach((a, j) => {
              if (alocDe(a, c.name, m)?.prof) individual(c, m, a, j, '—', PARES[(j + 1) % 5], HORAS[(j * 3 + 5) % 8]);
            });
            return;
          }
          /* 24/09/2026: módulo com grade cadastrada (Novo curso › Grade) usa os horários e professores dela */
          const hs = c.modInfo[m]?.horarios ?? [];
          if (hs.length) {
            const lugares = gradeDoAluno(alunosDe(c.name, m), m, hs);
            hs.forEach((h, j) => {
              out.push({
                prod: c.name,
                mod: m,
                quem: 'Turma aberta',
                grade: true,
                /* horário da grade sem professor vinculado: o professor sai do cadastro (fim da função) */
                prof: h.professorId ? (h.prof ?? um(profsDe(c.name, m), k + j)) : '—',
                sala: salasGrupo[(k + j) % 3],
                vagas: c.modInfo[m]?.vagas ?? rg.vagas,
                duracao: rg.duracao,
                dias: [h.dia],
                hora: agHoraNum(h.hora),
                alunos: lugares[j],
                ...(h.ate ? { ate: h.ate } : {}),
              });
            });
            return;
          }
          out.push({
            prod: c.name,
            mod: m,
            quem: 'Turma aberta',
            prof: um(profsDe(c.name, m), k),
            sala: salasGrupo[k % 3],
            vagas: rg.vagas,
            duracao: rg.duracao,
            dias: m === 'Suporte pedagógico' ? [5] : PARES[(k + ci) % 5],
            hora: HORAS[(k * 3 + ci) % 8],
            alunos: alunosDe(c.name, m).map((a) => a.name),
          });
        });
      } else {
        alunosDe(c.name, null).forEach((a, j) => {
          individual(c, null, a, j, um(profsDe(c.name, null), j), PARES[(j + 2) % 5], HORAS[(j * 5 + 2) % 8]);
        });
      }
    });
  /* 24/09/2026: aulas avulsas (Agenda › + Novo › Aula) — uma oferta de um dia só, com a duração do início ao término */
  for (const v of b.avulsas ?? []) {
    const c = b.cursos.find((x) => x.name === v.curso);
    const dia = agISO(v.inicio);
    out.push({
      prod: v.curso,
      mod: v.mod,
      quem: `Aula avulsa ${v.id}`,
      prof: v.prof ?? '—',
      sala: v.local || '—',
      vagas: Math.max(v.alunos.length, (c && crsRegras(c).vagas) || 1),
      duracao: Math.max(5, Math.round((+v.fim - +v.inicio) / 6e4)),
      dias: [v.inicio.getDay()],
      hora: v.inicio.getHours() + v.inicio.getMinutes() / 60,
      alunos: v.alunos,
      desde: dia,
      ate: dia,
      avulsa: v.id,
    });
  }
  /* 30/09/2026: horário da grade sem professor fica sem professor — o vínculo é só manual (grade ou aula) */
  return out;
}

/** as aulas de um intervalo, com o estado de cada uma — mesma data, mesmo estado, sempre */
export function agAulasEntre(
  b: Base,
  ini: Date,
  fim: Date,
  agora = new Date(),
  ofertas = agOfertas(b),
  /** o consumo do pacote (consumo.ts) não precisa da sala do Zoom, e distribuir um ano inteiro é caro */
  distribuiZoom = true,
): Aula[] {
  const out: Aula[] = [];
  const d = new Date(ini);
  d.setHours(0, 0, 0, 0);
  const f = new Date(fim);
  f.setHours(23, 59, 59, 999);
  for (; d <= f; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    const dia = agISO(d);
    /* domingo e feriado não têm aula da grade; a aula avulsa marcada no dia vale */
    const fechado = !dow || b.feriados.has(dia);
    ofertas.forEach((o, i) => {
      if (!o.dias.includes(dow) || (fechado && !o.avulsa)) return;
      if ((o.desde && dia < o.desde) || (o.ate && dia > o.ate)) return;
      const quando = new Date(d);
      quando.setHours(0, Math.round(o.hora * 60), 0, 0);
      const h = (i * 31 + d.getDate() * 7 + d.getMonth() * 13) % 11;
      const k = [o.prod, o.mod || '', o.quem, dia, o.hora].join('|');
      const ov = b.ajustes[k];
      /* alunos incluídos só nesta aula (Gerenciar alunos › Adicionar) */
      const extras = (ov?.extras ?? []).filter((x) => !o.alunos.includes(x));
      const alunos = extras.length ? [...o.alunos, ...extras] : o.alunos;
      const n = (o.ocupadas != null ? o.ocupadas : o.alunos.length) + extras.length;
      let estado: Estado;
      let prof = o.prof;
      let sub: string | null = null;
      if (o.avulsa)
        /* aula avulsa: sem o sorteio de estados da grade; sem professor fica em Sem professor, antes ou depois */
        estado =
          o.prof === '—'
            ? 'semProfessor'
            : quando > agora
              ? !n
                ? 'semAlunos'
                : 'comAlunos'
              : !n
                ? 'cancelada'
                : 'naoFinalizada';
      else if (quando > agora)
        estado =
          o.prof === '—'
            ? /* horário da grade ainda sem aluno: aberto, o professor sai do cadastro quando alguém entrar */
              o.grade && !n
              ? 'semAlunos'
              : 'semProfessor'
            : !n
              ? 'semAlunos'
              : h === 2
                ? 'semProfessor'
                : h === 3
                  ? 'cancelada'
                  : 'comAlunos';
      else
        estado =
          !n || h === 3
            ? 'cancelada'
            : h === 0
              ? 'substituida'
              : h === 1 && +agora - +quando < 12 * 864e5
                ? 'naoFinalizada'
                : 'executada';
      if (estado === 'semProfessor') prof = '—';
      if (estado === 'substituida') {
        const ps = b.professores.filter((t) => t.active && t.name !== o.prof && t.cursos.includes(o.prod));
        if (ps.length) {
          sub = o.prof;
          prof = ps[(i + d.getDate()) % ps.length].name;
        } else estado = 'executada';
      }
      let nn = n;
      if (ov) {
        if (ov.fora) nn = Math.max(0, n - alunos.filter((x) => ov.fora![x]).length);
        if (ov.prof && ov.prof !== prof) {
          if (quando > agora) {
            if (estado === 'semProfessor') estado = nn ? 'comAlunos' : 'semAlunos';
            prof = ov.prof;
          } else {
            if (!sub && prof !== '—') sub = prof;
            prof = ov.prof;
            if (estado === 'executada') estado = 'substituida';
          }
        }
        if (quando > agora && estado === 'comAlunos' && !nn) estado = 'semAlunos';
        if (ov.concluida && estado !== 'cancelada') estado = sub ? 'substituida' : 'executada';
        if (ov.cancelada) estado = 'cancelada';
        /* horário bloqueado: sai da agenda dos alunos, o professor fica livre e o crédito volta (como cancelada) */
        if (ov.bloqueada) {
          estado = 'cancelada';
          nn = 0;
        }
      }
      out.push({
        k,
        quando,
        prod: o.prod,
        mod: o.mod,
        quem: o.quem,
        prof,
        sub,
        sala: o.sala,
        alunos,
        n: nn,
        vagas: o.vagas,
        estado,
        duracao: o.duracao || 50,
        valorAloc: o.valor,
        ...(o.avulsa ? { avulsa: o.avulsa } : {}),
        ...(ov?.bloqueada ? { bloqueada: true } : {}),
      });
    });
  }
  return (distribuiZoom ? zoomDistribui(b, out) : out).sort((a, c) => +a.quando - +c.quando);
}

/** até quantas aulas ao mesmo tempo uma conta (sala) do Zoom recebe — regra do usuário, 30/09/2026 */
export const ZOOM_POR_CONTA = 2;
export const SEM_CONTA_ZOOM = 'Sem conta Zoom livre';

/**
 * Salas do Zoom = contas já existentes. Cada conta comporta até 2 aulas simultâneas, nunca 3: as aulas online do dia
 * (sala do Zoom), em ordem de início, vão para a primeira conta com vaga no horário; lotadas todas, a aula fica
 * "Sem conta Zoom livre" (alerta). Contas que atendem o curso (ou o tipo do curso) vêm antes das gerais.
 * Aula cancelada ou bloqueada não ocupa conta.
 */
export function zoomDistribui(b: Base, aulas: Aula[]) {
  const contas = b.salas.filter((s) => s.zoom && s.active);
  if (!contas.length) return aulas;
  const ehZoom = new Set(b.salas.filter((s) => s.zoom).map((s) => s.name));
  const ocup = new Map<string, [number, number][]>();
  const fim = (a: Aula) => +a.quando + (a.duracao || 50) * 6e4;
  const livre = (conta: string, a: Aula) =>
    (ocup.get(conta) ?? []).filter(([i, f]) => i < fim(a) && f > +a.quando).length < ZOOM_POR_CONTA;
  const online = aulas
    .filter((a) => (ehZoom.has(a.sala) || a.sala === SEM_CONTA_ZOOM) && a.estado !== 'cancelada' && !a.bloqueada)
    .sort((x, y) => +x.quando - +y.quando || x.k.localeCompare(y.k));
  for (const a of online) {
    const c = b.cursos.find((x) => x.name === a.prod);
    const doCurso = contas.filter((s) => s.atende === a.prod || (!!c?.tipo && s.atende === c.tipo));
    const ordem = [...doCurso, ...contas.filter((s) => !doCurso.includes(s))];
    /* a reunião já criada numa conta fica nela (o link não muda), se ainda houver vaga */
    const fixa = b.ajustes[a.k]?.zoom?.reuniao?.conta;
    const achou =
      (fixa && ordem.find((s) => s.zoomEmail === fixa && livre(s.name, a))) || ordem.find((s) => livre(s.name, a));
    if (!achou) {
      a.sala = SEM_CONTA_ZOOM;
      continue;
    }
    a.sala = achou.name;
    ocup.set(achou.name, [...(ocup.get(achou.name) ?? []), [+a.quando, fim(a)]]);
  }
  return aulas;
}

/** cor da aula: a do módulo neste curso (30/09/2026: mesmo nome em dois cursos não pega a cor do outro), senão a do curso */
export const agCor = (b: Base, a: { mod: string | null; prod: string }) =>
  (a.mod && (b.cursos.find((c) => c.name === a.prod)?.cores[a.mod] || b.corModulo[a.mod])) ||
  b.corCurso[a.prod] ||
  '#1e46c8';
/** rótulo curto: o módulo diz mais que o produto; a turma sozinha é ambígua e leva o primeiro nome do produto */
export const agRotulo = (a: { mod: string | null; prod: string }) =>
  !a.mod ? a.prod : /^Turma /.test(a.mod) ? `${a.prod.split(' ')[0]} · ${a.mod}` : a.mod;
export const agNaAgenda = (l: Aula[]) => l.filter((a) => a.estado !== 'cancelada');
export const agDiasTxt = (o: Oferta) => o.dias.map((d) => DN[d]).join(' e ');
/** faixa da aula: 12:00–12:45 */
export const agFaixa = (o: { hora: number; duracao?: number }) => {
  const fim = Math.round(o.hora * 60) + (o.duracao || 50);
  return `${agHH(o.hora)}–${String(Math.floor(fim / 60)).padStart(2, '0')}:${String(fim % 60).padStart(2, '0')}`;
};
/** aula individual: professor, dias e hora são da matrícula (Alumni Black) */
export const agIndividual = (c: CursoB, _mod?: string | null) => c.estrutura === 'nenhuma';

/* ---- disponibilidade: grade dia × hora ---- */
export const dispK = (d: number, h: number) => `${d}-${Math.floor(h)}`;
const dispDe = (ofs: Oferta[], padrao: [number[], number[]]) => {
  const s = new Set<string>();
  for (const o of ofs.filter((x) => !x.avulsa))
    for (const d of o.dias) for (const h of [o.hora - 1, o.hora, o.hora + 1]) if (h >= 7 && h <= 21) s.add(dispK(d, h));
  if (!s.size) for (const d of padrao[0]) for (const h of padrao[1]) s.add(dispK(d, h));
  return [...s];
};
export const alDisp = (b: Base, a: AlunoB, ofs = agOfertas(b)) =>
  a.disp ??
  dispDe(
    ofs.filter((o) => o.alunos.includes(a.name)),
    [
      [1, 2, 3, 4, 5],
      [18, 19, 20],
    ],
  );
/**
 * disponibilidade do professor: só a marcada à mão (30/09/2026 — nada de disponibilidade tirada das aulas nem de
 * horário padrão). Sem marcação, vazia. Os parâmetros extras ficam pela assinatura antiga.
 */
export const prDisp = (_b: Base, t: ProfessorB, _ofs?: Oferta[]) => t.disp ?? [];
/** aulas fora da disponibilidade — só conta para quem já marcou a disponibilidade */
export const prConflitos = (t: ProfessorB, meus: Oferta[]) => (t.disp ? dispConflitos(t.disp, meus) : []);
/** aula da grade num dia e hora que não estão marcados */
export const dispConflitos = (disp: string[], ofs: Oferta[]) => {
  const on = new Set(disp);
  return ofs.flatMap((o) => o.dias.filter((d) => !on.has(dispK(d, o.hora))).map((d) => ({ o, d })));
};

/** presença fictícia e estável: a mesma aula dá sempre o mesmo resultado; a lançada na aula vale antes */
export function fxPresenca(b: Base, nome: string, a: Aula): 'presente' | 'falta' | 'pendente' | null {
  const ov = a.k ? b.ajustes[a.k] : undefined;
  if (ov?.pres?.[nome]) return ov.pres[nome];
  if (a.estado === 'naoFinalizada') return 'pendente';
  if (!['executada', 'substituida'].includes(a.estado)) return null;
  let h = 0;
  for (const ch of nome) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return (h + a.quando.getDate() * 7 + a.quando.getMonth() * 11 + a.quando.getHours()) % 9 === 0 ? 'falta' : 'presente';
}

/**
 * Decisão 2.5.3.3 (05/10/2026): o professor pode estar em qualquer curso e módulo, mas nunca no mesmo dia e horário
 * em duas aulas, em nenhuma situação. Procura, na grade semanal de todos os cursos (módulos, turmas e alocações),
 * uma oferta do professor que se sobreponha ao horário pedido. `fora` tira da busca o curso que está sendo salvo.
 */
export function choqueNaGrade(
  b: Base,
  prof: string,
  dia: number,
  hora: number,
  duracaoMin: number,
  fora?: (o: Oferta) => boolean,
): Oferta | undefined {
  const fim = hora + duracaoMin / 60;
  /* só vínculos gravados: horário de grade com professor, turma com titular e alocação individual salva
     (as ofertas geradas para módulo sem grade ou aluno sem alocação não prendem o professor) */
  const turmas = new Set(b.cursos.filter((c) => c.estrutura === 'turmas').map((c) => c.name));
  const gravada = (o: Oferta) => !!o.grade || !!o.alocada || turmas.has(o.prod);
  return agOfertas(b).find(
    (o) =>
      o.prof === prof &&
      gravada(o) &&
      !o.ate &&
      o.dias.includes(dia) &&
      !(fora?.(o) ?? false) &&
      o.hora < fim &&
      hora < o.hora + (o.duracao || 60) / 60,
  );
}

/** Decisão 2.5.3.3 nas aulas do dia: as aulas não canceladas do professor que se sobrepõem ao horário pedido */
export function choquesDaAula(b: Base, prof: string, inicio: Date, duracaoMin: number, ignorar: string[] = []): Aula[] {
  const fim = +inicio + duracaoMin * 6e4;
  return agAulasEntre(b, inicio, inicio).filter(
    (a) =>
      a.prof === prof &&
      a.estado !== 'cancelada' &&
      !ignorar.includes(a.k) &&
      +a.quando < fim &&
      +a.quando + (a.duracao || 50) * 6e4 > +inicio,
  );
}
