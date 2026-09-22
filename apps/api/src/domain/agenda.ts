/**
 * Agenda: uma lista de aulas gerada do cadastro — porte fiel de agOfertas/agAulasEntre do artefato.
 * Turmas (FAAP, Palmares) pela grade da turma; módulos em grupo por uma grade fixa de cada módulo;
 * Private FLOW e Alumni Black por aluno. Sem domingo e feriado. O estado de cada aula é estável
 * (mesma data, mesmo estado) e os ajustes feitos numa aula (AulaAjuste) valem por cima.
 */
import type { AlunoB, Base, CursoB, MatriculaB, ProfessorB } from './base.ts';

export const AG_DIAS: Record<string, number> = { Seg: 1, Ter: 2, Qua: 3, Qui: 4, Sex: 5, Sáb: 6 };
export const DN = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export const agISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const agHH = (h: number) => `${String(h).padStart(2, '0')}:00`;
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
};

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

/** professor habilitado no curso e, se a habilitação for recortada, no módulo ou turma */
export const agHabilitado = (t: ProfessorB, curso: string, item: string | null) =>
  t.active &&
  t.cursos.includes(curso) &&
  (item == null || !t.habil || !t.habil[curso] || t.habil[curso].includes(item));

/** ofertas: o que se repete toda semana — produto, módulo ou turma, dias, hora, professor, sala e alunos */
export function agOfertas(b: Base): Oferta[] {
  const out: Oferta[] = [];
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
          if (m === 'Private FLOW') {
            alunosDe(c.name, m).forEach((a, j) => {
              individual(c, m, a, j, um(profsDe(c.name, m), k + j), PARES[(j + 1) % 5], HORAS[(j * 3 + 5) % 8]);
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
  return out;
}

/** as aulas de um intervalo, com o estado de cada uma — mesma data, mesmo estado, sempre */
export function agAulasEntre(b: Base, ini: Date, fim: Date, agora = new Date(), ofertas = agOfertas(b)): Aula[] {
  const out: Aula[] = [];
  const d = new Date(ini);
  d.setHours(0, 0, 0, 0);
  const f = new Date(fim);
  f.setHours(23, 59, 59, 999);
  for (; d <= f; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (!dow || b.feriados.has(agISO(d))) continue;
    ofertas.forEach((o, i) => {
      if (!o.dias.includes(dow)) return;
      const quando = new Date(d);
      quando.setHours(o.hora, 0, 0, 0);
      const h = (i * 31 + d.getDate() * 7 + d.getMonth() * 13) % 11;
      const n = o.ocupadas != null ? o.ocupadas : o.alunos.length;
      let estado: Estado;
      let prof = o.prof;
      let sub: string | null = null;
      if (quando > agora) estado = !n ? 'semAlunos' : h === 2 ? 'semProfessor' : h === 3 ? 'cancelada' : 'comAlunos';
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
      const k = [o.prod, o.mod || '', o.quem, agISO(d), o.hora].join('|');
      const ov = b.ajustes[k];
      let nn = n;
      if (ov) {
        if (ov.fora) nn = Math.max(0, n - o.alunos.filter((x) => ov.fora![x]).length);
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
        alunos: o.alunos,
        n: nn,
        vagas: o.vagas,
        estado,
        duracao: o.duracao || 50,
        valorAloc: o.valor,
      });
    });
  }
  return out.sort((a, c) => +a.quando - +c.quando);
}

export const agCor = (b: Base, a: { mod: string | null; prod: string }) =>
  (a.mod && b.corModulo[a.mod]) || b.corCurso[a.prod] || '#1e46c8';
/** rótulo curto: o módulo diz mais que o produto; a turma sozinha é ambígua e leva o primeiro nome do produto */
export const agRotulo = (a: { mod: string | null; prod: string }) =>
  !a.mod ? a.prod : /^Turma /.test(a.mod) ? `${a.prod.split(' ')[0]} · ${a.mod}` : a.mod;
export const agNaAgenda = (l: Aula[]) => l.filter((a) => a.estado !== 'cancelada');
export const agDiasTxt = (o: Oferta) => o.dias.map((d) => DN[d]).join(' e ');
/** faixa da aula: 12:00–12:45 */
export const agFaixa = (o: { hora: number; duracao?: number }) => {
  const fim = o.hora * 60 + (o.duracao || 50);
  return `${agHH(o.hora)}–${String(Math.floor(fim / 60)).padStart(2, '0')}:${String(fim % 60).padStart(2, '0')}`;
};
/** aula individual: professor, dias e hora são da matrícula (Alumni Black e Private FLOW) */
export const agIndividual = (c: CursoB, mod: string | null) => c.estrutura === 'nenhuma' || mod === 'Private FLOW';

/* ---- disponibilidade: grade dia × hora ---- */
export const dispK = (d: number, h: number) => `${d}-${h}`;
const dispDe = (ofs: Oferta[], padrao: [number[], number[]]) => {
  const s = new Set<string>();
  for (const o of ofs)
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
export const prDisp = (b: Base, t: ProfessorB, ofs = agOfertas(b)) =>
  t.disp ??
  dispDe(
    ofs.filter((o) => o.prof === t.name),
    b.professores.indexOf(t) % 2
      ? [
          [1, 2, 3, 4, 5],
          [8, 9, 10, 11],
        ]
      : [
          [1, 2, 3, 4, 5],
          [17, 18, 19, 20],
        ],
  );
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
