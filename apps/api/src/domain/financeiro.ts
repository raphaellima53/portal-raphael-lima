/**
 * Cobranças: cada matrícula ativa vira um contrato (pacote × valor da aula) em 6 parcelas mensais, vencendo no dia 10;
 * turmas dedicadas cobram por turma, da empresa. Porte de finCobrancas (financeiro.src.js).
 */
import { agAulasEntre, agOfertas, alMat, alSit, crsRegras } from './agenda.ts';
import { finValorHora, folhaSit, folhaValor } from './aulas.ts';
import type { Base } from './base.ts';
import { finValorAula } from './cursos.ts';

export const FIN_PARCELAS = 6;
/** hash de 32 bits sem sinal (finHash do portal) */
const finHash = (s: string) => {
  let h = 0;
  for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
};
/** moeda como o DS do portal: R$ 1.365,33 */
export const finR = (n: number, casas = 2) =>
  `${Number(n) < 0 ? '− ' : ''}R$ ${Math.abs(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}`;

export type Cobranca = {
  key: string;
  parcela: string;
  venc: Date;
  valor: number;
  pago: Date | null;
  sit: 'paga' | 'vencida' | 'aVencer';
  atraso: number;
  pagador: string;
  tipo: 'aluno' | 'turma';
  logId: number;
  curso: string;
  item: string;
  alunoId: number | null;
  cursoId: number | null;
};

export function finCobrancas(b: Base, pagas: Map<string, Date>, agora = new Date()): Cobranca[] {
  const out: Cobranca[] = [];
  const valorCurso = (nome: string) => {
    const c = b.cursos.find((x) => x.name === nome);
    return c ? finValorAula(c) : 0;
  };
  const porTurma = (nome: string) => b.cursos.find((x) => x.name === nome)?.estrutura === 'turmas';
  const gera = (
    base: string,
    o: Omit<Cobranca, 'key' | 'parcela' | 'venc' | 'valor' | 'pago' | 'sit' | 'atraso'> & {
      contrato: number;
      andamento: number;
      inad: boolean;
    },
  ) => {
    const valor = o.contrato / FIN_PARCELAS;
    const passados = Math.max(1, Math.min(FIN_PARCELAS, Math.round(o.andamento * FIN_PARCELAS) + 1));
    const h = finHash(base);
    for (let k = 0; k < FIN_PARCELAS; k++) {
      const venc = new Date(agora.getFullYear(), agora.getMonth() - (passados - 1) + k, 10);
      const key = `${base}|${k}`;
      const vencida = venc < agora;
      const ultimas = passados - 1 - k;
      let pago: Date | null = null;
      if (pagas.has(key)) pago = pagas.get(key)!;
      else if (vencida && !(o.inad && ultimas < 2) && !(h % 7 === 0 && ultimas === 0)) {
        pago = new Date(venc);
        pago.setDate(venc.getDate() - ((h + k) % 4));
      }
      const { contrato: _c, andamento: _a, inad: _i, ...resto } = o;
      out.push({
        ...resto,
        key,
        parcela: `${k + 1}/${FIN_PARCELAS}`,
        venc,
        valor,
        pago,
        sit: pago ? 'paga' : vencida ? 'vencida' : 'aVencer',
        atraso: vencida && !pago ? Math.floor((+agora - +venc) / 864e5) : 0,
      });
    }
  };
  for (const a of b.alunos)
    for (const e of alMat(a)) {
      if (porTurma(e.curso) || !e.total) continue;
      gera(`${a.id}|${e.curso}`, {
        pagador: a.name,
        tipo: 'aluno',
        logId: a.id,
        alunoId: a.id,
        cursoId: b.cursos.find((c) => c.name === e.curso)?.id ?? null,
        curso: e.curso,
        item: e.modulo ?? '—',
        contrato: e.total * valorCurso(e.curso),
        andamento: e.usadas / e.total,
        inad: alSit(a) === 'Inadimplente',
      });
    }
  b.cursos.forEach((c) => {
    if (c.estrutura !== 'turmas') return;
    c.turmas.forEach((t, ti) => {
      const m = b.alunos.map((a) => alMat(a).find((e) => e.curso === c.name && e.modulo === t.name)).find(Boolean);
      gera(`turma|${c.name}|${t.name}`, {
        pagador: `${c.name} (empresa)`,
        tipo: 'turma',
        logId: c.id,
        alunoId: null,
        cursoId: c.id,
        curso: c.name,
        item: t.name + (t.grupo ? ` · ${t.grupo}` : ''),
        contrato: crsRegras(c).pacote * finValorAula(c),
        andamento: m ? (m.usadas || 0) / (m.total || 1) : (ti % 5) / 5,
        inad: false,
      });
    });
  });
  return out;
}

/** alunos com parcela vencida: nome, total e quantas (em ordem de id, como o objeto do portal) */
export const devedores = (cs: Cobranca[]) => {
  const por = new Map<number, { id: number; nome: string; valor: number; n: number }>();
  for (const c of cs.filter((x) => x.tipo === 'aluno' && x.sit === 'vencida')) {
    const x = por.get(c.logId) ?? { id: c.logId, nome: c.pagador, valor: 0, n: 0 };
    x.valor += c.valor;
    x.n++;
    por.set(c.logId, x);
  }
  return [...por.values()].sort((x, y) => x.id - y.id);
};

