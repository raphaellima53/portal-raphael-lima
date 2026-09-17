/**
 * Relatórios por perspectiva (Seletores · Alunos · Professores · Cursos) com filtro de qualidade e CSV.
 * Porte de RELATÓRIOS (UI.qr, qlPresencas, qlConflitosLista, qlDispLista, QR_QUAL, qrQual*, RP) e dos seletores
 * (REL_CAMPOS, relLinhas). Tudo lê a base viva; cada linha aponta para a ficha de origem.
 */

import { fmt } from '../lib/fmt.ts';
import {
  type Aula,
  agAulasEntre,
  agDiasTxt,
  agFaixa,
  alDisp,
  alMat,
  alSit,
  crsItens,
  dispConflitos,
  fxPresenca,
  type Oferta,
  prDisp,
} from './agenda.ts';
import { alSaldo, alTemMod } from './alunos.ts';
import type { AlunoB, Base } from './base.ts';
import { crsAlunos, crsProfs } from './cursos.ts';
import { type Avaliacao, agNum, fbProf } from './professores.ts';
import { hrefAluno, hrefCurso, hrefProf } from './rotas.ts';

export const QR_PERIODOS: [number, string][] = [
  [7, 'últimos 7 dias'],
  [30, 'últimos 30 dias'],
  [60, 'últimos 60 dias'],
  [90, 'últimos 90 dias'],
];
export type Pers = 'aluno' | 'professor' | 'curso';
export const QR_QUAL: Record<Pers, [string, string][]> = {
  aluno: [
    ['faltas', '2 faltas ou mais no período'],
    ['conflito', 'conflito de agenda'],
    ['naoFin', 'aula sem registro de presença'],
    ['feedback', 'feedback ou ocorrência aberta'],
  ],
  professor: [
    ['dispFora', 'aula fora da disponibilidade'],
    ['subst', 'substituído no período'],
    ['naoFin', 'aula não finalizada'],
    ['teto', 'acima do teto semanal'],
    ['notaBaixa', 'nota 1 ou 2 no período'],
  ],
  curso: [
    ['semProf', 'horário sem professor'],
    ['semCur', 'módulo ou turma sem currículo'],
    ['naoFin', 'aula não finalizada'],
    ['vazio', 'horário sem alunos'],
  ],
};

/** o recorte comum: período, curso e grupo (UI.qr), mais o que vem do banco */
export type Recorte = {
  b: Base;
  ofs: Oferta[];
  agora: Date;
  dias: number;
  curso: string;
  grupo: 'curso' | 'item';
  /** alunos com feedback ou ocorrência não concluída */
  fbAbertos: Set<string>;
  /** avaliações registradas no portal, por id do professor */
  avs: Map<string, Avaliacao[]>;
};
type Q = Record<string, boolean>;

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const pctTxt = (a: number, b: number) => (b ? `${pct(a, b)}%` : '—');
const soma = <T>(ls: T[], f: (l: T) => number) => ls.reduce((s, l) => s + (f(l) || 0), 0);
const cmp = (x: string, y: string) => x.localeCompare(y);

export const qrIni = (r: { dias: number; agora: Date }) => {
  const i = new Date(r.agora);
  i.setDate(i.getDate() - r.dias);
  i.setHours(0, 0, 0, 0);
  return i;
};
const noCurso = (r: Recorte) => (a: { prod: string }) => !r.curso || a.prod === r.curso;
const tudo = () => true;
type NC = (a: { prod: string }) => boolean;
/** as aulas que já passaram no período */
const passadas = (r: Recorte, nc: NC = noCurso(r)) =>
  agAulasEntre(r.b, qrIni(r), r.agora, r.agora, r.ofs).filter((a) => a.quando < r.agora && nc(a));
const dada = (a: Aula) => ['executada', 'substituida'].includes(a.estado);
const registradas = (r: Recorte, id: string) => r.avs.get(id) ?? [];

