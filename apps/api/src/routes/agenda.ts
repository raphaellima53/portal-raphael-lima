import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.ts';
import {
  type Aula,
  agAulasEntre,
  agHabilitado,
  agHH,
  agRotulo,
  alMat,
  FX_ESTADO,
  fxPresenca,
} from '../domain/agenda.ts';
import {
  AG_QUAL,
  type Contexto,
  filtrosEfetivos,
  montaAgenda,
  opcoesFiltros,
  PERIODOS,
  VISTAS,
} from '../domain/agenda-vista.ts';
import {
  aulaAlunos,
  aulaDe,
  aulaHojeOuAntes,
  aulaModelo,
  aulaNivel,
  aulaPassou,
  aulaRot,
  aulaSala,
  FOLHA_MOTIVOS,
  folhaPodeSuporte,
  folhaPodeValor,
  folhaR,
  folhaSuporte,
  folhaValor,
  folhaValorBase,
  folhaVeValor,
  type QuemAula,
} from '../domain/aulas.ts';
import { type AjusteAula, base } from '../domain/base.ts';
import {
  EV_GRUPOS,
  EV_UM,
  evChoques,
  eventoPor,
  evHora,
  evPessoas,
  evPodeCriar,
  evPodeEditar,
  evPodeExcluir,
  type Participante,
} from '../domain/eventos.ts';
import { podeChave } from '../domain/mapa.ts';
import { fmt } from '../lib/fmt.ts';
import { registra } from '../lib/log.ts';
import type { UsuarioSessao } from '../plugins/sessao.ts';

const quem = (u: UsuarioSessao): QuemAula => ({
  nome: u.nome,
  nivel: u.nivel,
  areas: u.areas,
  tipoPerfil: u.tipoPerfil,
  ehAluno: u.ehAluno,
});

async function contexto(u: UsuarioSessao, minha: boolean): Promise<Contexto> {
  const b = await base();
  const soAluno = u.ehAluno || (minha && u.temAluno);
  const al = u.alunoId != null ? b.alunos.find((a) => a.id === u.alunoId) : undefined;
  const prof =
    u.tipoPerfil === 'Prestador' ? b.professores.find((t) => t.name === (u.agendaPresa?.prof || u.nome)) : undefined;
  return {
    soAluno,
    alunoNome: soAluno ? (al?.name ?? null) : null,
    cursosDoAluno: al ? [...new Set(alMat(al).map((e) => e.curso))] : [],
    cursosDoProf: u.tipoPerfil === 'Prestador' ? (prof?.cursos ?? []) : null,
    presa: soAluno ? null : u.agendaPresa,
  };
}

/** a agenda abre para todos os tipos de perfil; o aluno vê só a própria */
async function exigeAgenda(req: FastifyRequest, rep: FastifyReply) {
  const u = req.usuario;
  if (!u) return rep.code(401).send({ erro: 'Sessão expirada. Entre de novo.' });
  if (!u.ehAluno && !podeChave(u, 'agenda')) return rep.code(403).send({ erro: 'Sem acesso à agenda.' });
}

/** a aula existe e a pessoa pode vê-la (aluno: só as próprias; agenda presa: só as dela) */
async function aulaVisivel(u: UsuarioSessao, k: string) {
  const b = await base();
  const a = aulaDe(b, k);
  if (!a) return { b, a: null, erro: 'Esta aula não existe mais na agenda.' };
  if (u.ehAluno) {
    const al = b.alunos.find((x) => x.id === u.alunoId);
    if (!al || !a.alunos.includes(al.name)) return { b, a: null, erro: 'Sem acesso a esta aula.' };
  }
  if (!u.ehAluno && u.agendaPresa?.prof && a.prof !== u.agendaPresa.prof && a.sub !== u.agendaPresa.prof) {
    return { b, a: null, erro: 'Sem acesso a esta aula.' };
  }
  return { b, a, erro: null };
}

export async function gravaAjuste(k: string, muda: (ov: AjusteAula) => void) {
  const b = await base();
  const ov: AjusteAula = structuredClone(b.ajustes[k] ?? {});
  muda(ov);
  b.ajustes[k] = ov;
  await prisma.aulaAjuste.upsert({ where: { chave: k }, create: { chave: k, dados: ov }, update: { dados: ov } });
}

