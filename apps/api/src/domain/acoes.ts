/**
 * Ações: Alocação (pendências da grade), Fechamento (folha da competência), Funil de vendas e Atendimentos.
 * Porte de acoes.src.js e folha.src.js.
 */
import {
  type Aula,
  agAulasEntre,
  agDiasTxt,
  agFaixa,
  agHH,
  agOfertas,
  alDisp,
  alMat,
  DN,
  dispConflitos,
  type Oferta,
  prDisp,
} from './agenda.ts';
import { folhaPresenca, folhaSit, folhaValor } from './aulas.ts';
import type { Base } from './base.ts';
import { hrefAluno, hrefCurso, hrefProf } from './rotas.ts';

/* ---------------- Pedagógico › Alocação ---------------- */
export const AC_ALOC: [string, string, string, string][] = [
  [
    'semProf',
    'Horário sem professor',
    'red',
    'Aula da grade com aluno e ninguém escalado. Escale na grade do curso ou habilite um professor.',
  ],
  [
    'semHorario',
    'Matrícula sem horário',
    'amber',
    'Matrícula ativa sem aula na grade. Aloque na ficha do aluno, em Matrículas › Cursos.',
  ],
  [
    'conflitoAluno',
    'Aluno em conflito',
    'red',
    'Duas aulas no mesmo horário ou aula fora da disponibilidade do aluno.',
  ],
  [
    'profDisp',
    'Professor fora da disponibilidade',
    'amber',
    'Aula da grade num horário que o professor não marcou como disponível.',
  ],
];
export type ItemAloc = {
  tipo: string;
  curso: string;
  quem: string;
  oque: string;
  quando: string;
  det: string;
  href: string;
  rotIr: string;
};
export function acAlocItens(b: Base, ofs: Oferta[] = agOfertas(b)): ItemAloc[] {
  const out: ItemAloc[] = [];
  const cursoId = (nome: string) => b.cursos.find((c) => c.name === nome)?.id ?? b.cursos[0]?.id ?? 0;
  const rot = (o: Oferta) => o.prod + (o.mod ? ` · ${o.mod}` : '');
  for (const o of ofs.filter((x) => x.prof === '—' && (x.ocupadas != null ? x.ocupadas : x.alunos.length)))
    out.push({
      tipo: 'semProf',
      curso: o.prod,
      quem: o.quem || rot(o),
      oque: rot(o),
      quando: `${agDiasTxt(o)} · ${agFaixa(o)}`,
      det: `${o.ocupadas != null ? o.ocupadas : o.alunos.length} de ${o.vagas} vagas · ${o.sala}`,
      href: hrefCurso(cursoId(o.prod), 'grade'),
      rotIr: 'abrir a grade do curso',
    });
  for (const a of b.alunos) {
    const ms = alMat(a);
    if (!ms.length) continue;
    const os = ofs.filter((o) => o.alunos.includes(a.name));
    for (const e of ms.filter((m) => !os.some((o) => o.prod === m.curso)))
      out.push({
        tipo: 'semHorario',
        curso: e.curso,
        quem: a.name,
        oque: e.curso + (e.modulo ? ` · ${e.modulo}` : ''),
        quando: '—',
        det: `${e.modalidade || 'Online'} · ${e.usadas || 0}/${e.total || 0} aulas`,
        href: hrefAluno(a.id, 'cursos'),
        rotIr: 'alocar na ficha',
      });
    const choques = new Set<string>();
    os.forEach((o, i) => {
      for (const p of os.slice(i + 1))
        if (o.hora === p.hora)
          for (const d of o.dias.filter((x) => p.dias.includes(x))) choques.add(`${DN[d]} ${agHH(o.hora)}`);
    });
    const fora = dispConflitos(alDisp(b, a, ofs), os);
    if (choques.size || fora.length)
      out.push({
        tipo: 'conflitoAluno',
        curso: os[0]?.prod || ms[0].curso,
        quem: a.name,
        oque: [...new Set(os.map(rot))].join(' + '),
        quando: [...choques, ...fora.map(({ o, d }) => `${DN[d]} ${agHH(o.hora)}`)].join(', '),
        det: [
          choques.size ? 'duas aulas no mesmo horário' : '',
          fora.length ? `${fora.length} fora da disponibilidade` : '',
        ]
          .filter(Boolean)
          .join(' · '),
        href: hrefAluno(a.id, 'cursos'),
        rotIr: 'ver alocação',
      });
  }
  for (const t of b.professores.filter((x) => x.active)) {
    const fora = dispConflitos(
      prDisp(b, t, ofs),
      ofs.filter((o) => o.prof === t.name),
    );
    if (!fora.length) continue;
    out.push({
      tipo: 'profDisp',
      curso: [...new Set(fora.map((x) => x.o.prod))].join(', '),
      quem: t.name,
      oque: [...new Set(fora.map((x) => rot(x.o)))].join(' + '),
      quando: fora.map(({ o, d }) => `${DN[d]} ${agHH(o.hora)}`).join(', '),
      det: `${fora.length}${fora.length === 1 ? ' horário' : ' horários'} fora da disponibilidade`,
      href: hrefProf(t.id, 'disponibilidade'),
      rotIr: 'abrir disponibilidade',
    });
  }
  return out;
}