/* ---- leituras da base ---- */
function presencas(r: Recorte, ps: Aula[]) {
  const por = new Map<string, { nome: string; aulas: number; p: number; f: number; s: number; cursos: Set<string> }>();
  for (const a of ps)
    for (const n of a.alunos) {
      const res = fxPresenca(r.b, n, a);
      if (!res) continue;
      const x = por.get(n) ?? { nome: n, aulas: 0, p: 0, f: 0, s: 0, cursos: new Set<string>() };
      por.set(n, x);
      x.aulas++;
      x.cursos.add(a.prod);
      if (res === 'presente') x.p++;
      else if (res === 'falta') x.f++;
      else x.s++;
    }
  return [...por.values()];
}
/** choque e disponibilidade leem a grade inteira; o curso só recorta quem aparece */
function conflitos(r: Recorte, nc: NC) {
  const out = new Set<string>();
  for (const a of r.b.alunos.filter((x) => alMat(x).length)) {
    const os = r.ofs.filter((o) => o.alunos.includes(a.name));
    if (!os.length || !os.some(nc)) continue;
    let choque = false;
    os.forEach((o, i) => {
      for (const q of os.slice(i + 1)) if (o.hora === q.hora && o.dias.some((d) => q.dias.includes(d))) choque = true;
    });
    if (choque || dispConflitos(alDisp(r.b, a, r.ofs), os).length) out.add(a.name);
  }
  return out;
}
const dispFora = (r: Recorte, nc: NC) =>
  new Set(
    r.b.professores
      .filter((t) => t.active)
      .filter((t) =>
        dispConflitos(
          prDisp(r.b, t, r.ofs),
          r.ofs.filter((o) => o.prof === t.name),
        ).some(({ o }) => nc(o)),
      )
      .map((t) => t.name),
  );
const semCurriculo = (b: Base, prod: string, it: string | null) =>
  !!it && !b.curriculos.some((x) => x.grupo === prod && x.aplicado.includes(it));

/* ---- filtro de qualidade: os mesmos pontos, por perspectiva ---- */
export function qualAlunos(r: Recorte, todos: boolean): Record<string, Q> {
  const nc = todos ? tudo : noCurso(r);
  const pr = new Map(presencas(r, passadas(r, nc)).map((x) => [x.nome, x]));
  const conf = conflitos(r, nc);
  return Object.fromEntries(
    r.b.alunos.map((a) => {
      const x = pr.get(a.name) ?? { f: 0, s: 0 };
      return [
        a.name,
        { faltas: x.f >= 2, conflito: conf.has(a.name), naoFin: x.s > 0, feedback: r.fbAbertos.has(a.name) },
      ];
    }),
  );
}
export function qualProfs(r: Recorte, todos: boolean): Record<string, Q> {
  const nc = todos ? tudo : noCurso(r);
  const ps = passadas(r, nc);
  const ofs = r.ofs.filter(nc);
  const disp = dispFora(r, nc);
  return Object.fromEntries(
    r.b.professores.map((t) => {
      const dele = ps.filter((a) => a.prof === t.name);
      return [
        t.name,
        {
          dispFora: disp.has(t.name),
          subst: ps.some((a) => a.sub === t.name),
          naoFin: dele.some((a) => a.estado === 'naoFinalizada'),
          teto:
            soma(
              ofs.filter((o) => o.prof === t.name),
              (o) => o.dias.length,
            ) > (t.teto || 24),
          notaBaixa: fbProf(r.b, t, r.dias, r.ofs, registradas(r, t.id), r.agora).some(
            (x) => nc({ prod: x.curso }) && x.nota <= 2,
          ),
        },
      ];
    }),
  );
}
/** por "curso|módulo" e por "curso|" (o curso inteiro) */
export function qualItens(r: Recorte): Record<string, Q> {
  const m: Record<string, Q> = {};
  const marca = (k: string, q: Q) => {
    m[k] ??= { semProf: false, semCur: false, naoFin: false, vazio: false };
    const x = m[k];
    for (const c of Object.keys(q)) if (q[c]) x[c] = true;
  };
  for (const c of r.b.cursos) {
    marca(`${c.name}|`, {});
    for (const it of crsItens(c)) {
      const s = semCurriculo(r.b, c.name, it);
      marca(`${c.name}|${it}`, { semCur: s });
      marca(`${c.name}|`, { semCur: s });
    }
  }
  for (const o of r.ofs) {
    const q = { semProf: o.prof === '—', vazio: !(o.ocupadas != null ? o.ocupadas : o.alunos.length) };
    marca(`${o.prod}|${o.mod || ''}`, q);
    marca(`${o.prod}|`, q);
  }
  for (const a of passadas(r, tudo).filter((x) => x.estado === 'naoFinalizada')) {
    marca(`${a.prod}|${a.mod || ''}`, { naoFin: true });
    marca(`${a.prod}|`, { naoFin: true });
  }
  return m;
}
export const qualCursos = (r: Recorte) => {
  const m = qualItens(r);
  return Object.fromEntries(r.b.cursos.map((c) => [c.name, m[`${c.name}|`]]));
};