const Filtros = z.object({
  vista: z.enum(VISTAS).catch('mensal'),
  data: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  periodo: z.enum(PERIODOS.map((p) => p[0]) as [string, ...string[]]).catch('semana'),
  aluno: z.string().max(200).catch(''),
  prof: z.string().max(200).catch(''),
  prod: z.string().max(200).catch(''),
  mod: z.string().max(300).catch(''),
  tipo: z.enum(['', 'aulas', 'eventos']).catch(''),
  qual: z.enum(['', ...AG_QUAL.map((q) => q[0])] as [string, ...string[]]).catch(''),
  minha: z.string().optional(),
});

const Layout = z.object({
  agF: z.object({
    aluno: z.string(),
    prof: z.string(),
    prod: z.string(),
    mod: z.string(),
    tipo: z.string(),
    qual: z.string(),
  }),
  vista: z.enum(VISTAS),
  periodo: z.string(),
});

const AcaoAula = z.discriminatedUnion('acao', [
  z.object({ acao: z.literal('professor'), prof: z.string().min(1, 'Escolha o professor.') }),
  z.object({ acao: z.literal('cancelar') }),
  z.object({ acao: z.literal('reabrir') }),
  z.object({ acao: z.literal('agendamento'), aluno: z.string().min(1) }),
  z.object({ acao: z.literal('presenca'), aluno: z.string().min(1), valor: z.enum(['presente', 'falta']) }),
  z.object({ acao: z.literal('todosPresentes') }),
  z.object({ acao: z.literal('iniciar') }),
  z.object({ acao: z.literal('concluir'), apresentacao: z.boolean().optional() }),
  z.object({
    acao: z.literal('valor'),
    valor: z.coerce.number().min(0, 'Informe o valor em reais.'),
    motivo: z.string().trim().min(1, 'Diga o motivo da troca.'),
  }),
  z.object({ acao: z.literal('valorVoltar') }),
  z.object({
    acao: z.literal('suporte'),
    motivo: z.enum(FOLHA_MOTIVOS as [string, ...string[]], { message: 'Escolha o motivo.' }),
    detalhe: z.string().max(1000).default(''),
  }),
  z.object({ acao: z.literal('suporteTirar') }),
  z.object({ acao: z.literal('conteudo'), conteudo: z.string() }),
  z.object({ acao: z.literal('zoomAbrir') }),
  z.object({ acao: z.literal('zoomGravar') }),
  z.object({ acao: z.literal('zoomEnviar') }),
  z.object({ acao: z.literal('zoomEncerrar') }),
  z.object({ acao: z.literal('notas'), texto: z.string().max(5000) }),
]);

const EventoForm = z
  .object({
    tipo: z.enum(['Reunião', 'Evento']),
    titulo: z.string().trim().min(1, 'Informe o título.').max(200),
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data.'),
    ini: z.string().regex(/^\d{2}:\d{2}$/, 'O término precisa ser depois do início.'),
    fim: z.string().regex(/^\d{2}:\d{2}$/, 'O término precisa ser depois do início.'),
    local: z.string().trim().max(500).default(''),
    desc: z.string().trim().max(2000).default(''),
    part: z
      .array(z.object({ g: z.enum(['colaborador', 'prestador', 'aluno']), n: z.string().min(1) }))
      .min(1, 'Escolha ao menos um participante.'),
    confirmar: z.boolean().default(false),
  })
  .refine((d) => d.fim > d.ini, { message: 'O término precisa ser depois do início.', path: ['fim'] });

const erro400 = (rep: FastifyReply, e: z.ZodError) => rep.code(400).send({ erro: e.issues[0].message });

