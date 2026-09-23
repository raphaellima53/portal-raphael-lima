import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.ts';
import { podeAcao } from '../domain/acesso.ts';
import {
  AC_ALOC,
  acAlocItens,
  CONSULTORES_BASE,
  etapaRotulo,
  FUNIL_ETAPAS,
  FUNIL_MOTIVOS,
  FUNIL_ORIGENS,
  fecHoras,
  fecMeses,
  fecRotulo,
  folhaDados,
} from '../domain/acoes.ts';
import { agHM, agRotulo } from '../domain/agenda.ts';
import { FB_AREAS, FB_CANAIS, FB_ST, FB_TIPOS } from '../domain/alunos.ts';
import {
  FOLHA_SIT,
  folhaBlack,
  folhaPresenca,
  folhaSit,
  folhaSuporte,
  folhaValor,
  folhaVeValor,
} from '../domain/aulas.ts';
import { base, invalidaBase } from '../domain/base.ts';
import { avancaFeedback, criaFeedback, FeedbackIn, garantirFeedbacks } from '../domain/feedbacks-db.ts';
import { finR } from '../domain/financeiro.ts';
import { type Ctx, campoOps, FLUXOS, flAnt, flDia, flEtapa, flProx, type Valores, vazio } from '../domain/fluxos.ts';
import { podeChave } from '../domain/mapa.ts';
import { comExemplos } from '../lib/exemplos.ts';
import { fmt } from '../lib/fmt.ts';
import { registra } from '../lib/log.ts';
import type { UsuarioSessao } from '../plugins/sessao.ts';
import { gravaAjuste } from './agenda.ts';

const erro400 = (rep: FastifyReply, e: z.ZodError) => rep.code(400).send({ erro: e.issues[0].message });
/** quem opera as ações vai até o Colaborador; Visualizador só lê (flPode do portal) */
const podeOperar = (u: UsuarioSessao) => !u.ehAluno && podeAcao(u.nivel, 'criar');
const quemAula = (u: UsuarioSessao) => ({
  nome: u.nome,
  nivel: u.nivel,
  areas: u.areas,
  tipoPerfil: u.tipoPerfil,
  ehAluno: u.ehAluno,
});
const exigeTela =
  (tela: string, operar = false) =>
  async (req: FastifyRequest, rep: FastifyReply) => {
    const u = req.usuario;
    if (!u) return rep.code(401).send({ erro: 'Sessão expirada. Entre de novo.' });
    if (u.ehAluno || !podeChave(u, tela)) return rep.code(403).send({ erro: 'Sem acesso a esta tela.' });
    if (operar && !podeOperar(u)) return rep.code(403).send({ erro: 'Seu acesso é só de leitura.' });
  };
const exigeFluxo =
  (operar = false) =>
  async (req: FastifyRequest, rep: FastifyReply) => {
    const key = (req.params as { key: string }).key;
    if (!FLUXOS[key]) return rep.code(404).send({ erro: 'Ação não encontrada.' });
    return exigeTela(key, operar)(req, rep);
  };
const diasNaEtapa = (d: Date, agora = new Date()) => {
  const n = Math.max(0, Math.floor((+agora - +d) / 864e5));
  return n ? `${n}${n === 1 ? ' dia' : ' dias'} na etapa` : 'hoje';
};
const pagasMap = async () => new Map((await prisma.parcelaPaga.findMany()).map((p) => [p.chave, p.quando]));

