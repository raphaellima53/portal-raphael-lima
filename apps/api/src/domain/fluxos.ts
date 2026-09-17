/**
 * Ações por departamento: fluxos com kanban e formulário (porte de fluxos.src.js).
 * Cada fluxo define etapas (com o que cada uma exige), campos, a carga inicial lida da base e o que acontece ao entrar
 * numa etapa — Substituição confirmada troca o professor da aula, Mudança de nível aplicada troca o módulo,
 * Cobrança paga baixa as parcelas, Admissão ativa cria o professor, Renovação estende o contrato, Cancelamento muda a situação.
 */
import { prisma } from '../db.ts';
import { fmt } from '../lib/fmt.ts';
import { registra } from '../lib/log.ts';
import { type Aula, agAulasEntre, agHabilitado, agHH, agRotulo, alMat, alSit, fxPresenca } from './agenda.ts';
import { aulaDe, aulaRot } from './aulas.ts';
import type { AjusteAula, AlunoB, Base } from './base.ts';
import { devedores, finCobrancas, finR } from './financeiro.ts';

export type Valores = Record<string, string | number | string[] | null | undefined>;
export type Etapa = { k: string; t: string; cor: string; d: string; exige?: string[]; fim?: boolean; alt?: boolean };
export type Opcao = { v: string; l: string };
export type Campo = {
  k: string;
  t: string;
  tipo: 'select' | 'text' | 'textarea' | 'chips' | 'date' | 'number' | 'email';
  obrig?: boolean;
  full?: boolean;
  recarrega?: boolean;
  ajuda?: string;
  ph?: string;
  ops?: string[] | ((ctx: Ctx, v: Valores) => (string | Opcao)[]);
};
export type Ctx = {
  b: Base;
  agora: Date;
  pagas: Map<string, Date>;
  autor: string;
  /** grava um ajuste de aula (troca de professor na substituição) */
  ajuste: (k: string, muda: (ov: AjusteAula) => void) => Promise<void>;
};
export type SeedCard = { etapa: string; v: Valores };
export type Fluxo = {
  t: string;
  um: string;
  novo: string;
  como: string;
  etapas: Etapa[];
  campos: Campo[];
  titulo: (ctx: Ctx, v: Valores) => string;
  sub: (ctx: Ctx, v: Valores) => string;
  ao?: Record<string, (ctx: Ctx, v: Valores) => Promise<{ erro?: string; nota?: string } | undefined>>;
  seed?: (ctx: Ctx) => SeedCard[];
};

export const flDia = (n: number, agora = new Date()) => {
  const d = new Date(agora);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
};
const flISO = (d: Date) => fmt.iso(d);
const flDataBR = (s: unknown) => (s ? fmt.data(new Date(`${String(s).slice(0, 10)}T12:00:00`)) : '—');
const str = (v: unknown) => (v == null ? '' : String(v));
const alunoPor = (b: Base, id: unknown) => b.alunos.find((a) => String(a.id) === str(id));
const alunoNome = (b: Base, id: unknown) => alunoPor(b, id)?.name || '—';
const alunosOps = (b: Base, filtro?: (a: AlunoB) => boolean) =>
  b.alunos
    .filter((a) => alMat(a).length && (!filtro || filtro(a)))
    .sort((x, y) => x.name.localeCompare(y.name, 'pt-BR'))
    .map((a) => ({ v: String(a.id), l: a.name }));
const logAluno = (ctx: Ctx, a: { id: number | string; name: string }, acao: string, detalhe: string) =>
  registra({ tipo: 'aluno', id: String(a.id), nome: a.name, acao, detalhe, autor: ctx.autor });

/* ---------------- Substituição de professor ---------------- */
const aulasFuturas = (ctx: Ctx) =>
  agAulasEntre(ctx.b, flDia(1, ctx.agora), flDia(21, ctx.agora), ctx.agora).filter(
    (a) => a.prof !== '—' && a.estado !== 'cancelada' && a.estado !== 'semAlunos',
  );
const aulaV = (ctx: Ctx, k: unknown) => (k ? aulaDe(ctx.b, str(k), ctx.agora) : null);

