/**
 * Community Flow (24/09/2026): adesão ao Community live classes pela matrícula no módulo Community Flow. A cada
 * 5 presenças nas aulas dos níveis (Confidence a Apex 3) desde a adesão, o aluno ganha 1 crédito de aula particular,
 * que ele mesmo agenda num horário com vaga da grade do módulo. Cada horário tem as vagas do módulo (25/09/2026); o
 * professor é o vinculado ao horário na grade (desde 30/09/2026 não há escolha automática pelo cadastro), e quem
 * agenda depois entra na mesma aula. A aula agendada é uma aula avulsa do módulo;
 * cancelada, bloqueada ou com o aluno retirado, o crédito volta.
 */
import { fmt } from '../lib/fmt.ts';
import {
  type Aula,
  agAulasEntre,
  agHM,
  agHoraNum,
  agISO,
  alMat,
  crsRegras,
  fxPresenca,
  MOD_FLOW,
  type Oferta,
  prazoAte,
  prazoHoras,
  prazoTxt,
} from './agenda.ts';
import { type AlunoB, type AvulsaB, type Base, COR_NIVEL, type CursoB, type MatriculaB } from './base.ts';

export const FLOW_A_CADA = 5;
/** até quantos dias à frente o aluno vê horário para agendar */
export const FLOW_JANELA = 14;
/** sem data de início na matrícula, a adesão conta as presenças destes últimos dias */
const FLOW_SEM_INICIO = 90;
const NIVEIS = new Set(Object.keys(COR_NIVEL));

export const flowChave = (v: AvulsaB) =>
  [v.curso, v.mod ?? '', `Aula avulsa ${v.id}`, agISO(v.inicio), v.inicio.getHours() + v.inicio.getMinutes() / 60].join(
    '|',
  );
/** aula Flow que ainda vale (não cancelada, não bloqueada, aluno não retirado) */
const vale = (b: Base, v: AvulsaB, nome?: string) => {
  const ov = b.ajustes[flowChave(v)];
  return !ov?.cancelada && !ov?.bloqueada && !(nome && ov?.fora?.[nome]);
};
export const flowAulas = (b: Base, curso: string) => b.avulsas.filter((v) => v.curso === curso && v.mod === MOD_FLOW);

export const flowMatricula = (a: AlunoB) => alMat(a).find((e) => e.modulo === MOD_FLOW);

const adesaoDe = (e: MatriculaB, agora: Date) => {
  if (e.inicio) return new Date(`${e.inicio}T00:00:00`);
  const d = new Date(agora);
  d.setDate(d.getDate() - FLOW_SEM_INICIO);
  d.setHours(0, 0, 0, 0);
  return d;
};

/** horário da grade com vaga: professor, vagas livres e a aula Flow já marcada nele (quando há) */
type Horario = { data: string; hora: string; prof: string; vagas: number; total: number; avulsa: string | null };

/** vagas de cada horário do Flow: as do módulo (Cursos › Módulos), 1 quando não definidas */
export const flowVagas = (c: CursoB) => Math.max(1, c.modInfo[MOD_FLOW]?.vagas ?? 1);
/** alunos que ainda ocupam a aula Flow (retirado não conta) */
const ocupantes = (b: Base, v: AvulsaB) => v.alunos.filter((n) => !b.ajustes[flowChave(v)]?.fora?.[n]);

/** professor já com outra aula que se sobrepõe ao horário */
const profOcupado = (prof: string, quando: Date, dur: number, ocupados: Aula[]) => {
  const fim = +quando + dur * 6e4;
  return ocupados.some((a) => a.prof === prof && +a.quando < fim && +a.quando + (a.duracao || 50) * 6e4 > +quando);
};