export default async function rotasAcoes(app: FastifyInstance) {
  /* ================= Pedagógico › Alocação ================= */
  app.get('/acoes/alocacao', { preHandler: exigeTela('acAlocacao') }, async () => {
    const b = await base();
    return {
      tipos: AC_ALOC.map(([k, t, tom, d]) => ({ k, t, tom, d })),
      cursos: b.cursos.map((c) => c.name),
      itens: acAlocItens(b),
    };
  });

  /* ================= Administrativo › Fechamento ================= */
  app.get('/acoes/fechamento', { preHandler: exigeTela('acFechamento') }, async (req) => {
    const u = req.usuario!;
    const meses = fecMeses();
    const pedido = String((req.query as { mes?: string }).mes ?? '');
    const ym = meses.includes(pedido) ? pedido : meses[1];
    const b = await base();
    const d = folhaDados(b, ym);
    const st = await prisma.fechamentoCompetencia.findUnique({ where: { ym } });
    const ve = folhaVeValor(quemAula(u));
    const moeda = (v: number, sinal = '') => (ve ? `${sinal}${finR(v)}` : '—');
    return {
      meses: meses.map((m) => ({ v: m, l: fecRotulo(m) })),
      ym,
      rotulo: fecRotulo(ym),
      situacao: st
        ? { t: 'Fechada', tom: 'green' }
        : d.parcial
          ? { t: 'Em andamento', tom: 'blue' }
          : d.naoFin
            ? { t: 'Travada', tom: 'red' }
            : { t: 'Pronta para fechar', tom: 'amber' },
      fechada: st
        ? (() => {
            const x = st.dados as { pagas?: number; descontadas?: number; liquido?: number; dadas?: number };
            return {
              txt: `Fechada por ${st.por} em ${fmt.dataHora(st.quando, true)}: ${
                x.pagas != null
                  ? `${x.pagas} aulas pagas, ${x.descontadas} descontadas, ${finR(x.liquido ?? 0)} a pagar.`
                  : `${x.dadas} aulas.`
              }`,
            };
          })()
        : null,
      parcial: d.parcial,
      naoFin: d.naoFin,
      veValor: ve,
      podeOperar: podeOperar(u),
      linhas: d.folha.map((p) => ({
        nome: p.nome,
        profId: b.professores.find((t) => t.name === p.nome)?.id ?? null,
        pagas: p.pagas,
        presenca: p.presenca,
        falta: p.falta,
        descontadas: p.descontadas,
        pendentes: p.pendentes,
        horas: fecHoras(p.min),
        bruto: moeda(p.bruto),
        desconto: p.desconto && ve ? `− ${finR(p.desconto)}` : '—',
        liquido: moeda(p.liquido),
      })),
      total: d.folha.length
        ? {
            pagas: d.tot.pagas,
            presenca: d.tot.presenca,
            falta: d.tot.falta,
            descontadas: d.tot.descontadas,
            pendentes: d.tot.pendentes,
            horas: fecHoras(d.tot.min),
            bruto: moeda(d.tot.bruto),
            desconto: d.tot.desconto ? moeda(d.tot.desconto, '− ') : '—',
            liquido: moeda(d.tot.liquido),
          }
        : null,
    };
  });
  app.get('/acoes/fechamento/aulas', { preHandler: exigeTela('acFechamento') }, async (req, rep) => {
    const u = req.usuario!;
    const q = z.object({ mes: z.string(), prof: z.string() }).safeParse(req.query);
    if (!q.success) return erro400(rep, q.error);
    const b = await base();
    const d = folhaDados(b, q.data.mes);
    const p = d.folha.find((x) => x.nome === q.data.prof);
    if (!p) return rep.code(404).send({ erro: 'Sem aulas deste professor na competência.' });
    const ve = folhaVeValor(quemAula(u));
    return {
      titulo: `Aulas de ${p.nome}`,
      sub: `${fecRotulo(q.data.mes)} · ${p.pagas} pagas · ${p.descontadas} descontadas · ${p.pendentes} pendentes${ve ? ` · ${finR(p.liquido)} a pagar` : ''}`,
      aulas: [...p.aulas]
        .sort((x, y) => +x.quando - +y.quando)
        .map((a) => {
          const s = folhaSit(b, a);
          const sup = folhaSuporte(b, a);
          const v = folhaValor(b, a);
          return {
            k: a.k,
            quando: `${fmt.data(a.quando)} ${agHM(a.quando)}`,
            aula: agRotulo(a),
            noLugar: a.sub,
            presenca: s === 'pendente' ? '—' : folhaPresenca(b, a),
            situacao: FOLHA_SIT[s],
            suporte: sup?.motivo ?? null,
            valor: ve ? `${s === 'descontada' ? '− ' : ''}${finR(v)}` : '—',
            marca: b.ajustes[a.k]?.valor != null ? 'alterado' : folhaBlack(b, a) ? 'alocação' : '',
          };
        }),
    };
  });
  app.post('/acoes/fechamento/:ym/fechar', { preHandler: exigeTela('acFechamento', true) }, async (req, rep) => {
    const u = req.usuario!;
    const { ym } = req.params as { ym: string };
    if (!fecMeses().includes(ym)) return rep.code(404).send({ erro: 'Competência fora da lista.' });
    if (await prisma.fechamentoCompetencia.findUnique({ where: { ym } }))
      return rep.code(409).send({ erro: `${fecRotulo(ym)} já está fechada.` });
    const d = folhaDados(await base(), ym);
    if (d.naoFin)
      return rep.code(409).send({
        erro: `Não fechou: ${d.naoFin} ${d.naoFin === 1 ? 'aula não finalizada' : 'aulas não finalizadas'} em ${fecRotulo(ym)}. Registre a presença e feche de novo.`,
      });
    if (d.parcial)
      return rep
        .code(409)
        .send({ erro: `${fecRotulo(ym)} ainda não terminou: a competência só fecha depois do último dia do mês.` });
    const dadas = d.folha.reduce((s, p) => s + p.pagas + p.descontadas, 0);
    await prisma.fechamentoCompetencia.create({
      data: {
        ym,
        por: u.nome,
        dados: {
          dadas,
          min: d.tot.min,
          pagas: d.tot.pagas,
          descontadas: d.tot.descontadas,
          bruto: d.tot.bruto,
          desconto: d.tot.desconto,
          liquido: d.tot.liquido,
        },
      },
    });
    await registra({
      tipo: 'fechamento',
      id: ym,
      nome: fecRotulo(ym),
      acao: 'Competência fechada',
      detalhe: `${fecRotulo(ym)} · ${dadas} aulas · ${fecHoras(d.tot.min)}`,
      autor: u.nome,
    });
    invalidaBase();
    return {
      msg: `${fecRotulo(ym)} fechada: ${d.tot.pagas} aulas pagas, ${d.tot.descontadas} descontadas por suporte, ${finR(d.tot.liquido)} a pagar para ${d.folha.length} professores.`,
    };
  });
  app.post('/acoes/fechamento/:ym/reabrir', { preHandler: exigeTela('acFechamento', true) }, async (req, rep) => {
    const u = req.usuario!;
    const { ym } = req.params as { ym: string };
    const r = await prisma.fechamentoCompetencia.deleteMany({ where: { ym } });
    if (!r.count) return rep.code(409).send({ erro: `${fecRotulo(ym)} não está fechada.` });
    await registra({
      tipo: 'fechamento',
      id: ym,
      nome: fecRotulo(ym),
      acao: 'Competência reaberta',
      detalhe: fecRotulo(ym),
      autor: u.nome,
    });
    invalidaBase();
    return { msg: `${fecRotulo(ym)} reaberta.` };
  });

  /* ================= Comercial › Funil de vendas ================= */
  const consultores = async () => {
    const ps = await prisma.usuario.findMany({
      where: { status: { not: 'Bloqueado' }, perfilId: { in: [5, 6] } },
      orderBy: { ordem: 'asc' },
      select: { nome: true },
    });
    return [...new Set([...ps.map((x) => x.nome), ...((await comExemplos()) ? CONSULTORES_BASE : [])])];
  };
  const logLead = (u: UsuarioSessao, l: { id: string; nome: string }, acao: string, detalhe: string) =>
    registra({ tipo: 'lead', id: l.id, nome: l.nome, acao, detalhe, autor: u.nome });

  app.get('/acoes/funil', { preHandler: exigeTela('acFunil') }, async (req) => {
    const u = req.usuario!;
    const b = await base();
    const cons = await consultores();
    const agora = new Date();
    const leads = await prisma.lead.findMany({ orderBy: [{ mudou: 'desc' }] });
    return {
      etapas: FUNIL_ETAPAS.map(([k, t, cor]) => ({ k, t, cor })),
      consultores: cons,
      eu: cons.includes(u.nome) ? u.nome : cons[0],
      cursos: b.cursos.map((c) => c.name),
      origens: FUNIL_ORIGENS,
      motivos: FUNIL_MOTIVOS,
      podeOperar: podeOperar(u),
      leads: leads.map((l) => {
        const dias = Math.max(0, Math.floor((+agora - +l.mudou) / 864e5));
        return {
          id: l.id,
          nome: l.nome,
          email: l.email,
          curso: l.curso,
          origem: l.origem,
          consultor: l.consultor,
          etapa: l.etapa,
          motivo: l.motivo,
          alunoId: l.alunoId != null && b.alunos.some((a) => a.id === l.alunoId) ? l.alunoId : null,
          quando: l.motivo
            ? `motivo: ${l.motivo.toLowerCase()}`
            : dias
              ? `${dias}${dias === 1 ? ' dia' : ' dias'} nesta etapa`
              : 'mudou hoje',
        };
      }),
    };
  });
  const leadOu404 = async (id: string, rep: FastifyReply) => {
    const l = await prisma.lead.findUnique({ where: { id } });
    if (!l) rep.code(404).send({ erro: 'Lead não encontrado.' });
    return l;
  };
  app.post('/acoes/funil', { preHandler: exigeTela('acFunil', true) }, async (req, rep) => {
    const u = req.usuario!;
    const cons = await consultores();
    const b = await base();
    const p = z
      .object({
        nome: z.string().trim().min(2, 'Informe o nome.').max(160),
        email: z.union([z.literal(''), z.string().trim().email('E-mail inválido.')]).default(''),
        origem: z.enum(FUNIL_ORIGENS as [string, ...string[]]),
        curso: z.string().refine((c) => b.cursos.some((x) => x.name === c), 'Escolha o curso.'),
        consultor: z.string().refine((c) => cons.includes(c), 'Escolha o consultor.'),
      })
      .safeParse(req.body);
    if (!p.success) return erro400(rep, p.error);
    const v = p.data;
    const topo = await prisma.lead.aggregate({ _min: { ordem: true } });
    const l = await prisma.lead.create({
      data: {
        id: `ld${Date.now()}`,
        nome: v.nome,
        email: v.email || '—',
        origem: v.origem,
        curso: v.curso,
        consultor: v.consultor,
        etapa: 'captado',
        entrou: new Date(),
        mudou: new Date(),
        ordem: (topo._min.ordem ?? 0) - 1,
      },
    });
    await logLead(u, l, 'Lead criado', `${l.origem} · ${l.curso}`);
    return { msg: `${l.nome} entrou no funil.` };
  });
  app.post('/acoes/funil/:id/avancar', { preHandler: exigeTela('acFunil', true) }, async (req, rep) => {
    const u = req.usuario!;
    const l = await leadOu404((req.params as { id: string }).id, rep);
    if (!l) return;
    const i = FUNIL_ETAPAS.findIndex((x) => x[0] === l.etapa);
    if (i < 0 || i >= 3) return rep.code(409).send({ erro: 'Este lead não avança por aqui.' });
    const etapa = FUNIL_ETAPAS[i + 1][0];
    await prisma.lead.update({ where: { id: l.id }, data: { etapa, mudou: new Date() } });
    await logLead(u, l, 'Lead avançou', etapaRotulo(etapa));
    return { msg: `${l.nome} passou para ${etapaRotulo(etapa)}.` };
  });
  app.post('/acoes/funil/:id/perder', { preHandler: exigeTela('acFunil', true) }, async (req, rep) => {
    const u = req.usuario!;
    const p = z
      .object({ motivo: z.enum(FUNIL_MOTIVOS as [string, ...string[]], { message: 'Escolha o motivo.' }) })
      .safeParse(req.body);
    if (!p.success) return erro400(rep, p.error);
    const l = await leadOu404((req.params as { id: string }).id, rep);
    if (!l) return;
    if (['matriculado', 'perdido'].includes(l.etapa))
      return rep.code(409).send({ erro: 'Este lead já saiu do funil.' });
    await prisma.lead.update({
      where: { id: l.id },
      data: { etapaAntes: l.etapa, etapa: 'perdido', motivo: p.data.motivo, mudou: new Date() },
    });
    await logLead(u, l, 'Lead perdido', p.data.motivo);
    return { msg: `${l.nome} saiu do funil: ${p.data.motivo.toLowerCase()}.` };
  });
  app.post('/acoes/funil/:id/reabrir', { preHandler: exigeTela('acFunil', true) }, async (req, rep) => {
    const u = req.usuario!;
    const l = await leadOu404((req.params as { id: string }).id, rep);
    if (!l) return;
    if (l.etapa !== 'perdido') return rep.code(409).send({ erro: 'Só lead perdido se reabre.' });
    const etapa = l.etapaAntes && l.etapaAntes !== 'perdido' ? l.etapaAntes : 'contato';
    await prisma.lead.update({ where: { id: l.id }, data: { etapa, etapaAntes: null, motivo: '', mudou: new Date() } });
    await logLead(u, l, 'Lead reaberto', etapaRotulo(etapa));
    return { msg: `${l.nome} voltou para ${etapaRotulo(etapa)}.` };
  });
  app.post('/acoes/funil/:id/matricular', { preHandler: exigeTela('acFunil', true) }, async (req, rep) => {
    const u = req.usuario!;
    const l = await leadOu404((req.params as { id: string }).id, rep);
    if (!l) return;
    if (l.etapa !== 'proposta') return rep.code(409).send({ erro: 'Só lead com proposta enviada vira aluno.' });
    const topo = await prisma.aluno.aggregate({ _min: { ordem: true } });
    const a = await prisma.aluno.create({
      data: {
        nome: l.nome,
        email: l.email,
        emailPlaceholder: l.email === '—',
        cpf: '',
        status: 'Ativo',
        disponibilidade: [],
        ordem: (topo._min.ordem ?? 0) - 1,
      },
    });
    await prisma.lead.update({ where: { id: l.id }, data: { etapa: 'matriculado', alunoId: a.id, mudou: new Date() } });
    await logLead(u, l, 'Lead matriculado', `virou aluno · ${l.curso}`);
    await registra({
      tipo: 'aluno',
      id: String(a.id),
      nome: a.nome,
      acao: 'Cadastro criado',
      detalhe: `lead do funil · ${l.curso}`,
      autor: u.nome,
    });
    invalidaBase();
    return { msg: `${l.nome} virou aluno. Abra a ficha para criar a matrícula em ${l.curso}.`, alunoId: a.id };
  });

  /* ================= CX › Atendimentos ================= */
  app.get('/acoes/atendimentos', { preHandler: exigeTela('acAtendimentos') }, async (req) => {
    const u = req.usuario!;
    const b = await base();
    await garantirFeedbacks(b, b.alunos);
    const fbs = await prisma.feedbackAluno.findMany({ orderBy: [{ quando: 'desc' }, { id: 'desc' }] });
    const agora = new Date();
    const nomes = new Map(b.alunos.map((a) => [a.id, a]));
    return {
      podeOperar: podeOperar(u),
      tipos: FB_TIPOS.map((x) => x[0]),
      areas: FB_AREAS,
      canais: FB_CANAIS,
      situacoes: FB_ST.map((x) => x[0]),
      alunos: [...b.alunos]
        .sort((x, y) => x.name.localeCompare(y.name, 'pt-BR'))
        .map((a) => ({
          id: a.id,
          nome: a.name,
          cursos: [...new Set(a.matriculas.filter((e) => !e.desativadoEm).map((e) => e.curso))],
        })),
      itens: fbs
        .filter((f) => nomes.has(f.alunoId))
        .map((f) => {
          const n = Math.floor((+agora - +f.quando) / 864e5);
          return {
            id: f.id,
            alunoId: f.alunoId,
            aluno: nomes.get(f.alunoId)!.name,
            idade: n ? `${n}${n === 1 ? ' dia' : ' dias'}` : 'hoje',
            data: fmt.data(f.quando),
            tipo: f.tipo,
            tipoTom: FB_TIPOS.find((x) => x[0] === f.tipo)?.[1] ?? 'gray',
            area: f.area,
            curso: f.curso,
            texto: f.texto,
            por: f.por,
            canal: f.canal,
            status: f.status,
            statusTom: FB_ST.find((x) => x[0] === f.status)?.[1] ?? 'gray',
          };
        }),
    };
  });
  app.post(
    '/acoes/atendimentos',
    { preHandler: exigeTela('acAtendimentos', true), bodyLimit: 80 * 1024 * 1024 },
    async (req, rep) => {
      const u = req.usuario!;
      const p = FeedbackIn.extend({
        alunoId: z.coerce.number({ message: 'Escolha o aluno.' }).int().positive('Escolha o aluno.'),
      }).safeParse(req.body);
      if (!p.success) return erro400(rep, p.error);
      const b = await base();
      const a = b.alunos.find((x) => x.id === p.data.alunoId);
      if (!a) return rep.code(400).send({ erro: 'Escolha o aluno.' });
      const r = await criaFeedback(b, a, u.nome, p.data);
      if ('erro' in r) return rep.code(400).send({ erro: r.erro });
      return r;
    },
  );
  app.post('/acoes/atendimentos/:fid/avancar', { preHandler: exigeTela('acAtendimentos', true) }, async (req, rep) => {
    const u = req.usuario!;
    const fid = Number((req.params as { fid: string }).fid);
    const f = await prisma.feedbackAluno.findUnique({ where: { id: fid } });
    const a = f && (await base()).alunos.find((x) => x.id === f.alunoId);
    if (!f || !a) return rep.code(404).send({ erro: 'Registro não encontrado.' });
    const r = await avancaFeedback(a, f, u.nome);
    if ('erro' in r) return rep.code(409).send({ erro: r.erro });
    return r;
  });

  /* ================= Fluxos com kanban e formulário ================= */
  const contexto = async (u: UsuarioSessao): Promise<Ctx> => ({
    b: await base(),
    agora: new Date(),
    pagas: await pagasMap(),
    autor: u.nome,
    ajuste: gravaAjuste,
  });
  /** a carga inicial de cada fluxo nasce da base na primeira vez que alguém abre a tela */
  const semeia = async (key: string, ctx: Ctx) => {
    if (await prisma.fluxoSemeado.findUnique({ where: { fluxo: key } })) return;
    try {
      await prisma.fluxoSemeado.create({ data: { fluxo: key } });
    } catch {
      return;
    }
    const cards = (await comExemplos()) ? (FLUXOS[key].seed?.(ctx) ?? []) : [];
    if (cards.length)
      await prisma.fluxoCard.createMany({
        data: cards.map((c, i) => ({
          id: `${key}-${i + 1}`,
          fluxo: key,
          etapa: c.etapa,
          valores: c.v as object,
          criado: flDia(-(i + 3), ctx.agora),
          mudou: flDia(-((i % 4) + 1), ctx.agora),
          quem: 'base',
          hist: [],
        })),
      });
  };
  const camposDe = (key: string, ctx: Ctx, v: Valores) =>
    FLUXOS[key].campos.map((c) => ({
      k: c.k,
      t: c.t,
      tipo: c.tipo,
      obrig: !!c.obrig,
      full: !!c.full || c.tipo === 'textarea' || c.tipo === 'chips',
      recarrega: !!c.recarrega,
      ajuda: c.ajuda ?? '',
      ph: c.ph ?? '',
      ops: c.ops ? campoOps(c, ctx, v) : null,
    }));
  const cardDe = (
    key: string,
    ctx: Ctx,
    c: { id: string; etapa: string; valores: unknown; criado: Date; mudou: Date; quem: string; hist: unknown },
  ) => {
    const F = FLUXOS[key];
    const v = c.valores as Valores;
    const px = flProx(F, c.etapa);
    const ant = flAnt(F, c.etapa);
    const e = flEtapa(F, c.etapa);
    return {
      id: c.id,
      etapa: c.etapa,
      fim: !!e.fim,
      titulo: F.titulo(ctx, v),
      sub: F.sub(ctx, v),
      dias: diasNaEtapa(c.mudou, ctx.agora),
      mudou: fmt.data(c.mudou),
      criado: fmt.data(c.criado),
      quem: c.quem,
      prox: px ? { k: px.k, t: px.t } : null,
      ant: ant ? { k: ant.k, t: ant.t } : null,
      alts: e.fim ? [] : F.etapas.filter((x) => x.alt && x.k !== c.etapa).map((x) => ({ k: x.k, t: x.t })),
      exigeProx: px?.exige ? px.exige.map((k) => F.campos.find((x) => x.k === k)?.t ?? k) : [],
      hist: ((c.hist as { de?: string; para: string; quem: string; quando: string; nota?: string }[]) ?? [])
        .slice()
        .reverse()
        .map((h) => ({ ...h, quando: fmt.dataHora(new Date(h.quando), true) })),
      v,
    };
  };

  app.get('/acoes/fluxos/:key', { preHandler: exigeFluxo() }, async (req) => {
    const u = req.usuario!;
    const { key } = req.params as { key: string };
    const F = FLUXOS[key];
    const ctx = await contexto(u);
    await semeia(key, ctx);
    const cards = await prisma.fluxoCard.findMany({ where: { fluxo: key }, orderBy: { mudou: 'desc' } });
    return {
      key,
      t: F.t,
      um: F.um,
      novo: F.novo,
      como: F.como,
      podeOperar: podeOperar(u),
      etapas: F.etapas.map((e) => ({ k: e.k, t: e.t, cor: e.cor, d: e.d, fim: !!e.fim, alt: !!e.alt })),
      campos: camposDe(key, ctx, {}),
      cards: cards.map((c) => cardDe(key, ctx, c)),
    };
  });
  /** campos com as opções que dependem do que já foi escolhido (substituto da aula, módulo novo da matrícula) */
  app.post('/acoes/fluxos/:key/campos', { preHandler: exigeFluxo() }, async (req) => {
    const { key } = req.params as { key: string };
    const v = ((req.body as { v?: Valores })?.v ?? {}) as Valores;
    return { campos: camposDe(key, await contexto(req.usuario!), v) };
  });
  const ValoresIn = z.object({
    v: z.record(
      z.string(),
      z.union([z.string().max(4000), z.number(), z.array(z.string().max(200)).max(40), z.null()]),
    ),
  });
  const limpa = (key: string, v: Valores) =>
    Object.fromEntries(
      FLUXOS[key].campos.map((c) => [
        c.k,
        c.tipo === 'number' && v[c.k] !== '' && v[c.k] != null ? Number(v[c.k]) : (v[c.k] ?? ''),
      ]),
    );

  app.post('/acoes/fluxos/:key', { preHandler: exigeFluxo(true) }, async (req, rep) => {
    const u = req.usuario!;
    const { key } = req.params as { key: string };
    const F = FLUXOS[key];
    const p = ValoresIn.safeParse(req.body);
    if (!p.success) return erro400(rep, p.error);
    const v = limpa(key, p.data.v);
    const falta = F.campos.filter((c) => c.obrig && vazio(v[c.k]));
    if (falta.length) return rep.code(400).send({ erro: `Preencha: ${falta.map((c) => c.t).join(', ')}.` });
    const ctx = await contexto(u);
    await semeia(key, ctx);
    const ids = await prisma.fluxoCard.findMany({ where: { fluxo: key }, select: { id: true } });
    const n = Math.max(0, ...ids.map((x) => Number(x.id.split('-').pop()) || 0)) + 1;
    const agora = new Date();
    await prisma.fluxoCard.create({
      data: {
        id: `${key}-${n}`,
        fluxo: key,
        etapa: F.etapas[0].k,
        valores: v,
        criado: agora,
        mudou: agora,
        quem: u.nome,
        hist: [{ para: F.etapas[0].t, quem: u.nome, quando: agora.toISOString() }],
      },
    });
    await registra({
      tipo: 'acao',
      id: key,
      nome: F.t,
      acao: `${F.um} criado`,
      detalhe: F.titulo(ctx, v),
      autor: u.nome,
    });
    return { msg: `${F.titulo(ctx, v)} entrou em ${F.etapas[0].t}.` };
  });
  app.put('/acoes/fluxos/:key/:id', { preHandler: exigeFluxo(true) }, async (req, rep) => {
    const u = req.usuario!;
    const { key, id } = req.params as { key: string; id: string };
    const F = FLUXOS[key];
    const c = await prisma.fluxoCard.findFirst({ where: { id, fluxo: key } });
    if (!c) return rep.code(404).send({ erro: 'Card não encontrado.' });
    if (flEtapa(F, c.etapa).fim) return rep.code(409).send({ erro: 'Etapa encerrada: reabra para editar.' });
    const p = ValoresIn.safeParse(req.body);
    if (!p.success) return erro400(rep, p.error);
    const v = { ...(c.valores as Valores), ...limpa(key, p.data.v) };
    const falta = F.campos.filter((x) => x.obrig && vazio(v[x.k]));
    if (falta.length) return rep.code(400).send({ erro: `Preencha: ${falta.map((x) => x.t).join(', ')}.` });
    await prisma.fluxoCard.update({ where: { id }, data: { valores: v } });
    const ctx = await contexto(u);
    await registra({
      tipo: 'acao',
      id: key,
      nome: F.t,
      acao: `${F.um} editado`,
      detalhe: F.titulo(ctx, v),
      autor: u.nome,
    });
    return { msg: `${F.titulo(ctx, v)} salvo.` };
  });
  /* mover: confere o que a etapa exige, roda o efeito no portal e grava o histórico */
  app.post('/acoes/fluxos/:key/:id/mover', { preHandler: exigeFluxo(true) }, async (req, rep) => {
    const u = req.usuario!;
    const { key, id } = req.params as { key: string; id: string };
    const F = FLUXOS[key];
    const p = z.object({ etapa: z.string(), v: ValoresIn.shape.v.optional() }).safeParse(req.body);
    if (!p.success) return erro400(rep, p.error);
    const c = await prisma.fluxoCard.findFirst({ where: { id, fluxo: key } });
    if (!c) return rep.code(404).send({ erro: 'Card não encontrado.' });
    const alvo = F.etapas.find((e) => e.k === p.data.etapa);
    if (!alvo || alvo.k === c.etapa) return rep.code(400).send({ erro: 'Escolha outra etapa.' });
    const de = flEtapa(F, c.etapa);
    const reabre = !!de.fim && alvo.k === F.etapas[0].k;
    if (de.fim && !reabre) return rep.code(409).send({ erro: `Etapa encerrada: reabra em ${F.etapas[0].t}.` });
    const v = p.data.v && !de.fim ? { ...(c.valores as Valores), ...limpa(key, p.data.v) } : (c.valores as Valores);
    const falta = (alvo.exige ?? []).filter((k) => vazio(v[k]));
    if (falta.length)
      return rep.code(400).send({
        erro: `Para ${alvo.t}, preencha: ${falta.map((k) => F.campos.find((x) => x.k === k)?.t ?? k).join(', ')}.`,
      });
    const ctx = await contexto(u);
    let nota = '';
    const efeito = F.ao?.[alvo.k];
    if (efeito && !reabre) {
      const r = await efeito(ctx, v);
      if (r?.erro) return rep.code(409).send({ erro: r.erro });
      nota = r?.nota ?? '';
      invalidaBase();
    }
    const agora = new Date();
    const hist = [
      ...((c.hist as object[]) ?? []),
      { de: de.t, para: alvo.t, quem: u.nome, quando: agora.toISOString(), nota },
    ];
    await prisma.fluxoCard.update({ where: { id }, data: { etapa: alvo.k, mudou: agora, valores: v, hist } });
    const ctx2 = efeito ? await contexto(u) : ctx;
    await registra({
      tipo: 'acao',
      id: key,
      nome: F.t,
      acao: `${de.t} → ${alvo.t}`,
      detalhe: F.titulo(ctx2, v) + (nota ? ` · ${nota}` : ''),
      autor: u.nome,
    });
    return { msg: `${F.titulo(ctx2, v)}: ${alvo.t}.${nota ? ` ${nota}` : ''}` };
  });
}