/* ---------------- Mudança de nível ---------------- */
const matsModulos = (b: Base) =>
  b.alunos.flatMap((a) =>
    alMat(a)
      .map((e) => ({ a, e, c: b.cursos.find((x) => x.name === e.curso) }))
      .filter((x) => x.c?.estrutura === 'modulos' && x.e.modulo),
  );
const matDe = (b: Base, v: unknown) => matsModulos(b).find((x) => `${x.a.id}|${x.e.id}` === str(v));

/* ---------------- Reposição ---------------- */
const faltas = (ctx: Ctx) => {
  const out: { a: Aula; al: AlunoB }[] = [];
  for (const a of agAulasEntre(ctx.b, flDia(-30, ctx.agora), ctx.agora, ctx.agora).filter((x) =>
    ['executada', 'substituida'].includes(x.estado),
  ))
    for (const n of a.alunos)
      if (fxPresenca(ctx.b, n, a) === 'falta') {
        const al = ctx.b.alunos.find((x) => x.name === n);
        if (al) out.push({ a, al });
      }
  return out;
};

/* ---------------- Renovação ---------------- */
const vencendo = (ctx: Ctx) =>
  ctx.b.alunos.filter((a) => {
    if (!a.contratoFim || !alMat(a).length) return false;
    const d = new Date(a.contratoFim);
    d.setHours(12, 0, 0, 0);
    const x = (+d - +ctx.agora) / 864e5;
    return x >= -15 && x <= 60;
  });