/* ---- os relatórios ---- */
export type Coluna = [string, string, boolean?];
export type Linha = { _href: string; _q: Q; [k: string]: string | number | Q };
export type Resumo = { v: string; t: string; tom?: 'red' | 'amber' };
type Rel = {
  tela: string;
  pers: Pers;
  arquivo: string;
  t: string;
  periodo: boolean;
  cols: (r: Recorte) => Coluna[];
  linhas: (r: Recorte) => Linha[];
  resumo: (ls: Linha[]) => Resumo[];
};

const alunoHref = (b: Base, nome: string, aba: string, p?: Record<string, string>) => {
  const a = b.alunos.find((x) => x.name === nome);
  return a ? hrefAluno(a.id, aba, p) : '';
};
const cursoHref = (b: Base, nome: string, aba: string) => {
  const c = b.cursos.find((x) => x.name === nome);
  return c ? hrefCurso(c.id, aba) : '';
};
const n = (l: Linha, k: string) => Number(l[k]) || 0;
const tomSe = (cond: boolean, tom: 'red' | 'amber') => (cond ? tom : undefined);

export const RP: Record<string, Rel> = {
  presenca: {
    tela: 'rpPresenca',
    pers: 'aluno',
    arquivo: 'presenca-por-aluno',
    t: 'Presença por aluno',
    periodo: true,
    cols: () => [
      ['aluno', 'Aluno'],
      ['cursos', 'Cursos'],
      ['aulas', 'Aulas dadas', true],
      ['p', 'Presenças', true],
      ['f', 'Faltas', true],
      ['s', 'Sem registro', true],
      ['taxa', 'Presença', true],
    ],
    linhas: (r) => {
      const q = qualAlunos(r, false);
      return presencas(r, passadas(r))
        .map((x) => ({
          aluno: x.nome,
          cursos: [...x.cursos].join(', '),
          aulas: x.aulas,
          p: x.p,
          f: x.f,
          s: x.s,
          taxa: pctTxt(x.p, x.p + x.f),
          _href: alunoHref(r.b, x.nome, 'agendamentos', { quando: 'passadas' }),
          _q: q[x.nome] ?? {},
        }))
        .sort((a, c) => cmp(a.aluno, c.aluno));
    },
    resumo: (ls) => {
      const p = soma(ls, (l) => n(l, 'p'));
      const f = soma(ls, (l) => n(l, 'f'));
      return [
        { v: String(ls.length), t: 'alunos com aula' },
        { v: pctTxt(p, p + f), t: 'de presença' },
        { v: String(p), t: 'presenças' },
        { v: String(f), t: 'faltas', tom: tomSe(!!f, 'red') },
        { v: String(soma(ls, (l) => n(l, 's'))), t: 'sem registro' },
      ];
    },
  },
  pacote: {
    tela: 'rpPacote',
    pers: 'aluno',
    arquivo: 'consumo-do-pacote',
    t: 'Consumo do pacote',
    periodo: false,
    cols: () => [
      ['aluno', 'Aluno'],
      ['curso', 'Curso'],
      ['item', 'Módulo ou turma'],
      ['modalidade', 'Modalidade'],
      ['usadas', 'Usadas', true],
      ['pacote', 'Pacote', true],
      ['uso', 'Usado', true],
      ['restam', 'Restam', true],
      ['situacao', 'Situação'],
    ],
    linhas: (r) => {
      const q = qualAlunos(r, false);
      const nc = noCurso(r);
      return r.b.alunos
        .flatMap((a) =>
          alMat(a)
            .filter((e) => nc({ prod: e.curso }))
            .map((e) => {
              const u = e.usadas || 0;
              const t = e.total || 0;
              return {
                aluno: a.name,
                curso: e.curso,
                item: alTemMod(r.b, e) ? e.modulo! : '—',
                modalidade: e.modalidade || 'Online',
                usadas: u,
                pacote: t,
                uso: pctTxt(u, t),
                restam: Math.max(0, t - u),
                situacao: alSit(a),
                _p: t ? u / t : 0,
                _href: hrefAluno(a.id, 'cursos'),
                _q: q[a.name] ?? {},
              };
            }),
        )
        .sort((a, c) => c._p - a._p || cmp(a.aluno, c.aluno));
    },
    resumo: (ls) => {
      const altos = ls.filter((l) => n(l, '_p') >= 0.8).length;
      return [
        { v: String(ls.length), t: 'matrículas' },
        { v: String(altos), t: 'com 80% ou mais usado', tom: tomSe(!!altos, 'amber') },
        { v: String(soma(ls, (l) => n(l, 'restam'))), t: 'aulas restantes' },
      ];
    },
  },
  professores: {
    tela: 'rpProfessores',
    pers: 'professor',
    arquivo: 'aulas-por-professor',
    t: 'Aulas por professor',
    periodo: true,
    cols: () => [
      ['prof', 'Professor'],
      ['dadas', 'Aulas dadas', true],
      ['horas', 'Horas dadas', true],
      ['cobriu', 'Deu no lugar de outro', true],
      ['subst', 'Substituído', true],
      ['nf', 'Não finalizadas', true],
      ['canc', 'Canceladas', true],
      ['grade', 'Aulas por semana na grade', true],
      ['teto', 'Teto semanal', true],
    ],
    linhas: (r) => {
      const ps = passadas(r);
      const ofs = r.ofs.filter(noCurso(r));
      const q = qualProfs(r, false);
      return r.b.professores
        .map((t) => {
          const dele = ps.filter((a) => a.prof === t.name);
          const dadas = dele.filter(dada);
          const h = soma(dadas, (a) => a.duracao || 50) / 60;
          return {
            prof: t.name,
            dadas: dadas.length,
            horas: agNum(h),
            _h: h,
            cobriu: dele.filter((a) => a.sub).length,
            subst: ps.filter((a) => a.sub === t.name).length,
            nf: dele.filter((a) => a.estado === 'naoFinalizada').length,
            canc: dele.filter((a) => a.estado === 'cancelada').length,
            grade: soma(
              ofs.filter((o) => o.prof === t.name),
              (o) => o.dias.length,
            ),
            teto: t.teto || 24,
            _ativo: t.active ? 1 : 0,
            _href: hrefProf(t.id, 'agenda', { quando: 'passadas' }),
            _q: q[t.name] ?? {},
          };
        })
        .filter((l) => l._ativo || l.dadas || l.subst)
        .sort((a, c) => c.dadas - a.dadas || cmp(a.prof, c.prof));
    },
    resumo: (ls) => {
      const nf = soma(ls, (l) => n(l, 'nf'));
      return [
        { v: String(soma(ls, (l) => n(l, 'dadas'))), t: 'aulas dadas' },
        { v: agNum(soma(ls, (l) => n(l, '_h'))), t: 'horas dadas' },
        { v: String(soma(ls, (l) => n(l, 'cobriu'))), t: 'substituições' },
        { v: String(nf), t: 'não finalizadas', tom: tomSe(!!nf, 'amber') },
        { v: String(ls.filter((l) => n(l, 'grade') > n(l, 'teto')).length), t: 'acima do teto' },
      ];
    },
  },
  avaliacao: {
    tela: 'rpAvaliacao',
    pers: 'professor',
    arquivo: 'avaliacao-dos-alunos',
    t: 'Avaliação dos alunos',
    periodo: true,
    cols: () => [
      ['prof', 'Professor'],
      ['n', 'Avaliações', true],
      ['media', 'Nota média', true],
      ['altas', 'Notas 4 e 5', true],
      ['baixas', 'Notas 1 e 2', true],
      ['cursos', 'Média por curso'],
    ],
    linhas: (r) => {
      const q = qualProfs(r, false);
      const nc = noCurso(r);
      return r.b.professores
        .map((t) => {
          const fb = fbProf(r.b, t, r.dias, r.ofs, registradas(r, t.id), r.agora).filter((x) => nc({ prod: x.curso }));
          const s = soma(fb, (x) => x.nota);
          const cs = [...new Set(fb.map((x) => x.curso))].map((c) => {
            const xs = fb.filter((x) => x.curso === c);
            return `${c} ${agNum(soma(xs, (x) => x.nota) / xs.length)}`;
          });
          return {
            prof: t.name,
            n: fb.length,
            media: fb.length ? agNum(s / fb.length) : '—',
            _soma: s,
            altas: fb.filter((x) => x.nota >= 4).length,
            baixas: fb.filter((x) => x.nota <= 2).length,
            cursos: cs.join(' · '),
            _ativo: t.active ? 1 : 0,
            _m: fb.length ? s / fb.length : 9,
            _href: hrefProf(t.id, 'feedbacks'),
            _q: q[t.name] ?? {},
          };
        })
        .filter((l) => l._ativo || l.n)
        .sort((a, c) => c.baixas - a.baixas || a._m - c._m || cmp(a.prof, c.prof));
    },
    resumo: (ls) => {
      const tot = soma(ls, (l) => n(l, 'n'));
      const b = soma(ls, (l) => n(l, 'baixas'));
      return [
        { v: String(tot), t: 'avaliações no período' },
        { v: tot ? agNum(soma(ls, (l) => n(l, '_soma')) / tot) : '—', t: 'nota média, de 5' },
        {
          v: pctTxt(
            soma(ls, (l) => n(l, 'altas')),
            tot,
          ),
          t: 'notas 4 e 5',
        },
        { v: String(b), t: 'notas 1 e 2', tom: tomSe(!!b, 'red') },
      ];
    },
  },
  aulas: {
    tela: 'rpAulas',
    pers: 'curso',
    arquivo: 'aulas-por-curso',
    t: 'Aulas por curso',
    periodo: true,
    cols: (r) => [
      ['curso', 'Curso'],
      ...(r.grupo === 'item' ? ([['item', 'Módulo ou turma']] as Coluna[]) : []),
      ['total', 'Aulas no período', true],
      ['exec', 'Executadas', true],
      ['sub', 'Substituídas', true],
      ['nf', 'Não finalizadas', true],
      ['canc', 'Canceladas', true],
      ['real', 'Realizadas', true],
    ],
    linhas: (r) => {
      const qi = qualItens(r);
      const porItem = r.grupo === 'item';
      const por = new Map<
        string,
        { curso: string; item: string; total: number; exec: number; sub: number; nf: number; canc: number; _q: Q }
      >();
      for (const a of passadas(r)) {
        const k = `${a.prod}|${porItem ? a.mod || '' : ''}`;
        const x = por.get(k) ?? {
          curso: a.prod,
          item: a.mod || '—',
          total: 0,
          exec: 0,
          sub: 0,
          nf: 0,
          canc: 0,
          _q: qi[k] ?? {},
        };
        por.set(k, x);
        x.total++;
        if (a.estado === 'executada') x.exec++;
        else if (a.estado === 'substituida') x.sub++;
        else if (a.estado === 'naoFinalizada') x.nf++;
        else if (a.estado === 'cancelada') x.canc++;
      }
      return [...por.values()]
        .map((x) => ({ ...x, real: pctTxt(x.exec + x.sub, x.total - x.canc), _href: cursoHref(r.b, x.curso, 'grade') }))
        .sort((a, c) => cmp(a.curso, c.curso) || cmp(a.item, c.item));
    },
    resumo: (ls) => {
      const t = soma(ls, (l) => n(l, 'total'));
      const c = soma(ls, (l) => n(l, 'canc'));
      const nf = soma(ls, (l) => n(l, 'nf'));
      return [
        { v: String(t), t: 'aulas no período' },
        {
          v: pctTxt(
            soma(ls, (l) => n(l, 'exec') + n(l, 'sub')),
            t - c,
          ),
          t: 'realizadas',
        },
        { v: String(soma(ls, (l) => n(l, 'sub'))), t: 'substituídas' },
        { v: String(nf), t: 'não finalizadas', tom: tomSe(!!nf, 'amber') },
        { v: String(c), t: 'canceladas' },
      ];
    },
  },
  ocupacao: {
    tela: 'rpOcupacao',
    pers: 'curso',
    arquivo: 'ocupacao-da-grade',
    t: 'Ocupação da grade',
    periodo: false,
    cols: () => [
      ['curso', 'Curso'],
      ['item', 'Módulo ou turma'],
      ['quem', 'Turma ou aluno'],
      ['dias', 'Dias'],
      ['horario', 'Horário'],
      ['prof', 'Professor'],
      ['sala', 'Sala'],
      ['alunos', 'Alunos', true],
      ['vagas', 'Vagas', true],
      ['ocup', 'Ocupação', true],
    ],
    linhas: (r) => {
      const qi = qualItens(r);
      return r.ofs
        .filter(noCurso(r))
        .map((o) => {
          const k = o.ocupadas != null ? o.ocupadas : o.alunos.length;
          return {
            curso: o.prod,
            item: o.mod || '—',
            quem: o.quem,
            dias: agDiasTxt(o),
            horario: agFaixa(o),
            prof: o.prof === '—' ? 'sem professor' : o.prof,
            sala: o.sala,
            alunos: k,
            vagas: o.vagas,
            ocup: pctTxt(k, o.vagas),
            _p: o.vagas ? k / o.vagas : 0,
            _href: cursoHref(r.b, o.prod, 'grade'),
            _q: { ...qi[`${o.prod}|${o.mod || ''}`], semProf: o.prof === '—', vazio: !k },
          };
        })
        .sort((a, c) => cmp(a.curso, c.curso) || c._p - a._p);
    },
    resumo: (ls) => {
      const vazios = ls.filter((l) => !n(l, 'alunos')).length;
      return [
        { v: String(ls.length), t: 'horários na grade' },
        {
          v: pctTxt(
            soma(ls, (l) => n(l, 'alunos')),
            soma(ls, (l) => n(l, 'vagas')),
          ),
          t: 'de ocupação',
        },
        { v: String(ls.filter((l) => n(l, '_p') >= 1).length), t: 'lotados' },
        { v: String(vazios), t: 'vazios', tom: tomSe(!!vazios, 'amber') },
      ];
    },
  },
};
export const RP_TELA = Object.fromEntries(Object.entries(RP).map(([k, v]) => [v.tela, k]));

