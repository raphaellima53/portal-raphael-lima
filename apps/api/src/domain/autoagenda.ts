/**
 * Autoagendamento do aluno (25/09/2026): ao clicar num dia (ou dia e hora) da Minha agenda, o aluno vê as aulas desse
 * dia dos cursos Open-Entry (estrutura por módulos) em que tem matrícula ativa, agrupadas por curso e módulo, com o
 * saldo de créditos da matrícula, o tópico, o horário, o professor e a ocupação — e agenda entrando na aula (fica
 * incluído só nela). Os horários do Community Flow entram num grupo próprio, com o crédito do Flow.
 * Regras: prazo de agendamento do módulo (ou do curso), vaga livre, sem outra aula no mesmo horário e com crédito.
 */
import {
  type Aula,
  agAulasEntre,
  agHM,
  agISO,
  agRotulo,
  alMat,
  crsRegras,
  MOD_FLOW,
  type Oferta,
  prazoAte,
  prazoHoras,
  prazoTxt,
} from './agenda.ts';
import { aulaCur } from './aulas.ts';
import type { AlunoB, Base } from './base.ts';
import { flowHorarios, flowResumo } from './flow.ts';

export type SlotAgendar = {
  k: string;
  topico: string;
  ini: string;
  fim: string;
  prof: string;
  n: number;
  vagas: number;
  /** vazio = dá para agendar; senão, o motivo */
  trava: string;
};
export type GrupoAgendar = {
  curso: string;
  mod: string;
  corCurso: string;
  corMod: string;
  creditos: number;
  flow: boolean;
  regra: string;
  aulas: SlotAgendar[];
};

const fimDe = (quando: Date, dur: number) => agHM(new Date(+quando + dur * 6e4));
const choca = (x: Aula, y: Aula) =>
  +x.quando < +y.quando + (y.duracao || 50) * 6e4 && +y.quando < +x.quando + (x.duracao || 50) * 6e4;

/** o aluno está nesta aula (e não cancelou a participação) */
export const estaNaAula = (b: Base, a: Aula, nome: string) => a.alunos.includes(nome) && !b.ajustes[a.k]?.fora?.[nome];

/** aulas Open-Entry de um dia para o aluno agendar, agrupadas por curso e módulo, e os horários do Flow */
export function autoAgenda(b: Base, al: AlunoB, dia: string, ofs: Oferta[], agora = new Date()) {
  const d0 = new Date(`${dia}T00:00:00`);
  const doDia = agAulasEntre(b, d0, d0, agora, ofs);
  /* as aulas em que o aluno já está (para o choque de horário) */
  const minhas = doDia.filter((x) => x.estado !== 'cancelada' && estaNaAula(b, x, al.name));
  const grupos: GrupoAgendar[] = [];
  for (const e of alMat(al)) {
    const c = b.cursos.find((x) => x.name === e.curso);
    if (c?.estrutura !== 'modulos' || !e.modulo) continue;
    const base = {
      curso: c.name,
      mod: e.modulo,
      corCurso: b.corCurso[c.name] || '#1a4fd6',
      corMod: b.corModulo[e.modulo] || '',
    };
    if (e.modulo === MOD_FLOW) {
      const r = flowResumo(b, al, ofs, agora);
      if (!r) continue;
      const dur = crsRegras(c).duracao;
      const hs = flowHorarios(b, c, al, ofs, agora).filter((h) => h.data === dia);
      grupos.push({
        ...base,
        creditos: r.saldo,
        flow: true,
        regra: prazoTxt(prazoHoras(c, MOD_FLOW, 'agendamento')),
        aulas: hs.map((h) => {
          const quando = new Date(`${dia}T${h.hora}:00`);
          return {
            k: `flow|${dia}|${h.hora}`,
            topico: MOD_FLOW,
            ini: h.hora,
            fim: fimDe(quando, dur),
            prof: h.prof,
            n: h.total - h.vagas,
            vagas: h.total,
            trava: r.saldo ? '' : 'sem crédito do Community Flow',
          };
        }),
      });
      continue;
    }
    const creditos = Math.max(0, e.total - e.usadas);
    const aulas = doDia
      .filter(
        (x) =>
          x.prod === c.name &&
          x.mod === e.modulo &&
          !x.avulsa &&
          x.estado !== 'cancelada' &&
          !x.bloqueada &&
          x.quando > agora &&
          !estaNaAula(b, x, al.name),
      )
      .sort((x, y) => +x.quando - +y.quando)
      .map((x): SlotAgendar => {
        const ate = prazoAte(c, x.mod, 'agendamento', x.quando);
        const trava =
          agora > ate
            ? `agendamento encerrado às ${agHM(ate)}`
            : x.n >= x.vagas
              ? 'aula lotada'
              : minhas.some((y) => choca(x, y))
                ? 'você já tem aula neste horário'
                : !creditos
                  ? 'sem créditos neste módulo'
                  : '';
        return {
          k: x.k,
          topico: aulaCur(b, x)?.x.titulo ?? agRotulo(x),
          ini: agHM(x.quando),
          fim: fimDe(x.quando, x.duracao),
          prof: x.prof === '—' ? 'Professor a definir' : x.prof,
          n: x.n,
          vagas: x.vagas,
          trava,
        };
      });
    grupos.push({
      ...base,
      creditos,
      flow: false,
      regra: prazoTxt(prazoHoras(c, e.modulo, 'agendamento')),
      aulas,
    });
  }
  /* o Flow depois dos níveis, como na agenda do produto */
  grupos.sort((x, y) => Number(x.flow) - Number(y.flow));
  return {
    data: dia,
    /* "Quarta-feira, 30 de setembro" */
    titulo: d0
      .toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
      .replace(/^./, (x) => x.toUpperCase()),
    passado: dia < agISO(agora),
    grupos,
  };
}
