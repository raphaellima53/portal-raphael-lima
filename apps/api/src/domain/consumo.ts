import { agAulasEntre } from './agenda.ts';
import type { Base, MatriculaB } from './base.ts';

const DIA = 864e5;
/** o futuro conta só até o limite de agendamento (720 h = 30 dias, 2.13.2.6) ou o fim da vigência, o que vier antes:
    a grade fixa se repete sem fim e não deve consumir o pacote meses antes da aula */
export const CONSUMO_HORIZONTE_DIAS = 30;
/** sem início de vigência, conta os últimos 90 dias (a mesma janela do Community Flow) */
export const CONSUMO_SEM_INICIO_DIAS = 90;
/** teto da janela, para a base em memória não varrer anos de agenda */
const TETO_DIAS = 730;

/**
 * Decisão 3.4.3.1 (05/10/2026): Saldo = Total − aulas agendadas + aulas canceladas.
 * Agendada = aula da agenda em que o aluno está, do início da vigência até daqui a 30 dias (ou o fim da vigência) (a grade fixa, a aula avulsa e o
 * autoagendamento). Cancelada = a aula foi cancelada ou bloqueada, ou o agendamento do aluno foi cancelado.
 * O resultado vai para `usadas` (agendadas − canceladas): lista, ficha, dashboard, relatórios e alertas usam o mesmo
 * número. A coluna `usadas` do banco deixa de ser digitada.
 */
export function aplicaConsumo(b: Base, agora = new Date()) {
  const hoje = new Date(agora);
  hoje.setHours(0, 0, 0, 0);
  const dia = (s: string) => new Date(`${s}T00:00:00`);
  const piso = +hoje - TETO_DIAS * DIA;
  const teto = +hoje + TETO_DIAS * DIA;
  type Conta = { e: MatriculaB; ini: number; fim: number; ag: number; canc: number };
  const porAluno = new Map<string, Conta[]>();
  let gi = Number.POSITIVE_INFINITY;
  let gf = Number.NEGATIVE_INFINITY;
  for (const a of b.alunos)
    for (const e of a.matriculas) {
      if (e.desativadoEm) continue;
      const ini = Math.max(piso, e.inicio ? +dia(e.inicio) : +hoje - CONSUMO_SEM_INICIO_DIAS * DIA);
      const fim = Math.min(teto, +hoje + CONSUMO_HORIZONTE_DIAS * DIA, e.fim ? +dia(e.fim) : teto) + DIA - 1;
      if (fim < ini) {
        e.agendadas = 0;
        e.canceladas = 0;
        e.usadas = 0;
        continue;
      }
      gi = Math.min(gi, ini);
      gf = Math.max(gf, fim);
      porAluno.set(a.name, [...(porAluno.get(a.name) ?? []), { e, ini, fim, ag: 0, canc: 0 }]);
    }
  if (!porAluno.size) return;
  for (const a of agAulasEntre(b, new Date(gi), new Date(gf), agora, undefined, false))
    for (const nome of a.alunos) {
      const c = porAluno
        .get(nome)
        ?.find(
          (x) =>
            x.e.curso === a.prod &&
            (x.e.modulo == null || x.e.modulo === a.mod) &&
            +a.quando >= x.ini &&
            +a.quando <= x.fim,
        );
      if (!c) continue;
      c.ag++;
      if (a.estado === 'cancelada' || b.ajustes[a.k]?.fora?.[nome]) c.canc++;
    }
  for (const l of porAluno.values())
    for (const c of l) {
      c.e.agendadas = c.ag;
      c.e.canceladas = c.canc;
      c.e.usadas = c.ag - c.canc;
    }
}