/* ---------------- Administrativo › Fechamento ---------------- */
export const fecMeses = (agora = new Date()) =>
  Array.from({ length: 6 }, (_, i) => {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
export const fecRotulo = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};
export const fecHoras = (min: number) => `${(min / 60).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`;

export type LinhaFolha = {
  nome: string;
  pagas: number;
  presenca: number;
  falta: number;
  descontadas: number;
  pendentes: number;
  bruto: number;
  desconto: number;
  liquido: number;
  min: number;
  aulas: Aula[];
};
export function folhaDados(b: Base, ym: string, agora = new Date()) {
  const [y, m] = ym.split('-').map(Number);
  const ini = new Date(y, m - 1, 1);
  const fimMes = new Date(y, m, 0);
  const fim = fimMes > agora ? agora : fimMes;
  const aulas = ini > agora ? [] : agAulasEntre(b, ini, fim, agora).filter((a) => a.quando <= agora);
  const por: Record<string, LinhaFolha> = {};
  for (const a of aulas) {
    const s = folhaSit(b, a);
    if (s === 'fora') continue;
    por[a.prof] ??= {
      nome: a.prof,
      pagas: 0,
      presenca: 0,
      falta: 0,
      descontadas: 0,
      pendentes: 0,
      bruto: 0,
      desconto: 0,
      liquido: 0,
      min: 0,
      aulas: [],
    };
    const p = por[a.prof];
    p.aulas.push(a);
    if (s === 'pendente') {
      p.pendentes++;
      continue;
    }
    const v = folhaValor(b, a);
    p.bruto += v;
    p.min += a.duracao || 50;
    if (s === 'descontada') {
      p.descontadas++;
      p.desconto += v;
      continue;
    }
    p.pagas++;
    if (folhaPresenca(b, a) === 'falta') p.falta++;
    else p.presenca++;
  }
  const folha = Object.values(por)
    .map((p) => ({ ...p, liquido: p.bruto - p.desconto }))
    .sort((x, z) => z.pendentes - x.pendentes || z.liquido - x.liquido);
  const soma = (
    k: 'pagas' | 'presenca' | 'falta' | 'descontadas' | 'pendentes' | 'bruto' | 'desconto' | 'liquido' | 'min',
  ) => folha.reduce((s, p) => s + p[k], 0);
  return {
    ym,
    parcial: fimMes > agora,
    ate: fim,
    naoFin: aulas.filter((a) => a.estado === 'naoFinalizada').length,
    folha,
    tot: {
      pagas: soma('pagas'),
      presenca: soma('presenca'),
      falta: soma('falta'),
      descontadas: soma('descontadas'),
      pendentes: soma('pendentes'),
      bruto: soma('bruto'),
      desconto: soma('desconto'),
      liquido: soma('liquido'),
      min: soma('min'),
    },
  };
}

/* ---------------- Comercial › Funil de vendas ---------------- */
export const FUNIL_ETAPAS: [string, string, string][] = [
  ['captado', 'Captado', '#64748b'],
  ['contato', 'Contato feito', '#1a4fd6'],
  ['nivelamento', 'Nivelamento', '#6d28d9'],
  ['proposta', 'Proposta enviada', '#c8871a'],
  ['matriculado', 'Matriculado', '#0f9d6e'],
  ['perdido', 'Perdido', '#98a1b2'],
];
export const FUNIL_ORIGENS = ['Site', 'Instagram', 'Indicação', 'Google', 'Empresa parceira', 'Evento'];
export const FUNIL_MOTIVOS = ['Preço', 'Horário', 'Sem resposta', 'Escolheu outra escola', 'Adiou os estudos'];
export const CONSULTORES_BASE = ['Eduardo Krausz', 'Larissa Santana Moreira'];
export const etapaRotulo = (k: string) => FUNIL_ETAPAS.find((x) => x[0] === k)?.[1] ?? k;
/** propostas enviadas há 14 dias ou mais (alerta Propostas paradas) */
export const propostasParadas = (leads: { etapa: string; mudou: Date }[], agora = new Date()) =>
  leads.filter((l) => l.etapa === 'proposta' && (+agora - +l.mudou) / 864e5 >= 14).length;