/** a tela do relatório: colunas, linhas (com o filtro de qualidade), resumo e o recorte escrito por extenso */
export function relatorio(r: Recorte, k: string, qual: string) {
  const rel = RP[k];
  const todas = rel.linhas(r);
  const ls = qual ? todas.filter((l) => l._q?.[qual]) : todas;
  const ql = qual ? (QR_QUAL[rel.pers].find((x) => x[0] === qual)?.[1] ?? '') : '';
  return {
    k,
    t: rel.t,
    pers: rel.pers,
    arquivo: rel.arquivo + (qual ? `-${qual}` : ''),
    periodo: rel.periodo,
    agrupa: k === 'aulas',
    recorte: `${rel.periodo ? `${fmt.data(qrIni(r))} a ${fmt.data(r.agora)}` : 'situação de hoje'} · ${r.curso || 'todos os cursos'}`,
    qualidade: QR_QUAL[rel.pers].map(([v, l]) => ({ v, l })),
    qualRotulo: ql,
    cols: rel.cols(r).map(([c, l, num]) => ({ k: c, t: l, num: !!num })),
    resumo: rel.resumo(ls),
    linhas: ls.map((l) => {
      const o: Record<string, string | number> = {};
      for (const [c] of rel.cols(r)) o[c] = l[c] == null || l[c] === '' ? '—' : (l[c] as string | number);
      return { href: l._href || null, v: o };
    }),
  };
}

