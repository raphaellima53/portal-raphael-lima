import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.ts';
import {
  type Aula,
  agAulasEntre,
  agHabilitado,
  agHM,
  agISO,
  agOfertas,
  agRotulo,
  alMat,
  crsItens,
  crsRegras,
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
  avulsaDe,
  FOLHA_MOTIVOS,
  folhaPodeSuporte,
  folhaPodeValor,
  folhaR,
  folhaSuporte,
  folhaValor,
  folhaValorBase,
  folhaVeValor,
  primeiroNome,
  type QuemAula,
} from '../domain/aulas.ts';
import { autoAgenda } from '../domain/autoagenda.ts';
import { type AjusteAula, base, invalidaBase } from '../domain/base.ts';
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
import { pendenteNaAula, TIPO_CANCEL, TIPO_MUDANCA } from '../domain/solicitacoes.ts';
import { env } from '../env.ts';
import { fmt } from '../lib/fmt.ts';
import { registra } from '../lib/log.ts';
import { assinatura, criaReuniao, reuniaoDoLink, sdkConectado, tokenAnfitriao, transcricao } from '../lib/zoom.ts';
import type { UsuarioSessao } from '../plugins/sessao.ts';
import { moveParaLixeira } from './lixeira.ts';

const quem = (u: UsuarioSessao): QuemAula => ({
  nome: u.nome,
  nivel: u.nivel,
  areas: u.areas,
  tipoPerfil: u.tipoPerfil,
  ehAluno: u.ehAluno,
  alunoId: u.alunoId,
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
    modulosDoAluno: al ? [...new Set(alMat(al).flatMap((e) => (e.modulo ? [`${e.curso} · ${e.modulo}`] : [])))] : [],
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
  const doProprioAluno = u.alunoId != null && a.alunos.includes(b.alunos.find((x) => x.id === u.alunoId)?.name ?? '');
  if (
    !u.ehAluno &&
    !doProprioAluno &&
    u.agendaPresa?.prof &&
    a.prof !== u.agendaPresa.prof &&
    a.sub !== u.agendaPresa.prof
  ) {
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
  /* vários valores separados por | (24/09/2026) */
  aluno: z.string().max(20000).catch(''),
  prof: z.string().max(5000).catch(''),
  prod: z.string().max(200).catch(''),
  mod: z.string().max(20000).catch(''),
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
  /* 24/09/2026 */
  z.object({ acao: z.literal('bloquear') }),
  z.object({ acao: z.literal('adicionarAluno'), aluno: z.string().min(1, 'Escolha o aluno.') }),
  z.object({ acao: z.literal('encerrarGrade') }),
  /* 25/09/2026: o aluno cancela a própria aula, dentro do prazo de cancelamento */
  z.object({ acao: z.literal('meuCancelamento') }),
  /* 30/09/2026: curso Regular — o aluno solicita o cancelamento; Particular — solicita mudança de dias e horários */
  z.object({ acao: z.literal('solicitarCancelamento'), motivo: z.string().trim().max(1000).default('') }),
  z.object({
    acao: z.literal('solicitarMudanca'),
    pedido: z.string().trim().min(3, 'Diga os dias e horários que você quer.').max(1000),
  }),
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
    const m = aulaModelo(b, a, quem(req.usuario!));
    const u = req.usuario!;
    if (m.meuCancelamento && u.alunoId != null) m.meuCancelamento.pendente = !!(await pendenteNaAula(u.alunoId, a.k));
    return m;
  });

  /**
   * 30/09/2026: entrar na sala do Zoom sem sair do portal nem fazer login. A reunião é criada na conta (sala) que a
   * distribuição deu à aula; o professor da aula entra como anfitrião (token da conta), aluno e equipe como participantes.
   * A sala abre 30 minutos antes e fecha 30 minutos depois da aula.
   */
  app.get('/aulas/zoom', { preHandler: exigeAgenda }, async (req, rep) => {
    const u = req.usuario!;
    const k = String((req.query as { k?: string }).k ?? '');
    const { b, a, erro } = await aulaVisivel(u, k);
    if (!a) return rep.code(404).send({ erro });
    const sala = aulaSala(b, a);
    if (!sala.zoom) return rep.code(400).send({ erro: `Aula presencial na ${sala.nome}: não há sala no Zoom.` });
    if (a.estado === 'cancelada') return rep.code(400).send({ erro: 'Aula cancelada: a sala não abre.' });
    if (sala.semConta)
      return rep.code(409).send({
        erro: 'Todas as contas do Zoom já têm 2 aulas nesse horário. Cadastre mais uma conta em Configurações › Salas ou mude o horário.',
      });
    if (!sala.conta)
      return rep
        .code(400)
        .send({ erro: `A sala ${sala.nome} ainda não tem a conta do Zoom cadastrada (Configurações › Salas).` });
    const fim = +a.quando + (a.duracao || 50) * 6e4;
    const agora = Date.now();
    if (agora < +a.quando - 30 * 6e4) return rep.code(400).send({ erro: 'A sala abre 30 minutos antes da aula.' });
    if (agora > fim + 30 * 6e4) return rep.code(400).send({ erro: 'A aula já terminou: a sala fechou.' });
    if (!sdkConectado())
      return rep.code(503).send({
        erro: 'O Zoom ainda não está conectado ao portal. Um Admin precisa cadastrar os apps do Zoom (Server-to-Server: ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET; Meeting SDK: ZOOM_SDK_KEY, ZOOM_SDK_SECRET).',
      });
    const anfitriao = !u.ehAluno && (u.agendaPresa?.prof ?? u.nome) === a.prof;
    let r = b.ajustes[a.k]?.zoom?.reuniao;
    if (!r || r.conta !== sala.conta) {
      const nova = await criaReuniao(sala.conta, `${aulaRot(a)}`, a.quando, a.duracao || 50);
      r = { ...nova, conta: sala.conta };
      const guardar = r;
      await gravaAjuste(a.k, (o) => {
        o.zoom = { ...(o.zoom ?? {}), reuniao: guardar };
      });
    }
    if (anfitriao)
      await registra({
        tipo: 'aula',
        id: a.k,
        nome: aulaRot(a),
        acao: 'Sala do Zoom aberta',
        detalhe: sala.nome,
        autor: u.nome,
      });
    return {
      sdkKey: env.ZOOM_SDK_KEY,
      assinatura: assinatura(r.id, anfitriao ? 1 : 0),
      reuniao: r.id,
      senha: r.senha,
      nome: u.nome,
      email: u.email,
      zak: anfitriao ? await tokenAnfitriao(sala.conta) : '',
      anfitriao,
      sala: sala.nome,
    };
  });

  /** Transcrição (24/09/2026): automática do Zoom, da gravação na nuvem da reunião da aula */
  app.get('/aulas/transcricao', { preHandler: exigeAgenda }, async (req, rep) => {
    const u = req.usuario!;
    const { b, a, erro } = await aulaVisivel(u, String((req.query as { k?: string }).k ?? ''));
    if (!a) return rep.code(404).send({ erro });
    const sala = aulaSala(b, a);
    const reuniao = sala.url ? reuniaoDoLink(sala.url) : null;
    if (!sala.zoom || !reuniao) return { ok: false, motivo: 'Esta aula não tem sala do Zoom.' };
    if (!aulaPassou(a)) return { ok: false, motivo: 'A transcrição aparece depois que a aula acontece.' };
    try {
      return await transcricao(reuniao);
    } catch (e) {
      return { ok: false, motivo: (e as Error).message };
    }
  });

  /** + Novo › Aula (24/09/2026): opções do formulário — cursos, módulos ou turmas, tópicos, professores e alunos */
  app.get('/aulas/avulsas/opcoes', { preHandler: exigeAgenda }, async (req, rep) => {
    const u = req.usuario!;
    if (u.ehAluno || aulaNivel(quem(u)) > 3) return rep.code(403).send({ erro: 'Seu acesso não cria aula.' });
    const b = await base();
    const profs = await prisma.professor.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } });
    const abc = (x: string, y: string) => x.localeCompare(y, 'pt-BR', { sensitivity: 'base', numeric: true });
    return {
      cursos: b.cursos
        .filter((c) => c.active !== false)
        .sort((x, y) => abc(x.name, y.name))
        .map((c) => {
          const itens = crsItens(c);
          const curs = b.curriculos.filter((x) => x.grupo === c.name && x.conteudos.length);
          return {
            id: c.id,
            nome: c.name,
            rotuloItem: c.estrutura === 'turmas' ? 'Turma' : c.estrutura === 'modulos' ? 'Módulo' : null,
            itens,
            duracao: crsRegras(c).duracao,
            professores: profs
              .filter((p) => b.professores.find((t) => t.id === p.id && agHabilitado(t, c.name, null)))
              .map((p) => ({ v: p.id, l: p.nome })),
            /* tópicos: conteúdos do currículo aplicado ao item (ou do curso) */
            topicos: Object.fromEntries(
              (itens.length ? itens : ['']).map((it) => {
                const cs = curs.filter((x) => !it || x.aplicado.includes(it));
                return [
                  it,
                  (cs.length ? cs : curs).flatMap((x) =>
                    x.conteudos.map((ct, i) => ({ v: `${x.id}|${i}`, l: `${i + 1}. ${ct.titulo}`, grupo: x.nome })),
                  ),
                ];
              }),
            ),
            alunos: b.alunos
              .filter((a) => a.matriculas.some((e) => !e.desativadoEm && e.curso === c.name))
              .map((a) => a.name)
              .sort(abc),
          };
        }),
    };
  });

  const AvulsaForm = z
    .object({
      cursoId: z.coerce.number().int({ message: 'Escolha o curso.' }),
      modulo: z.string().trim().max(200).default(''),
      topico: z.string().trim().max(300).default(''),
      conteudo: z.string().max(80).default(''),
      professorId: z.string().default(''),
      data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data.'),
      ini: z.string().regex(/^\d{2}:\d{2}$/, 'Informe o início.'),
      fim: z.string().regex(/^\d{2}:\d{2}$/, 'Informe o término.'),
      local: z.string().trim().max(500).default(''),
      desc: z.string().trim().max(2000).default(''),
      alunos: z.array(z.string().min(1)).max(200).default([]),
      confirmar: z.boolean().default(false),
    })
    .refine((d) => d.fim > d.ini, { message: 'O término precisa ser depois do início.', path: ['fim'] });

  app.post('/aulas/avulsas', { preHandler: exigeAgenda }, async (req, rep) => {
    const u = req.usuario!;
    if (u.ehAluno || aulaNivel(quem(u)) > 3) return rep.code(403).send({ erro: 'Seu acesso não cria aula.' });
    const r = AvulsaForm.safeParse(req.body);
    if (!r.success) return erro400(rep, r.error);
    const v = r.data;
    const b = await base();
    const c = b.cursos.find((x) => x.id === v.cursoId);
    if (!c) return rep.code(400).send({ erro: 'Escolha o curso.' });
    const itens = crsItens(c);
    if (itens.length && !itens.includes(v.modulo))
      return rep.code(400).send({ erro: `Escolha ${c.estrutura === 'turmas' ? 'a turma' : 'o módulo'}.` });
    /* tópico: um conteúdo do currículo do curso ou um texto livre */
    const [curId, pos] = v.conteudo.split('|');
    const ct = curId
      ? b.curriculos.find((x) => x.id === curId && x.grupo === c.name)?.conteudos[Number(pos)]
      : undefined;
    const topico = ct?.titulo ?? v.topico;
    if (!topico) return rep.code(400).send({ erro: 'Informe o tópico da aula.' });
    const prof = v.professorId ? b.professores.find((t) => t.id === v.professorId) : null;
    if (v.professorId && (!prof || !agHabilitado(prof, c.name, v.modulo || null)))
      return rep.code(400).send({ erro: `${prof?.name ?? 'O professor'} não está habilitado em ${c.name}.` });
    const semMat = v.alunos.filter(
      (n) => !b.alunos.find((a) => a.name === n)?.matriculas.some((e) => !e.desativadoEm && e.curso === c.name),
    );
    if (semMat.length) return rep.code(400).send({ erro: `Sem matrícula ativa em ${c.name}: ${semMat.join(', ')}.` });
    const inicio = new Date(`${v.data}T${v.ini}:00`);
    const fim = new Date(`${v.data}T${v.fim}:00`);
    /* professor já com aula no horário: avisa e só grava com "Salvar mesmo assim" */
    if (prof && !v.confirmar) {
      const choques = agAulasEntre(b, inicio, inicio).filter(
        (a) =>
          a.prof === prof.name &&
          a.estado !== 'cancelada' &&
          a.quando < fim &&
          +a.quando + (a.duracao || 50) * 6e4 > +inicio,
      );
      if (choques.length)
        return rep.code(409).send({
          erro: `${prof.name} já tem aula nesse horário: ${choques.map((a) => aulaRot(a)).join('; ')}.`,
          choques: choques.length,
        });
    }
    const id = `av-${crypto.randomUUID().slice(0, 12)}`;
    await prisma.aulaAvulsa.create({
      data: {
        id,
        cursoId: c.id,
        modulo: v.modulo,
        topico,
        conteudo: ct ? v.conteudo : '',
        professorId: prof?.id ?? null,
        inicio,
        fim,
        local: v.local,
        descricao: v.desc,
        alunos: v.alunos,
        criadoPor: u.nome,
      },
    });
    invalidaBase();
    const hora = inicio.getHours() + inicio.getMinutes() / 60;
    const k = [c.name, v.modulo, `Aula avulsa ${id}`, v.data, hora].join('|');
    await registra({
      tipo: 'aula',
      id: k,
      acao: 'Aula avulsa criada',
      detalhe: `${topico} · ${v.alunos.length} ${v.alunos.length === 1 ? 'aluno' : 'alunos'}`,
      nome: `${c.name}${v.modulo ? ` · ${v.modulo}` : ''} · ${fmt.data(inicio)} ${v.ini}`,
      autor: u.nome,
    });
    return {
      msg: `Aula criada: ${topico}, ${fmt.data(inicio)} das ${v.ini} às ${v.fim}${prof ? ` com ${prof.name}` : ' (sem professor)'}.`,
      k,
      data: v.data,
    };
  });

  /* 25/09/2026: autoagendamento do aluno nos cursos Open-Entry — o menu do dia e a inscrição numa aula */
  app.get('/agenda/agendar', { preHandler: exigeAgenda }, async (req, rep) => {
    const u = req.usuario!;
    const dia = String((req.query as { data?: string }).data ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return rep.code(400).send({ erro: 'Escolha o dia.' });
    const b = await base();
    const al = u.alunoId != null ? b.alunos.find((x) => x.id === u.alunoId) : undefined;
    if (!al) return rep.code(403).send({ erro: 'Só o aluno agenda as próprias aulas.' });
    return autoAgenda(b, al, dia, agOfertas(b));
  });

  app.post('/agenda/agendar', { preHandler: exigeAgenda }, async (req, rep) => {
    const u = req.usuario!;
    const k = String((req.body as { k?: string })?.k ?? '');
    const b = await base();
    const al = u.alunoId != null ? b.alunos.find((x) => x.id === u.alunoId) : undefined;
    if (!al) return rep.code(403).send({ erro: 'Só o aluno agenda as próprias aulas.' });
    const a = aulaDe(b, k);
    if (!a) return rep.code(404).send({ erro: 'Esta aula não existe mais na agenda.' });
    /* confere de novo pelo mesmo menu (prazo, vaga, choque e crédito) no instante da gravação */
    const g = autoAgenda(b, al, agISO(a.quando), agOfertas(b)).grupos.find(
      (x) => !x.flow && x.aulas.some((y) => y.k === k),
    );
    const slot = g?.aulas.find((y) => y.k === k);
    if (!g || !slot) return rep.code(400).send({ erro: 'Esta aula não está disponível para você agendar.' });
    if (slot.trava) return rep.code(409).send({ erro: `Não dá para agendar: ${slot.trava}.` });
    await gravaAjuste(a.k, (o) => {
      /* quem tinha cancelado a participação volta; senão entra só nesta aula */
      if (o.fora?.[al.name]) delete o.fora[al.name];
      else if (!a.alunos.includes(al.name)) o.extras = [...(o.extras ?? []), al.name];
    });
    await registra({
      tipo: 'aula',
      id: a.k,
      acao: 'Aluno agendou a aula',
      detalhe: al.name,
      nome: aulaRot(a),
      autor: u.nome,
    });
    return {
      msg: `Aula agendada: ${slot.topico}, ${fmt.semana(a.quando)} das ${slot.ini} às ${slot.fim}${slot.prof === 'Professor a definir' ? ' (professor a definir)' : ` com ${slot.prof}`}.`,
      k: a.k,
    };
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
      /* 24/09/2026: Bloquear horário — o professor fica livre, os agendados recebem o crédito de volta e a aula
         some para os alunos; Desbloquear devolve */
      case 'bloquear': {
        if (nv > 3 || passou || (cancelada && !a.bloqueada)) return negado();
        const tira = !!a.bloqueada;
        await gravaAjuste(a.k, (o) => {
          if (tira) delete o.bloqueada;
          else o.bloqueada = true;
        });
        await log(tira ? 'Horário desbloqueado' : 'Horário bloqueado', `${a.n}${a.n === 1 ? ' aluno' : ' alunos'}`);
        return {
          msg: tira
            ? 'Horário desbloqueado: a aula voltou para a agenda.'
            : `Horário bloqueado.${a.n ? ` ${a.n} ${a.n === 1 ? 'aluno recebe' : 'alunos recebem'} o crédito de volta.` : ''} ${a.prof !== '—' ? `${a.prof} fica livre neste horário.` : ''}`.trim(),
        };
      }
      /* Gerenciar alunos › Adicionar: aluno com matrícula ativa no curso entra só nesta aula */
      case 'adicionarAluno': {
        if (nv > 3 || cancelada || passou) return negado();
        const al = b.alunos.find((x) => x.name === d.aluno);
        if (!al?.matriculas.some((e) => !e.desativadoEm && e.curso === a.prod))
          return rep.code(400).send({ erro: `${d.aluno} não tem matrícula ativa em ${a.prod}.` });
        if (a.alunos.includes(d.aluno)) return rep.code(400).send({ erro: `${d.aluno} já está nesta aula.` });
        if (a.n >= a.vagas) return rep.code(400).send({ erro: `A aula está lotada (${a.vagas} vagas).` });
        await gravaAjuste(a.k, (o) => {
          o.extras = [...(o.extras ?? []), d.aluno];
        });
        await log('Aluno incluído na aula', d.aluno);
        return { msg: `${d.aluno} entrou nesta aula.` };
      }
      /* Encerrar disponibilidade na grade: o horário do módulo deixa de gerar aula a partir desta data */
      case 'encerrarGrade': {
        if (nv > 2 || passou || a.avulsa || !a.mod) return negado();
        const hm = agHM(a.quando);
        const c = await prisma.curso.findUnique({ where: { nome: a.prod } });
        const mod = c && (await prisma.modulo.findUnique({ where: { cursoId_nome: { cursoId: c.id, nome: a.mod } } }));
        const hs = mod
          ? await prisma.moduloHorario.findMany({
              where: { moduloId: mod.id, dia: a.quando.getDay(), hora: hm, ate: null },
            })
          : [];
        if (!hs.length)
          return rep.code(400).send({ erro: 'Este horário não está na grade do módulo (Cursos › Módulos).' });
        /* o último dia é a véspera desta aula (coluna @db.Date em UTC) */
        const ate = new Date(Date.UTC(a.quando.getFullYear(), a.quando.getMonth(), a.quando.getDate() - 1));
        await prisma.moduloHorario.updateMany({ where: { id: { in: hs.map((h) => h.id) } }, data: { ate } });
        invalidaBase();
        await registra({
          tipo: 'curso',
          id: String(c!.id),
          nome: a.prod,
          acao: 'Horário encerrado na grade',
          detalhe: `${a.mod} · ${aulaRot(a)} em diante`,
          autor: u.nome,
        });
        return {
          msg: `${a.mod} · ${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][a.quando.getDay()]} ${hm} saiu da grade a partir de ${fmt.data(a.quando)}: esta aula e as seguintes deixam de existir.`,
        };
      }
      /* o próprio aluno cancela a aula dele até o prazo do módulo (ou do curso). Na aula do Community Flow sai da aula
         avulsa (o crédito e a vaga voltam; sem ninguém, a aula deixa de existir); nas outras, fica como cancelado */
      case 'solicitarCancelamento':
      case 'solicitarMudanca': {
        const m = aulaModelo(b, a, p).meuCancelamento;
        if (!u.ehAluno || !m || u.alunoId == null) return negado();
        const cancel = d.acao === 'solicitarCancelamento';
        if (cancel && m.modo !== 'solicitar') return negado();
        if (!cancel && !m.mudanca) return negado();
        if (cancel && !m.pode)
          return rep
            .code(400)
            .send({ erro: `O prazo para pedir o cancelamento terminou em ${m.ate} (cancelar ${m.regra}).` });
        if (cancel && (await pendenteNaAula(u.alunoId, a.k)))
          return rep.code(409).send({ erro: 'Você já pediu o cancelamento desta aula; a equipe vai responder.' });
        await prisma.solicitacaoAluno.create({
          data: {
            alunoId: u.alunoId,
            tipo: cancel ? TIPO_CANCEL : TIPO_MUDANCA,
            curso: a.prod,
            aula: cancel ? a.k : '',
            aulaRot: aulaRot(a),
            pedido: d.acao === 'solicitarMudanca' ? d.pedido : d.motivo,
          },
        });
        await log(
          cancel ? 'Aluno pediu cancelamento' : 'Aluno pediu mudança de dias e horários',
          cancel ? d.motivo : d.pedido,
        );
        return {
          msg: cancel
            ? 'Pedido de cancelamento enviado. Você continua na aula até a equipe pedagógica aprovar.'
            : 'Pedido de mudança enviado. A equipe pedagógica vai ver os novos dias e horários com você.',
        };
      }
      case 'meuCancelamento': {
        const m = aulaModelo(b, a, p).meuCancelamento;
        if (!u.ehAluno || !m) return negado();
        /* curso Regular: o aluno só solicita (30/09/2026) */
        if (m.modo === 'solicitar') return negado();
        if (!m.pode)
          return rep.code(400).send({
            erro: `O prazo para cancelar esta aula terminou em ${m.ate} (cancelar ${m.regra}).`,
          });
        const eu = b.alunos.find((x) => x.id === u.alunoId)!.name;
        const v = m.flow ? avulsaDe(b, a) : null;
        if (v) {
          const resto = v.alunos.filter((x) => x !== eu);
          if (resto.length) await prisma.aulaAvulsa.update({ where: { id: v.id }, data: { alunos: resto } });
          else {
            await prisma.aulaAvulsa.delete({ where: { id: v.id } });
            await prisma.aulaAjuste.deleteMany({ where: { chave: a.k } });
          }
          invalidaBase();
        } else if (ov.extras?.includes(eu)) {
          await gravaAjuste(a.k, (o) => {
            o.extras = (o.extras ?? []).filter((x) => x !== eu);
          });
        } else {
          await gravaAjuste(a.k, (o) => {
            o.fora = { ...(o.fora ?? {}), [eu]: true };
          });
        }
        await log('Aluno cancelou a própria aula', eu);
        return {
          msg: m.flow
            ? 'Aula cancelada. O crédito do Community Flow voltou para você.'
            : 'Aula cancelada. Sua presença não é mais esperada nela.',
        };
      }
      case 'agendamento': {
        if (nv > 3 || cancelada || passou || !a.alunos.includes(d.aluno)) return negado();
        /* incluído só nesta aula: remover tira da lista */
        if (ov.extras?.includes(d.aluno)) {
          await gravaAjuste(a.k, (o) => {
            o.extras = (o.extras ?? []).filter((x) => x !== d.aluno);
          });
          await log('Aluno retirado da aula', d.aluno);
          return { msg: `${d.aluno} saiu desta aula.` };
        }
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
      /* o aluno vê os outros alunos só pelo primeiro nome e não vê os choques de agenda dos outros */
      part: e.part.map((x) => ({
        ...x,
        n: u.ehAluno && x.g === 'aluno' && x.n !== al?.name ? primeiroNome(x.n) : x.n,
        grupo: EV_UM[x.g] ?? x.g,
      })),
      por: e.por,
      choques: u.ehAluno ? [] : evChoques(b, e),
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
    await registra({
      tipo: 'evento',
      id: e.id,
      nome: e.titulo,
      autor: u.nome,
      acao: e.tipo === 'Reunião' ? 'Reunião excluída' : 'Evento excluído',
      detalhe: `${evHora(e.ini)} · ${e.part.length} participantes`,
    });
    /* 24/09/2026: vai para a Lixeira (o Admin restaura em Configurações › Lixeira) */
    const r = await moveParaLixeira(req, rep, 'evento', e.id);
    return r && 'msg' in r ? { msg: `${e.tipo === 'Reunião' ? 'Reunião excluída' : 'Evento excluído'}.` } : r;
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
    if (u.tipoPerfil === 'Prestador' && (req.query as { visao?: string }).visao !== 'aluno') {
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
          const fim = x.quando.getHours() * 60 + x.quando.getMinutes() + (x.duracao || 50);
          return {
            k: x.k,
            data: fmt.semana(x.quando),
            horario: `${agHM(x.quando)}–${String(Math.floor(fim / 60)).padStart(2, '0')}:${String(fim % 60).padStart(2, '0')}`,
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
        const fim = x.quando.getHours() * 60 + x.quando.getMinutes() + (x.duracao || 50);
        const p = fxPresenca(b, al.name, x);
        return {
          k: x.k,
          data: fmt.semana(x.quando),
          horario: `${agHM(x.quando)}–${String(Math.floor(fim / 60)).padStart(2, '0')}:${String(fim % 60).padStart(2, '0')}`,
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
