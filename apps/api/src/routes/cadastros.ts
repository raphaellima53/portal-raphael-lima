import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../db.ts';
import { podeAcao } from '../domain/acesso.ts';
import { invalidaBase } from '../domain/base.ts';
import {
  type Cadastro,
  type Campo,
  cadastroDe,
  doForm,
  type Opcao,
  opcoesDe,
  paraForm,
  paraLista,
} from '../domain/cadastros.ts';
import { podeChave } from '../domain/mapa.ts';
import { registra } from '../lib/log.ts';
import type { UsuarioSessao } from '../plugins/sessao.ts';

/**
 * Rota única dos cadastros simples (domain/cadastros.ts): lista com opções, criar, editar e excluir.
 * ?pai= é o aluno, o professor ou a conta dona dos registros quando o cadastro abre dentro de uma ficha.
 */
// biome-ignore lint/suspicious/noExplicitAny: o delegate do Prisma é escolhido pelo nome do modelo
const delegate = (c: Cadastro) => (prisma as any)[c.modelo];
const ENT: Record<string, string> = { aluno: 'aluno', professor: 'prof', usuario: 'config' };

function acesso(u: UsuarioSessao | undefined, c: Cadastro) {
  if (!u || u.ehAluno) return { ver: false, criar: false, editar: false, excluir: false };
  const ver = c.chaves.some((k) => podeChave(u, k));
  return {
    ver,
    criar: ver && podeAcao(u.nivel, 'criar'),
    editar: ver && podeAcao(u.nivel, 'editar'),
    excluir: ver && podeAcao(u.nivel, 'excluir'),
  };
}

type Req = FastifyRequest<{ Params: { id: string; rid?: string }; Querystring: { pai?: string } }>;

function abre(req: Req, rep: FastifyReply) {
  const c = cadastroDe(req.params.id);
  if (!c) {
    rep.code(404).send({ erro: 'Cadastro não encontrado.' });
    return null;
  }
  if (!req.usuario) {
    rep.code(401).send({ erro: 'Sessão expirada. Entre de novo.' });
    return null;
  }
  const pode = acesso(req.usuario, c);
  if (!pode.ver) {
    rep.code(403).send({ erro: 'Sem acesso a esta tela.' });
    return null;
  }
  const pai = req.query.pai ? String(req.query.pai) : null;
  if (c.soComPai && !pai) {
    rep.code(400).send({ erro: 'Abra este cadastro pela ficha.' });
    return null;
  }
  return { c, pode, pai };
}

/** campos que aparecem no formulário (os calculados e, dentro da ficha, o próprio pai ficam de fora) */
const doFormulario = (c: Cadastro, pai: string | null) => c.campos.filter((f) => !f.soLista && !(pai && f.somePai));

async function opcoes(c: Cadastro, pai: string | null) {
  const r: Record<string, Opcao[]> = {};
  for (const f of c.campos) if (f.fonte) r[f.k] = await opcoesDe(f.fonte, pai);
  return r;
}

async function linhas(c: Cadastro, pai: string | null, ops: Record<string, Opcao[]>) {
  const rs = await delegate(c).findMany({
    where: pai && c.onde ? c.onde(pai) : {},
    orderBy: c.ordem,
    include: c.include,
  });
  const cols = c.campos.filter((f) => f.coluna && !(pai && f.somePai));
  return rs.map((r: Record<string, unknown> & { id: number | string }) => ({
    id: r.id,
    rotulo: c.rotulo(r),
    valores: Object.fromEntries(c.campos.map((f) => [f.k, paraForm(f, r[f.k])])),
    txt: Object.fromEntries([
      ...cols.map((f) => [f.k, paraLista(f, r[f.k], ops[f.k])]),
      ...(c.extras ?? []).map((x) => [x.k, x.valor(r)]),
    ]),
  }));
}

/** catálogos que os formulários da equipe podem ler (nomes ativos) */
const CATALOGOS_LIVRES = [
  'genders',
  'finResp',
  'skills',
  'roomTypes',
  'languages',
  'visibilidadesOferta',
  'categoriasCurriculo',
];