/** moeda curta do DS: R$ 73,5 mil · R$ 1,2 mi */
export const finRk = (n: number) => {
  const v = Number(n) || 0;
  const a = Math.abs(v);
  const s = v < 0 ? '− ' : '';
  const um = (x: number) => x.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (a >= 1e6) return `${s}R$ ${um(a / 1e6)} mi`;
  if (a >= 1e3) return `${s}R$ ${um(a / 1e3)} mil`;
  return finR(v);
};
export const finPct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');

export type CompCurso = {
  curso: string;
  valor: number;
  dadas: number;
  alunosAula: number;
  receita: number;
  custo: number;
  perdida: number;
  canc: number;
};
export type CompProf = { prof: string; valorHora: number; dadas: number; horas: number; custo: number };

/**
 * A competência: receita e custo das aulas dadas no mês (até hoje, se estiver em andamento).
 * ateDia corta o mês no mesmo dia, para comparar um mês em andamento com o mesmo trecho do anterior.
 * Custo = o que a folha paga (valor da alocação ou valor hora, sem as aulas descontadas por suporte).
 */
export function finCompetencia(
  b: Base,
  ym: string,
  curso: string,
  agora = new Date(),
  ateDia = 0,
  ofertas = agOfertas(b),
) {
  const [y, m] = ym.split('-').map(Number);
  const ini = new Date(y, m - 1, 1);
  const fimMes = new Date(y, m, 0);
  let fim = fimMes > agora ? agora : fimMes;
  if (ateDia) {
    const c = new Date(y, m - 1, Math.min(ateDia, fimMes.getDate()), 23, 59, 59);
    if (c < fim) fim = c;
  }
  const aulas =
    ini > agora
      ? []
      : agAulasEntre(b, ini, fim, agora, ofertas).filter((a) => a.quando <= agora && (!curso || a.prod === curso));
  const cursos = new Map<string, CompCurso>();
  const profs = new Map<string, CompProf>();
  let receita = 0;
  let custo = 0;
  let perdida = 0;
  let dadas = 0;
  let min = 0;
  const porTurma = (nome: string) => b.cursos.find((x) => x.name === nome)?.estrutura === 'turmas';
  for (const a of aulas) {
    const cb = b.cursos.find((x) => x.name === a.prod);
    const v = cb ? finValorAula(cb) : 0;
    const c = cursos.get(a.prod) ?? {
      curso: a.prod,
      valor: v,
      dadas: 0,
      alunosAula: 0,
      receita: 0,
      custo: 0,
      perdida: 0,
      canc: 0,
    };
    cursos.set(a.prod, c);
    if (a.estado === 'cancelada') {
      const p = porTurma(a.prod) ? v : (a.n || a.alunos.length) * v;
      c.perdida += p;
      c.canc++;
      perdida += p;
      continue;
    }
    if (!['executada', 'substituida'].includes(a.estado) || a.prof === '—') continue;
    const n = a.n || 0;
    const r = porTurma(a.prod) ? v : n * v;
    const h = (a.duracao || 50) / 60;
    const k = folhaSit(b, a) === 'paga' ? folhaValor(b, a) : 0;
    c.dadas++;
    c.alunosAula += n;
    c.receita += r;
    c.custo += k;
    const p = profs.get(a.prof) ?? { prof: a.prof, valorHora: finValorHora(b, a.prof), dadas: 0, horas: 0, custo: 0 };
    profs.set(a.prof, p);
    p.dadas++;
    p.horas += h;
    p.custo += k;
    receita += r;
    custo += k;
    dadas++;
    min += a.duracao || 50;
  }
  return {
    ym,
    parcial: fimMes > agora,
    ate: fim,
    receita,
    custo,
    margem: receita - custo,
    perdida,
    dadas,
    min,
    cursos: [...cursos.values()].sort((x, z) => z.receita - x.receita),
    profs: [...profs.values()].sort((x, z) => z.custo - x.custo),
  };
}

/** carteira a reconhecer: aulas que restam × valor da aula; turma dedicada conta as parcelas da turma ainda não pagas */
export const finCarteira = (b: Base, cobs: Cobranca[], curso: string) =>
  b.alunos.reduce(
    (s, a) =>
      s +
      alMat(a)
        .filter(
          (e) => (!curso || e.curso === curso) && b.cursos.find((x) => x.name === e.curso)?.estrutura !== 'turmas',
        )
        .reduce((t, e) => {
          const c = b.cursos.find((x) => x.name === e.curso);
          return t + Math.max(0, (e.total || 0) - (e.usadas || 0)) * (c ? finValorAula(c) : 0);
        }, 0),
    0,
  ) +
  cobs.filter((c) => c.tipo === 'turma' && !c.pago && (!curso || c.curso === curso)).reduce((s, c) => s + c.valor, 0);