/* ---- Seletores ---- */
export const REL_CAMPOS: Record<Pers, [string, string][]> = {
  aluno: [
    ['nome', 'Nome'],
    ['email', 'E-mail'],
    ['produto', 'Produto'],
    ['modulo', 'Módulo ou turma'],
    ['modalidade', 'Modalidade'],
    ['uso', 'Aulas usadas/total'],
    ['saldo', 'Saldo'],
    ['situacao', 'Situação'],
    ['empresa', 'Empresa'],
    ['contrato', 'Contrato até'],
  ],
  professor: [
    ['nome', 'Nome'],
    ['email', 'E-mail'],
    ['cursos', 'Cursos'],
    ['carga', 'Carga semanal'],
    ['horarios', 'Horários na grade'],
    ['situacao', 'Situação'],
  ],
  curso: [
    ['nome', 'Nome'],
    ['tipo', 'Tipo'],
    ['idioma', 'Idioma'],
    ['estrutura', 'Estrutura'],
    ['itens', 'Módulos ou turmas'],
    ['alunos', 'Alunos'],
    ['professores', 'Professores'],
    ['auto', 'Auto-agendamento'],
  ],
};
export const REL_NUM = ['saldo', 'carga', 'horarios', 'itens', 'alunos', 'professores'];
/** Relatórios › Seletores usa as colunas iniciais da ótica educacional (REL_PADRAO.relatorios = edu) */
export const REL_PADRAO: Record<Pers, string[]> = {
  aluno: ['nome', 'produto', 'modulo', 'modalidade', 'uso'],
  professor: ['nome', 'cursos', 'carga', 'horarios'],
  curso: ['nome', 'estrutura', 'itens', 'alunos', 'professores'],
};
export const REL_PERS: [Pers, string, string][] = [
  ['aluno', 'Alunos', 'alunos'],
  ['professor', 'Professores', 'professores'],
  ['curso', 'Cursos', 'curso.geral'],
];
const ESTRUTURA: Record<string, string> = { modulos: 'Módulos', turmas: 'Turmas', nenhuma: 'Sem subdivisão' };

