/**
 * Dashboard (tela inicial) — porte de dashboard.src.js.
 * Cada bloco lê a base viva, só aparece para quem tem a chave de acesso e leva à tela de origem.
 * A API devolve dados, não HTML: linhas, KPIs, barras e links; o front desenha.
 */
import { fmt, plural } from '../lib/fmt.ts';
import {
  AG_KB,
  AL_SIT,
  type Aula,
  agAulasEntre,
  agCor,
  agDiasTxt,
  agHH,
  agHM,
  agInicioSemana,
  agISO,
  agNaAgenda,
  agOfertas,
  agRotulo,
  alDisp,
  alMat,
  alSit,
  crsItens,
  DN,
  dispConflitos,
  type Estado,
  FX_ESTADO,
  fxPresenca,
  type Oferta,
  prDisp,
} from './agenda.ts';
import type { Base } from './base.ts';
import { hrefAgenda, hrefAluno, hrefCurso, hrefProf, hrefTela } from './rotas.ts';

export type Tom = 'red' | 'amber' | 'green' | 'blue' | 'purple' | 'gray';
export type Seg = { t: string; cor?: string; tom?: Tom };
export type Linha = {
  nome: Seg[];
  valor?: string;
  valorBadge?: { t: string; tom: Tom };
  href?: string;
  sub?: Seg[];
  barra?: { pct: number; cor: string };
};
export type Kpi = { valor: string; rotulo: string; tom?: Tom; ponto?: string };
export type CorpoBloco = {
  stats?: { valor: string; rotulo: string; tom?: Tom }[];
  kpis?: Kpi[];
  linhas?: Linha[];
  vazio?: string;
  pe?: string;
};
export type BlocoDef = {
  k: string;
  g: string;
  t: string;
  d: string;
  chave: string;
  semCard?: boolean;
  abrir?: { href: string; rotulo: string };
};

export const DASH_GRUPOS = ['Cursos e agenda', 'Alunos', 'Professores', 'Qualidade', 'Configurações'];
export const DASH_PADRAO = ['resumo', 'proximas', 'pendencias', 'ocupacao', 'situacao', 'pacote', 'presenca', 'carga'];

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const txt = (t: string, extra?: Omit<Seg, 't'>): Seg[] => [{ t, ...extra }];

type Ctx = {
  b: Base;
  agora: Date;
  ofertas: () => Oferta[];
  hoje: () => Aula[];
  semana: () => Aula[];
  mes30: () => Aula[];
};

function ctx(b: Base, agora: Date): Ctx {
  const memo = new Map<string, unknown>();
  const m =
    <T>(k: string, f: () => T) =>
    () => {
      if (!memo.has(k)) memo.set(k, f());
      return memo.get(k) as T;
    };
  const c: Ctx = {
    b,
    agora,
    ofertas: m('o', () => agOfertas(b)),
    hoje: m('h', () => agAulasEntre(b, agora, agora, agora, c.ofertas())),
    semana: m('s', () => {
      const s = agInicioSemana(agora);
      const f = new Date(s);
      f.setDate(s.getDate() + 6);
      return agAulasEntre(b, s, f, agora, c.ofertas());
    }),
    mes30: m('m', () => {
      const i = new Date(agora);
      i.setDate(i.getDate() - 30);
      return agAulasEntre(b, i, agora, agora, c.ofertas()).filter((a) => a.quando < agora);
    }),
  };
  return c;
}

type Bloco = BlocoDef & { corpo: (c: Ctx) => CorpoBloco };
const kb = (k: Estado) => AG_KB.find((x) => x[0] === k)!;

