/**
 * Engenharia (menu criado a pedido de 17/09/2026, só para o tipo de perfil Admin):
 * GitHub › Repositórios — lista os repositórios do dono, clona o escolhido e roda os 16 critérios de saúde;
 * IA › Provedores — Anthropic, OpenAI e Google Gemini chamados por fetch, com pergunta lado a lado.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.ts';
import { avalia, CRITERIOS, type Item, lerArvore, NIVEL_ROTULO, NIVEL_TOM } from '../domain/engenharia.ts';
import { configurado, ErroIA, modeloDe, PROVEDORES, type ProvedorK, pergunta } from '../domain/ia.ts';
import { podeChave } from '../domain/mapa.ts';
import { env } from '../env.ts';
import { fmt } from '../lib/fmt.ts';
import { clona, ErroGitHub, limpaClone, listaRepos, metaDe, repoDe } from '../lib/github.ts';
import { registra } from '../lib/log.ts';

async function exigeEng(req: FastifyRequest, rep: FastifyReply) {
  const u = req.usuario;
  if (!u) return rep.code(401).send({ erro: 'Sessão expirada. Entre de novo.' });
  if (u.ehAluno || !podeChave(u, 'engenharia'))
    return rep.code(403).send({ erro: 'Só o tipo de perfil Admin abre Engenharia.' });
}
const Dono = z
  .string()
  .trim()
  .max(120)
  .regex(/^[A-Za-z0-9._-]*$/, 'Nome de dono inválido no GitHub.');
const Repo = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9._-]+$/, 'Nome de repositório inválido.');
const erroResp = (rep: FastifyReply, e: unknown) => {
  if (e instanceof ErroGitHub || e instanceof ErroIA) return rep.code(e.status).send({ erro: e.message });
  throw e;
};
const analiseVista = (a: {
  id: number;
  quando: Date;
  nota: number;
  selo: string;
  tom: string;
  ok: number;
  atencao: number;
  falha: number;
  itens: unknown;
  por: string;
}) => ({
  id: a.id,
  quando: fmt.dataHora(a.quando),
  nota: a.nota,
  selo: a.selo,
  tom: a.tom,
  ok: a.ok,
  atencao: a.atencao,
  falha: a.falha,
  por: a.por,
  itens: (a.itens as Item[]).map((i) => ({ ...i, rotulo: NIVEL_ROTULO[i.nivel], tom: NIVEL_TOM[i.nivel] })),
});

export default async function rotasEngenharia(app: FastifyInstance) {
  /* ================= GitHub › Repositórios ================= */
  app.get('/engenharia/repos', { preHandler: exigeEng }, async (req, rep) => {
    const q = z.object({ dono: Dono.catch('') }).parse(req.query);
    const dono = q.dono || env.GITHUB_OWNER;
    const criterios = CRITERIOS.map((c) => ({ k: c.k, t: c.t, d: c.d, peso: c.peso }));
    const base = { dono, comToken: !!env.GITHUB_TOKEN, donoPadrao: env.GITHUB_OWNER, criterios };
    if (!dono) return { ...base, linhas: [], analises: {} };
    try {
      const linhas = await listaRepos(dono);
      const ultimas = await prisma.analiseRepo.findMany({
        where: { dono, repo: { in: linhas.map((l) => l.nome) } },
        orderBy: { quando: 'desc' },
      });
      const analises: Record<string, ReturnType<typeof analiseVista>> = {};
      for (const a of ultimas) if (!analises[a.repo]) analises[a.repo] = analiseVista(a);
      return {
        ...base,
        linhas: linhas.map((l) => ({ ...l, atualizado: l.atualizado ? fmt.data(new Date(l.atualizado)) : '—' })),
        analises,
      };
    } catch (e) {
      return erroResp(rep, e);
    }
  });

  app.post('/engenharia/repos/analisar', { preHandler: exigeEng }, async (req, rep) => {
    const u = req.usuario!;
    const r = z.object({ dono: Dono.min(1, 'Informe o dono no GitHub.'), repo: Repo }).safeParse(req.body);
    if (!r.success) return rep.code(400).send({ erro: r.error.issues[0].message });
    const { dono, repo } = r.data;
    try {
      const meta = await repoDe(dono, repo);
      const { destino, ultimoCommit, commits } = await clona(dono, repo);
      const arvore = lerArvore(destino, ultimoCommit, commits);
      const res = avalia(arvore, metaDe(meta));
      limpaClone(dono, repo);
      const salva = await prisma.analiseRepo.create({
        data: {
          dono,
          repo,
          nota: res.nota,
          selo: res.selo,
          tom: res.tom,
          ok: res.ok,
          atencao: res.atencao,
          falha: res.falha,
          itens: res.itens as never,
          por: u.nome,
        },
      });
      await registra({
        tipo: 'eng',
        id: `${dono}/${repo}`,
        nome: `${dono}/${repo}`,
        acao: 'Repositório analisado',
        detalhe: `nota ${res.nota} · ${res.selo} · ${res.ok} ok, ${res.atencao} em atenção, ${res.falha} em falha`,
        autor: u.nome,
      });
      return {
        analise: analiseVista(salva),
        msg: `${dono}/${repo}: nota ${res.nota} de 100 — ${res.selo}. ${res.ok} critérios ok, ${res.atencao} em atenção e ${res.falha} em falha.`,
      };
    } catch (e) {
      return erroResp(rep, e);
    }
  });

  app.get('/engenharia/repos/:repo/analises', { preHandler: exigeEng }, async (req, rep) => {
    const p = z.object({ repo: Repo }).safeParse(req.params);
    const q = z.object({ dono: Dono.catch('') }).parse(req.query);
    const dono = q.dono || env.GITHUB_OWNER;
    if (!p.success || !dono) return rep.code(400).send({ erro: 'Informe o dono e o repositório.' });
    const ls = await prisma.analiseRepo.findMany({
      where: { dono, repo: p.data.repo },
      orderBy: { quando: 'desc' },
      take: 30,
    });
    return { linhas: ls.map(analiseVista) };
  });

  /* ================= IA › Provedores ================= */
  const provedores = () =>
    PROVEDORES.map((p) => ({
      k: p.k,
      nome: p.nome,
      modelo: modeloDe(p),
      docs: p.docs,
      chaveEnv: p.chaveEnv,
      modeloEnv: p.modeloEnv,
      configurado: configurado(p.k),
    }));
  app.get('/engenharia/ia', { preHandler: exigeEng }, async () => ({
    provedores: provedores(),
    algum: PROVEDORES.some((p) => configurado(p.k)),
  }));

  const Pergunta = z.object({
    prompt: z.string().trim().min(1, 'Escreva a pergunta.').max(8000),
    sistema: z.string().trim().max(2000).default(''),
    provedores: z.array(z.enum(['anthropic', 'openai', 'gemini'])).min(1, 'Escolha ao menos um provedor.'),
  });
  app.post('/engenharia/ia/perguntar', { preHandler: exigeEng }, async (req, rep) => {
    const u = req.usuario!;
    const r = Pergunta.safeParse(req.body);
    if (!r.success) return rep.code(400).send({ erro: r.error.issues[0].message });
    const escolhidos = PROVEDORES.filter((p) => r.data.provedores.includes(p.k));
    /* os provedores respondem em paralelo: cada um traz a resposta ou o próprio erro */
    const respostas = await Promise.all(
      escolhidos.map(async (p) => {
        try {
          const x = await pergunta(p, r.data.prompt, r.data.sistema);
          return { k: p.k, nome: p.nome, modelo: x.modelo, texto: x.texto, ms: x.ms, tokens: x.tokens, erro: null };
        } catch (e) {
          return {
            k: p.k,
            nome: p.nome,
            modelo: modeloDe(p),
            texto: '',
            ms: 0,
            tokens: null,
            erro: e instanceof ErroIA ? e.message : (e as Error).message,
          };
        }
      }),
    );
    await registra({
      tipo: 'eng',
      id: 'ia',
      nome: 'Provedores de IA',
      acao: 'Pergunta enviada à IA',
      detalhe: `${escolhidos.map((p) => p.nome).join(', ')} · ${r.data.prompt.slice(0, 120)}`,
      autor: u.nome,
    });
    return { respostas };
  });

  /** explica a última análise do repositório com a IA escolhida */
  app.post('/engenharia/ia/explicar', { preHandler: exigeEng }, async (req, rep) => {
    const r = z
      .object({ dono: Dono.min(1), repo: Repo, provedor: z.enum(['anthropic', 'openai', 'gemini']) })
      .safeParse(req.body);
    if (!r.success) return rep.code(400).send({ erro: r.error.issues[0].message });
    const a = await prisma.analiseRepo.findFirst({
      where: { dono: r.data.dono, repo: r.data.repo },
      orderBy: { quando: 'desc' },
    });
    if (!a) return rep.code(404).send({ erro: 'Analise o repositório antes de pedir a explicação.' });
    const p = PROVEDORES.find((x) => x.k === (r.data.provedor as ProvedorK))!;
    const itens = (a.itens as Item[]).map((i) => `- ${i.t} (peso ${i.peso}): ${NIVEL_ROTULO[i.nivel]} — ${i.detalhe}`);
    try {
      const x = await pergunta(
        p,
        `Repositório ${r.data.dono}/${r.data.repo}, nota ${a.nota} de 100 nos 16 critérios de saúde:\n${itens.join('\n')}\n\nEm português do Brasil, liste em até 5 itens o que corrigir primeiro e por quê, do mais urgente ao menos urgente.`,
        'Você revisa repositórios de código. Responda direto, sem introdução, em frases curtas.',
      );
      return { resposta: { k: p.k, nome: p.nome, modelo: x.modelo, texto: x.texto, ms: x.ms, tokens: x.tokens } };
    } catch (e) {
      return erroResp(rep, e);
    }
  });
}
