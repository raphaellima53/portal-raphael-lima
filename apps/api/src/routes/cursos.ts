import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.ts';
import { podeAcao } from '../domain/acesso.ts';
import { crsItens, crsRegras } from '../domain/agenda.ts';
import { base, invalidaBase } from '../domain/base.ts';
import {
  CONFIG_AGENDA,
  CONFIG_PADRAO,
  catalogo,
  curSemMat,
  cursoCurriculo,
  cursoGeral,
  cursoGrade,
  cursoRegras,
} from '../domain/cursos.ts';
import { funcionamento } from '../domain/funcionamento.ts';
import { podeChave } from '../domain/mapa.ts';
import { registra } from '../lib/log.ts';
import type { UsuarioSessao } from '../plugins/sessao.ts';

const ABAS = ['geral', 'regras', 'curriculo', 'grade'] as const;
type Conteudo = {
  titulo: string;
  formato: string;
  gram: string;
  voc: [string, string][];
  links: { pre: string; in: string; post: string };
};
type Versao = [string, string, string, Conteudo[]];

const erro400 = (rep: FastifyReply, e: z.ZodError) => rep.code(400).send({ erro: e.issues[0].message });
const hoje = () => new Date().toLocaleDateString('pt-BR');
const clone = <T>(x: T): T => structuredClone(x);

/** quem edita currículo: Admin e quem tem Acadêmico ou Pedagógico com acesso Total */
export const curPodeEditar = (u: UsuarioSessao) =>
  !u.ehAluno && (u.tipoPerfil === 'Admin' || (['aca', 'ped'] as const).some((k) => u.areas[k]?.acesso === 'total'));

async function exige(req: FastifyRequest, rep: FastifyReply, chaves: string[]) {
  const u = req.usuario;
  if (!u) return rep.code(401).send({ erro: 'Sessão expirada. Entre de novo.' });
  if (!chaves.some((c) => podeChave(u, c))) return rep.code(403).send({ erro: 'Sem acesso a esta tela.' });
}
const exigeCatalogo = (req: FastifyRequest, rep: FastifyReply) => exige(req, rep, ['catalogo']);
const exigeCurriculo = (req: FastifyRequest, rep: FastifyReply) => exige(req, rep, ['curso.curriculo', 'cfg']);

/** regra de agenda em minutos ou horas (guardada em minutos) */
const Tempo = z.object({ valor: z.coerce.number().int().min(0).max(100000), unidade: z.enum(['min', 'h']) });
const minutos = (t: z.infer<typeof Tempo> | null) => (t == null ? null : t.unidade === 'h' ? t.valor * 60 : t.valor);
const DIAS_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const CEFR = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
/** minutos guardados → o que o formulário mostra (horas quando fecha a conta) */
const tempoDe = (m: number | null | undefined) =>
  m == null
    ? null
    : m && m % 60 === 0
      ? { valor: m / 60, unidade: 'h' as const }
      : { valor: m, unidade: 'min' as const };

const CursoForm = z.object({
  nome: z.string().trim().min(1, 'Informe o nome do curso.').max(120),
  descricao: z.string().trim().max(500).default(''),
  idioma: z.string().max(80).default(''),
  tipo: z.string().max(80).default(''),
  estrutura: z.enum(['modulos', 'turmas', 'nenhuma']).default('modulos'),
  cor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida.'),
  itens: z
    .array(
      z.object({
        nome: z.string().trim(),
        cor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        /* adequação ao Portal Alumni: sigla, descrição e vagas do módulo */
        sigla: z.string().trim().max(20).default(''),
        descricao: z.string().trim().max(300).default(''),
        vagas: z.coerce.number().int().min(1).max(500).nullable().default(null),
        /* 24/09/2026 (Novo curso): CEFR do módulo ou da turma; no Open-Entry, regras de agenda e grade */
        cefr: z.string().trim().max(10).default(''),
        agendamento: Tempo.nullable().default(null),
        cancelamento: Tempo.nullable().default(null),
        horarios: z
          .array(
            z.object({
              dia: z.coerce.number().int().min(0).max(6),
              hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário da grade inválido (HH:MM).'),
              /* 24/09/2026: o professor pode ficar para depois; a grade e a agenda avisam o que falta */
              professorId: z.string().default(''),
            }),
          )
          .max(120)
          .default([]),
      }),
    )
    .max(80)
    .default([]),
  /* curso Particular: as alocações (responsável e vagas) */
  alocacoes: z
    .array(
      z.object({
        responsavel: z.string().trim().max(160).default(''),
        vagas: z.coerce.number().int().min(1).max(50).default(1),
      }),
    )
    .max(200)
    .default([]),
  sigla: z.string().trim().max(20).default(''),
  natureza: z.enum(['Curso', 'Serviço', 'Assinatura']).default('Curso'),
  visibilidadeOferta: z.string().trim().max(80).default(''),
  tipoSala: z.string().trim().max(80).default(''),
  autoAgenda: z.boolean().default(false),
  ativo: z.boolean().default(true),
});

const RegrasForm = z.object({
  vagas: z.coerce.number().int().optional(),
  duracao: z.coerce.number().int(),
  modalidades: z.array(z.enum(['Online', 'Presencial'])),
  pacote: z.coerce.number().int(),
  cancelamento: z.coerce.number().int(),
  autoAgenda: z.boolean(),
  exigeDisp: z.boolean().optional(),
  valorAula: z.coerce.number().int(),
  /* adequação ao Portal Alumni: antecedência para marcar (horas) e a configuração da agenda */
  antecedencia: z.coerce.number().int().min(0).max(720).default(0),
  config: z.record(z.string(), z.union([z.string().max(60), z.boolean()])).optional(),
});

