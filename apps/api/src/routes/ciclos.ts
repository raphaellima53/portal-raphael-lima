/**
 * Produtos e serviços › Materiais › Ciclos de aprendizagem (02/10/2026): lista, opções (cursos com módulos ou
 * turmas, dias de aula e currículo), prévia das datas e gravar o ciclo com as datas validadas na tela.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.ts';
import { podeAcao } from '../domain/acesso.ts';
import { agOfertas, crsItens, DN } from '../domain/agenda.ts';
import { base, invalidaBase } from '../domain/base.ts';
import { type CicloDef, curriculoDoItem, diasDoItem, geraDatas } from '../domain/ciclos.ts';
import { podeChave } from '../domain/mapa.ts';
import { fmt } from '../lib/fmt.ts';
import { registra } from '../lib/log.ts';

async function exigeCiclos(req: FastifyRequest, rep: FastifyReply) {
  const u = req.usuario;
  if (!u) return rep.code(401).send({ erro: 'Sessão expirada. Entre de novo.' });
  if (u.ehAluno || !podeChave(u, 'curso.curriculo')) return rep.code(403).send({ erro: 'Sem acesso a esta tela.' });
}

const ISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.');
const DefIn = z
  .object({
    cursoId: z.coerce.number().int({ message: 'Escolha o curso.' }),
    item: z.string().trim().min(1, 'Escolha o módulo ou a turma.'),
    inicio: ISO,
    modo: z.enum(['periodo', 'quantidade']),
    fim: z.union([z.literal(''), ISO]).default(''),
    quantidade: z.coerce.number().int().min(1, 'Informe quantos conteúdos.').max(500).nullable().default(null),
    porSemana: z.coerce.number().int().min(1, 'Pelo menos 1 conteúdo por semana.').max(7, 'No máximo 7 por semana.'),
    distribuicao: z.enum(['repeticao', 'livre']),
  })
  .refine((d) => d.modo !== 'periodo' || !!d.fim, { message: 'Informe a data de fim.', path: ['fim'] })
  .refine((d) => d.modo !== 'quantidade' || !!d.quantidade, {
    message: 'Informe quantos conteúdos.',
    path: ['quantidade'],
  });
const CicloIn = z.object({
  nome: z.string().trim().min(2, 'Dê um nome ao ciclo.').max(160),
  ativo: z.boolean().default(true),
  def: DefIn,
  datas: z
    .array(z.object({ data: ISO, s: z.number().int().min(0), i: z.number().int().min(0) }))
    .min(1, 'Gere e confira as datas antes de salvar.')
    .max(400),
});

const erro400 = (rep: FastifyReply, e: z.ZodError) => rep.code(400).send({ erro: e.issues[0].message });
const isoUTC = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');
const br = (iso: string) => (iso ? fmt.data(new Date(`${iso}T00:00:00`)) : '—');
const semana = (iso: string) => DN[new Date(`${iso}T00:00:00`).getDay()];

/** curso, item, currículo e dias de aula conferidos para a definição */
async function contexto(def: z.infer<typeof DefIn>) {
  const b = await base();
  const c = b.cursos.find((x) => x.id === def.cursoId);
  if (!c) return { erro: 'Curso não encontrado.' };
  if (!crsItens(c).includes(def.item)) return { erro: `${def.item} não é módulo nem turma de ${c.name}.` };
  const cur = curriculoDoItem(b, c.name, def.item);
  const dias = diasDoItem(b, c.name, def.item, agOfertas(b));
  return { b, c, cur, dias };
}