export const DASH_BLOCOS: Bloco[] = [
  {
    k: 'resumo',
    g: 'Cursos e agenda',
    t: 'Resumo do dia',
    chave: 'agenda',
    semCard: true,
    d: 'aulas, alunos e professores de hoje, pendências da semana e ocupação da grade',
    corpo: (c) => {
      const hj = agNaAgenda(c.hoje());
      const sem = c.semana();
      const ofs = c.ofertas();
      const pend = sem.filter((a) => ['semAlunos', 'semProfessor', 'naoFinalizada'].includes(a.estado)).length;
      const v = ofs.reduce((s, o) => s + o.vagas, 0);
      const oc = ofs.reduce((s, o) => s + (o.ocupadas != null ? o.ocupadas : o.alunos.length), 0);
      return {
        stats: [
          { valor: String(hj.length), rotulo: 'aulas hoje' },
          { valor: String(new Set(hj.flatMap((a) => a.alunos)).size), rotulo: 'alunos com aula hoje' },
          {
            valor: String(new Set(hj.map((a) => a.prof).filter((p) => p !== '—')).size),
            rotulo: 'professores em aula hoje',
          },
          { valor: String(pend), rotulo: 'pendências na semana', tom: pend ? 'red' : 'green' },
          { valor: v ? `${pct(oc, v)}%` : '—', rotulo: 'ocupação da grade' },
        ],
      };
    },
  },
  {
    k: 'proximas',
    g: 'Cursos e agenda',
    t: 'Aulas de hoje',
    chave: 'agenda',
    d: 'o que ainda vai acontecer hoje, com professor, sala e ocupação',
    abrir: { href: hrefAgenda({ vista: 'diaria' }), rotulo: 'abrir o dia' },
    corpo: (c) => {
      const hj = agNaAgenda(c.hoje());
      if (!hj.length) return { vazio: !c.agora.getDay() ? 'domingo — não há grade' : 'nenhuma aula hoje' };
      const prox = hj.filter((a) => a.quando.getTime() + (a.duracao || 50) * 6e4 >= c.agora.getTime());
      const feitas = hj.length - prox.length;
      return {
        linhas: prox.slice(0, 7).map((a) => ({
          nome: txt(`${agHM(a.quando)} · ${agRotulo(a)}`, { cor: agCor(c.b, a) }),
          valor: `${a.n}/${a.vagas}`,
          href: hrefAgenda({ vista: 'diaria' }),
          sub: [a.prof === '—' ? { t: 'sem professor', tom: 'red' } : { t: a.prof }, { t: ` · ${a.sala}` }],
        })),
        vazio: prox.length ? undefined : 'as aulas de hoje já terminaram',
        pe: `${feitas} ${feitas === 1 ? 'aula já terminou' : 'aulas já terminaram'} · ${prox.length} por vir${prox.length > 7 ? ' · mostrando 7' : ''}`,
      };
    },
  },
  {
    k: 'pendencias',
    g: 'Cursos e agenda',
    t: 'Pendências da semana',
    chave: 'agenda',
    d: 'aulas sem professor, sem alunos ou não finalizadas',
    abrir: { href: hrefAgenda({ vista: 'kanban', periodo: 'semana' }), rotulo: 'abrir o kanban' },
    corpo: (c) => {
      const sem = c.semana();
      const ks: Estado[] = ['semProfessor', 'semAlunos', 'naoFinalizada'];
      const ls = sem
        .filter((a) => ks.includes(a.estado))
        .sort((x, y) => ks.indexOf(x.estado) - ks.indexOf(y.estado) || +x.quando - +y.quando);
      return {
        kpis: ks.map((k) => ({
          valor: String(sem.filter((a) => a.estado === k).length),
          rotulo: kb(k)[1].toLowerCase(),
          ponto: kb(k)[2],
        })),
        linhas: ls.slice(0, 5).map((a) => ({
          nome: txt(`${fmt.semana(a.quando)} · ${agHM(a.quando)} · ${agRotulo(a)}`),
          valorBadge: { t: FX_ESTADO[a.estado][0], tom: FX_ESTADO[a.estado][1] as Tom },
          href: hrefAgenda({ vista: 'diaria', data: agISO(a.quando) }),
          sub: txt(a.quem),
        })),
        vazio: ls.length ? undefined : 'nenhuma pendência nesta semana',
        pe: ls.length > 5 ? `mais ${ls.length - 5} na tela de origem` : undefined,
      };
    },
  },
  {
    k: 'ocupacao',
    g: 'Cursos e agenda',
    t: 'Ocupação por curso',
    chave: 'curso.grade',
    d: 'alunos na grade sobre as vagas ofertadas em cada curso',
    corpo: (c) => {
      const ofs = c.ofertas();
      const linhas = c.b.cursos
        .map((cs) => ({ cs, os: ofs.filter((o) => o.prod === cs.name) }))
        .filter((x) => x.os.length)
        .map(({ cs, os }) => {
          const v = os.reduce((s, o) => s + o.vagas, 0);
          const oc = os.reduce((s, o) => s + (o.ocupadas != null ? o.ocupadas : o.alunos.length), 0);
          const p = pct(oc, v);
          return {
            nome: txt(cs.name),
            valor: `${oc}/${v} · ${p}%`,
            href: hrefCurso(cs.id, 'grade'),
            sub: txt(`${os.length} ${os.length === 1 ? 'horário' : 'horários'} na grade`),
            barra: { pct: Math.min(100, p), cor: c.b.corCurso[cs.name] || '#1a4fd6' },
          };
        });
      return linhas.length ? { linhas } : { vazio: 'nenhum curso com horário na grade' };
    },
  },
  {
    k: 'curriculo',
    g: 'Qualidade',
    t: 'Módulos e turmas sem currículo',
    chave: 'curso.curriculo',
    d: 'o que vai gerar aula sem conteúdo definido',
    abrir: { href: hrefAgenda({ vista: 'kanban', periodo: 'semana', qual: 'semCur' }), rotulo: 'abrir no kanban' },
    corpo: (c) => {
      const ls = c.b.cursos
        .map((cs) => ({
          cs,
          sem: crsItens(cs).filter((it) => !c.b.curriculos.some((x) => x.grupo === cs.name && x.aplicado.includes(it))),
        }))
        .filter((x) => x.sem.length);
      return ls.length
        ? {
            linhas: ls.map(({ cs, sem }) => ({
              nome: txt(cs.name),
              valor: String(sem.length),
              href: hrefCurso(cs.id, 'curriculo'),
              sub: txt(sem.join(', ')),
            })),
          }
        : { vazio: 'todos os módulos e turmas têm currículo' };
    },
  },
  {
    k: 'situacao',
    g: 'Alunos',
    t: 'Alunos por situação',
    chave: 'alunos',
    d: 'quantos estão ativos, suspensos, congelados, inadimplentes, cancelados ou inativos',
    abrir: { href: hrefTela('pedAlunos'), rotulo: 'abrir a lista' },
    corpo: (c) => {
      const tot = c.b.alunos.length;
      const cor: Record<string, string> = {
        Ativo: '#0f9d6e',
        Suspenso: '#e8a020',
        Congelado: '#64748b',
        Inadimplente: '#dc2f3c',
        Cancelado: '#98a1b2',
        Inativo: '#475569',
      };
      return {
        linhas: AL_SIT.map((s) => {
          const n = c.b.alunos.filter((a) => alSit(a) === s).length;
          return {
            nome: txt(s),
            valor: `${n} · ${pct(n, tot)}%`,
            href: hrefTela('pedAlunos', { sit: s }),
            barra: { pct: pct(n, tot), cor: cor[s] },
          };
        }),
      };
    },
  },
  {
    k: 'pacote',
    g: 'Alunos',
    t: 'Consumo do pacote',
    chave: 'aluno.cursos',
    d: 'as matrículas que mais usaram o pacote — a partir de 80%, hora de renovar',
    corpo: (c) => {
      const ls = c.b.alunos
        .flatMap((a) => alMat(a).map((e) => ({ a, e, u: e.usadas || 0, t: e.total || 0 })))
        .filter((x) => x.t)
        .sort((x, y) => y.u / y.t - x.u / x.t);
      const renovar = ls.filter((x) => x.u / x.t >= 0.8).length;
      return {
        kpis: [
          { valor: String(renovar), rotulo: 'com 80% ou mais', tom: renovar ? 'amber' : 'green' },
          { valor: String(ls.length), rotulo: 'matrículas ativas' },
        ],
        linhas: ls.slice(0, 6).map(({ a, e, u, t }) => {
          const p = pct(u, t);
          return {
            nome: txt(a.name),
            valor: `${p}% · restam ${t - u}`,
            href: hrefAluno(a.id, 'cursos'),
            sub: txt(`${e.curso}${e.modulo ? ` · ${e.modulo}` : ''} · ${u}/${t} aulas`),
            barra: { pct: p, cor: p >= 95 ? '#dc2f3c' : p >= 80 ? '#e8a020' : '#1a4fd6' },
          };
        }),
        vazio: ls.length ? undefined : 'nenhuma matrícula ativa',
      };
    },
  },
  {
    k: 'conflitos',
    g: 'Alunos',
    t: 'Agenda do aluno em conflito',
    chave: 'aluno.alocacao',
    d: 'aula fora da disponibilidade ou duas aulas no mesmo horário',
    corpo: (c) => {
      const ofs = c.ofertas();
      const ls: { id: number; nome: string; fora: number; choques: string[] }[] = [];
      for (const a of c.b.alunos.filter((x) => alMat(x).length)) {
        const os = ofs.filter((o) => o.alunos.includes(a.name));
        const choques = new Set<string>();
        os.forEach((o, i) => {
          for (const p of os.slice(i + 1))
            if (o.hora === p.hora)
              for (const d of o.dias.filter((d) => p.dias.includes(d))) choques.add(`${DN[d]} ${agHH(o.hora)}`);
        });
        const fora = dispConflitos(alDisp(c.b, a, ofs), os).length;
        if (fora || choques.size) ls.push({ id: a.id, nome: a.name, fora, choques: [...choques] });
      }
      return ls.length
        ? {
            linhas: ls.slice(0, 6).map((x) => {
              const n = x.fora + x.choques.length;
              return {
                nome: txt(x.nome),
                valor: n + (n === 1 ? ' conflito' : ' conflitos'),
                href: hrefAluno(x.id, 'cursos'),
                sub: txt(
                  [
                    x.choques.length ? `duas aulas em ${x.choques.join(', ')}` : '',
                    x.fora ? `${x.fora} fora da disponibilidade` : '',
                  ]
                    .filter(Boolean)
                    .join(' · '),
                ),
              };
            }),
            pe: ls.length > 6 ? `mais ${ls.length - 6} na tela de origem` : undefined,
          }
        : { vazio: 'nenhum aluno com conflito de agenda' };
    },
  },
  {
    k: 'presenca',
    g: 'Alunos',
    t: 'Presença nos últimos 30 dias',
    chave: 'aluno.agendamentos',
    d: 'a presença geral e quem mais faltou',
    corpo: (c) => {
      const por: Record<string, number> = {};
      let p = 0;
      let f = 0;
      for (const a of c.mes30()) {
        for (const n of a.alunos) {
          const r = fxPresenca(c.b, n, a);
          if (r === 'presente') p++;
          else if (r === 'falta') {
            f++;
            por[n] = (por[n] || 0) + 1;
          }
        }
      }
      const top = Object.entries(por)
        .sort((x, y) => y[1] - x[1])
        .slice(0, 5);
      const pc = pct(p, p + f);
      return {
        kpis: [
          { valor: p + f ? `${pc}%` : '—', rotulo: 'de presença', tom: pc >= 85 ? 'green' : 'amber' },
          { valor: String(p), rotulo: 'presenças' },
          { valor: String(f), rotulo: 'faltas', tom: f ? 'red' : undefined },
        ],
        linhas: top.map(([n, k]) => {
          const a = c.b.alunos.find((x) => x.name === n);
          const dadas = c
            .mes30()
            .filter((x) => x.alunos.includes(n) && ['executada', 'substituida'].includes(x.estado)).length;
          return {
            nome: txt(n),
            valor: k + (k === 1 ? ' falta' : ' faltas'),
            href: a ? hrefAluno(a.id, 'agendamentos', { quando: 'passadas' }) : undefined,
            sub: txt(`${dadas} aulas dadas no período`),
          };
        }),
        vazio: top.length ? undefined : 'nenhuma falta no período',
      };
    },
  },
  {
    k: 'carga',
    g: 'Professores',
    t: 'Aulas por semana por professor',
    chave: 'professores',
    d: 'a carga de cada professor na grade contra o teto semanal',
    abrir: { href: hrefTela('professores'), rotulo: 'abrir a lista' },
    corpo: (c) => {
      const ofs = c.ofertas();
      return {
        linhas: c.b.professores
          .filter((t) => t.active)
          .map((t) => ({ t, n: ofs.filter((o) => o.prof === t.name).reduce((s, o) => s + o.dias.length, 0) }))
          .sort((x, y) => y.n - x.n)
          .slice(0, 8)
          .map(({ t, n }) => ({
            nome: txt(t.name),
            valor: `${n} de ${t.teto}`,
            href: hrefProf(t.id),
            barra: { pct: Math.min(100, pct(n, t.teto)), cor: n > t.teto ? '#e8a020' : '#1a4fd6' },
          })),
      };
    },
  },
  {
    k: 'naoFin',
    g: 'Qualidade',
    t: 'Aulas não finalizadas',
    chave: 'agenda',
    d: 'aulas dos últimos 30 dias que passaram sem fechamento, por professor',
    abrir: { href: hrefAgenda({ vista: 'kanban', periodo: 'mes', qual: 'naoFin' }), rotulo: 'abrir no kanban' },
    corpo: (c) => {
      const ls = c.mes30().filter((a) => a.estado === 'naoFinalizada');
      const por: Record<string, number> = {};
      for (const a of ls) por[a.prof] = (por[a.prof] || 0) + 1;
      return {
        kpis: [
          { valor: String(ls.length), rotulo: 'aulas sem fechamento', tom: ls.length ? 'amber' : 'green' },
          { valor: String(Object.keys(por).length), rotulo: 'professores' },
        ],
        linhas: Object.entries(por)
          .sort((x, y) => y[1] - x[1])
          .slice(0, 6)
          .map(([n, k]) => {
            const t = c.b.professores.find((x) => x.name === n);
            const ult = ls.filter((a) => a.prof === n).pop()!;
            return {
              nome: txt(n),
              valor: k + (k === 1 ? ' aula' : ' aulas'),
              href: t ? hrefProf(t.id, 'agenda', { quando: 'passadas' }) : undefined,
              sub: txt(`a última em ${fmt.semana(ult.quando)} · ${agRotulo(ult)}`),
            };
          }),
        vazio: ls.length ? undefined : 'todas as aulas do período foram finalizadas',
      };
    },
  },
  {
    k: 'semProf',
    g: 'Qualidade',
    t: 'Horários sem professor',
    chave: 'agenda',
    d: 'o que a grade oferta e ninguém está escalado para dar',
    abrir: { href: hrefAgenda({ vista: 'kanban', periodo: 'semana', qual: 'semProf' }), rotulo: 'abrir no kanban' },
    corpo: (c) => {
      const ls = c.ofertas().filter((o) => o.prof === '—');
      return ls.length
        ? {
            linhas: ls.map((o) => ({
              nome: txt(`${o.prod}${o.mod ? ` · ${o.mod}` : ''}`),
              valor: `${agDiasTxt(o)} · ${agHH(o.hora)}`,
              href: hrefCurso(c.b.cursos.find((x) => x.name === o.prod)?.id ?? 0, 'grade'),
              sub: txt(o.quem),
            })),
          }
        : { vazio: 'todos os horários da grade têm professor' };
    },
  },
  {
    k: 'subst',
    g: 'Qualidade',
    t: 'Substituições nos últimos 30 dias',
    chave: 'prof.agenda',
    d: 'quem foi substituído e quem cobriu',
    abrir: { href: hrefAgenda({ vista: 'kanban', periodo: 'mes', qual: 'subst' }), rotulo: 'abrir no kanban' },
    corpo: (c) => {
      const ls = c.mes30().filter((a) => a.sub);
      const por: Record<string, { s: number; c: number }> = {};
      for (const a of ls) {
        por[a.sub!] ??= { s: 0, c: 0 };
        por[a.sub!].s++;
        por[a.prof] ??= { s: 0, c: 0 };
        por[a.prof].c++;
      }
      const rows = Object.entries(por).sort((x, y) => y[1].s + y[1].c - (x[1].s + x[1].c));
      return {
        kpis: [
          { valor: String(ls.length), rotulo: 'aulas substituídas' },
          { valor: String(rows.length), rotulo: 'professores envolvidos' },
        ],
        linhas: rows.slice(0, 6).map(([n, v]) => {
          const t = c.b.professores.find((x) => x.name === n);
          return {
            nome: txt(n),
            valor: `${v.s} · ${v.c}`,
            href: t ? hrefProf(t.id, 'agenda', { quando: 'passadas' }) : undefined,
            sub: txt(`substituído ${v.s} ${v.s === 1 ? 'vez' : 'vezes'} · cobriu ${v.c}`),
          };
        }),
        vazio: rows.length ? undefined : 'nenhuma substituição no período',
      };
    },
  },
  {
    k: 'profDisp',
    g: 'Qualidade',
    t: 'Professores com aula fora da disponibilidade',
    chave: 'prof.disponibilidade',
    d: 'aula da grade num horário que o professor não marcou como disponível',
    abrir: { href: hrefAgenda({ vista: 'kanban', periodo: 'semana', qual: 'profDisp' }), rotulo: 'abrir no kanban' },
    corpo: (c) => {
      const ofs = c.ofertas();
      const ls = c.b.professores
        .filter((t) => t.active)
        .map((t) => ({
          t,
          cf: dispConflitos(
            prDisp(c.b, t, ofs),
            ofs.filter((o) => o.prof === t.name),
          ),
        }))
        .filter((x) => x.cf.length);
      return ls.length
        ? {
            linhas: ls.map(({ t, cf }) => ({
              nome: txt(t.name),
              valor: cf.length + (cf.length === 1 ? ' aula' : ' aulas'),
              href: hrefProf(t.id, 'disponibilidade'),
              sub: txt(
                cf
                  .slice(0, 4)
                  .map(({ o, d }) => `${DN[d]} ${agHH(o.hora)}`)
                  .join(', '),
              ),
            })),
          }
        : { vazio: 'todas as aulas estão dentro da disponibilidade dos professores' };
    },
  },
  {
    k: 'acessos',
    g: 'Configurações',
    t: 'Acessos ao portal',
    chave: 'cfg',
    d: 'usuários ativos, convites pendentes, bloqueados e sem MFA',
    abrir: { href: hrefTela('usuarios'), rotulo: 'abrir usuários' },
    corpo: (c) => {
      const st = ['Ativo', 'Convite pendente', 'Bloqueado', 'Inativo'];
      const cor: Record<string, string> = {
        Ativo: '#0f9d6e',
        'Convite pendente': '#e8a020',
        Bloqueado: '#dc2f3c',
        Inativo: '#98a1b2',
      };
      const tot = c.b.usuarios.length;
      return {
        linhas: st.map((s) => {
          const n = c.b.usuarios.filter((u) => u.status === s).length;
          return {
            nome: txt(s),
            valor: String(n),
            href: hrefTela('usuarios'),
            barra: { pct: pct(n, tot), cor: cor[s] },
          };
        }),
        pe: `${c.b.usuarios.filter((u) => !u.mfa).length} de ${tot} usuários sem MFA`,
      };
    },
  },
];

export const blocoDef = ({ corpo: _c, ...d }: Bloco): BlocoDef => d;

/** Monta os blocos marcados. Um bloco que falha vira aviso, sem derrubar o dashboard. */
export function montaDashboard(b: Base, marcados: string[], agora = new Date()) {
  const c = ctx(b, agora);
  return DASH_BLOCOS.filter((x) => marcados.includes(x.k)).map((x) => {
    let corpo: CorpoBloco;
    try {
      corpo = x.corpo(c);
    } catch {
      corpo = { vazio: 'não foi possível montar este bloco' };
    }
    return { ...blocoDef(x), corpo };
  });
}

export { plural };