const linkOk = (u: string) => {
  if (!u) return true;
  try {
    const p = new URL(u).protocol;
    return p === 'https:' || p === 'http:';
  } catch {
    return false;
  }
};
const MOMENTOS: [keyof Conteudo['links'], string][] = [
  ['pre', 'Pre-class'],
  ['in', 'In-class'],
  ['post', 'Post-class'],
];
const ConteudoForm = z.object({
  titulo: z.string().trim().min(1, 'Dê um título ao conteúdo.').max(200),
  formato: z.enum(['Interativa', 'Simples']).default('Interativa'),
  gram: z.string().trim().max(200).default(''),
  voc: z.string().max(3000).default(''),
  pre: z.string().trim().max(1000).default(''),
  in: z.string().trim().max(1000).default(''),
  post: z.string().trim().max(1000).default(''),
  pos: z.coerce.number().int().min(0).optional(),
});
const vocLer = (s: string): [string, string][] =>
  String(s || '')
    .split(/[;\n]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      const m = t.match(/^(.*?)\s*\((n|v|adj|col|id)\)$/i);
      return m ? [m[1].trim(), m[2].toLowerCase()] : [t, ''];
    });

export default async function rotasCursos(app: FastifyInstance) {
  /* ---------------- catálogo ---------------- */
  app.get('/cursos', { preHandler: exigeCatalogo }, async (req) => ({
    cursos: catalogo(await base()),
    podeCriar: podeAcao(req.usuario!.nivel, 'criar'),
  }));

  /* ---------------- curso ---------------- */
  app.get('/cursos/:id', { preHandler: exigeCatalogo }, async (req, rep) => {
    const u = req.usuario!;
    const b = await base();
    const c = b.cursos.find((x) => x.id === Number((req.params as { id: string }).id));
    if (!c) return rep.code(404).send({ erro: 'Curso não encontrado.' });
    const abas = ABAS.filter((a) => podeChave(u, `curso.${a}`));
    if (!abas.length) return rep.code(403).send({ erro: 'Sem acesso a este curso.' });
    const pedida = String((req.query as { aba?: string }).aba ?? '');
    const aba = (abas as readonly string[]).includes(pedida) ? (pedida as (typeof ABAS)[number]) : abas[0];
    const curs = await prisma.curriculo.findMany({ where: { grupo: c.name }, orderBy: { ordem: 'asc' } });
    const tipos = await prisma.catalogo.findMany({
      where: { tipo: { in: ['courseTypes', 'languages', 'visibilidadesOferta', 'roomTypes'] } },
      orderBy: { ordem: 'asc' },
    });
    const dados =
      aba === 'geral'
        ? cursoGeral(b, c, curs)
        : aba === 'regras'
          ? cursoRegras(b, c)
          : aba === 'curriculo'
            ? cursoCurriculo(c, curs as never)
            : cursoGrade(b, c);
    return {
      id: c.id,
      nome: c.name,
      cor: c.color,
      sub: [c.descricao, [c.idioma, c.tipo].filter((x) => x && x !== '—').join(' · ')].filter(Boolean).join(' — '),
      abas,
      aba,
      dados,
      form: {
        nome: c.name,
        descricao: c.descricao,
        idioma: c.idioma,
        tipo: c.tipo,
        estrutura: c.estrutura,
        cor: c.color,
        itens: crsItens(c).map((n) => ({
          nome: n,
          cor: c.cores[n] || b.corModulo[n] || c.color,
          sigla: c.modInfo[n]?.sigla ?? '',
          descricao: c.modInfo[n]?.descricao ?? '',
          vagas:
            c.estrutura === 'turmas'
              ? (c.turmas.find((t) => t.name === n)?.vagas ?? null)
              : (c.modInfo[n]?.vagas ?? null),
          cefr:
            c.estrutura === 'turmas' ? (c.turmas.find((t) => t.name === n)?.cefr ?? '') : (c.modInfo[n]?.cefr ?? ''),
          agendamento: tempoDe(c.modInfo[n]?.agendamentoMin),
          cancelamento: tempoDe(c.modInfo[n]?.cancelamentoMin),
          horarios: (c.modInfo[n]?.horarios ?? []).map((h) => ({
            dia: h.dia,
            hora: h.hora,
            professorId: h.professorId ?? '',
          })),
        })),
        alocacoes: c.alocacoes,
        autoAgenda: c.autoAgenda,
        ativo: c.active,
        sigla: c.sigla,
        natureza: c.natureza,
        visibilidadeOferta: c.visibilidadeOferta,
        tipoSala: c.tipoSala,
      },
      opcoes: {
        idiomas: tipos.filter((t) => t.tipo === 'languages').map((t) => t.nome),
        tipos: tipos.filter((t) => t.tipo === 'courseTypes').map((t) => t.nome),
        visibilidades: tipos.filter((t) => t.tipo === 'visibilidadesOferta').map((t) => t.nome),
        tiposSala: tipos.filter((t) => t.tipo === 'roomTypes').map((t) => t.nome),
        cefr: CEFR,
        funcionamento: await funcionamento(),
        professores: (await prisma.professor.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } })).map(
          (p) => ({ v: p.id, l: p.nome }),
        ),
      },
      pode: {
        agenda: podeChave(u, 'agenda'),
        editar: podeAcao(u.nivel, 'editar'),
        criar: podeAcao(u.nivel, 'criar'),
        curriculo: curPodeEditar(u),
      },
    };
  });

  app.get('/cursos-opcoes', { preHandler: exigeCatalogo }, async () => {
    const tipos = await prisma.catalogo.findMany({
      where: { tipo: { in: ['courseTypes', 'languages', 'visibilidadesOferta', 'roomTypes'] } },
      orderBy: { ordem: 'asc' },
    });
    return {
      idiomas: tipos.filter((t) => t.tipo === 'languages').map((t) => t.nome),
      tipos: tipos.filter((t) => t.tipo === 'courseTypes').map((t) => t.nome),
      visibilidades: tipos.filter((t) => t.tipo === 'visibilidadesOferta').map((t) => t.nome),
      tiposSala: tipos.filter((t) => t.tipo === 'roomTypes').map((t) => t.nome),
      cefr: CEFR,
      funcionamento: await funcionamento(),
      professores: (await prisma.professor.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } })).map((p) => ({
        v: p.id,
        l: p.nome,
      })),
    };
  });

  /** Novo curso e Editar curso: a estrutura diz se o curso se divide em módulos, em turmas ou em nada */
  const salvaCurso = async (req: FastifyRequest, rep: FastifyReply, id: number | null) => {
    const u = req.usuario!;
    if (!podeAcao(u.nivel, id == null ? 'criar' : 'editar'))
      return rep.code(403).send({ erro: 'Seu acesso não permite esta ação.' });
    const r = CursoForm.safeParse(req.body);
    if (!r.success) return erro400(rep, r.error);
    const v = r.data;
    const antigo =
      id == null ? null : await prisma.curso.findUnique({ where: { id }, include: { turmas: true, modulos: true } });
    if (id != null && !antigo) return rep.code(404).send({ erro: 'Curso não encontrado.' });
    const outro = await prisma.curso.findFirst({
      where: { nome: { equals: v.nome, mode: 'insensitive' }, NOT: id == null ? undefined : { id } },
    });
    if (outro) return rep.code(400).send({ erro: 'Já existe um curso com esse nome.' });
    const itens = v.itens.filter((x) => x.nome);
    if (new Set(itens.map((x) => x.nome.toLowerCase())).size !== itens.length)
      return rep.code(400).send({ erro: 'Há módulos ou turmas com o mesmo nome.' });
    const estrutura = itens.length ? (v.estrutura === 'nenhuma' ? 'modulos' : v.estrutura) : 'nenhuma';
    /* obrigatórios do Novo curso (24/09/2026) */
    if (!v.idioma) return rep.code(400).send({ erro: 'Escolha o idioma do curso.' });
    for (const m of itens) {
      if (!CEFR.includes(m.cefr)) return rep.code(400).send({ erro: `Escolha o CEFR de ${m.nome}.` });
      if (!m.vagas) return rep.code(400).send({ erro: `Informe as vagas de ${m.nome}.` });
      if (estrutura === 'modulos' && (!m.agendamento || !m.cancelamento))
        return rep.code(400).send({ erro: `Informe as regras de agendamento e cancelamento de ${m.nome}.` });
    }
    /* grade do Open-Entry (24/09/2026): só dentro do funcionamento, uma aula por hora no módulo e o professor
       em um módulo só na mesma hora */
    if (estrutura === 'modulos') {
      const fn = await funcionamento();
      const ocupado = new Map<string, string>();
      for (const m of itens) {
        const vistos = new Set<string>();
        for (const h of m.horarios) {
          const d = fn.find((x) => x.dia === h.dia);
          if (!d?.aberto || h.hora < d.inicio || h.hora >= d.fim)
            return rep.code(400).send({
              erro: `${m.nome}: ${DIAS_CURTO[h.dia]} ${h.hora} está fora do horário de funcionamento.`,
            });
          const k = `${h.dia}|${h.hora}`;
          if (vistos.has(k))
            return rep
              .code(400)
              .send({ erro: `${m.nome}: ${DIAS_CURTO[h.dia]} ${h.hora} aparece duas vezes na grade.` });
          vistos.add(k);
          if (!h.professorId) continue;
          const kp = `${k}|${h.professorId}`;
          const outroMod = ocupado.get(kp);
          if (outroMod)
            return rep.code(400).send({
              erro: `O mesmo professor está em ${outroMod} e ${m.nome} na ${DIAS_CURTO[h.dia]} às ${h.hora}.`,
            });
          ocupado.set(kp, m.nome);
        }
      }
    }
    const alocacoes = estrutura === 'nenhuma' ? v.alocacoes.filter((x) => x.responsavel || x.vagas) : [];
    const tipo = await prisma.catalogo.findFirst({ where: { tipo: 'courseTypes', nome: v.tipo } });
    const formato = (tipo?.dados as { format?: string } | null)?.format ?? '—';
    const dados = {
      nome: v.nome,
      descricao: v.descricao,
      idioma: v.idioma || '—',
      tipo: v.tipo || '—',
      formato,
      estrutura,
      cor: v.cor,
      autoAgenda: v.autoAgenda,
      ativo: v.ativo,
      sigla: v.sigla,
      natureza: v.natureza,
      visibilidadeOferta: v.visibilidadeOferta,
      tipoSala: v.tipoSala,
    };

    const salvo = await prisma.$transaction(async (tx) => {
      const regrasPadrao = crsRegras({ estrutura, idioma: dados.idioma } as never);
      const curso = antigo
        ? await tx.curso.update({ where: { id: antigo.id }, data: dados })
        : await tx.curso.create({
            data: {
              ...dados,
              regras: { ...regrasPadrao },
              ordem: ((await tx.curso.aggregate({ _max: { ordem: true } }))._max.ordem ?? -1) + 1,
            },
          });
      /* módulos: o que continua mantém o id (e a grade é regravada); o que saiu da lista é apagado */
      const mods = estrutura === 'modulos' ? itens : [];
      await tx.modulo.deleteMany({ where: { cursoId: curso.id, nome: { notIn: mods.map((m) => m.nome) } } });
      for (const [k, m] of mods.entries()) {
        const dadosMod = {
          cor: m.cor,
          sigla: m.sigla,
          descricao: m.descricao,
          vagas: m.vagas,
          ordem: k,
          cefr: m.cefr,
          agendamentoMin: minutos(m.agendamento),
          cancelamentoMin: minutos(m.cancelamento),
        };
        const mod = await tx.modulo.upsert({
          where: { cursoId_nome: { cursoId: curso.id, nome: m.nome } },
          update: dadosMod,
          create: { cursoId: curso.id, nome: m.nome, ...dadosMod },
        });
        await tx.moduloHorario.deleteMany({ where: { moduloId: mod.id } });
        if (m.horarios.length)
          await tx.moduloHorario.createMany({
            data: m.horarios.map((h) => ({ moduloId: mod.id, ...h, professorId: h.professorId || null })),
          });
      }
      await tx.cursoAlocacao.deleteMany({ where: { cursoId: curso.id } });
      if (alocacoes.length)
        await tx.cursoAlocacao.createMany({
          data: alocacoes.map((x, k) => ({
            cursoId: curso.id,
            responsavel: x.responsavel || `Aluno ${k + 1}`,
            vagas: x.vagas,
            ordem: k,
          })),
        });
      /* turma que já existia mantém grade, professor e vagas; a nova entra em branco */
      const ts = estrutura === 'turmas' ? itens : [];
      const nomes = ts.map((x) => x.nome);
      await tx.turma.deleteMany({ where: { cursoId: curso.id, nome: { notIn: nomes } } });
      for (const [k, it] of ts.entries()) {
        const nome = it.nome;
        const t = antigo?.turmas.find((x) => x.nome === nome);
        const extra = { cor: it.cor, cefr: it.cefr, descricao: it.descricao };
        if (t)
          await tx.turma.update({
            where: { id: t.id },
            data: { ordem: k, ...extra, ...(it.vagas ? { vagas: it.vagas } : {}) },
          });
        else
          await tx.turma.create({
            data: {
              cursoId: curso.id,
              nome,
              ...extra,
              grupo: '—',
              grade: '—',
              vagas: it.vagas ?? 20,
              ocupadas: 0,
              sala: '—',
              modalidade: 'Presencial',
              periodo: '—',
              curriculo: '—',
              ordem: k,
            },
          });
      }
      /* renomear leva junto a habilitação dos professores e os currículos do curso */
      if (antigo && antigo.nome !== v.nome) {
        const profs = await tx.professor.findMany({ where: { cursos: { has: antigo.nome } } });
        for (const p of profs) {
          const habil = (p.habilitacao as Record<string, string[]> | null) ?? null;
          if (habil?.[antigo.nome]) {
            habil[v.nome] = habil[antigo.nome];
            delete habil[antigo.nome];
          }
          await tx.professor.update({
            where: { id: p.id },
            data: { cursos: p.cursos.map((x) => (x === antigo.nome ? v.nome : x)), habilitacao: habil ?? undefined },
          });
        }
        await tx.curriculo.updateMany({ where: { grupo: antigo.nome }, data: { grupo: v.nome } });
      }
      return curso;
    });
    invalidaBase();
    const semProf = estrutura === 'modulos' ? itens.flatMap((m) => m.horarios).filter((h) => !h.professorId).length : 0;
    const aviso = semProf
      ? ` Atenção: ${semProf} ${semProf === 1 ? 'horário da grade está' : 'horários da grade estão'} sem professor; as aulas aparecem na Agenda como sem professor.`
      : '';
    return {
      id: salvo.id,
      msg: (antigo ? 'Curso salvo.' : 'Curso criado. Confira as regras dele.') + aviso,
      semProfessor: semProf,
    };
  };
  app.post('/cursos', { preHandler: exigeCatalogo }, (req, rep) => salvaCurso(req, rep, null));
  app.put('/cursos/:id', { preHandler: exigeCatalogo }, (req, rep) =>
    salvaCurso(req, rep, Number((req.params as { id: string }).id)),
  );

  app.put('/cursos/:id/regras', { preHandler: (req, rep) => exige(req, rep, ['curso.regras']) }, async (req, rep) => {
    const u = req.usuario!;
    if (!podeAcao(u.nivel, 'editar')) return rep.code(403).send({ erro: 'Seu acesso não permite editar as regras.' });
    const r = RegrasForm.safeParse(req.body);
    if (!r.success) return erro400(rep, r.error);
    const c = await prisma.curso.findUnique({ where: { id: Number((req.params as { id: string }).id) } });
    if (!c) return rep.code(404).send({ erro: 'Curso não encontrado.' });
    const d = r.data;
    const rg = { ...(c.regras as Record<string, unknown>) };
    if (c.estrutura === 'modulos' && d.vagas != null) rg.vagas = Math.max(1, d.vagas);
    rg.duracao = Math.max(15, d.duracao || 15);
    rg.pacote = Math.max(1, d.pacote || 1);
    rg.cancelamento = Math.max(0, d.cancelamento || 0);
    rg.modalidades = d.modalidades.length ? d.modalidades : ['Online'];
    if (c.estrutura !== 'turmas' && d.exigeDisp != null) rg.exigeDisp = d.exigeDisp;
    rg.valorAula = Math.max(1, d.valorAula || 1);
    rg.antecedencia = d.antecedencia;
    /* só as chaves conhecidas, e escolha só entre as opções */
    const config = d.config
      ? Object.fromEntries(
          CONFIG_AGENDA.map((x) => {
            const v = d.config![x.k];
            return [x.k, x.opcoes ? (x.opcoes.includes(String(v)) ? String(v) : CONFIG_PADRAO[x.k]) : v === true];
          }),
        )
      : undefined;
    await prisma.curso.update({
      where: { id: c.id },
      data: { regras: rg as never, autoAgenda: d.autoAgenda, ...(config ? { configAgenda: config } : {}) },
    });
    invalidaBase();
    return { msg: `Regras de ${c.nome} salvas. A agenda, a grade e as fichas já usam os valores novos.` };
  });

  /* ---------------- currículos ---------------- */
  const curPor = (id: string) => prisma.curriculo.findUnique({ where: { id } });
  const pubDe = (vs: Versao[]) => vs.filter((v) => v[1] === 'Publicada').pop() ?? null;
  const rascDe = (vs: Versao[]) => {
    const x = vs[vs.length - 1];
    return x && x[1] === 'Rascunho' ? x : null;
  };
  const log = (u: UsuarioSessao, c: { id: string; nome: string }, acao: string, detalhe = '') =>
    registra({ tipo: 'curriculo', id: c.id, nome: c.nome, acao, detalhe, autor: u.nome });

  app.get('/curriculos/:id', { preHandler: exigeCurriculo }, async (req, rep) => {
    const u = req.usuario!;
    const c = await curPor((req.params as { id: string }).id);
    if (!c) return rep.code(404).send({ erro: 'Currículo não encontrado.' });
    const b = await base();
    const vs = c.versoes as Versao[];
    const pub = pubDe(vs);
    const curso = b.cursos.find((x) => x.name === c.grupo);
    const ed = curPodeEditar(u);
    return {
      id: c.id,
      nome: c.nome,
      grupo: c.grupo,
      tipo: c.tipo,
      idioma: c.idioma,
      aplicado: c.aplicado,
      cor: b.corCurso[c.grupo] ?? null,
      versoes: vs.map((v, k) => ({
        k,
        nome: v[0],
        situacao: v === pub ? 'Publicada' : v[1] === 'Publicada' ? 'Substituída' : v[1],
        data: v[2],
        conteudos: v[3] ?? [],
        ehPublicada: v === pub,
        ehRascunho: v === rascDe(vs),
      })),
      proxima: `v${vs.length + 1}`,
      curso: curso ? { id: curso.id, estrutura: curso.estrutura, itens: crsItens(curso) } : null,
      pode: { editar: ed, editarItens: ed && podeAcao(u.nivel, 'editar'), excluir: ed && podeAcao(u.nivel, 'excluir') },
    };
  });

  /** opções do formulário Novo currículo (de um curso ou acervo) */
  app.get('/curriculos-form', { preHandler: exigeCurriculo }, async (req) => {
    const grupo = String((req.query as { grupo?: string }).grupo ?? '');
    const id = String((req.query as { id?: string }).id ?? '');
    const b = await base();
    const todos = await prisma.curriculo.findMany({
      orderBy: { ordem: 'asc' },
      select: { id: true, nome: true, grupo: true, tipo: true, aplicado: true, categoria: true },
    });
    const c = id ? todos.find((x) => x.id === id) : null;
    const g = c ? c.grupo : grupo;
    const curso = b.cursos.find((x) => x.name === g);
    const prod = c ? c.tipo === 'produto' : !!curso;
    return {
      curso: curso
        ? { nome: curso.name, estrutura: curso.estrutura, itens: curso.estrutura !== 'nenhuma' ? crsItens(curso) : [] }
        : null,
      copiar: todos
        .filter((x) => x.grupo === g || (!prod && x.tipo === 'acervo'))
        .map((x) => ({ id: x.id, nome: x.nome })),
      acervos: [...new Set(todos.filter((x) => x.tipo === 'acervo').map((x) => x.grupo))],
      atual: c ? { nome: c.nome, aplicado: c.aplicado, categoria: c.categoria } : null,
      /* adequação ao Portal Alumni: catálogo Categorias de currículo */
      categorias: (
        await prisma.catalogo.findMany({
          where: { tipo: 'categoriasCurriculo', ativo: true },
          orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
        })
      ).map((x) => x.nome),
    };
  });

  const CurForm = z.object({
    nome: z.string().trim().max(200),
    aplicado: z.array(z.string()).optional(),
    grupo: z.string().optional(),
    grupoNovo: z.string().trim().max(120).optional(),
    idioma: z.enum(['Inglês', 'Espanhol']).optional(),
    copia: z.string().optional(),
    curso: z.string().optional(),
    categoria: z.string().trim().max(80).optional(),
  });

  const aplicaEm = async (alvo: { id: string; grupo: string }, ap: string[] | undefined) => {
    const movidos: string[] = [];
    if (!ap) return movidos;
    const outros = await prisma.curriculo.findMany({ where: { grupo: alvo.grupo, NOT: { id: alvo.id } } });
    for (const x of outros) {
      const tira = x.aplicado.filter((i) => ap.includes(i));
      if (!tira.length) continue;
      await prisma.curriculo.update({
        where: { id: x.id },
        data: { aplicado: x.aplicado.filter((i) => !ap.includes(i)) },
      });
      movidos.push(`${tira.join(', ')} saiu de ${x.nome}`);
    }
    await prisma.curriculo.update({ where: { id: alvo.id }, data: { aplicado: ap } });
    return movidos;
  };

  app.post('/curriculos', { preHandler: exigeCurriculo }, async (req, rep) => {
    const u = req.usuario!;
    if (!curPodeEditar(u))
      return rep
        .code(403)
        .send({ erro: 'Só Admin e quem tem Acadêmico ou Pedagógico com acesso Total edita o currículo.' });
    const r = CurForm.safeParse(req.body);
    if (!r.success) return erro400(rep, r.error);
    const v = r.data;
    if (!v.nome || /·\s*$/.test(v.nome)) return rep.code(400).send({ erro: 'Dê um nome ao currículo.' });
    if (await prisma.curriculo.findFirst({ where: { nome: { equals: v.nome, mode: 'insensitive' } } }))
      return rep.code(400).send({ erro: 'Já existe um currículo com esse nome.' });
    const b = await base();
    const curso = v.curso ? b.cursos.find((x) => x.name === v.curso) : undefined;
    let grupo = v.curso ?? '';
    let tipo = 'produto';
    let idioma = curso?.idioma ?? 'Inglês';
    if (!curso) {
      tipo = 'acervo';
      grupo = v.grupo === '__novo' || !v.grupo ? (v.grupoNovo ?? '') : v.grupo;
      idioma = v.idioma ?? 'Inglês';
      if (!grupo) return rep.code(400).send({ erro: 'Escolha o acervo ou dê nome ao novo.' });
    }
    const baseCopia = v.copia ? await curPor(v.copia) : null;
    const ids = await prisma.curriculo.findMany({ select: { id: true } });
    const id = `cur${Math.max(0, ...ids.map((x) => Number(x.id.replace('cur', '')) || 0)) + 1}`;
    const ordem = ((await prisma.curriculo.aggregate({ _max: { ordem: true } }))._max.ordem ?? -1) + 1;
    const conteudosCopia = baseCopia ? clone(baseCopia.conteudos as Conteudo[]) : [];
    const novo = await prisma.curriculo.create({
      data: {
        id,
        nome: v.nome,
        grupo,
        tipo,
        idioma,
        ordem,
        categoria: v.categoria ?? '',
        aplicado: curso?.estrutura === 'nenhuma' ? ['cada contrato particular'] : [],
        versoes: [['v1', 'Rascunho', '—', conteudosCopia]] as never,
        conteudos: [],
      },
    });
    const movidos = await aplicaEm(novo, v.aplicado);
    await log(u, novo, 'Currículo criado', `${baseCopia ? `cópia de ${baseCopia.nome}` : 'vazio'} · ${grupo}`);
    invalidaBase();
    return {
      id,
      msg: `Currículo criado como v1 em rascunho${baseCopia ? ` com os ${conteudosCopia.length} conteúdos de ${baseCopia.nome}` : ''}. Publique quando estiver pronto.${movidos.length ? ` ${movidos.join('; ')}.` : ''}`,
    };
  });

  app.put('/curriculos/:id', { preHandler: exigeCurriculo }, async (req, rep) => {
    const u = req.usuario!;
    if (!curPodeEditar(u) || !podeAcao(u.nivel, 'editar'))
      return rep.code(403).send({ erro: 'Seu acesso não permite editar o currículo.' });
    const c = await curPor((req.params as { id: string }).id);
    if (!c) return rep.code(404).send({ erro: 'Currículo não encontrado.' });
    const r = CurForm.safeParse(req.body);
    if (!r.success) return erro400(rep, r.error);
    const v = r.data;
    if (!v.nome || /·\s*$/.test(v.nome)) return rep.code(400).send({ erro: 'Dê um nome ao currículo.' });
    if (
      await prisma.curriculo.findFirst({ where: { nome: { equals: v.nome, mode: 'insensitive' }, NOT: { id: c.id } } })
    )
      return rep.code(400).send({ erro: 'Já existe um currículo com esse nome.' });
    await prisma.curriculo.update({
      where: { id: c.id },
      data: { nome: v.nome, ...(v.categoria != null ? { categoria: v.categoria } : {}) },
    });
    const movidos = await aplicaEm(c, v.aplicado);
    const ap = v.aplicado ?? c.aplicado;
    await log(
      u,
      { id: c.id, nome: v.nome },
      'Currículo editado',
      `${c.nome !== v.nome ? `${c.nome} → ${v.nome} · ` : ''}aplicado em ${ap.join(', ') || 'nada'}`,
    );
    invalidaBase();
    return { msg: `Currículo salvo.${movidos.length ? ` ${movidos.join('; ')}.` : ''}` };
  });

  app.post('/curriculos/:id/duplicar', { preHandler: exigeCurriculo }, async (req, rep) => {
    const u = req.usuario!;
    if (!curPodeEditar(u)) return rep.code(403).send({ erro: 'Sem permissão.' });
    const c = await curPor((req.params as { id: string }).id);
    if (!c) return rep.code(404).send({ erro: 'Currículo não encontrado.' });
    const vs = c.versoes as Versao[];
    const src = rascDe(vs)?.[3] ?? (c.conteudos as Conteudo[]);
    let nome = `${c.nome} (cópia)`;
    let n = 2;
    while (await prisma.curriculo.findFirst({ where: { nome } })) nome = `${c.nome} (cópia ${n++})`;
    const ids = await prisma.curriculo.findMany({ select: { id: true } });
    const id = `cur${Math.max(0, ...ids.map((x) => Number(x.id.replace('cur', '')) || 0)) + 1}`;
    const ordem = ((await prisma.curriculo.aggregate({ _max: { ordem: true } }))._max.ordem ?? -1) + 1;
    await prisma.curriculo.create({
      data: {
        id,
        nome,
        grupo: c.grupo,
        tipo: c.tipo,
        idioma: c.idioma,
        aplicado: [],
        ordem,
        versoes: [['v1', 'Rascunho', '—', clone(src)]] as never,
        conteudos: [],
      },
    });
    await log(u, { id, nome }, 'Currículo criado', `cópia de ${c.nome}`);
    invalidaBase();
    return {
      id,
      msg: `Cópia criada como v1 em rascunho, sem aplicar em nenhum ${c.tipo === 'produto' ? 'módulo ou turma' : 'lugar'}. Use Editar currículo para aplicar.`,
    };
  });

  app.delete('/curriculos/:id', { preHandler: exigeCurriculo }, async (req, rep) => {
    const u = req.usuario!;
    if (!curPodeEditar(u) || !podeAcao(u.nivel, 'excluir'))
      return rep.code(403).send({ erro: 'Seu acesso não permite excluir o currículo.' });
    const c = await curPor((req.params as { id: string }).id);
    if (!c) return rep.code(404).send({ erro: 'Currículo não encontrado.' });
    await prisma.curriculo.delete({ where: { id: c.id } });
    await log(u, c, 'Currículo excluído', c.grupo);
    invalidaBase();
    return { msg: `Currículo ${c.nome} excluído.`, grupo: c.grupo };
  });

  /** toda edição cai no rascunho — se não houver, abre a próxima versão copiada da publicada */
  const noRascunho = async (
    req: FastifyRequest,
    rep: FastifyReply,
    muda: (l: Conteudo[], c: { nome: string }) => string | { erro: string } | { msg: string; log: [string, string] },
  ) => {
    const u = req.usuario!;
    if (!curPodeEditar(u))
      return rep
        .code(403)
        .send({ erro: 'Só Admin e quem tem Acadêmico ou Pedagógico com acesso Total edita o currículo.' });
    const c = await curPor((req.params as { id: string }).id);
    if (!c) return rep.code(404).send({ erro: 'Currículo não encontrado.' });
    const vs = clone(c.versoes as Versao[]);
    let r = rascDe(vs);
    let aviso = '';
    if (!r) {
      r = [`v${vs.length + 1}`, 'Rascunho', '—', clone(c.conteudos as Conteudo[])];
      vs.push(r);
      aviso = `As mudanças foram para a ${r[0]} em rascunho. As aulas continuam lendo a ${pubDe(vs)?.[0] ?? '—'} até você publicar.`;
      await log(u, c, 'Rascunho aberto', r[0]);
    }
    const res = muda(r[3], c);
    if (typeof res === 'object' && 'erro' in res) return rep.code(400).send({ erro: res.erro });
    await prisma.curriculo.update({ where: { id: c.id }, data: { versoes: vs as never } });
    if (typeof res === 'object' && 'log' in res) await log(u, c, res.log[0], res.log[1]);
    return { versao: vs.indexOf(r), msg: aviso || (typeof res === 'string' ? res : res.msg) };
  };

  app.post('/curriculos/:id/versao', { preHandler: exigeCurriculo }, (req, rep) => noRascunho(req, rep, () => ''));

  app.post('/curriculos/:id/conteudos', { preHandler: exigeCurriculo }, async (req, rep) => {
    const p = ConteudoForm.safeParse(req.body);
    if (!p.success) return erro400(rep, p.error);
    const v = p.data;
    for (const [m, rot] of MOMENTOS)
      if (!linkOk(v[m]))
        return rep
          .code(400)
          .send({ erro: `O link de ${rot} precisa ser um endereço completo, começando com https://.` });
    return noRascunho(req, rep, (l) => {
      const novo: Conteudo = {
        titulo: v.titulo,
        formato: v.formato,
        gram: v.gram,
        voc: vocLer(v.voc),
        links: { pre: v.pre, in: v.in, post: v.post },
      };
      const pos = v.pos == null ? l.length : Math.min(v.pos, l.length);
      l.splice(pos, 0, novo);
      return { msg: '', log: ['Conteúdo criado', `${novo.titulo} · posição ${pos + 1}`] };
    });
  });

  app.put('/curriculos/:id/conteudos/:k', { preHandler: exigeCurriculo }, async (req, rep) => {
    if (!podeAcao(req.usuario!.nivel, 'editar'))
      return rep.code(403).send({ erro: 'Seu acesso não permite editar conteúdo.' });
    const k = Number((req.params as { k: string }).k);
    const p = ConteudoForm.safeParse(req.body);
    if (!p.success) return erro400(rep, p.error);
    const v = p.data;
    for (const [m, rot] of MOMENTOS)
      if (!linkOk(v[m]))
        return rep
          .code(400)
          .send({ erro: `O link de ${rot} precisa ser um endereço completo, começando com https://.` });
    return noRascunho(req, rep, (l) => {
      if (!l[k]) return { erro: 'Conteúdo não encontrado.' };
      Object.assign(l[k], {
        titulo: v.titulo,
        formato: v.formato,
        gram: v.gram,
        voc: vocLer(v.voc),
        links: { pre: v.pre, in: v.in, post: v.post },
      });
      return { msg: '', log: ['Conteúdo editado', v.titulo] };
    });
  });

  const Links = z.object({
    pre: z.string().trim().default(''),
    in: z.string().trim().default(''),
    post: z.string().trim().default(''),
  });
  app.put('/curriculos/:id/conteudos/:k/links', { preHandler: exigeCurriculo }, async (req, rep) => {
    if (!podeAcao(req.usuario!.nivel, 'editar'))
      return rep.code(403).send({ erro: 'Seu acesso não permite editar links.' });
    const k = Number((req.params as { k: string }).k);
    const p = Links.safeParse(req.body);
    if (!p.success) return erro400(rep, p.error);
    for (const [m, rot] of MOMENTOS)
      if (!linkOk(p.data[m]))
        return rep
          .code(400)
          .send({ erro: `O link de ${rot} precisa ser um endereço completo, começando com https://.` });
    return noRascunho(req, rep, (l) => {
      if (!l[k]) return { erro: 'Conteúdo não encontrado.' };
      l[k].links = p.data;
      return { msg: '', log: ['Links editados', l[k].titulo] };
    });
  });

  app.post('/curriculos/:id/conteudos/:k/mover', { preHandler: exigeCurriculo }, async (req, rep) => {
    const k = Number((req.params as { k: string }).k);
    const d = Number((req.body as { d?: number })?.d) === -1 ? -1 : 1;
    return noRascunho(req, rep, (l) => {
      const j = k + d;
      if (!l[k] || j < 0 || j >= l.length) return { erro: 'Não dá para mover este conteúdo.' };
      [l[k], l[j]] = [l[j], l[k]];
      return { msg: '', log: ['Conteúdo reordenado', `${l[j].titulo} → posição ${j + 1}`] };
    });
  });

  app.post('/curriculos/:id/conteudos/:k/duplicar', { preHandler: exigeCurriculo }, async (req, rep) => {
    const k = Number((req.params as { k: string }).k);
    return noRascunho(req, rep, (l) => {
      if (!l[k]) return { erro: 'Conteúdo não encontrado.' };
      const x = clone(l[k]);
      x.titulo += ' (cópia)';
      l.splice(k + 1, 0, x);
      return { msg: '', log: ['Conteúdo duplicado', x.titulo] };
    });
  });

  app.delete('/curriculos/:id/conteudos/:k', { preHandler: exigeCurriculo }, async (req, rep) => {
    const k = Number((req.params as { k: string }).k);
    return noRascunho(req, rep, (l) => {
      const x = l.splice(k, 1)[0];
      if (!x) return { erro: 'Conteúdo não encontrado.' };
      return { msg: '', log: ['Conteúdo removido', x.titulo] };
    });
  });

  app.post('/curriculos/:id/publicar', { preHandler: exigeCurriculo }, async (req, rep) => {
    const u = req.usuario!;
    if (!curPodeEditar(u)) return rep.code(403).send({ erro: 'Sem permissão.' });
    const c = await curPor((req.params as { id: string }).id);
    if (!c) return rep.code(404).send({ erro: 'Currículo não encontrado.' });
    const vs = clone(c.versoes as Versao[]);
    const r = rascDe(vs);
    if (!r) return rep.code(400).send({ erro: 'Não há rascunho para publicar.' });
    if (!r[3].length)
      return rep.code(400).send({ erro: 'Um currículo precisa de pelo menos um conteúdo para ser publicado.' });
    const antes = pubDe(vs);
    r[1] = 'Publicada';
    r[2] = hoje();
    await prisma.curriculo.update({ where: { id: c.id }, data: { versoes: vs as never, conteudos: r[3] as never } });
    await log(u, c, 'Versão publicada', `${r[0]} · ${r[3].length} conteúdos`);
    invalidaBase();
    return {
      versao: vs.indexOf(r),
      msg: `${r[0]} publicada. As aulas geradas a partir de agora leem os ${r[3].length} conteúdos dela${antes ? `; a ${antes[0]} fica no histórico` : ''}.`,
    };
  });

  app.post('/curriculos/:id/descartar', { preHandler: exigeCurriculo }, async (req, rep) => {
    const u = req.usuario!;
    if (!curPodeEditar(u)) return rep.code(403).send({ erro: 'Sem permissão.' });
    const c = await curPor((req.params as { id: string }).id);
    if (!c) return rep.code(404).send({ erro: 'Currículo não encontrado.' });
    const vs = clone(c.versoes as Versao[]);
    const r = rascDe(vs);
    const pub = pubDe(vs);
    if (!r || !pub) return rep.code(400).send({ erro: 'Não há rascunho para descartar.' });
    vs.splice(vs.indexOf(r), 1);
    await prisma.curriculo.update({ where: { id: c.id }, data: { versoes: vs as never } });
    await log(u, c, 'Rascunho descartado', r[0]);
    return {
      versao: vs.length - 1,
      msg: `Rascunho ${r[0]} descartado. O currículo volta a mostrar a ${pub[0]} publicada.`,
    };
  });
}

export { curSemMat };