export default async function rotasCiclos(app: FastifyInstance) {
  app.get('/ciclos', { preHandler: exigeCiclos }, async (req) => {
    const xs = await prisma.cicloAprendizagem.findMany({
      orderBy: [{ cursoId: 'asc' }, { nome: 'asc' }],
      include: { curso: { select: { nome: true } } },
    });
    return {
      linhas: xs.map((x) => {
        const ds = x.datas as { data: string; s: number }[];
        return {
          id: x.id,
          nome: x.nome,
          cursoId: x.cursoId,
          curso: x.curso.nome,
          item: x.item || '—',
          inicio: br(isoUTC(x.inicio)),
          fim: br(ds.length ? ds[ds.length - 1].data : ''),
          datas: ds.length,
          conteudos: new Set(ds.map((d) => d.s)).size,
          porSemana: x.porSemana,
          distribuicao: x.distribuicao === 'livre' ? 'Livre' : 'Repetição',
          ativo: x.ativo,
          /* ciclos de antes de 02/10/2026 não têm módulo nem datas: abrem para completar */
          completo: !!x.item && ds.length > 0,
        };
      }),
      pode: { criar: podeAcao(req.usuario!.nivel, 'criar'), editar: podeAcao(req.usuario!.nivel, 'editar') },
    };
  });

  /** cursos com módulos ou turmas: dias de aula e currículo de cada um */
  app.get('/ciclos-opcoes', { preHandler: exigeCiclos }, async () => {
    const b = await base();
    const ofs = agOfertas(b);
    return {
      cursos: b.cursos
        .filter((c) => crsItens(c).length)
        .map((c) => ({
          id: c.id,
          nome: c.name,
          itens: crsItens(c).map((nome) => {
            const cur = curriculoDoItem(b, c.name, nome);
            return {
              nome,
              dias: diasDoItem(b, c.name, nome, ofs).map((d) => DN[d]),
              curriculo: cur ? { id: cur.id, nome: cur.nome, conteudos: cur.conteudos.map((x) => x.titulo) } : null,
            };
          }),
        })),
    };
  });

  app.get('/ciclos/:id', { preHandler: exigeCiclos }, async (req, rep) => {
    const x = await prisma.cicloAprendizagem.findUnique({ where: { id: Number((req.params as { id: string }).id) } });
    if (!x) return rep.code(404).send({ erro: 'Ciclo não encontrado.' });
    return {
      id: x.id,
      nome: x.nome,
      ativo: x.ativo,
      def: {
        cursoId: x.cursoId,
        item: x.item,
        inicio: isoUTC(x.inicio),
        modo: x.modo,
        fim: isoUTC(x.fim),
        quantidade: x.quantidade,
        porSemana: x.porSemana,
        distribuicao: x.distribuicao,
      },
      datas: x.datas,
    };
  });

  /** a prévia: as datas do ciclo com o conteúdo de cada uma, para validar e editar na tela */
  app.post('/ciclos/previa', { preHandler: exigeCiclos }, async (req, rep) => {
    const r = DefIn.safeParse(req.body);
    if (!r.success) return erro400(rep, r.error);
    const ctx = await contexto(r.data);
    if ('erro' in ctx) return rep.code(400).send({ erro: ctx.erro });
    const g = geraDatas(r.data as CicloDef, ctx.dias, ctx.cur?.conteudos.length ?? 0);
    if ('erro' in g) return rep.code(400).send({ erro: g.erro });
    return { datas: g.datas, semana: g.datas.map((d) => semana(d.data)) };
  });

  const salva = async (req: FastifyRequest, rep: FastifyReply, id: number | null) => {
    const u = req.usuario!;
    if (!podeAcao(u.nivel, id ? 'editar' : 'criar'))
      return rep.code(403).send({ erro: 'Seu acesso não permite esta ação.' });
    const r = CicloIn.safeParse(req.body);
    if (!r.success) return erro400(rep, r.error);
    const { nome, ativo, def, datas } = r.data;
    const ctx = await contexto(def);
    if ('erro' in ctx) return rep.code(400).send({ erro: ctx.erro });
    if (!ctx.cur) return rep.code(400).send({ erro: `${def.item} não tem currículo publicado com conteúdos.` });
    const n = ctx.cur.conteudos.length;
    if (datas.some((d) => d.i >= n))
      return rep.code(400).send({ erro: 'Há data com conteúdo que não existe no currículo.' });
    const ordenadas = [...datas].sort((x, y) => x.data.localeCompare(y.data));
    if (new Set(ordenadas.map((d) => d.data)).size !== ordenadas.length)
      return rep.code(400).send({ erro: 'Há data repetida no ciclo.' });
    if (
      await prisma.cicloAprendizagem.findFirst({ where: { cursoId: def.cursoId, nome, NOT: id ? { id } : undefined } })
    )
      return rep.code(400).send({ erro: `Já existe um ciclo chamado ${nome} neste curso.` });
    /* dois ciclos ativos do mesmo módulo ou turma não dividem datas */
    if (ativo) {
      const outros = await prisma.cicloAprendizagem.findMany({
        where: { cursoId: def.cursoId, item: def.item, ativo: true, NOT: id ? { id } : undefined },
        select: { nome: true, datas: true },
      });
      const minhas = new Set(ordenadas.map((d) => d.data));
      const choque = outros.find((o) => (o.datas as { data: string }[]).some((d) => minhas.has(d.data)));
      if (choque)
        return rep.code(400).send({ erro: `As datas batem com o ciclo ${choque.nome}, também ativo em ${def.item}.` });
    }
    const dados = {
      nome,
      ativo,
      cursoId: def.cursoId,
      item: def.item,
      inicio: new Date(`${def.inicio}T00:00:00Z`),
      modo: def.modo,
      fim: def.modo === 'periodo' && def.fim ? new Date(`${def.fim}T00:00:00Z`) : null,
      quantidade: def.modo === 'quantidade' ? def.quantidade : null,
      porSemana: def.porSemana,
      distribuicao: def.distribuicao,
      curriculoId: ctx.cur.id,
      datas: ordenadas,
    };
    const x = id
      ? await prisma.cicloAprendizagem.update({ where: { id }, data: dados })
      : await prisma.cicloAprendizagem.create({ data: dados });
    await registra({
      tipo: 'ciclo',
      id: String(x.id),
      nome,
      acao: id ? 'Ciclo editado' : 'Ciclo criado',
      detalhe: `${ctx.c.name} · ${def.item} · ${ordenadas.length} datas de ${br(ordenadas[0].data)} a ${br(ordenadas[ordenadas.length - 1].data)}`,
      autor: u.nome,
    });
    invalidaBase();
    return {
      id: x.id,
      msg: `Ciclo ${id ? 'salvo' : 'criado'}: ${ordenadas.length} datas com conteúdo em ${def.item}.`,
    };
  };
  app.post('/ciclos', { preHandler: exigeCiclos }, (req, rep) => salva(req, rep, null));
  app.put('/ciclos/:id', { preHandler: exigeCiclos }, (req, rep) =>
    salva(req, rep, Number((req.params as { id: string }).id)),
  );
}