export function relLinhas(b: Base, pers: Pers, ofs: Oferta[]) {
  if (pers === 'aluno')
    return b.alunos.flatMap((a: AlunoB) => {
      const ms = alMat(a);
      const base = {
        nome: a.name,
        email: a.email,
        situacao: alSit(a),
        empresa: a.empresa || 'B2C',
        contrato: a.contratoFim ? fmt.data(a.contratoFim) : '—',
        saldo: alSaldo(a),
        href: hrefAluno(a.id, 'perfil'),
      };
      return ms.length
        ? ms.map((e) => ({
            ...base,
            produto: e.curso,
            modulo: alTemMod(b, e) ? e.modulo! : '—',
            modalidade: e.modalidade || 'Online',
            uso: `${e.usadas || 0}/${e.total || 0}`,
          }))
        : [{ ...base, produto: '—', modulo: '—', modalidade: '—', uso: '—' }];
    });
  if (pers === 'professor')
    return b.professores.map((t) => ({
      nome: t.name,
      email: t.email,
      cursos: t.cursos.join(', ') || '—',
      carga: t.carga,
      horarios: ofs.filter((x) => x.prof === t.name).length,
      situacao: t.active ? 'Ativo' : 'Inativo',
      href: hrefProf(t.id, 'perfil'),
    }));
  return b.cursos.map((c) => ({
    nome: c.name,
    tipo: c.tipo,
    idioma: c.idioma,
    estrutura: ESTRUTURA[c.estrutura] || '—',
    itens: crsItens(c).length,
    alunos: crsAlunos(b, c.name),
    professores: crsProfs(b, c.name),
    auto: c.autoAgenda ? 'Sim' : 'Não',
    href: hrefCurso(c.id, 'geral'),
  }));
}

/** as marcas de qualidade de cada nome na perspectiva (lê as aulas de todos os cursos no período) */
export const relQual = (r: Recorte, pers: Pers) =>
  pers === 'aluno' ? qualAlunos(r, true) : pers === 'professor' ? qualProfs(r, true) : qualCursos(r);
