import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.ts';
import { podeAcao } from '../domain/acesso.ts';
import {
  ATV_CADENCIAS,
  ATV_FRENTES,
  ATV_PRIORIDADES,
  ATV_REL,
  ATV_SITUACOES,
  ATV_TIPOS,
  atvAberta,
  atvCartao,
  atvFrenteDe,
  garanteCatalogo,
  garanteRecorrentes,
  type Hist,
  RECORRENTES,
} from '../domain/atividades.ts';
import { base } from '../domain/base.ts';
import { atvSetores } from '../domain/mapa.ts';
import { fmt } from '../lib/fmt.ts';
import { registra } from '../lib/log.ts';
import type { UsuarioSessao } from '../plugins/sessao.ts';

const podeOperar = (u: UsuarioSessao) => !u.ehAluno && podeAcao(u.nivel, 'criar');
const erro400 = (rep: FastifyReply, e: z.ZodError) => rep.code(400).send({ erro: e.issues[0].message });
const exige = async (req: FastifyRequest, rep: FastifyReply) => {
  const u = req.usuario;
  if (!u) return rep.code(401).send({ erro: 'Sessão expirada. Entre de novo.' });
  if (u.ehAluno || !atvSetores(u).length) return rep.code(403).send({ erro: 'Sem acesso a esta tela.' });
};
const SIT_ROT: Record<string, string> = Object.fromEntries([
  ...ATV_SITUACOES.map(([k, l]) => [k, l]),
  ['cancelada', 'Cancelada'],
  ['expirada', 'Não realizada'],
] as [string, string][]);
const hist = (quem: string, acao: string, det = ''): Hist => ({ quando: new Date().toISOString(), quem, acao, det });