export default async function rotasCadastros(app: FastifyInstance) {
  /* opções dos catálogos para os formulários: /catalogo-opcoes?tipos=genders,finResp */
  app.get('/catalogo-opcoes', async (req: FastifyRequest<{ Querystring: { tipos?: string } }>, rep) => {
    if (!req.usuario) return rep.code(401).send({ erro: 'Sessão expirada. Entre de novo.' });
    if (req.usuario.ehAluno) return rep.code(403).send({ erro: 'Sem acesso.' });
    const tipos = String(req.query.tipos ?? '')
      .split(',')
      .filter((t) => CATALOGOS_LIVRES.includes(t));
    const cs = await prisma.catalogo.findMany({
      where: { tipo: { in: tipos }, ativo: true },
      orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
    });
    return Object.fromEntries(tipos.map((t) => [t, cs.filter((c) => c.tipo === t).map((c) => c.nome)]));
  });

  app.get('/cadastros/:id', async (req: Req, rep) => {
    const a = abre(req, rep);
    if (!a) return;
    const { c, pode, pai } = a;
    const ops = await opcoes(c, pai);
    const cols = c.campos.filter((f) => f.coluna && !(pai && f.somePai));
    return {
      id: c.id,
      titulo: c.titulo,
      um: c.um,
      novo: c.novo,
      sobre: c.sobre,
      campos: doFormulario(c, pai).map((f) => ({
        k: f.k,
        rotulo: f.rotulo,
        tipo: f.tipo,
        req: !!f.req,
        largo: !!f.largo,
        ajuda: f.ajuda ?? null,
        padrao: f.padrao ?? (f.tipo === 'sim' ? false : ''),
      })),
      colunas: [
        ...cols.map((f) => ({ k: f.k, rotulo: f.rotulo })),
        ...(c.extras ?? []).map((x) => ({ k: x.k, rotulo: x.rotulo })),
      ],
      filtros: c.campos
        .filter((f) => f.filtro && !(pai && f.somePai))
        .map((f) => ({
          k: f.k,
          rotulo: f.rotulo,
          opcoes:
            f.tipo === 'sim'
              ? [
                  { v: 'true', l: 'Sim' },
                  { v: 'false', l: 'Não' },
                ]
              : (ops[f.k] ?? []),
        })),
      opcoes: ops,
      linhas: await linhas(c, pai, ops),
      pode,
    };
  });

  const salva = async (req: Req, rep: FastifyReply) => {
    const a = abre(req, rep);
    if (!a) return;
    const { c, pode, pai } = a;
    const rid = req.params.rid;
    if (rid ? !pode.editar : !pode.criar)
      return rep.code(403).send({ erro: 'Seu acesso não permite alterar este cadastro.' });
    const d = delegate(c);
    const idV = rid == null ? null : c.geraId ? rid : Number(rid);
    const atual = idV == null ? null : await d.findUnique({ where: { id: idV } });
    if (idV != null && !atual) return rep.code(404).send({ erro: `${cap(c.um)} não encontrad${g(c)}.` });
    if (atual && pai && c.onde) {
      const dono = await d.findFirst({ where: { id: idV, ...c.onde(pai) } });
      if (!dono) return rep.code(404).send({ erro: `${cap(c.um)} não encontrad${g(c)} nesta ficha.` });
    }
    const corpo = (req.body ?? {}) as Record<string, unknown>;
    const dados: Record<string, unknown> = {};
    for (const f of doFormulario(c, pai) as Campo[]) {
      const r = doForm(f, corpo[f.k]);
      if ('erro' in r) return rep.code(400).send({ erro: r.erro });
      if (r.v === null && !f.nulo) {
        /* coluna sem nulo: texto vazio grava ''; número e escolha por id vazios ficam no padrão do banco */
        const texto =
          f.tipo !== 'data' && f.tipo !== 'numero' && f.tipo !== 'dinheiro' && !(f.tipo === 'escolha' && f.int);
        if (texto) dados[f.k] = '';
        else if (f.tipo === 'data') dados[f.k] = null;
        continue;
      }
      dados[f.k] = r.v;
      /* escolha só vale entre as opções da ficha (não se grava a matrícula de outro aluno) */
      if (
        f.fonte &&
        r.v != null &&
        !(atual && String(atual[f.k]) === String(r.v)) &&
        !(await opcoesDe(f.fonte, pai)).some((o) => o.v === String(r.v))
      )
        return rep.code(400).send({ erro: `${f.rotulo}: escolha uma opção da lista.` });
    }
    const autor = req.usuario!.nome;
    Object.assign(dados, c.fixa?.({ pai, autor }) ?? {});
    const erro = c.antes ? await c.antes(dados, { pai, autor }, atual) : null;
    if (erro) return rep.code(400).send({ erro });
    let r: Record<string, unknown> & { id: number | string };
    try {
      r = atual
        ? await d.update({ where: { id: idV }, data: dados })
        : await d.create({ data: { ...(c.geraId ? { id: c.geraId() } : {}), ...dados } });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002')
        return rep.code(400).send({ erro: `Já existe ${c.um} com esses dados.` });
      throw e;
    }
    await c.depois?.(r, { pai, autor });
    invalidaBase();
    await registra({
      tipo: c.pai && pai ? ENT[c.pai] : c.titulo,
      id: c.pai && pai ? pai : String(r.id),
      nome: await nomeDoPai(c, pai),
      acao: `${c.um} ${atual ? `editad${g(c)}` : `criad${g(c)}`}`,
      detalhe: c.rotulo(r),
      autor,
      antes: atual ? Object.fromEntries(Object.keys(dados).map((k) => [k, atual[k]])) : undefined,
      depois: dados,
    });
    return { id: r.id, msg: `${cap(c.um)} ${atual ? `salv${g(c)}` : `criad${g(c)}`}.` };
  };
  app.post('/cadastros/:id', salva);
  app.put('/cadastros/:id/:rid', salva);

  app.delete('/cadastros/:id/:rid', async (req: Req, rep) => {
    const a = abre(req, rep);
    if (!a) return;
    const { c, pode, pai } = a;
    if (!pode.excluir) return rep.code(403).send({ erro: 'Excluir não está liberado para o seu acesso.' });
    const d = delegate(c);
    const idV = c.geraId ? String(req.params.rid) : Number(req.params.rid);
    const atual = await d.findFirst({ where: { id: idV, ...(pai && c.onde ? c.onde(pai) : {}) } });
    if (!atual) return rep.code(404).send({ erro: `${cap(c.um)} não encontrad${g(c)}.` });
    const trava = await c.podeExcluir?.(atual);
    if (trava) return rep.code(400).send({ erro: trava });
    try {
      await d.delete({ where: { id: idV } });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2003')
        return rep.code(400).send({ erro: 'Está em uso por outro cadastro: inative em vez de excluir.' });
      throw e;
    }
    invalidaBase();
    await registra({
      tipo: c.pai && pai ? ENT[c.pai] : c.titulo,
      id: c.pai && pai ? pai : String(atual.id),
      nome: await nomeDoPai(c, pai),
      acao: `${c.um} excluíd${g(c)}`,
      detalhe: c.rotulo(atual),
      autor: req.usuario!.nome,
      antes: atual,
    });
    return { msg: `${cap(c.um)} excluíd${g(c)}.` };
  });
}

/** no log, o nome é o da pessoa dona da ficha (ou o do próprio cadastro) */
async function nomeDoPai(c: Cadastro, pai: string | null) {
  if (!c.pai || !pai) return c.titulo;
  if (c.pai === 'aluno') return (await prisma.aluno.findUnique({ where: { id: Number(pai) } }))?.nome ?? c.titulo;
  if (c.pai === 'professor') return (await prisma.professor.findUnique({ where: { id: pai } }))?.nome ?? c.titulo;
  return (await prisma.usuario.findUnique({ where: { id: Number(pai) } }))?.nome ?? c.titulo;
}

/** terminação do particípio pelo gênero do cadastro: criado/criada */
const g = (c: Cadastro) => (c.fem ? 'a' : 'o');
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
