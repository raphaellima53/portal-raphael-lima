/**
 * Alunos: lista e ficha (Perfil, Log, Cursos com alocação, Disponibilidade, Agendamentos, Feedbacks).
 * Porte de listas.src.js (pedAlunos), fichas.src.js (alMatriculas, alAlocacoes, dispPainel, alAgenda, alHistorico),
 * fichas-abas.src.js (alPerfil, fxLogDe, alQualidade, fbAluno) e alunos-acoes.src.js (ações da linha).
 */
import { fmt } from '../lib/fmt.ts';
import {
  type Aula,
  agAulasEntre,
  agDiasTxt,
  agFaixa,
  agHabilitado,
  agHH,
  agHM,
  agIndividual,
  agNaAgenda,
  agRotulo,
  alDisp,
  alMat,
  alSit,
  crsItens,
  crsRegras,
  DN,
  dispConflitos,
  dispK,
  FX_ESTADO,
  fxPresenca,
  type Oferta,
  prDisp,
} from './agenda.ts';
import { fxHash } from './aulas.ts';
import type { AlunoB, Base, CursoB, MatriculaB } from './base.ts';
import { SIT_TOM } from './cursos.ts';

export const alSaldo = (a: AlunoB) => alMat(a).reduce((s, e) => s + (e.total - e.usadas), 0);
export const alTemMod = (b: Base, e: MatriculaB) =>
  !!(b.cursos.find((c) => c.name === e.curso)?.allowsModules && e.modulo);
export const alCorItem = (b: Base, e: MatriculaB) => (e.modulo && b.corModulo[e.modulo]) || b.corCurso[e.curso] || '';
export const alOfertas = (ofs: Oferta[], a: AlunoB) => ofs.filter((o) => o.alunos.includes(a.name));
export const matTxt = (e: { curso: string; modulo: string | null }) => e.curso + (e.modulo ? ` · ${e.modulo}` : '');
const cpfFmt = (c: string) => {
  const d = String(c || '').replace(/\D/g, '');
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : c || '—';
};
const dm = (d: Date) => fmt.data(d);
const p2 = (n: number) => String(n).padStart(2, '0');

/** as aulas passadas de uma pessoa, da mais recente para a mais antiga */
export const fxPassadas = (b: Base, filtro: (a: Aula) => boolean, dias: number, ofs: Oferta[], agora = new Date()) => {
  const ini = new Date(agora);
  ini.setDate(ini.getDate() - dias);
  return agAulasEntre(b, ini, agora, agora, ofs)
    .filter((a) => a.quando < agora && filtro(a))
    .reverse();
};
export const fxProximas = (b: Base, filtro: (a: Aula) => boolean, dias: number, ofs: Oferta[], agora = new Date()) => {
  const fim = new Date(agora);
  fim.setDate(fim.getDate() + dias);
  return agNaAgenda(agAulasEntre(b, agora, fim, agora, ofs)).filter((a) => a.quando >= agora && filtro(a));
};
const presencaPct = (b: Base, nome: string, ps: Aula[]) => {
  const l = ps.map((x) => fxPresenca(b, nome, x)).filter((p) => p === 'presente' || p === 'falta');
  return l.length ? Math.round((l.filter((p) => p === 'presente').length / l.length) * 100) : null;
};

/* ---------------- lista ---------------- */
export function linhaAluno(b: Base, a: AlunoB, personas: Set<number>) {
  const s = alSit(a);
  return {
    id: a.id,
    nome: a.name,
    email: a.email,
    cpf: a.cpf,
    sit: s,
    sitTom: SIT_TOM[s] ?? 'gray',
    matriculas: alMat(a).map((e) => ({
      curso: e.curso,
      item: alTemMod(b, e) ? { nome: e.modulo!, cor: alCorItem(b, e) } : null,
      modalidade: e.modalidade || 'Online',
      usadas: e.usadas,
      total: e.total,
    })),
    saldo: alSaldo(a),
    persona: personas.has(a.id),
  };
}

