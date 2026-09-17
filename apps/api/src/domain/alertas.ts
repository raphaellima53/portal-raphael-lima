/**
 * Alertas da barra lateral — porte de alertasLista (barra-lateral.src.js).
 * Lidos da base e filtrados pelo acesso de quem está logado; cada alerta leva à tela onde se resolve.
 * Os de Ações (alocação, atendimentos, competência, propostas) leem o banco: extrasAlertas junta esses números antes.
 */

import { prisma } from '../db.ts';
import { plural } from '../lib/fmt.ts';
import { acAlocItens, fecMeses, fecRotulo, propostasParadas } from './acoes.ts';
import { agAulasEntre, agOfertas, alMat, type Oferta } from './agenda.ts';
import type { Base } from './base.ts';
import { garantirFeedbacks } from './feedbacks-db.ts';
import { type Pessoa, podeChave } from './mapa.ts';
import { hrefAgenda, hrefTela } from './rotas.ts';

/** números de Ações que dependem do banco */
export type ExtrasAlertas = {
  aloc: number;
  atend: number;
  fechadaAnterior: boolean;
  mesAnterior: string;
  propostas: number;
};
export async function extrasAlertas(b: Base, ofs: Oferta[] = agOfertas(b), agora = new Date()): Promise<ExtrasAlertas> {
  await garantirFeedbacks(b, b.alunos, ofs);
  const mesAnterior = fecMeses(agora)[1];
  return {
    aloc: acAlocItens(b, ofs).length,
    atend: await prisma.feedbackAluno.count({ where: { status: 'Aberto' } }),
    fechadaAnterior: b.fechadas.has(mesAnterior),
    mesAnterior,
    propostas: propostasParadas(await prisma.lead.findMany({ select: { etapa: true, mudou: true } }), agora),
  };
}

export type Alerta = { k: string; nivel: 'red' | 'amber'; n: number; t: string; d: string; href: string };

export function alertasDe(
  b: Base,
  p: Pessoa & { agendaPresa?: Record<string, string> | null },
  x: ExtrasAlertas,
  agora = new Date(),
): Alerta[] {
  if (p.ehAluno) return [];
  const out: Alerta[] = [];
  const hoje = new Date(agora);
  hoje.setHours(0, 0, 0, 0);
  const somar = (d: number) => {
    const x = new Date(hoje);
    x.setDate(x.getDate() + d);
    return x;
  };
  const add = (a: Alerta, chave: string) => {
    if (a.n && podeChave(p, chave)) out.push(a);
  };
  const presa = p.agendaPresa ?? {};

  const prox = agAulasEntre(b, agora, somar(7), agora).filter((a) => a.estado === 'semProfessor');
  add(
    {
      k: 'semProf',
      nivel: 'red',
      n: prox.length,
      t: 'Aulas sem professor',
      d: `${plural(prox.length, 'aula nos próximos 7 dias', 'aulas nos próximos 7 dias')} com aluno e sem professor escalado`,
      href: hrefAgenda({ vista: 'kanban', periodo: 'semana', qual: 'semProf', ...presa }),
    },
    'agenda',
  );

  const naoFin = agAulasEntre(b, somar(-14), agora, agora).filter((a) => a.estado === 'naoFinalizada');
  add(
    {
      k: 'naoFin',
      nivel: 'red',
      n: naoFin.length,
      t: 'Aulas não finalizadas',
      d: `${plural(naoFin.length, 'aula dos últimos 14 dias', 'aulas dos últimos 14 dias')} sem presença registrada — travam o fechamento`,
      href: hrefAgenda({ vista: 'kanban', periodo: 'janela', qual: 'naoFin', ...presa }),
    },
    'agenda',
  );

  add(
    {
      k: 'aloc',
      nivel: 'amber',
      n: x.aloc,
      t: 'Pendências de alocação',
      d: `${plural(x.aloc, 'pendência', 'pendências')} na grade: sem professor, sem horário ou em conflito`,
      href: hrefTela('acAlocacao'),
    },
    'acAlocacao',
  );
  add(
    {
      k: 'atend',
      nivel: 'amber',
      n: x.atend,
      t: 'Atendimentos abertos',
      d: plural(
        x.atend,
        'feedback ou ocorrência sem tratativa iniciada',
        'feedbacks e ocorrências sem tratativa iniciada',
      ),
      href: hrefTela('acAtendimentos'),
    },
    'acAtendimentos',
  );
  if (!x.fechadaAnterior)
    add(
      {
        k: 'fec',
        nivel: 'amber',
        n: 1,
        t: 'Competência aberta',
        d: `${fecRotulo(x.mesAnterior)} terminou e ainda não foi fechada`,
        href: hrefTela('acFechamento', { mes: x.mesAnterior }),
      },
      'acFechamento',
    );
  add(
    {
      k: 'funil',
      nivel: 'amber',
      n: x.propostas,
      t: 'Propostas paradas',
      d: `${plural(x.propostas, 'lead', 'leads')} com proposta enviada há 14 dias ou mais`,
      href: hrefTela('acFunil'),
    },
    'acFunil',
  );

  const pacote = b.alunos.flatMap((a) => alMat(a)).filter((e) => e.total && (e.usadas || 0) / e.total >= 0.95).length;
  add(
    {
      k: 'pacote',
      nivel: 'amber',
      n: pacote,
      t: 'Pacotes quase no fim',
      d: `${plural(pacote, 'matrícula com', 'matrículas com')} 95% ou mais das aulas usadas — hora de renovar`,
      href: hrefTela('rpPacote'),
    },
    'rpPacote',
  );
  return out;
}