export default async function rotasAgenda(app: FastifyInstance) {
  app.get('/agenda', { preHandler: exigeAgenda }, async (req) => {
    const u = req.usuario!;
    const q = Filtros.parse(req.query ?? {});
    const c = await contexto(u, q.minha === '1');
    const f = filtrosEfetivos(
      { aluno: q.aluno, prof: q.prof, prod: q.prod, mod: q.mod, tipo: q.tipo, qual: q.qual },
      c,
    );
    const b = await base();
    const nv = aulaNivel(quem(u));
    return {
      ...(await montaAgenda(b, q.vista, q.data ?? null, q.periodo, f, c)),
      opcoes: opcoesFiltros(b, f, c),
      podeCriarEvento: !c.soAluno && evPodeCriar(nv),
      podeMassa: !c.soAluno,
    };
  });

  /* layout salvo da agenda (no portal: localStorage alumni.agenda.<login>) */
  app.get('/agenda/layout', { preHandler: exigeAgenda }, async (req) => {
    const p = await prisma.preferencia.findUnique({
      where: { usuarioId_chave: { usuarioId: req.usuario!.id, chave: 'agenda.layout' } },
    });
    return { salvo: p?.valor ?? null };
  });
  app.put('/agenda/layout', { preHandler: exigeAgenda }, async (req, rep) => {
    const r = Layout.safeParse(req.body);
    if (!r.success) return erro400(rep, r.error);
    const u = req.usuario!;
    await prisma.preferencia.upsert({
      where: { usuarioId_chave: { usuarioId: u.id, chave: 'agenda.layout' } },
      create: { usuarioId: u.id, chave: 'agenda.layout', valor: r.data },
      update: { valor: r.data },
    });
    return { salvo: r.data };
  });
  app.delete('/agenda/layout', { preHandler: exigeAgenda }, async (req) => {
    await prisma.preferencia.deleteMany({ where: { usuarioId: req.usuario!.id, chave: 'agenda.layout' } });
    return { salvo: null };
  });

  /* ---- aula ---- */
  app.get('/aulas/detalhe', { preHandler: exigeAgenda }, async (req, rep) => {
    const k = String((req.query as { k?: string }).k ?? '');
    const { b, a, erro } = await aulaVisivel(req.usuario!, k);
    if (!a) return rep.code(404).send({ erro });
    return aulaModelo(b, a, quem(req.usuario!));
  });

  app.post('/aulas/acao', { preHandler: exigeAgenda }, async (req, rep) => {
    const u = req.usuario!;
    const k = String((req.body as { k?: string })?.k ?? '');
    const r = AcaoAula.safeParse(req.body);
    if (!r.success) return erro400(rep, r.error);
    const { b, a, erro } = await aulaVisivel(u, k);
    if (!a) return rep.code(404).send({ erro });
    const p = quem(u);
    const nv = aulaNivel(p);
    const ov = b.ajustes[a.k] ?? {};
    const cancelada = a.estado === 'cancelada';
    const passou = aulaPassou(a);
    const log = (acao: string, detalhe = '') =>
      registra({ tipo: 'aula', id: a.k, acao, detalhe, nome: aulaRot(a), autor: u.nome });
    const negado = () => rep.code(403).send({ erro: 'Seu acesso não permite esta ação nesta aula.' });
    const podePres = nv <= 4 && aulaHojeOuAntes(a) && !cancelada && !ov.concluida;
    const podeOperar = podePres;
    const d = r.data;

    switch (d.acao) {
      case 'professor': {
        if (nv > 3 || cancelada) return negado();
        if (!b.professores.some((t) => t.name === d.prof && t.active && agHabilitado(t, a.prod, a.mod)))
          return rep
            .code(400)
            .send({ erro: `${d.prof} não está habilitado em ${a.prod}${a.mod ? ` · ${a.mod}` : ''}.` });
        if (d.prof === a.prof) return { msg: '' };
        await gravaAjuste(a.k, (o) => {
          o.prof = d.prof;
        });
        await log('Professor alterado', `${a.prof === '—' ? 'sem professor' : a.prof} → ${d.prof}`);
        return { msg: `${d.prof} assume esta aula.` };
      }
      case 'cancelar':
        if (nv > 2 || passou || cancelada) return negado();
        await gravaAjuste(a.k, (o) => {
          o.cancelada = true;
        });
        await log('Aula cancelada', `${a.n}${a.n === 1 ? ' aluno' : ' alunos'}`);
        return { msg: 'Aula cancelada.' };
      case 'reabrir':
        if (nv > 2 || passou || !cancelada) return negado();
        await gravaAjuste(a.k, (o) => {
          delete o.cancelada;
        });
        await log('Cancelamento desfeito');
        return { msg: 'A aula voltou para a agenda.' };
      case 'agendamento': {
        if (nv > 3 || cancelada || passou || !a.alunos.includes(d.aluno)) return negado();
        const volta = !!ov.fora?.[d.aluno];
        await gravaAjuste(a.k, (o) => {
          o.fora = o.fora ?? {};
          if (volta) delete o.fora[d.aluno];
          else o.fora[d.aluno] = true;
        });
        await log(volta ? 'Agendamento refeito' : 'Agendamento cancelado', d.aluno);
        return { msg: volta ? `${d.aluno} voltou para a aula.` : `Agendamento de ${d.aluno} cancelado.` };
      }
      case 'presenca':
        if (!podePres || !a.alunos.includes(d.aluno)) return negado();
        await gravaAjuste(a.k, (o) => {
          o.pres = o.pres ?? {};
          if (o.pres[d.aluno] === d.valor) delete o.pres[d.aluno];
          else o.pres[d.aluno] = d.valor;
        });
        return { msg: '' };
      case 'todosPresentes':
        if (!podePres) return negado();
        await gravaAjuste(a.k, (o) => {
          o.pres = o.pres ?? {};
          for (const x of aulaAlunos(b, a).filter((x) => !x.fora)) o.pres[x.nome] = 'presente';
        });
        return { msg: 'Todos marcados como presentes.' };
      case 'iniciar':
        if (!podePres) return negado();
        await gravaAjuste(a.k, (o) => {
          o.iniciada = true;
        });
        await log('Aula iniciada');
        return { msg: 'Aula em andamento.' };
      case 'concluir': {
        if (!podePres) return negado();
        const al = aulaAlunos(b, a).filter((x) => !x.fora);
        const falta = al.filter((x) => !ov.pres?.[x.nome]).length;
        if (falta)
          return rep.code(400).send({
            erro: `Marque presença ou falta de todos antes de concluir: ${falta === 1 ? 'falta 1 aluno' : `faltam ${falta} alunos`}.`,
          });
        if (d.apresentacao && ov.zoom?.aberta) {
          const durou = Math.max(0, Math.floor((Date.now() - +new Date(ov.zoom.desde ?? Date.now())) / 6e4));
          await gravaAjuste(a.k, (o) => {
            o.zoom = { ...o.zoom, aberta: false, gravando: false, durou };
          });
          await log('Reunião encerrada', `${durou} min`);
        }
        await gravaAjuste(a.k, (o) => {
          o.concluida = true;
        });
        const pres = al.filter((x) => ov.pres?.[x.nome] === 'presente').length;
        await log('Aula concluída', `${pres} presentes, ${al.length - pres} faltas`);
        return { msg: 'Aula concluída e presença registrada.' };
      }
      case 'valor': {
        if (!folhaPodeValor(b, p, a)) return negado();
        const n = Math.round(d.valor);
        const antes = folhaValor(b, a);
        await gravaAjuste(a.k, (o) => {
          o.valor = n;
          o.valorMotivo = d.motivo;
        });
        await log('Valor da aula alterado', `${folhaR(antes)} → ${folhaR(n)} · ${d.motivo}`);
        return { msg: `Valor desta aula: ${folhaR(n)}. A folha de ${a.prof} já considera.` };
      }
      case 'valorVoltar': {
        if (!folhaPodeValor(b, p, a) || ov.valor == null) return negado();
        const antes = ov.valor;
        await gravaAjuste(a.k, (o) => {
          delete o.valor;
          delete o.valorMotivo;
        });
        await log('Valor da aula voltou ao da alocação', `${folhaR(antes)} → ${folhaR(folhaValorBase(b, a))}`);
        return { msg: 'Valor voltou ao da alocação.' };
      }
      case 'suporte': {
        if (!folhaPodeSuporte(b, p, a) || folhaSuporte(b, a)) return negado();
        await gravaAjuste(a.k, (o) => {
          o.suporte = { motivo: d.motivo, detalhe: d.detalhe, quem: u.nome, quando: new Date().toISOString() };
        });
        await log('Suporte pedido', `${d.motivo}${d.detalhe ? ` · ${d.detalhe}` : ''} · aula descontada da folha`);
        return {
          msg: `Pedido de suporte registrado. A aula é descontada da folha de ${a.prof}${folhaVeValor(p) ? ` (− ${folhaR(folhaValor(b, a))})` : ''}.`,
        };
      }
      case 'suporteTirar':
        if (nv > 3 || !folhaPodeSuporte(b, p, a) || !folhaSuporte(b, a)) return negado();
        await gravaAjuste(a.k, (o) => {
          o.suporte = false;
        });
        await log('Pedido de suporte retirado', 'a aula volta a ser paga');
        return { msg: `Pedido de suporte retirado: a aula volta a ser paga a ${a.prof}.` };
      case 'conteudo': {
        if (nv > 4 || cancelada || ov.concluida) return negado();
        if (!d.conteudo) {
          await gravaAjuste(a.k, (o) => {
            delete o.conteudo;
          });
          await log('Conteúdo da aula', 'volta para a sequência do currículo');
        } else {
          const [id, i] = d.conteudo.split('|');
          const c = b.curriculos.find((x) => x.id === id);
          const x = c?.conteudos[Number(i)];
          if (!c || !x) return rep.code(400).send({ erro: 'Conteúdo não encontrado.' });
          await gravaAjuste(a.k, (o) => {
            o.conteudo = { cur: id, i: Number(i) };
          });
          await log('Conteúdo da aula trocado', `${c.nome} · ${x.titulo}`);
        }
        return { msg: 'Conteúdo da aula atualizado.' };
      }
      case 'zoomAbrir': {
        if (!podeOperar || !aulaSala(b, a).zoom) return negado();
        const agora = new Date().toISOString();
        if (!ov.zoom?.aberta) await log('Reunião iniciada no Zoom', aulaSala(b, a).nome);
        if (!ov.iniciada) await log('Aula iniciada', 'pelo modo apresentação');
        await gravaAjuste(a.k, (o) => {
          o.zoom = o.zoom ?? {};
          if (!o.zoom.aberta) {
            o.zoom.aberta = true;
            o.zoom.desde = agora;
          }
          if (!o.iniciada) {
            o.iniciada = true;
            o.inicioEm = agora;
          }
        });
        return { msg: 'Reunião aberta numa aba do Zoom e aula em andamento.' };
      }
      case 'zoomGravar': {
        if (!podeOperar || !ov.zoom?.aberta) return negado();
        const grava = !ov.zoom.gravando;
        await gravaAjuste(a.k, (o) => {
          o.zoom = { ...o.zoom, gravando: grava, gravou: o.zoom?.gravou || grava };
        });
        await log(grava ? 'Gravação iniciada' : 'Gravação pausada');
        return { msg: grava ? 'Gravando a aula no Zoom.' : 'Gravação pausada.' };
      }
      case 'zoomEnviar': {
        if (!podeOperar || !aulaSala(b, a).zoom) return negado();
        const n = aulaAlunos(b, a).filter((x) => !x.fora).length;
        await gravaAjuste(a.k, (o) => {
          o.zoom = { ...o.zoom, enviado: new Date().toISOString() };
        });
        await log('Link da sala enviado', `${n}${n === 1 ? ' aluno' : ' alunos'}`);
        return { msg: `Link da sala enviado por e-mail e no app para ${n} ${n === 1 ? 'aluno' : 'alunos'}.` };
      }
      case 'zoomEncerrar': {
        if (!podeOperar || !ov.zoom?.aberta) return negado();
        const durou = Math.max(0, Math.floor((Date.now() - +new Date(ov.zoom.desde ?? Date.now())) / 6e4));
        await gravaAjuste(a.k, (o) => {
          o.zoom = { ...o.zoom, aberta: false, gravando: false, durou };
        });
        await log('Reunião encerrada', `${durou} min`);
        return { msg: 'Reunião encerrada.' };
      }
      case 'notas': {
        if (nv > 4 || cancelada) return negado();
        if ((ov.notas ?? '') === d.texto) return { msg: '' };
        await gravaAjuste(a.k, (o) => {
          o.notas = d.texto;
        });
        await log('Anotações da aula', d.texto.slice(0, 80));
        return { msg: '' };
      }
    }
  });

  /* ---- Diária: Gerar todos os Zoom do dia e ação em massa ---- */
  app.post('/agenda/zoom-dia', { preHandler: exigeAgenda }, async (req, rep) => {
    const u = req.usuario!;
    if (u.ehAluno) return rep.code(403).send({ erro: 'Sem acesso.' });
    const iso = String((req.body as { data?: string })?.data ?? '');
    const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date();
    const b = await base();
    const dia = agAulasEntre(b, d, d).filter((a) => a.estado !== 'cancelada');
    const zoom = dia.filter((a) => aulaSala(b, a).zoom);
    for (const a of zoom) {
      if (b.ajustes[a.k]?.zoomGerado) continue;
      await gravaAjuste(a.k, (o) => {
        o.zoomGerado = new Date().toISOString();
      });
      await registra({
        tipo: 'aula',
        id: a.k,
        acao: 'Link do Zoom gerado',
        detalhe: aulaSala(b, a).url,
        nome: aulaRot(a),
        autor: u.nome,
      });
    }
    return {
      msg: `${zoom.length} ${zoom.length === 1 ? 'link de Zoom gerado' : 'links de Zoom gerados'} para ${fmt.data(d).slice(0, 5)} e enviados aos professores e alunos; ${dia.length - zoom.length} aulas são presenciais.`,
    };
  });

  const Ks = z.object({
    ks: z.array(z.string()).min(1, 'Marque as aulas na lista do dia para usar a ação em massa.').max(500),
  });
  app.post('/agenda/massa/previa', { preHandler: exigeAgenda }, async (req, rep) => {
    if (req.usuario!.ehAluno) return rep.code(403).send({ erro: 'Sem acesso.' });
    const r = Ks.safeParse(req.body);
    if (!r.success) return erro400(rep, r.error);
    const b = await base();
    const aulas = r.data.ks.map((k) => aulaDe(b, k)).filter((a): a is Aula => !!a);
    const futuras = aulas.filter((a) => !aulaPassou(a) && a.estado !== 'cancelada');
    const prods = [...new Set(aulas.map((a) => a.prod))];
    return {
      aulas: aulas.map((a) => ({ k: a.k, rot: aulaRot(a), prof: a.prof === '—' ? 'sem professor' : a.prof })),
      futuras: futuras.length,
      profs: b.professores.filter((t) => t.active && prods.every((p) => t.cursos.includes(p))).map((t) => t.name),
    };
  });
  const Massa = Ks.extend({
    acao: z.enum(['prof', 'cancelar', 'zoom'], { message: 'Escolha o que fazer.' }),
    prof: z.string().optional(),
  });
  app.post('/agenda/massa', { preHandler: exigeAgenda }, async (req, rep) => {
    const u = req.usuario!;
    if (u.ehAluno) return rep.code(403).send({ erro: 'Sem acesso.' });
    const r = Massa.safeParse(req.body);
    if (!r.success) return erro400(rep, r.error);
    const b = await base();
    const nv = aulaNivel(quem(u));
    const aulas = r.data.ks.map((k) => aulaDe(b, k)).filter((a): a is Aula => !!a);
    const fut = aulas.filter((a) => !aulaPassou(a) && a.estado !== 'cancelada');
    const log = (a: Aula, acao: string, detalhe: string) =>
      registra({ tipo: 'aula', id: a.k, acao, detalhe, nome: aulaRot(a), autor: u.nome });
    if (r.data.acao === 'prof') {
      const prof = r.data.prof;
      if (!prof) return rep.code(400).send({ erro: 'Escolha o novo professor.' });
      if (nv > 3) return rep.code(403).send({ erro: 'Seu acesso não permite trocar o professor.' });
      for (const a of fut) {
        if (a.prof === prof) continue;
        await gravaAjuste(a.k, (o) => {
          o.prof = prof;
        });
        await log(a, 'Professor alterado', `${a.prof === '—' ? 'sem professor' : a.prof} → ${prof} · em massa`);
      }
      return { msg: `${prof} assume ${fut.length} ${fut.length === 1 ? 'aula' : 'aulas'}.` };
    }
    if (r.data.acao === 'cancelar') {
      if (nv > 2) return rep.code(403).send({ erro: 'Seu acesso não permite cancelar aulas.' });
      for (const a of fut) {
        await gravaAjuste(a.k, (o) => {
          o.cancelada = true;
        });
        await log(a, 'Aula cancelada', 'em massa');
      }
      return { msg: `${fut.length} ${fut.length === 1 ? 'aula cancelada' : 'aulas canceladas'}.` };
    }
    const zs = aulas.filter((a) => aulaSala(b, a).zoom);
    for (const a of zs) await log(a, 'Link da sala reenviado', 'em massa');
    return {
      msg: `Link da sala reenviado em ${zs.length} ${zs.length === 1 ? 'aula' : 'aulas'}${aulas.length - zs.length ? `; ${aulas.length - zs.length} presenciais ficaram de fora` : ''}.`,
    };
  });

  /* ---- eventos e reuniões ---- */
  app.get('/eventos/pessoas', { preHandler: exigeAgenda }, async () => {
    const ps = evPessoas(await base());
    return { grupos: EV_GRUPOS.map(([g, rot]) => ({ g, rot, pessoas: ps[g] })) };
  });

  app.get('/eventos/:id', { preHandler: exigeAgenda }, async (req, rep) => {
    const u = req.usuario!;
    const e = await eventoPor((req.params as { id: string }).id);
    const b = await base();
    const al = u.ehAluno ? b.alunos.find((x) => x.id === u.alunoId) : null;
    if (!e || (u.ehAluno && !e.part.some((x) => x.g === 'aluno' && x.n === al?.name)))
      return rep.code(404).send({ erro: 'Evento não encontrado.' });
    const nv = aulaNivel(quem(u));
    return {
      id: e.id,
      tipo: e.tipo,
      titulo: e.titulo,
      desc: e.desc,
      local: e.local,
      link: /^https?:\/\//i.test(e.local),
      data: fmt.iso(e.ini),
      ini: evHora(e.ini),
      fim: evHora(e.fim),
      dataTxt: `${e.ini.toLocaleDateString('pt-BR', { weekday: 'long' }).replace(/^./, (c) => c.toUpperCase())}, ${e.ini.getDate()} de ${e.ini.toLocaleDateString('pt-BR', { month: 'short' })}`,
      part: e.part.map((x) => ({ ...x, grupo: EV_UM[x.g] ?? x.g })),
      por: e.por,
      choques: evChoques(b, e),
      podeEditar: !u.ehAluno && evPodeEditar(nv, e, u.nome),
      podeExcluir: !u.ehAluno && evPodeExcluir(nv, e, u.nome),
    };
  });

  const salvaEvento = async (req: FastifyRequest, rep: FastifyReply, id: string | null) => {
    const u = req.usuario!;
    const nv = aulaNivel(quem(u));
    if (u.ehAluno || !evPodeCriar(nv)) return rep.code(403).send({ erro: 'Seu acesso não permite criar eventos.' });
    const antes = id ? await eventoPor(id) : null;
    if (id && !antes) return rep.code(404).send({ erro: 'Evento não encontrado.' });
    if (antes && !evPodeEditar(nv, antes, u.nome))
      return rep.code(403).send({ erro: 'Seu acesso não permite editar este evento.' });
    const r = EventoForm.safeParse(req.body);
    if (!r.success) return erro400(rep, r.error);
    const d = r.data;
    const ini = new Date(`${d.data}T${d.ini}:00`);
    const fim = new Date(`${d.data}T${d.fim}:00`);
    const part = d.part as Participante[];
    const b = await base();
    const choques = evChoques(b, { ini, fim, part });
    if (choques.length && !d.confirmar) {
      return rep.code(409).send({
        erro: `Choque de horário: ${choques.slice(0, 2).join(' · ')}${choques.length > 2 ? ` e mais ${choques.length - 2}` : ''}.`,
        choques,
      });
    }
    const dados = {
      tipo: d.tipo,
      titulo: d.titulo,
      inicio: ini,
      fim,
      local: d.local,
      descricao: d.desc,
      participantes: part,
    };
    const e = antes
      ? await prisma.evento.update({ where: { id: antes.id }, data: dados })
      : await prisma.evento.create({ data: { ...dados, id: `ev${Date.now()}`, criadoPor: u.nome } });
    const reuniao = d.tipo === 'Reunião';
    await registra({
      tipo: 'evento',
      id: e.id,
      nome: e.titulo,
      autor: u.nome,
      acao: `${reuniao ? 'Reunião ' : 'Evento '}${antes ? `alterad${reuniao ? 'a' : 'o'}` : `criad${reuniao ? 'a' : 'o'}`}`,
      detalhe: `${fmt.data(ini).slice(0, 5)} ${d.ini} · ${part.length} participantes`,
    });
    return {
      id: e.id,
      data: d.data,
      msg: antes
        ? 'Alterações salvas.'
        : `${reuniao ? 'Reunião criada' : 'Evento criado'} na agenda de ${part.length}${part.length === 1 ? ' pessoa.' : ' pessoas.'}`,
    };
  };
  app.post('/eventos', { preHandler: exigeAgenda }, (req, rep) => salvaEvento(req, rep, null));
  app.put('/eventos/:id', { preHandler: exigeAgenda }, (req, rep) =>
    salvaEvento(req, rep, (req.params as { id: string }).id),
  );

  app.delete('/eventos/:id', { preHandler: exigeAgenda }, async (req, rep) => {
    const u = req.usuario!;
    const e = await eventoPor((req.params as { id: string }).id);
    if (!e) return rep.code(404).send({ erro: 'Evento não encontrado.' });
    if (u.ehAluno || !evPodeExcluir(aulaNivel(quem(u)), e, u.nome))
      return rep.code(403).send({ erro: 'Seu acesso não permite excluir este evento.' });
    await prisma.evento.delete({ where: { id: e.id } });
    await registra({
      tipo: 'evento',
      id: e.id,
      nome: e.titulo,
      autor: u.nome,
      acao: e.tipo === 'Reunião' ? 'Reunião excluída' : 'Evento excluído',
      detalhe: `${evHora(e.ini)} · ${e.part.length} participantes`,
    });
    return { msg: `${e.tipo === 'Reunião' ? 'Reunião excluída' : 'Evento excluído'}.` };
  });

  /* ---- Histórico de aulas: o do aluno (área do aluno) e o do professor (as aulas que deu ou em que foi substituído) ---- */
  app.get('/historico-de-aulas', { preHandler: exigeAgenda }, async (req, rep) => {
    const u = req.usuario!;
    const b = await base();
    const dias = [30, 60, 90].includes(Number((req.query as { dias?: string }).dias))
      ? Number((req.query as { dias?: string }).dias)
      : 60;
    const agora = new Date();
    const ini = new Date();
    ini.setDate(ini.getDate() - dias);
    if (u.tipoPerfil === 'Prestador') {
      const prof = u.agendaPresa?.prof ?? u.nome;
      const todas = agAulasEntre(b, ini, agora, agora)
        .filter((x) => x.quando < agora && (x.prof === prof || x.sub === prof))
        .reverse();
      const n = (e: string) => todas.filter((x) => x.estado === e).length;
      return {
        modo: 'professor' as const,
        dias,
        stats: {
          aulas: todas.length,
          executadas: n('executada'),
          substituidas: n('substituida'),
          naoFinalizadas: n('naoFinalizada'),
          canceladas: n('cancelada'),
        },
        aulas: todas.map((x) => {
          const fim = x.quando.getHours() * 60 + (x.duracao || 50);
          return {
            k: x.k,
            data: fmt.semana(x.quando),
            horario: `${agHH(x.quando.getHours())}–${String(Math.floor(fim / 60)).padStart(2, '0')}:${String(fim % 60).padStart(2, '0')}`,
            rotulo: agRotulo(x),
            cor: b.corModulo[x.mod ?? ''] || b.corCurso[x.prod] || '#1e46c8',
            prod: x.prod,
            prof: x.prof,
            sub: x.sub,
            estado: x.estado,
            estadoTag: FX_ESTADO[x.estado],
            alunos: x.alunos.length,
          };
        }),
      };
    }
    const al = u.alunoId != null ? b.alunos.find((a) => a.id === u.alunoId) : undefined;
    if (!al) return rep.code(404).send({ erro: 'Entre com uma persona de aluno para ver o histórico de aulas.' });
    const todas = agAulasEntre(b, ini, agora, agora)
      .filter((x) => x.quando < agora && x.alunos.includes(al.name))
      .reverse();
    const pres = todas.map((x) => fxPresenca(b, al.name, x));
    const np = pres.filter((p) => p === 'presente').length;
    const nf = pres.filter((p) => p === 'falta').length;
    return {
      modo: 'aluno' as const,
      dias,
      stats: {
        aulas: todas.length,
        presencas: np,
        faltas: nf,
        pct: np + nf ? Math.round((np / (np + nf)) * 100) : null,
        canceladas: todas.filter((x) => x.estado === 'cancelada').length,
      },
      aulas: todas.map((x) => {
        const fim = x.quando.getHours() * 60 + (x.duracao || 50);
        const p = fxPresenca(b, al.name, x);
        return {
          k: x.k,
          data: fmt.semana(x.quando),
          horario: `${agHH(x.quando.getHours())}–${String(Math.floor(fim / 60)).padStart(2, '0')}:${String(fim % 60).padStart(2, '0')}`,
          rotulo: agRotulo(x),
          cor: b.corModulo[x.mod ?? ''] || b.corCurso[x.prod] || '#1e46c8',
          prod: x.prod,
          prof: x.prof,
          sub: x.sub,
          estado: x.estado,
          estadoTag: FX_ESTADO[x.estado],
          presenca: p,
        };
      }),
    };
  });
}