/* ---------------- cabeçalho da ficha ---------------- */
export function fichaTopo(b: Base, a: AlunoB, ofs: Oferta[], hist: number, agora = new Date()) {
  const ms = alMat(a);
  const meus = alOfertas(ofs, a);
  const s = alSit(a);
  return {
    id: a.id,
    nome: a.name,
    sit: s,
    sitTom: SIT_TOM[s] ?? 'gray',
    sub: [
      a.email,
      a.empresa ? `B2B · ${a.empresa}` : 'B2C',
      a.contratoFim ? `contrato até ${fmt.data(a.contratoFim)}` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    resumo: {
      matriculas: ms.length,
      restantes: alSaldo(a),
      porSemana: meus.reduce((q, o) => q + o.dias.length, 0),
      presenca: presencaPct(
        b,
        a.name,
        fxPassadas(b, (x) => x.alunos.includes(a.name), hist, ofs, agora),
      ),
      dias: hist,
    },
  };
}

/* ---------------- Perfil ---------------- */
type Kv = { k: string; v: string | null; tom?: string };
export function alPerfil(
  b: Base,
  a: AlunoB,
  ofs: Oferta[],
  hist: number,
  extra: { abertos: number; ultima: { quando: Date; acao: string } | null },
  agora = new Date(),
) {
  const ms = alMat(a);
  const enc = a.matriculas.filter((e) => e.desativadoEm);
  const meus = alOfertas(ofs, a);
  const prox = fxProximas(b, (x) => x.alunos.includes(a.name), 14, ofs, agora)[0];
  const pct = presencaPct(
    b,
    a.name,
    fxPassadas(b, (x) => x.alunos.includes(a.name), hist, ofs, agora),
  );
  const s = alSit(a);
  const blocos: { titulo: string; itens: Kv[] }[] = [
    {
      titulo: 'Identificação',
      itens: [
        { k: 'Nome', v: a.name },
        { k: 'E-mail', v: a.email },
        { k: 'CPF', v: cpfFmt(a.cpf) },
        { k: 'Situação', v: s, tom: SIT_TOM[s] ?? 'gray' },
        { k: 'Código', v: String(a.id) },
      ],
    },
    {
      titulo: 'Vínculo e contrato',
      itens: [
        { k: 'Tipo', v: a.empresa ? 'B2B' : 'B2C' },
        { k: 'Empresa', v: a.empresa },
        { k: 'Contrato até', v: a.contratoFim ? fmt.data(a.contratoFim) : null },
        {
          k: 'Matrículas',
          v: `${ms.length} ${ms.length === 1 ? 'ativa' : 'ativas'} · ${enc.length} ${enc.length === 1 ? 'encerrada' : 'encerradas'}`,
        },
        { k: 'Aulas restantes', v: fmt.numero(alSaldo(a)) },
      ],
    },
    {
      titulo: 'Acompanhamento',
      itens: [
        { k: 'Aulas por semana', v: String(meus.reduce((q, o) => q + o.dias.length, 0)) },
        { k: 'Presença', v: pct != null ? `${pct}% nos últimos ${hist} dias` : null },
        {
          k: 'Próxima aula',
          v: prox ? `${fmt.semana(prox.quando)} · ${agHM(prox.quando)} · ${agRotulo(prox)}` : null,
        },
        { k: 'Feedbacks e ocorrências abertos', v: String(extra.abertos) },
        {
          k: 'Última alteração',
          v: extra.ultima ? `${fmt.dataHora(extra.ultima.quando, true)} · ${extra.ultima.acao}` : 'nenhuma registrada',
        },
      ],
    },
  ];
  return { blocos };
}

/* ---------------- Log ---------------- */
export type LogVivo = { quando: Date; autor: string; acao: string; detalhe: string | null; vezes: number };
export function alLog(a: AlunoB, vivos: LogVivo[], agora = new Date()) {
  const hoje = fmt.iso(agora);
  const base: { quando: Date | null; quem: string; acao: string; detalhe: string; base: true; vezes: 1 }[] = [];
  for (const e of a.matriculas) {
    if (!e.desativadoEm || fmt.iso(e.desativadoEm) === hoje) continue;
    if (vivos.some((v) => v.acao === 'Matrícula encerrada' && v.detalhe === matTxt(e))) continue;
    const q = new Date(e.desativadoEm);
    q.setHours(12, 0, 0, 0);
    base.push({ acao: 'Matrícula encerrada', detalhe: matTxt(e), quem: 'base', quando: q, base: true, vezes: 1 });
  }
  base.sort((x, y) => +y.quando! - +x.quando!);
  const n = alMat(a).length;
  base.push({
    acao: 'Cadastro na base',
    quem: 'importação',
    quando: null,
    base: true,
    vezes: 1,
    detalhe: `${n} ${n === 1 ? 'matrícula ativa' : 'matrículas ativas'} · ${a.empresa ? `B2B · ${a.empresa}` : 'B2C'}`,
  });
  return {
    linhas: [
      ...vivos.map((v) => ({
        quando: fmt.dataHora(v.quando, true),
        quem: v.autor,
        base: false,
        acao: v.acao,
        vezes: v.vezes,
        detalhe: v.detalhe ?? '',
      })),
      ...base.map((x) => ({
        quando: x.quando ? fmt.dataHora(x.quando, true) : 'na base',
        quem: x.quem,
        base: true,
        acao: x.acao,
        vezes: 1,
        detalhe: x.detalhe,
      })),
    ],
  };
}

/* ---------------- Cursos: matrículas ---------------- */
export function alMatriculas(b: Base, a: AlunoB, ofs: Oferta[]) {
  const meus = alOfertas(ofs, a);
  const cursoId = (n: string) => b.cursos.find((c) => c.name === n)?.id ?? null;
  const item = (e: MatriculaB) => (e.modulo ? { nome: e.modulo, cor: alCorItem(b, e) } : null);
  return {
    ativas: alMat(a).map((e) => ({
      id: e.id,
      curso: e.curso,
      cursoId: cursoId(e.curso),
      item: item(e),
      modalidade: e.modalidade || 'Online',
      usadas: e.usadas,
      total: e.total,
      saldo: e.total - e.usadas,
      horarios: meus
        .filter((x) => x.prod === e.curso && x.mod === e.modulo)
        .map((x) => ({ txt: `${agDiasTxt(x)} · ${agFaixa(x)}`, prof: x.prof === '—' ? null : x.prof })),
    })),
    encerradas: a.matriculas
      .filter((e) => e.desativadoEm)
      .map((e) => ({
        id: e.id,
        curso: e.curso,
        item: item(e),
        usadas: e.usadas,
        total: e.total,
        encerradaEm: fmt.data(e.desativadoEm!),
      })),
  };
}

/* ---------------- Cursos: alocação ---------------- */
export type Avaliacao = { foraA: number[]; foraP: number[]; choqueP: number[]; choqueA: number[] };
/** checagem de um horário: disponibilidade do aluno e do professor, e choque nas duas agendas */
export function alocAvalia(
  b: Base,
  a: AlunoB,
  prod: string,
  mod: string | null,
  prof: string,
  dias: number[],
  hora: number,
  ofs: Oferta[],
): Avaliacao {
  const t = b.professores.find((x) => x.name === prof);
  const ad = new Set(alDisp(b, a, ofs));
  const pd = new Set(t ? prDisp(b, t, ofs) : []);
  const esta = (o: Oferta) => o.prod === prod && o.mod === mod && o.alunos.includes(a.name);
  return {
    foraA: dias.filter((d) => !ad.has(dispK(d, hora))),
    foraP: t ? dias.filter((d) => !pd.has(dispK(d, hora))) : [],
    choqueP: t
      ? dias.filter((d) => ofs.some((o) => !esta(o) && o.prof === prof && o.hora === hora && o.dias.includes(d)))
      : [],
    choqueA: dias.filter((d) =>
      ofs.some((o) => !esta(o) && o.alunos.includes(a.name) && o.hora === hora && o.dias.includes(d)),
    ),
  };
}
const dd = (x: number[]) => x.map((d) => DN[d]).join(', ');
export const alocLinhas = (r: Avaliacao, exige: boolean, comProf: boolean) => {
  const l = (ok: boolean, sim: string, nao: string) => ({ ok, txt: ok ? sim : nao });
  return [
    l(
      !r.foraA.length,
      'dentro da disponibilidade do aluno',
      `aluno indisponível em ${dd(r.foraA)}${exige ? ' — as regras do curso bloqueiam' : ''}`,
    ),
    ...(comProf
      ? [
          l(!r.foraP.length, 'dentro da disponibilidade do professor', `professor indisponível em ${dd(r.foraP)}`),
          l(!r.choqueP.length, 'sem choque na agenda do professor', `professor já tem aula em ${dd(r.choqueP)}`),
        ]
      : []),
    l(!r.choqueA.length, 'sem choque na agenda do aluno', `aluno já tem aula em ${dd(r.choqueA)}`),
  ];
};
/** erro que impede salvar a alocação individual (a ordem é a do portal) */
export function alocErro(c: CursoB, f: { prof: string; dias: number[]; hora: number }, r: Avaliacao) {
  const exige = crsRegras(c).exigeDisp;
  if (!f.prof) return 'Não há professor habilitado neste curso.';
  if (!f.dias.length) return 'Marque ao menos um dia.';
  if (r.choqueP.length) return `${f.prof} já tem aula às ${agHH(f.hora)} em ${dd(r.choqueP)}.`;
  if (r.choqueA.length) return `O aluno já tem aula às ${agHH(f.hora)} em ${dd(r.choqueA)}.`;
  if (r.foraP.length) return `${f.prof} não está disponível em ${dd(r.foraP)} às ${agHH(f.hora)}.`;
  if (r.foraA.length && exige)
    return `Fora da disponibilidade do aluno em ${dd(r.foraA)} — as regras de ${c.name} exigem disponibilidade.`;
  return '';
}
export const alocAviso = (r: Avaliacao) =>
  `Alocação salva${r.foraA.length ? ` — atenção: fora da disponibilidade do aluno em ${dd(r.foraA)}.` : '. A agenda já mostra o novo horário.'}`;

type AlocTopo = {
  mid: number;
  curso: string;
  cor: string;
  item: { nome: string; cor: string } | null;
  modalidade: string;
};
type Checagem = { ok: boolean; txt: string }[];
export type AlocCard =
  | (AlocTopo & {
      ind: true;
      gravada: boolean;
      profs: string[];
      prof: string;
      dias: number[];
      hora: number;
      valor: number | null;
      checagem: Checagem;
    })
  | (AlocTopo & {
      ind: false;
      eTurma: boolean;
      horario: string | null;
      prof: string | null;
      profId: string | null;
      sala: string | null;
      ocupacao: string | null;
      checagem: Checagem;
      opcoes: { v: string; l: string; desabilitada: boolean }[];
    });

export function alAlocacoes(b: Base, a: AlunoB, ofs: Oferta[], veValor: boolean, valorPadrao: number) {
  return alMat(a).flatMap((e): AlocCard[] => {
    const c = b.cursos.find((x) => x.name === e.curso);
    if (!c) return [];
    const mod = e.modulo;
    const cor = b.corCurso[c.name] || '#1a4fd6';
    const o = ofs.find((x) => x.prod === c.name && x.mod === mod && x.alunos.includes(a.name));
    const topo = {
      mid: e.id,
      curso: c.name,
      cor,
      item: mod ? { nome: mod, cor: b.corModulo[mod] || cor } : null,
      modalidade: e.modalidade || 'Online',
    };
    if (agIndividual(c, mod)) {
      const x = o ?? { prof: '—', dias: [] as number[], hora: 18, valor: undefined };
      const r = alocAvalia(b, a, c.name, mod, x.prof, x.dias, x.hora, ofs);
      return [
        {
          ...topo,
          ind: true as const,
          gravada: !!e.aloc,
          profs: b.professores.filter((t) => agHabilitado(t, c.name, mod)).map((t) => t.name),
          prof: x.prof,
          dias: x.dias,
          hora: x.hora,
          valor: c.estrutura === 'nenhuma' && veValor ? (x.valor ?? valorPadrao) : null,
          checagem: alocLinhas(r, crsRegras(c).exigeDisp, true),
        },
      ];
    }
    const eTurma = c.estrutura === 'turmas';
    const r = o ? alocAvalia(b, a, c.name, mod, o.prof, o.dias, o.hora, ofs) : null;
    const opcoes = crsItens(c)
      .filter((x) => x !== 'Private FLOW')
      .map((it) => {
        const y = ofs.find((z) => z.prod === c.name && z.mod === it && z.vagas !== 1);
        const t = eTurma ? c.turmas.find((z) => z.name === it) : undefined;
        const lotada = !!t && t.ocupadas >= t.vagas && it !== mod;
        return {
          v: it,
          l: `${it}${y ? ` · ${agDiasTxt(y)} ${agHH(y.hora)}` : ' · sem horário'}${t ? ` · ${t.ocupadas}/${t.vagas}` : ''}${lotada ? ' · lotada' : ''}`,
          desabilitada: lotada,
        };
      });
    const prof = o ? b.professores.find((t) => t.name === o.prof) : undefined;
    return [
      {
        ...topo,
        ind: false as const,
        eTurma,
        horario: o ? `${agDiasTxt(o)} · ${agFaixa(o)}` : null,
        prof: o ? o.prof : null,
        profId: prof?.id ?? null,
        sala: o ? o.sala : null,
        ocupacao: o ? `${o.ocupadas != null ? o.ocupadas : o.alunos.length} de ${o.vagas} vagas` : null,
        checagem: r ? alocLinhas(r, false, false) : [],
        opcoes,
      },
    ];
  });
}

/* ---------------- Disponibilidade ---------------- */
export const DISP_DIAS: [number, string][] = [
  [1, 'seg'],
  [2, 'ter'],
  [3, 'qua'],
  [4, 'qui'],
  [5, 'sex'],
  [6, 'sáb'],
];
export const DISP_HORAS = Array.from({ length: 15 }, (_, k) => 7 + k);
/** clique na célula troca aquela hora; no dia ou na hora do cabeçalho, a coluna ou a linha inteira */
export function dispTroca(disp: string[], k: string) {
  const s = new Set(disp);
  const ks =
    k[0] === 'd'
      ? DISP_HORAS.map((h) => dispK(Number(k.slice(1)), h))
      : k[0] === 'h'
        ? DISP_DIAS.map(([d]) => dispK(d, Number(k.slice(1))))
        : [k];
  const liga = ks.some((x) => !s.has(x));
  for (const x of ks) {
    if (liga) s.add(x);
    else s.delete(x);
  }
  return [...s];
}
export const dispChaveValida = (k: string) =>
  /^d[1-6]$/.test(k) ||
  (/^h\d{1,2}$/.test(k) && DISP_HORAS.includes(Number(k.slice(1)))) ||
  (/^[1-6]-\d{1,2}$/.test(k) && DISP_HORAS.includes(Number(k.split('-')[1])));

export function dispPainel(disp: string[], meus: Oferta[]) {
  const on = new Set(disp);
  const aula: Record<string, Oferta[]> = {};
  for (const o of meus)
    for (const d of o.dias) {
      const k = dispK(d, o.hora);
      aula[k] ??= [];
      aula[k].push(o);
    }
  const rot = (o: Oferta) =>
    o.mod ? (/^Turma /.test(o.mod) ? `${o.prod.split(' ')[0]} ${o.mod.replace('Turma ', 'T')}` : o.mod) : o.prod;
  const conf = dispConflitos(disp, meus);
  const aulas = meus.reduce((s, o) => s + o.dias.length, 0);
  return {
    stats: [
      { valor: String(disp.length), rotulo: 'horas disponíveis por semana' },
      { valor: String(new Set(disp.map((k) => k.split('-')[0])).size), rotulo: 'dias com disponibilidade' },
      { valor: String(aulas), rotulo: 'aulas por semana na grade' },
      { valor: String(conf.length), rotulo: 'aulas fora da disponibilidade', tom: conf.length ? 'red' : 'green' },
      { valor: String(Math.max(0, disp.length - aulas)), rotulo: 'horas livres para alocar' },
    ],
    dias: DISP_DIAS.map(([d, l]) => ({ k: `d${d}`, rotulo: l })),
    linhas: DISP_HORAS.map((h) => ({
      k: `h${h}`,
      rotulo: agHH(h),
      celulas: DISP_DIAS.map(([d, l]) => {
        const k = dispK(d, h);
        const as = aula[k] ?? [];
        const estado = as.length ? (on.has(k) ? 'aula' : 'conflito') : on.has(k) ? 'livre' : 'fechada';
        return {
          k,
          estado,
          texto: as.length ? rot(as[0]) + (as.length > 1 ? ` +${as.length - 1}` : '') : '',
          rotulo: `${l} ${agHH(h)}`,
        };
      }),
    })),
    conflitos: conf.map(({ o, d }) => `${DN[d]} ${agHH(o.hora)} · ${o.prod}${o.mod ? ` · ${o.mod}` : ''}`),
  };
}

/* ---------------- Agendamentos ---------------- */
export const fxHora = (a: Aula) => {
  const fim = a.quando.getHours() * 60 + a.quando.getMinutes() + (a.duracao || 50);
  return `${agHM(a.quando)}–${p2(Math.floor(fim / 60))}:${p2(fim % 60)}`;
};
export function alAgenda(b: Base, a: AlunoB, dias: number, ofs: Oferta[], agora = new Date()) {
  const ls = fxProximas(b, (x) => x.alunos.includes(a.name), dias, ofs, agora);
  /* o módulo com regra própria (Novo curso, 24/09/2026, em minutos) vale antes da do curso */
  const prazo = (x: Aula, regra: 'agendamento' | 'cancelamento') => {
    const c = b.cursos.find((y) => y.name === x.prod);
    const min = c && x.mod ? c.modInfo[x.mod]?.[`${regra}Min`] : null;
    const rg = c ? crsRegras(c) : null;
    const padrao =
      regra === 'cancelamento'
        ? (rg?.cancelamento ?? 6)
        : ((rg as { antecedencia?: number } | null)?.antecedencia ?? 0);
    const h = min != null ? min / 60 : padrao;
    const d = new Date(x.quando.getTime() - h * 36e5);
    return h ? `${dm(d)} · ${agHM(d)}` : 'até o início';
  };
  return {
    dias,
    aulas: ls.map((x) => ({
      k: x.k,
      data: fmt.semana(x.quando),
      horario: fxHora(x),
      rotulo: agRotulo(x),
      cor: (x.mod && b.corModulo[x.mod]) || b.corCurso[x.prod] || '#1e46c8',
      prod: x.prod,
      prof: x.prof,
      profId: b.professores.find((t) => t.name === x.prof)?.id ?? null,
      sala: x.sala,
      estadoTag: FX_ESTADO[x.estado],
      agendarAte: prazo(x, 'agendamento'),
      limite: prazo(x, 'cancelamento'),
    })),
  };
}
/** Histórico: as aulas passadas do aluno, com presença (também o Histórico de aulas do próprio aluno) */
export function alHistorico(b: Base, a: AlunoB, dias: number, ofs: Oferta[], agora = new Date()) {
  const todas = fxPassadas(b, (x) => x.alunos.includes(a.name), dias, ofs, agora);
  const pres = todas.map((x) => fxPresenca(b, a.name, x));
  const np = pres.filter((p) => p === 'presente').length;
  const nf = pres.filter((p) => p === 'falta').length;
  return {
    dias,
    stats: {
      aulas: todas.length,
      presencas: np,
      faltas: nf,
      pct: np + nf ? Math.round((np / (np + nf)) * 100) : null,
      canceladas: todas.filter((x) => x.estado === 'cancelada').length,
    },
    aulas: todas.map((x) => ({
      k: x.k,
      data: fmt.semana(x.quando),
      horario: fxHora(x),
      rotulo: agRotulo(x),
      cor: (x.mod && b.corModulo[x.mod]) || b.corCurso[x.prod] || '#1e46c8',
      prod: x.prod,
      prof: x.prof,
      profId: b.professores.find((t) => t.name === x.prof)?.id ?? null,
      sub: x.sub,
      estado: x.estado,
      estadoTag: FX_ESTADO[x.estado],
      presenca: fxPresenca(b, a.name, x),
    })),
  };
}

/* ---------------- Feedbacks e qualidade ---------------- */
export const FB_TIPOS: [string, string][] = [
  ['Reclamação', 'red'],
  ['Elogio', 'green'],
  ['Sugestão', 'blue'],
  ['Qualidade', 'amber'],
];
export const FB_AREAS = ['Professor', 'Horário', 'Presença', 'Metodologia', 'Plataforma', 'Atendimento', 'Financeiro'];
export const FB_CANAIS = ['WhatsApp', 'E-mail', 'Em aula', 'Pesquisa de satisfação', 'Telefone', 'Registro interno'];
export const FB_ST: [string, string][] = [
  ['Aberto', 'red'],
  ['Em tratativa', 'amber'],
  ['Concluído', 'green'],
];
export const FB_MAX = 10 * 1024 * 1024;

function fbTexto(tipo: string, area: string, o: Oferta | null) {
  const prof = o && o.prof !== '—' ? o.prof : 'o professor';
  const hora = o ? agHH(o.hora) : 'o horário';
  const mod = o?.mod ? o.mod : 'o módulo';
  const T: Record<string, Record<string, string>> = {
    Reclamação: {
      Professor: `${prof} começou atrasado duas vezes seguidas e a aula terminou antes do horário.`,
      Horário: `A aula das ${hora} bate com o horário de trabalho; pediu outra opção na semana.`,
      Presença: 'Foi marcado como falta numa aula em que estava presente.',
      Metodologia: `Achou o ritmo de ${mod} rápido demais e sente que ficou para trás.`,
      Plataforma: 'O link da aula mudou sem aviso e perdeu o começo.',
      Atendimento: 'Pediu reposição por mensagem e esperou três dias pela resposta.',
      Financeiro: 'O boleto veio com valor diferente do contrato.',
    },
    Elogio: {
      Professor: `Gostou muito da aula de ${prof}: exemplos práticos e todo mundo falou.`,
      Horário: `O horário das ${hora} encaixou na rotina e não faltou mais.`,
      Presença: 'Gostou do lembrete de presença que chega antes da aula.',
      Metodologia: `As atividades de conversação de ${mod} ajudaram a destravar a fala.`,
      Plataforma: 'O material pós-aula ajuda a revisar antes da próxima.',
      Atendimento: 'Resolveram a troca de turma no mesmo dia.',
      Financeiro: 'A renegociação foi rápida e clara.',
    },
    Sugestão: {
      Professor: `Pediu que ${prof} mande o resumo da aula por escrito.`,
      Horário: 'Sugere uma turma aos sábados de manhã.',
      Presença: 'Pediu para ver as próprias faltas no app.',
      Metodologia: `Gostaria de mais simulações de conversa real em ${mod}.`,
      Plataforma: 'Sugere um lembrete no celular uma hora antes da aula.',
      Atendimento: 'Sugere um canal só para reposição de aulas.',
      Financeiro: 'Pediu a opção de pagamento recorrente no cartão.',
    },
  };
  return T[tipo][area];
}

/** os feedbacks de exemplo de cada aluno nascem estáveis do cadastro (a mesma pessoa tem sempre os mesmos) */
export function fbGera(a: AlunoB, ofs: Oferta[], agora = new Date()) {
  const ms = alMat(a);
  const meus = alOfertas(ofs, a);
  const n = ms.length ? fxHash(a.name) % 4 : 0;
  const out: {
    quando: Date;
    tipo: string;
    area: string;
    curso: string;
    canal: string;
    texto: string;
    status: string;
  }[] = [];
  for (let j = 0; j < n; j++) {
    const h = (k: string) => fxHash(`${j}|${k}|${a.name}`);
    const o = meus.length ? meus[h('oferta') % meus.length] : null;
    const tipo = FB_TIPOS[h('tipo') % 3][0];
    let ai = h('area') % FB_AREAS.length;
    while (out.some((x) => x.tipo === tipo && x.area === FB_AREAS[ai])) ai = (ai + 1) % FB_AREAS.length;
    const area = FB_AREAS[ai];
    const dias = 3 + (h('dias') % 55);
    const quando = new Date(agora);
    quando.setDate(quando.getDate() - dias);
    quando.setHours(9 + (h('hora') % 9), h('min') % 60, 0, 0);
    out.push({
      quando,
      tipo,
      area,
      curso: o ? o.prod : ms[0].curso,
      canal: FB_CANAIS[h('canal') % 5],
      texto: fbTexto(tipo, area, o),
      status: dias > 30 ? 'Concluído' : dias > 12 ? FB_ST[1 + (h('st') % 2)][0] : FB_ST[h('st') % 2][0],
    });
  }
  return out.sort((x, y) => +y.quando - +x.quando);
}

/** os pontos de qualidade do aluno, lidos da agenda, da presença, da alocação e do currículo */
export function alQualidade(b: Base, a: AlunoB, dias: number, ofs: Oferta[], agora = new Date()) {
  const ps = fxPassadas(b, (x) => x.alunos.includes(a.name), dias, ofs, agora);
  const aula = (x: Aula) => `${fmt.semana(x.quando)} ${agHM(x.quando)} · ${agRotulo(x)}`;
  const faltas = ps.filter((x) => fxPresenca(b, a.name, x) === 'falta');
  const naoFin = ps.filter((x) => x.estado === 'naoFinalizada');
  const subst = ps.filter((x) => x.estado === 'substituida');
  const meus = alOfertas(ofs, a);
  const choques = new Set<string>();
  meus.forEach((o, i) => {
    for (const q of meus.slice(i + 1))
      if (o.hora === q.hora)
        for (const d of o.dias.filter((d) => q.dias.includes(d))) choques.add(`${DN[d]} ${agHH(o.hora)}`);
  });
  const fora = dispConflitos(alDisp(b, a, ofs), meus);
  const nConf = choques.size + fora.length;
  const semCur = alMat(a).filter(
    (e) => e.modulo && !b.curriculos.some((x) => x.grupo === e.curso && x.aplicado.includes(e.modulo!)),
  );
  const lista = <T>(xs: T[], f: (x: T) => string) =>
    xs.slice(0, 3).map(f).join(' · ') + (xs.length > 3 ? ` · e mais ${xs.length - 3}` : '');
  return [
    {
      k: 'faltas',
      t: 'Faltas',
      n: faltas.length,
      nivel: faltas.length >= 2 ? 'red' : faltas.length ? 'amber' : 'ok',
      area: 'Presença',
      ir: 'passadas',
      rot: 'ver aulas',
      d: faltas.length ? lista(faltas, aula) : `nenhuma falta nos últimos ${dias} dias`,
    },
    {
      k: 'naoFin',
      t: 'Aulas sem registro de presença',
      n: naoFin.length,
      nivel: naoFin.length ? 'amber' : 'ok',
      area: 'Professor',
      ir: 'passadas',
      rot: 'ver aulas',
      d: naoFin.length ? lista(naoFin, aula) : 'todas as aulas dadas têm a presença registrada',
    },
    {
      k: 'subst',
      t: 'Aulas com professor substituto',
      n: subst.length,
      nivel: subst.length >= 3 ? 'amber' : 'ok',
      area: 'Professor',
      ir: 'passadas',
      rot: 'ver aulas',
      d: subst.length
        ? lista(subst, (x) => `${aula(x)} · ${x.prof} no lugar de ${x.sub}`)
        : `nenhuma substituição nos últimos ${dias} dias`,
    },
    {
      k: 'conflito',
      t: 'Conflitos de agenda',
      n: nConf,
      nivel: nConf ? 'red' : 'ok',
      area: 'Horário',
      ir: 'cursos',
      rot: 'ver alocação',
      d:
        [
          choques.size ? `duas aulas em ${[...choques].join(', ')}` : '',
          fora.length ? `${fora.map(({ o, d }) => `${DN[d]} ${agHH(o.hora)}`).join(', ')} fora da disponibilidade` : '',
        ]
          .filter(Boolean)
          .join(' · ') || 'sem choque e dentro da disponibilidade',
    },
    {
      k: 'semCur',
      t: 'Módulo ou turma sem currículo',
      n: semCur.length,
      nivel: semCur.length ? 'amber' : 'ok',
      area: 'Metodologia',
      ir: null,
      rot: '',
      d: semCur.length
        ? semCur.map((e) => `${e.curso} · ${e.modulo}`).join(' · ')
        : 'todas as matrículas têm currículo',
    },
  ];
}