/** pessoas que podem ser responsáveis: a equipe ativa (colaboradores) e quem tem conta de acesso na equipe */
async function pessoas() {
  const b = await base();
  const nomes = new Set<string>(b.colaboradores.filter((c) => c.ativo).map((c) => c.nome));
  for (const u of await prisma.usuario.findMany({ where: { alunoId: null }, select: { nome: true, status: true } }))
    if (u.status !== 'Bloqueado') nomes.add(u.nome);
  return [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

const AtvIn = z.object({
  titulo: z.string().trim().min(3, 'Informe o título (3 letras ou mais).').max(200),
  descricao: z.string().max(4000).default(''),
  setor: z.string().refine((s) => ATV_FRENTES.some(([, ss]) => ss.includes(s)), 'Escolha o setor.'),
  tipo: z.string().refine((t) => ATV_TIPOS.includes(t), 'Escolha o tipo.'),
  responsavel: z.string().trim().default(''),
  prioridade: z.string().refine((p) => ATV_PRIORIDADES.includes(p), 'Escolha a prioridade.'),
  /** AAAA-MM-DD e HH:MM (vazios = sem prazo) */
  data: z.string().default(''),
  hora: z.string().default(''),
  situacao: z.enum(['afazer', 'andamento', 'concluida']).default('afazer'),
  relTipo: z.enum(['', 'aluno', 'empresa', 'prof', 'lead']).default(''),
  relId: z.string().default(''),
  modeloId: z.number().int().nullable().default(null),
});
type AtvIn = z.infer<typeof AtvIn>;

async function prazoDe(v: AtvIn) {
  if (!v.data) {
    if (v.hora) throw new Error('Informe a data do prazo, ou apague a hora.');
    return null;
  }
  const [y, m, d] = v.data.split('-').map(Number);
  const [hh, mm] = (v.hora || '09:00').split(':').map(Number);
  const x = new Date(y, m - 1, d, hh || 0, mm || 0);
  if (Number.isNaN(+x)) throw new Error('Data do prazo inválida.');
  return x;
}
/** nome de quem está na atividade, pelo registro escolhido */
async function relDe(v: AtvIn) {
  if (!v.relTipo) return { relTipo: null, relId: null, relNome: null };
  if (!v.relId) throw new Error('Escolha o registro de quem está na atividade, ou marque Ninguém.');
  const b = await base();
  let nome: string | undefined;
  if (v.relTipo === 'aluno') nome = b.alunos.find((a) => String(a.id) === v.relId)?.name;
  if (v.relTipo === 'prof') nome = b.professores.find((p) => p.id === v.relId)?.name;
  if (v.relTipo === 'empresa') nome = (await prisma.empresa.findUnique({ where: { id: v.relId } }))?.nome;
  if (v.relTipo === 'lead') nome = (await prisma.lead.findUnique({ where: { id: v.relId } }))?.nome;
  if (!nome) throw new Error('Registro não encontrado.');
  return { relTipo: v.relTipo, relId: v.relId, relNome: nome };
}

export default async function rotasAtividades(app: FastifyInstance) {
  /* opções dos filtros e do cadastro */
  app.get('/atividades/opcoes', { preHandler: exige }, async (req) => {
    const u = req.usuario!;
    await garanteCatalogo();
    const b = await base();
    const setores = atvSetores(u);
    const [empresas, leads, modelos] = await Promise.all([
      prisma.empresa.findMany({ select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
      prisma.lead.findMany({ select: { id: true, nome: true, etapa: true }, orderBy: { nome: 'asc' } }),
      prisma.atividadeModelo.findMany({ where: { ativo: true, setor: { in: setores } }, orderBy: { nome: 'asc' } }),
    ]);
    return {
      frentes: ATV_FRENTES.map(([f, ss]) => ({ frente: f, setores: ss.filter((s) => setores.includes(s)) })).filter(
        (f) => f.setores.length,
      ),
      tipos: ATV_TIPOS,
      prioridades: ATV_PRIORIDADES,
      situacoes: ATV_SITUACOES.map(([k, t, cor]) => ({ k, t, cor })),
      cadencias: ATV_CADENCIAS.map(([k, t]) => ({ k, t })),
      rels: ATV_REL.map(([k, t]) => ({ k, t })),
      pessoas: await pessoas(),
      eu: u.nome,
      podeOperar: podeOperar(u),
      registros: {
        aluno: b.alunos
          .slice()
          .sort((x, y) => x.name.localeCompare(y.name, 'pt-BR'))
          .map((a) => ({ v: String(a.id), l: a.name })),
        empresa: empresas.map((e) => ({ v: e.id, l: e.nome })),
        prof: b.professores.map((p) => ({ v: p.id, l: p.name })),
        lead: leads.map((l) => ({ v: l.id, l: l.nome })),
      },
      modelos: modelos.map((m) => ({
        id: m.id,
        nome: m.nome,
        descricao: m.descricao,
        setor: m.setor,
        tipo: m.tipo,
        cadencia: m.cadencia,
        responsavel: m.responsavel,
        prioridade: m.prioridade,
      })),
    };
  });

  /* quadro de uma frente: abertas, e as concluídas nos últimos 30 dias */
  app.get('/atividades/quadro', { preHandler: exige }, async (req, rep) => {
    const u = req.usuario!;
    const frente = String((req.query as { frente?: string }).frente ?? '');
    const setores = atvSetores(u, frente);
    if (!setores.length) return rep.code(403).send({ erro: 'Sem acesso a esta frente.' });
    await garanteRecorrentes();
    const desde = new Date(Date.now() - 30 * 864e5);
    const ls = await prisma.atividade.findMany({
      where: {
        setor: { in: setores },
        OR: [{ situacao: { in: ['afazer', 'andamento'] } }, { situacao: 'concluida', concluida: { gte: desde } }],
      },
      include: { modelo: true },
    });
    const agora = new Date();
    return { frente, setores, itens: ls.map((a) => atvCartao(a, agora)) };
  });

  app.get('/atividades/:id', { preHandler: exige }, async (req, rep) => {
    const a = await prisma.atividade.findUnique({
      where: { id: Number((req.params as { id: string }).id) },
      include: { modelo: true },
    });
    if (!a || !atvSetores(req.usuario!).includes(a.setor))
      return rep.code(404).send({ erro: 'Atividade não encontrada.' });
    return atvCartao(a);
  });

  /* Nova atividade (do catálogo ou livre) */
  app.post('/atividades', { preHandler: exige }, async (req, rep) => {
    const u = req.usuario!;
    if (!podeOperar(u)) return rep.code(403).send({ erro: 'Seu acesso é só de leitura.' });
    const r = AtvIn.safeParse(req.body);
    if (!r.success) return erro400(rep, r.error);
    const v = r.data;
    if (!atvSetores(u).includes(v.setor)) return rep.code(403).send({ erro: 'Você não atua nesse setor.' });
    try {
      const a = await prisma.atividade.create({
        data: {
          titulo: v.titulo,
          descricao: v.descricao,
          setor: v.setor,
          tipo: v.tipo,
          responsavel: v.responsavel,
          prioridade: v.prioridade,
          prazo: await prazoDe(v),
          situacao: v.situacao,
          concluida: v.situacao === 'concluida' ? new Date() : null,
          ...(await relDe(v)),
          modeloId: v.modeloId,
          criadoPor: u.nome,
          hist: [hist(u.nome, 'Atividade criada', v.modeloId ? 'a partir do catálogo' : 'por Nova atividade')],
        },
      });
      await registra({
        tipo: 'atividade',
        id: String(a.id),
        acao: 'Atividade criada',
        detalhe: a.titulo,
        nome: a.titulo,
        autor: u.nome,
      });
      return {
        id: a.id,
        frente: atvFrenteDe(a.setor),
        msg: `Atividade criada em ${atvFrenteDe(a.setor)} › ${a.setor}.`,
      };
    } catch (e) {
      return rep.code(400).send({ erro: (e as Error).message });
    }
  });

  /* edição */
  app.patch('/atividades/:id', { preHandler: exige }, async (req, rep) => {
    const u = req.usuario!;
    if (!podeOperar(u)) return rep.code(403).send({ erro: 'Seu acesso é só de leitura.' });
    const id = Number((req.params as { id: string }).id);
    const a = await prisma.atividade.findUnique({ where: { id } });
    if (!a || !atvSetores(u).includes(a.setor)) return rep.code(404).send({ erro: 'Atividade não encontrada.' });
    const r = AtvIn.safeParse(req.body);
    if (!r.success) return erro400(rep, r.error);
    const v = r.data;
    if (!atvSetores(u).includes(v.setor)) return rep.code(403).send({ erro: 'Você não atua nesse setor.' });
    try {
      const prazo = await prazoDe(v);
      const rel = await relDe(v);
      const novo = {
        titulo: v.titulo,
        descricao: v.descricao,
        setor: v.setor,
        tipo: v.tipo,
        responsavel: v.responsavel,
        prioridade: v.prioridade,
        prazo,
        situacao: v.situacao,
        ...rel,
      };
      const ROT: Record<string, string> = {
        titulo: 'título',
        descricao: 'descrição',
        setor: 'setor',
        tipo: 'tipo',
        responsavel: 'responsável',
        prioridade: 'prioridade',
        prazo: 'prazo',
        situacao: 'situação',
        relId: 'com quem',
      };
      const velho = a as unknown as Record<string, unknown>;
      const mud = Object.keys(ROT).filter((k) => {
        const x = velho[k];
        const y = (novo as Record<string, unknown>)[k];
        return (x instanceof Date ? +x : (x ?? null)) !== (y instanceof Date ? +y : (y ?? null));
      });
      await prisma.atividade.update({
        where: { id },
        data: {
          ...novo,
          concluida: v.situacao === 'concluida' ? (a.concluida ?? new Date()) : null,
          hist: mud.length
            ? [hist(u.nome, 'Atividade editada', mud.map((k) => ROT[k]).join(', ')), ...(a.hist as Hist[])]
            : (a.hist as Hist[]),
        },
      });
      if (mud.length)
        await registra({
          tipo: 'atividade',
          id: String(id),
          acao: 'Atividade editada',
          detalhe: mud.map((k) => ROT[k]).join(', '),
          nome: v.titulo,
          autor: u.nome,
        });
      return { msg: mud.length ? `${v.titulo}: alterações salvas.` : 'Nada mudou.' };
    } catch (e) {
      return rep.code(400).send({ erro: (e as Error).message });
    }
  });

  /* mover no quadro (Iniciar, Concluir, Reabrir) e cancelar */
  app.post('/atividades/:id/situacao', { preHandler: exige }, async (req, rep) => {
    const u = req.usuario!;
    if (!podeOperar(u)) return rep.code(403).send({ erro: 'Seu acesso é só de leitura.' });
    const r = z.object({ situacao: z.enum(['afazer', 'andamento', 'concluida', 'cancelada']) }).safeParse(req.body);
    if (!r.success) return erro400(rep, r.error);
    const id = Number((req.params as { id: string }).id);
    const a = await prisma.atividade.findUnique({ where: { id } });
    if (!a || !atvSetores(u).includes(a.setor)) return rep.code(404).send({ erro: 'Atividade não encontrada.' });
    const s = r.data.situacao;
    const det = `${SIT_ROT[a.situacao] ?? a.situacao} → ${SIT_ROT[s]}`;
    await prisma.atividade.update({
      where: { id },
      data: {
        situacao: s,
        concluida: s === 'concluida' ? new Date() : null,
        /* quem inicia um cartão sem responsável passa a ser o responsável */
        responsavel: s === 'andamento' && !a.responsavel ? u.nome : a.responsavel,
        hist: [
          hist(u.nome, s === 'cancelada' ? 'Atividade cancelada' : 'Situação alterada', det),
          ...(a.hist as Hist[]),
        ],
      },
    });
    await registra({
      tipo: 'atividade',
      id: String(id),
      acao: s === 'cancelada' ? 'Atividade cancelada' : 'Situação alterada',
      detalhe: det,
      nome: a.titulo,
      autor: u.nome,
    });
    return {
      msg:
        s === 'cancelada'
          ? `${a.titulo}: cancelada. Ela sai do quadro e continua no histórico.`
          : `${a.titulo}: ${SIT_ROT[s].toLowerCase()}.`,
    };
  });

  /* Dashboard › Visão geral */
  app.get('/atividades/dash', { preHandler: exige }, async (req) => {
    const u = req.usuario!;
    const setores = atvSetores(u);
    await garanteRecorrentes();
    const agora = new Date();
    const d0 = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const d1 = new Date(+d0 + 864e5);
    const rec = new Date(+agora - 30 * 864e5);
    const ls = await prisma.atividade.findMany({ where: { setor: { in: setores } }, include: { modelo: true } });
    const ab = ls.filter((a) => atvAberta(a.situacao));
    const atr = (a: (typeof ls)[number]) => atvAberta(a.situacao) && !!a.prazo && a.prazo < agora;
    const conc = (a: (typeof ls)[number]) => a.situacao === 'concluida' && (a.concluida ?? a.criado) >= rec;
    const exp = (a: (typeof ls)[number]) => a.situacao === 'expirada' && a.criado >= rec;
    const resp = new Map<string, { n: number; at: number }>();
    for (const a of ab) {
      const k = a.responsavel || 'Sem responsável';
      const r = resp.get(k) ?? { n: 0, at: 0 };
      r.n++;
      if (atr(a)) r.at++;
      resp.set(k, r);
    }
    const ult = ls
      .flatMap((a) => (a.hist as Hist[]).filter((h) => h.quem !== 'Sistema').map((h) => ({ a, h })))
      .sort((x, y) => y.h.quando.localeCompare(x.h.quando))
      .slice(0, 10);
    return {
      stats: {
        abertas: ab.length,
        andamento: ab.filter((a) => a.situacao === 'andamento').length,
        atrasadas: ab.filter(atr).length,
        hoje: ab.filter((a) => a.prazo && a.prazo >= d0 && a.prazo < d1).length,
        concluidas: ls.filter(conc).length,
        naoRealizadas: ls.filter(exp).length,
      },
      porSetor: setores.map((s) => {
        const x = ls.filter((a) => a.setor === s);
        return {
          setor: s,
          frente: atvFrenteDe(s),
          afazer: x.filter((a) => a.situacao === 'afazer').length,
          andamento: x.filter((a) => a.situacao === 'andamento').length,
          atrasadas: x.filter(atr).length,
          concluidas: x.filter(conc).length,
          naoRealizadas: x.filter(exp).length,
        };
      }),
      porResponsavel: [...resp.entries()]
        .sort((a, b) => b[1].at - a[1].at || b[1].n - a[1].n)
        .slice(0, 10)
        .map(([nome, r]) => ({ nome, abertas: r.n, atrasadas: r.at })),
      proximos: ab
        .filter((a) => a.prazo)
        .sort((a, b) => +a.prazo! - +b.prazo!)
        .slice(0, 10)
        .map((a) => atvCartao(a, agora)),
      ultimas: ult.map(({ a, h }) => ({
        id: a.id,
        titulo: a.titulo,
        quando: fmt.dataHora(new Date(h.quando)),
        quem: h.quem,
        acao: h.acao,
        det: h.det,
      })),
      podeOperar: podeOperar(u),
    };
  });

  /* catálogo de atividades */
  app.get('/atividades/catalogo', { preHandler: exige }, async (req) => {
    const u = req.usuario!;
    await garanteCatalogo();
    const setores = atvSetores(u);
    const ms = await prisma.atividadeModelo.findMany({
      where: { setor: { in: setores } },
      include: { atividades: { select: { situacao: true } } },
      orderBy: [{ setor: 'asc' }, { nome: 'asc' }],
    });
    return {
      podeEditar: !u.ehAluno && podeAcao(u.nivel, 'editar'),
      itens: ms.map((m) => ({
        id: m.id,
        nome: m.nome,
        descricao: m.descricao,
        cadencia: m.cadencia,
        setor: m.setor,
        frente: atvFrenteDe(m.setor),
        tipo: m.tipo,
        responsavel: m.responsavel,
        prioridade: m.prioridade,
        ativo: m.ativo,
        abertas: m.atividades.filter((a) => atvAberta(a.situacao)).length,
        total: m.atividades.length,
      })),
    };
  });

  const ModeloIn = z.object({
    nome: z.string().trim().min(3, 'Informe o nome (3 letras ou mais).').max(200),
    descricao: z.string().max(4000).default(''),
    cadencia: z.string().refine((c) => ATV_CADENCIAS.some(([k]) => k === c), 'Escolha a cadência.'),
    setor: z.string().refine((s) => ATV_FRENTES.some(([, ss]) => ss.includes(s)), 'Escolha o setor.'),
    tipo: z.string().refine((t) => ATV_TIPOS.includes(t), 'Escolha o tipo.'),
    responsavel: z.string().trim().default(''),
    prioridade: z.string().refine((p) => ATV_PRIORIDADES.includes(p), 'Escolha a prioridade.'),
    ativo: z.boolean().default(true),
  });
  const salvaModelo = async (req: FastifyRequest, rep: FastifyReply, id: number | null) => {
    const u = req.usuario!;
    if (!podeAcao(u.nivel, 'editar')) return rep.code(403).send({ erro: 'Só quem edita cadastros muda o catálogo.' });
    const r = ModeloIn.safeParse(req.body);
    if (!r.success) return erro400(rep, r.error);
    if (!atvSetores(u).includes(r.data.setor)) return rep.code(403).send({ erro: 'Você não atua nesse setor.' });
    const m = id
      ? await prisma.atividadeModelo.update({ where: { id }, data: r.data })
      : await prisma.atividadeModelo.create({ data: r.data });
    await registra({
      tipo: 'atividade',
      id: `modelo-${m.id}`,
      acao: id ? 'Catálogo editado' : 'Catálogo: atividade nova',
      detalhe: m.nome,
      nome: m.nome,
      autor: u.nome,
    });
    /* uma recorrente nova ou reativada já ganha o cartão do período */
    if (RECORRENTES.includes(m.cadencia) && m.ativo) await garanteRecorrentes(new Date(), true);
    return { id: m.id, msg: id ? `${m.nome}: catálogo atualizado.` : `${m.nome} entrou no catálogo.` };
  };
  app.post('/atividades/catalogo', { preHandler: exige }, (req, rep) => salvaModelo(req, rep, null));
  app.patch('/atividades/catalogo/:id', { preHandler: exige }, (req, rep) =>
    salvaModelo(req, rep, Number((req.params as { id: string }).id)),
  );
}