/** horários livres da grade do Community Flow para um aluno, nos próximos dias */
export function flowHorarios(b: Base, c: CursoB, a: AlunoB | null, ofs: Oferta[], agora = new Date()): Horario[] {
  const info = c.modInfo[MOD_FLOW];
  const grade = info?.horarios ?? [];
  if (!grade.length) return [];
  const rg = crsRegras(c);
  /* agendar até X antes (regra do módulo, senão a do curso) */
  const limite = +agora + prazoHoras(c, MOD_FLOW, 'agendamento') * 36e5;
  const fim = new Date(agora);
  fim.setDate(fim.getDate() + FLOW_JANELA);
  const todas = agAulasEntre(b, agora, fim, agora, ofs).filter((x) => x.estado !== 'cancelada');
  const flow = flowAulas(b, c.name).filter((v) => v.inicio > agora && vale(b, v));
  const total = flowVagas(c);
  const out: Horario[] = [];
  const d = new Date(agora);
  d.setHours(0, 0, 0, 0);
  for (; d <= fim; d.setDate(d.getDate() + 1)) {
    const dia = agISO(d);
    if (!d.getDay() || b.feriados.has(dia)) continue;
    for (const h of grade
      .filter((x) => x.dia === d.getDay() && (!x.ate || dia <= x.ate))
      .sort((x, y) => x.hora.localeCompare(y.hora))) {
      const quando = new Date(d);
      quando.setHours(0, Math.round(agHoraNum(h.hora) * 60), 0, 0);
      if (+quando <= limite) continue;
      /* 25/09/2026: o horário recebe até `vagas` alunos, todos na mesma aula e com o mesmo professor */
      const marcada = flow.find((v) => +v.inicio === +quando);
      if (marcada) {
        const ocup = ocupantes(b, marcada);
        if (!marcada.prof || ocup.length >= total || (a && marcada.alunos.includes(a.name))) continue;
      }
      const dur = rg.duracao;
      const fimAula = +quando + dur * 6e4;
      if (
        a &&
        todas.some(
          (x) => x.alunos.includes(a.name) && +x.quando < fimAula && +x.quando + (x.duracao || 50) * 6e4 > +quando,
        )
      )
        continue;
      if (marcada) {
        const livres = total - ocupantes(b, marcada).length;
        out.push({ data: dia, hora: h.hora, prof: marcada.prof!, vagas: livres, total, avulsa: marcada.id });
        continue;
      }
      /* 30/09/2026: só o professor vinculado ao horário na grade (sem escolha automática), e livre nessa hora */
      if (!h.prof || profOcupado(h.prof, quando, dur, todas)) continue;
      out.push({ data: dia, hora: h.hora, prof: h.prof, vagas: total, total, avulsa: null });
    }
  }
  return out;
}

/** saldo de créditos, presenças que contam e as aulas Flow do aluno */
export function flowResumo(b: Base, a: AlunoB, ofs: Oferta[], agora = new Date()) {
  const e = flowMatricula(a);
  if (!e) return null;
  const c = b.cursos.find((x) => x.name === e.curso);
  if (!c) return null;
  const desde = adesaoDe(e, agora);
  const presencas = agAulasEntre(b, desde, agora, agora, ofs).filter(
    (x) =>
      x.quando < agora &&
      x.prod === c.name &&
      !!x.mod &&
      NIVEIS.has(x.mod) &&
      x.alunos.includes(a.name) &&
      !b.ajustes[x.k]?.fora?.[a.name] &&
      fxPresenca(b, a.name, x) === 'presente',
  ).length;
  const minhas = flowAulas(b, c.name).filter((v) => v.alunos.includes(a.name) && vale(b, v, a.name));
  const ganhos = Math.floor(presencas / FLOW_A_CADA);
  const usados = minhas.length;
  return {
    curso: c,
    matricula: e.id,
    desde: agISO(desde),
    desdeTxt: fmt.data(desde),
    presencas,
    ganhos,
    usados,
    saldo: Math.max(0, ganhos - usados),
    /* presenças que faltam para o próximo crédito */
    faltam: FLOW_A_CADA - (presencas % FLOW_A_CADA),
    agendadas: minhas
      .filter((v) => v.fim > agora)
      .map((v) => {
        /* cancelar até X antes (regra do módulo); depois do prazo, a aula fica */
        const ate = prazoAte(c, MOD_FLOW, 'cancelamento', v.inicio);
        return {
          k: flowChave(v),
          data: fmt.semana(v.inicio),
          horario: `${agHM(v.inicio)}–${agHM(v.fim)}`,
          prof: v.prof ?? '—',
          cancelarAte: `${fmt.data(ate)} às ${agHM(ate)}`,
          podeCancelar: agora < ate,
        };
      }),
    regras: {
      agendar: prazoTxt(prazoHoras(c, MOD_FLOW, 'agendamento')),
      cancelar: prazoTxt(prazoHoras(c, MOD_FLOW, 'cancelamento')),
    },
  };
}

export const flowDiaTxt = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return fmt.semana(d);
};