export const FLUXOS: Record<string, Fluxo> = {
  acSubstituicao: {
    t: 'Substituição de professor',
    um: 'substituição',
    novo: 'Nova substituição',
    como: 'o professor avisa que não pode dar a aula; a coordenação acha quem dá',
    etapas: [
      { k: 'pedido', t: 'Pedido', cor: '#64748b', d: 'O professor avisou que não pode dar a aula.' },
      {
        k: 'busca',
        t: 'Buscando substituto',
        cor: '#c8871a',
        d: 'A coordenação procura um professor habilitado e disponível.',
      },
      {
        k: 'confirmado',
        t: 'Confirmado',
        cor: '#1a4fd6',
        d: 'O substituto aceitou: a agenda já mostra o novo professor.',
        exige: ['substituto'],
      },
      { k: 'concluido', t: 'Concluído', cor: '#0f9d6e', d: 'A aula foi dada pelo substituto.', fim: true },
      {
        k: 'cancelado',
        t: 'Cancelado',
        cor: '#98a1b2',
        d: 'O professor original deu a aula ou a substituição não é mais necessária.',
        fim: true,
        alt: true,
      },
    ],
    campos: [
      {
        k: 'aula',
        t: 'Aula',
        tipo: 'select',
        obrig: true,
        full: true,
        recarrega: true,
        ops: (ctx) =>
          aulasFuturas(ctx)
            .slice(0, 120)
            .map((a) => ({ v: a.k, l: `${aulaRot(a)} · ${a.prof}` })),
      },
      {
        k: 'motivo',
        t: 'Motivo',
        tipo: 'select',
        obrig: true,
        ops: ['Férias', 'Doença', 'Compromisso pessoal', 'Troca de agenda', 'Outro'],
      },
      {
        k: 'substituto',
        t: 'Substituto',
        tipo: 'select',
        ajuda: 'só aparecem os habilitados no curso e no módulo ou turma da aula',
        ops: (ctx, v) => {
          const a = aulaV(ctx, v.aula);
          return a
            ? ctx.b.professores
                .filter((t) => t.active && t.name !== a.prof && agHabilitado(t, a.prod, a.mod))
                .map((t) => t.name)
            : [];
        },
      },
      { k: 'obs', t: 'Observações', tipo: 'textarea' },
    ],
    titulo: (ctx, v) => {
      const a = aulaV(ctx, v.aula);
      return a ? aulaRot(a) : 'Aula';
    },
    sub: (ctx, v) => {
      const a = aulaV(ctx, v.aula);
      return (
        (a ? a.sub || a.prof : '') + (v.substituto ? ` → ${v.substituto}` : '') + (v.motivo ? ` · ${v.motivo}` : '')
      );
    },
    ao: {
      confirmado: async (ctx, v) => {
        const a = aulaV(ctx, v.aula);
        if (!a) return { erro: 'A aula não existe mais na agenda.' };
        if (a.prof === v.substituto) return { nota: '' };
        const antes = a.prof;
        await ctx.ajuste(a.k, (o) => {
          o.prof = str(v.substituto);
        });
        await registra({
          tipo: 'aula',
          id: a.k,
          nome: aulaRot(a),
          acao: 'Professor alterado',
          detalhe: `${antes} → ${v.substituto} · substituição`,
          autor: ctx.autor,
        });
        return { nota: `${v.substituto} assume a aula na agenda.` };
      },
    },
    seed: (ctx) =>
      aulasFuturas(ctx)
        .filter((_, i) => i % 9 === 4)
        .slice(0, 3)
        .map((a, i) => ({
          etapa: ['pedido', 'pedido', 'busca'][i],
          v: { aula: a.k, motivo: ['Doença', 'Compromisso pessoal', 'Férias'][i] },
        })),
  },

  acNivel: {
    t: 'Mudança de nível',
    um: 'mudança de nível',
    novo: 'Nova mudança de nível',
    como: 'o aluno troca de módulo depois do teste de nível',
    etapas: [
      { k: 'solicitada', t: 'Solicitada', cor: '#64748b', d: 'Pedido do aluno, do professor ou da coordenação.' },
      { k: 'teste', t: 'Teste de nível', cor: '#6d28d9', d: 'O aluno faz o teste de nível com a coordenação.' },
      {
        k: 'aprovada',
        t: 'Aprovada',
        cor: '#1a4fd6',
        d: 'Resultado registrado e módulo novo definido.',
        exige: ['resultado', 'novo'],
      },
      {
        k: 'aplicada',
        t: 'Aplicada',
        cor: '#0f9d6e',
        d: 'A matrícula já está no módulo novo: a grade e a agenda seguem o novo horário.',
        fim: true,
      },
      { k: 'recusada', t: 'Mantida', cor: '#98a1b2', d: 'O aluno continua no módulo atual.', fim: true, alt: true },
    ],
    campos: [
      {
        k: 'mat',
        t: 'Aluno e matrícula',
        tipo: 'select',
        obrig: true,
        full: true,
        recarrega: true,
        ops: (ctx) =>
          matsModulos(ctx.b).map((x) => ({
            v: `${x.a.id}|${x.e.id}`,
            l: `${x.a.name} · ${x.c!.name} · ${x.e.modulo}`,
          })),
      },
      { k: 'resultado', t: 'Resultado do teste', tipo: 'text', ph: 'Ex.: 78% · fala e compreensão acima do nível' },
      {
        k: 'novo',
        t: 'Módulo novo',
        tipo: 'select',
        ops: (ctx, v) => {
          const x = matDe(ctx.b, v.mat);
          return x ? x.c!.modulos.filter((m) => m !== x.e.modulo) : [];
        },
      },
      { k: 'obs', t: 'Observações', tipo: 'textarea' },
    ],
    titulo: (ctx, v) => matDe(ctx.b, v.mat)?.a.name ?? alunoNome(ctx.b, str(v.mat).split('|')[0]),
    sub: (ctx, v) => {
      const x = matDe(ctx.b, v.mat);
      return (x ? `${x.c!.name} · ${x.e.modulo}` : '') + (v.novo ? ` → ${v.novo}` : '');
    },
    ao: {
      aplicada: async (ctx, v) => {
        const x = matDe(ctx.b, v.mat);
        if (!x) return { erro: 'A matrícula não existe mais.' };
        if (!x.c!.modulos.includes(str(v.novo))) return { erro: 'O módulo novo não é deste curso.' };
        await prisma.$executeRaw`UPDATE "Matricula" SET modulo = ${str(v.novo)}, alocacao = NULL WHERE id = ${x.e.id}`;
        await logAluno(ctx, x.a, 'Mudança de nível', `${x.c!.name} · ${x.e.modulo} → ${v.novo}`);
        return { nota: `${x.a.name} agora em ${v.novo}.` };
      },
    },
    seed: (ctx) =>
      matsModulos(ctx.b)
        .filter((x) => (x.e.usadas || 0) / (x.e.total || 1) >= 0.25)
        .slice(0, 3)
        .map((x, i) => {
          const prox = x.c!.modulos[x.c!.modulos.indexOf(x.e.modulo!) + 1];
          return {
            etapa: ['solicitada', 'teste', 'aprovada'][i],
            v: {
              mat: `${x.a.id}|${x.e.id}`,
              resultado: i === 2 ? '82% · pronto para o próximo módulo' : '',
              novo: i === 2 ? prox || '' : '',
            },
          };
        })
        .filter((c) => c.etapa !== 'aprovada' || c.v.novo),
  },

  acReposicao: {
    t: 'Reposição de aula',
    um: 'reposição',
    novo: 'Nova reposição',
    como: 'o aluno faltou com justificativa e pede outra aula',
    etapas: [
      { k: 'pedido', t: 'Pedido', cor: '#64748b', d: 'O aluno pediu a reposição de uma aula que perdeu.' },
      {
        k: 'agendada',
        t: 'Agendada',
        cor: '#1a4fd6',
        d: 'Data, hora e professor definidos; o aluno recebe o convite.',
        exige: ['data', 'hora', 'prof'],
      },
      { k: 'realizada', t: 'Realizada', cor: '#0f9d6e', d: 'A reposição aconteceu.', fim: true },
      { k: 'negada', t: 'Negada', cor: '#98a1b2', d: 'Fora da política de reposição.', fim: true, alt: true },
    ],
    campos: [
      {
        k: 'falta',
        t: 'Aula perdida',
        tipo: 'select',
        obrig: true,
        full: true,
        ops: (ctx) =>
          faltas(ctx)
            .slice(-80)
            .reverse()
            .map((x) => ({ v: `${x.al.id}|${x.a.k}`, l: `${x.al.name} · ${aulaRot(x.a)}` })),
      },
      { k: 'data', t: 'Data da reposição', tipo: 'date' },
      {
        k: 'hora',
        t: 'Hora',
        tipo: 'select',
        ops: () => Array.from({ length: 15 }, (_, i) => ({ v: String(7 + i), l: agHH(7 + i) })),
      },
      {
        k: 'prof',
        t: 'Professor',
        tipo: 'select',
        ops: (ctx) => ctx.b.professores.filter((t) => t.active).map((t) => t.name),
      },
      { k: 'obs', t: 'Justificativa', tipo: 'textarea' },
    ],
    titulo: (ctx, v) => alunoNome(ctx.b, str(v.falta).split('|')[0]),
    sub: (ctx, v) => {
      const k = str(v.falta).split('|').slice(1).join('|');
      const a = k ? aulaDe(ctx.b, k, ctx.agora) : null;
      return (
        (a ? `faltou em ${agRotulo(a)} ${fmt.data(a.quando)}` : '') +
        (v.data ? ` · repõe ${flDataBR(v.data)}${v.hora ? ` ${agHH(Number(v.hora))}` : ''}` : '')
      );
    },
    ao: {
      agendada: async (ctx, v) => {
        const al = alunoPor(ctx.b, str(v.falta).split('|')[0]);
        if (al)
          await logAluno(ctx, al, 'Reposição agendada', `${flDataBR(v.data)} ${agHH(Number(v.hora))} com ${v.prof}`);
        return { nota: 'convite enviado ao aluno' };
      },
      realizada: async (ctx, v) => {
        const al = alunoPor(ctx.b, str(v.falta).split('|')[0]);
        if (al) await logAluno(ctx, al, 'Reposição realizada', flDataBR(v.data));
        return {};
      },
    },
    seed: (ctx) =>
      faltas(ctx)
        .filter((_, i) => i % 5 === 1)
        .slice(0, 3)
        .map((x, i) => ({
          etapa: i === 2 ? 'agendada' : 'pedido',
          v: {
            falta: `${x.al.id}|${x.a.k}`,
            obs: 'faltou por motivo de saúde',
            data: i === 2 ? flISO(flDia(3, ctx.agora)) : '',
            hora: i === 2 ? '18' : '',
            prof: i === 2 ? x.a.prof : '',
          },
        })),
  },

  acAdmissao: {
    t: 'Admissão de professor',
    um: 'candidato',
    novo: 'Novo candidato',
    como: 'do currículo recebido ao professor ativo na base',
    etapas: [
      { k: 'candidato', t: 'Candidato', cor: '#64748b', d: 'Currículo recebido.' },
      {
        k: 'entrevista',
        t: 'Entrevista e aula teste',
        cor: '#6d28d9',
        d: 'Conversa com a coordenação e aula teste gravada.',
      },
      {
        k: 'documentos',
        t: 'Documentação',
        cor: '#c8871a',
        d: 'Contrato de prestação de serviço, dados bancários e documentos.',
        exige: ['email', 'cursos'],
      },
      {
        k: 'ativo',
        t: 'Ativo',
        cor: '#0f9d6e',
        d: 'Professor criado na base: já aparece em Professores e pode ser alocado.',
        fim: true,
      },
      { k: 'reprovado', t: 'Não seguiu', cor: '#98a1b2', d: 'Reprovado ou desistiu.', fim: true, alt: true },
    ],
    campos: [
      { k: 'nome', t: 'Nome', tipo: 'text', obrig: true },
      { k: 'email', t: 'E-mail', tipo: 'email' },
      {
        k: 'cursos',
        t: 'Cursos em que vai dar aula',
        tipo: 'chips',
        ops: (ctx) => ctx.b.cursos.filter((c) => c.active !== false).map((c) => c.name),
      },
      { k: 'valorHora', t: 'Valor hora (R$)', tipo: 'number' },
      { k: 'obs', t: 'Observações', tipo: 'textarea' },
    ],
    titulo: (_ctx, v) => str(v.nome) || 'Candidato',
    sub: (_ctx, v) =>
      [((v.cursos as string[]) || []).join(', '), str(v.email)].filter(Boolean).join(' · ') || 'sem cursos definidos',
    ao: {
      ativo: async (ctx, v) => {
        const norm = (s: string) => s.trim().toLowerCase();
        if (ctx.b.professores.some((t) => norm(t.email) === norm(str(v.email))))
          return { erro: 'Já existe professor com esse e-mail.' };
        if (ctx.b.professores.some((t) => norm(t.name) === norm(str(v.nome))))
          return { erro: 'Já existe professor com esse nome.' };
        const todos = await prisma.professor.findMany({ select: { id: true, ordem: true } });
        const id = `p${Math.max(0, ...todos.map((t) => Number(t.id.replace('p', '')) || 0)) + 1}`;
        await prisma.professor.create({
          data: {
            id,
            nome: str(v.nome),
            email: str(v.email),
            cursos: (v.cursos as string[]) ?? [],
            carga: 0,
            teto: 24,
            ativo: true,
            valorHora: v.valorHora ? Number(v.valorHora) : null,
            disponibilidade: [],
            ordem: Math.max(0, ...todos.map((t) => t.ordem)) + 1,
          },
        });
        await registra({
          tipo: 'prof',
          id,
          nome: str(v.nome),
          acao: 'Professor admitido',
          detalhe: ((v.cursos as string[]) ?? []).join(', '),
          autor: ctx.autor,
        });
        return { nota: `${v.nome} criado em Professores.` };
      },
    },
    seed: () => [
      {
        etapa: 'candidato',
        v: {
          nome: 'Beatriz Salles',
          email: 'beatriz.salles@pessoal.teste',
          cursos: ['Community live classes'],
          valorHora: 70,
        },
      },
      {
        etapa: 'entrevista',
        v: {
          nome: 'Rodrigo Almeida',
          email: 'rodrigo.almeida@pessoal.teste',
          cursos: ['Conexión Español'],
          valorHora: 75,
        },
      },
      {
        etapa: 'documentos',
        v: {
          nome: 'Helena Duarte',
          email: 'helena.duarte@pessoal.teste',
          cursos: ['Alumni Black', 'Community live classes'],
          valorHora: 90,
        },
      },
    ],
  },

  acCobranca: {
    t: 'Cobrança',
    um: 'cobrança',
    novo: 'Nova cobrança',
    como: 'parcelas vencidas até o acordo ou a baixa',
    etapas: [
      { k: 'aberto', t: 'Em aberto', cor: '#dc2f3c', d: 'Parcela vencida e ainda sem contato.' },
      {
        k: 'contato',
        t: 'Contato feito',
        cor: '#c8871a',
        d: 'Aluno ou responsável financeiro avisado por e-mail, WhatsApp ou telefone.',
      },
      { k: 'negociacao', t: 'Negociação', cor: '#6d28d9', d: 'Proposta de acordo em andamento.', exige: ['acordo'] },
      {
        k: 'pago',
        t: 'Pago',
        cor: '#0f9d6e',
        d: 'As parcelas vencidas foram baixadas e a situação do aluno voltou a Ativo.',
        fim: true,
      },
      { k: 'perdido', t: 'Sem acordo', cor: '#98a1b2', d: 'Encaminhado para cobrança externa.', fim: true, alt: true },
    ],
    campos: [
      { k: 'aluno', t: 'Aluno', tipo: 'select', obrig: true, ops: (ctx) => alunosOps(ctx.b) },
      { k: 'acordo', t: 'Acordo', tipo: 'text', ph: 'Ex.: 2x sem juros a partir de 10/10' },
      { k: 'venc', t: 'Vencimento do acordo', tipo: 'date' },
      { k: 'obs', t: 'Observações', tipo: 'textarea' },
    ],
    titulo: (ctx, v) => alunoNome(ctx.b, v.aluno),
    sub: (ctx, v) => {
      const d = devedores(finCobrancas(ctx.b, ctx.pagas, ctx.agora)).find((x) => String(x.id) === str(v.aluno));
      return d
        ? `${finR(d.valor)} vencidos · ${d.n}${d.n === 1 ? ' parcela' : ' parcelas'}`
        : 'sem parcela vencida hoje';
    },
    ao: {
      pago: async (ctx, v) => {
        const a = alunoPor(ctx.b, v.aluno);
        if (!a) return { erro: 'Aluno não encontrado.' };
        const vs = finCobrancas(ctx.b, ctx.pagas, ctx.agora).filter(
          (c) => c.tipo === 'aluno' && c.logId === a.id && c.sit === 'vencida',
        );
        if (vs.length)
          await prisma.parcelaPaga.createMany({
            data: vs.map((c) => ({ chave: c.key, por: ctx.autor })),
            skipDuplicates: true,
          });
        if (alSit(a) === 'Inadimplente') await prisma.aluno.update({ where: { id: a.id }, data: { status: 'Ativo' } });
        await logAluno(ctx, a, 'Cobrança paga', `${vs.length} parcelas baixadas`);
        return { nota: `${vs.length}${vs.length === 1 ? ' parcela baixada' : ' parcelas baixadas'}.` };
      },
    },
    seed: (ctx) =>
      devedores(finCobrancas(ctx.b, ctx.pagas, ctx.agora))
        .slice(0, 4)
        .map((d, i) => ({
          etapa: ['aberto', 'contato', 'negociacao', 'aberto'][i],
          v: { aluno: String(d.id), acordo: i === 2 ? '2x sem juros a partir do dia 10' : '' },
        })),
  },

  acRenovacao: {
    t: 'Renovação de contrato',
    um: 'renovação',
    novo: 'Nova renovação',
    como: 'contratos que vencem em até 60 dias',
    etapas: [
      { k: 'vencendo', t: 'Vence em breve', cor: '#c8871a', d: 'Contrato vence em até 60 dias.' },
      { k: 'contato', t: 'Contato feito', cor: '#1a4fd6', d: 'Consultor falou com o aluno sobre continuar.' },
      { k: 'proposta', t: 'Proposta enviada', cor: '#6d28d9', d: 'Pacote e valor enviados.', exige: ['pacote'] },
      {
        k: 'renovado',
        t: 'Renovado',
        cor: '#0f9d6e',
        d: 'Contrato estendido por 12 meses e aulas somadas ao pacote.',
        fim: true,
      },
      {
        k: 'perdido',
        t: 'Não renovou',
        cor: '#98a1b2',
        d: 'O aluno encerra no fim do contrato.',
        fim: true,
        alt: true,
      },
    ],
    campos: [
      { k: 'aluno', t: 'Aluno', tipo: 'select', obrig: true, ops: (ctx) => alunosOps(ctx.b) },
      { k: 'pacote', t: 'Aulas no novo pacote', tipo: 'number' },
      { k: 'valor', t: 'Valor do contrato (R$)', tipo: 'number' },
      { k: 'obs', t: 'Observações', tipo: 'textarea' },
    ],
    titulo: (ctx, v) => alunoNome(ctx.b, v.aluno),
    sub: (ctx, v) => {
      const a = alunoPor(ctx.b, v.aluno);
      return (
        (a ? `contrato até ${a.contratoFim ? fmt.data(a.contratoFim) : '—'}` : '') +
        (v.pacote ? ` · ${v.pacote} aulas` : '')
      );
    },
    ao: {
      renovado: async (ctx, v) => {
        const a = alunoPor(ctx.b, v.aluno);
        if (!a) return { erro: 'Aluno não encontrado.' };
        const ref = a.contratoFim ? new Date(a.contratoFim) : new Date(ctx.agora);
        ref.setHours(12, 0, 0, 0);
        const novo = new Date(Math.max(+ref, +ctx.agora));
        novo.setFullYear(novo.getFullYear() + 1);
        await prisma.aluno.update({ where: { id: a.id }, data: { contratoFim: new Date(`${flISO(novo)}T00:00:00Z`) } });
        const e = alMat(a)[0];
        if (e)
          await prisma.matricula.update({
            where: { id: e.id },
            data: { total: (e.total || 0) + (Number(v.pacote) || 0) },
          });
        await logAluno(ctx, a, 'Contrato renovado', `até ${fmt.data(novo)} · +${v.pacote} aulas`);
        return { nota: `contrato até ${fmt.data(novo)}.` };
      },
    },
    seed: (ctx) =>
      vencendo(ctx)
        .slice(0, 4)
        .map((a, i) => ({
          etapa: ['vencendo', 'contato', 'proposta', 'vencendo'][i],
          v: { aluno: String(a.id), pacote: i === 2 ? 48 : '', valor: i === 2 ? 3180 : '' },
        })),
  },

  acCampanhas: {
    t: 'Campanhas',
    um: 'campanha',
    novo: 'Nova campanha',
    como: 'da ideia ao resultado em leads',
    etapas: [
      { k: 'ideia', t: 'Ideia', cor: '#64748b', d: 'Proposta de campanha.' },
      {
        k: 'producao',
        t: 'Em produção',
        cor: '#c8871a',
        d: 'Peças, textos e segmentação sendo preparados.',
        exige: ['canal', 'publico'],
      },
      { k: 'noar', t: 'No ar', cor: '#1a4fd6', d: 'Campanha publicada.', exige: ['inicio', 'orcamento'] },
      { k: 'encerrada', t: 'Encerrada', cor: '#0f9d6e', d: 'Resultado registrado.', exige: ['leads'], fim: true },
    ],
    campos: [
      { k: 'nome', t: 'Nome', tipo: 'text', obrig: true },
      {
        k: 'canal',
        t: 'Canal',
        tipo: 'select',
        ops: ['Instagram', 'Google', 'E-mail', 'Indicação', 'Evento', 'Site', 'Empresa parceira'],
      },
      { k: 'publico', t: 'Público', tipo: 'text', ph: 'Ex.: ex-alunos B2C · 25 a 40 anos' },
      { k: 'orcamento', t: 'Orçamento (R$)', tipo: 'number' },
      { k: 'inicio', t: 'Início', tipo: 'date' },
      { k: 'fim', t: 'Fim', tipo: 'date' },
      { k: 'leads', t: 'Leads gerados', tipo: 'number' },
      { k: 'obs', t: 'Observações', tipo: 'textarea' },
    ],
    titulo: (_ctx, v) => str(v.nome) || 'Campanha',
    sub: (_ctx, v) =>
      [
        str(v.canal),
        v.orcamento ? finR(Number(v.orcamento)) : '',
        v.leads != null && v.leads !== '' ? `${v.leads} leads` : '',
      ]
        .filter(Boolean)
        .join(' · ') || 'sem canal',
    seed: (ctx) => [
      {
        etapa: 'noar',
        v: {
          nome: 'Volta às aulas Community',
          canal: 'Instagram',
          publico: 'ex-alunos B2C',
          orcamento: 4500,
          inicio: flISO(flDia(-10, ctx.agora)),
          fim: flISO(flDia(20, ctx.agora)),
        },
      },
      {
        etapa: 'producao',
        v: { nome: 'Webinar Conexión Español', canal: 'E-mail', publico: 'base de leads frios', orcamento: 800 },
      },
      {
        etapa: 'ideia',
        v: { nome: 'Indique um amigo — B2B', canal: 'Empresa parceira', publico: 'RH das empresas clientes' },
      },
    ],
  },

  acRetencao: {
    t: 'Cancelamento e retenção',
    um: 'pedido',
    novo: 'Novo pedido de cancelamento',
    como: 'do pedido de cancelamento à retenção ou ao encerramento',
    etapas: [
      { k: 'pedido', t: 'Pedido de cancelamento', cor: '#dc2f3c', d: 'O aluno pediu para cancelar.' },
      {
        k: 'tentativa',
        t: 'Tentativa de retenção',
        cor: '#c8871a',
        d: 'CX conversa e faz uma oferta.',
        exige: ['oferta'],
      },
      { k: 'retido', t: 'Retido', cor: '#0f9d6e', d: 'O aluno aceitou a oferta e continua.', fim: true },
      {
        k: 'cancelado',
        t: 'Cancelado',
        cor: '#98a1b2',
        d: 'Matrícula encerrada: a situação do aluno passa a Cancelado.',
        fim: true,
        alt: true,
      },
    ],
    campos: [
      {
        k: 'aluno',
        t: 'Aluno',
        tipo: 'select',
        obrig: true,
        ops: (ctx) => alunosOps(ctx.b, (a) => alSit(a) !== 'Cancelado'),
      },
      {
        k: 'motivo',
        t: 'Motivo',
        tipo: 'select',
        obrig: true,
        ops: [
          'Preço',
          'Horário',
          'Mudança de cidade ou emprego',
          'Insatisfação com as aulas',
          'Pausa nos estudos',
          'Outro',
        ],
      },
      { k: 'oferta', t: 'Oferta de retenção', tipo: 'text', ph: 'Ex.: congelar por 60 dias · troca de horário' },
      { k: 'obs', t: 'Observações', tipo: 'textarea' },
    ],
    titulo: (ctx, v) => alunoNome(ctx.b, v.aluno),
    sub: (_ctx, v) => [str(v.motivo), str(v.oferta)].filter(Boolean).join(' · ') || '—',
    ao: {
      cancelado: async (ctx, v) => {
        const a = alunoPor(ctx.b, v.aluno);
        if (!a) return { erro: 'Aluno não encontrado.' };
        await prisma.aluno.update({
          where: { id: a.id },
          data: { statusAntes: alSit(a), status: 'Cancelado', desativadoEm: new Date() },
        });
        await logAluno(ctx, a, 'Cancelamento', str(v.motivo));
        return { nota: `${a.name} passa a Cancelado.` };
      },
      retido: async (ctx, v) => {
        const a = alunoPor(ctx.b, v.aluno);
        if (a) await logAluno(ctx, a, 'Retido', str(v.oferta));
        return {};
      },
    },
    seed: (ctx) =>
      ctx.b.alunos
        .filter((a) => ['Suspenso', 'Congelado'].includes(alSit(a)))
        .slice(0, 2)
        .map((a, i) => ({
          etapa: i ? 'tentativa' : 'pedido',
          v: { aluno: String(a.id), motivo: i ? 'Horário' : 'Preço', oferta: i ? 'troca para turma das 19h' : '' },
        })),
  },
};

export const flEtapa = (F: Fluxo, k: string) => F.etapas.find((e) => e.k === k) ?? F.etapas[0];
export const flProx = (F: Fluxo, k: string) => {
  const i = F.etapas.findIndex((e) => e.k === k);
  const e = F.etapas[i];
  if (!e || e.fim) return null;
  return F.etapas.slice(i + 1).find((x) => !x.alt) ?? null;
};
export const flAnt = (F: Fluxo, k: string) => {
  const i = F.etapas.findIndex((e) => e.k === k);
  const e = F.etapas[i];
  if (!e || e.fim || i === 0) return null;
  return (
    F.etapas
      .slice(0, i)
      .reverse()
      .find((x) => !x.fim) ?? null
  );
};
/** campo vazio (conta lista vazia) */
export const vazio = (x: unknown) => x == null || x === '' || (Array.isArray(x) && !x.length);
export const campoOps = (c: Campo, ctx: Ctx, v: Valores): Opcao[] =>
  (typeof c.ops === 'function' ? c.ops(ctx, v) : (c.ops ?? [])).map((o) =>
    typeof o === 'string' ? { v: o, l: o } : o,
  );
