import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.ts';
import { agAulasEntre, agCor, agHH, agNaAgenda, agRotulo, alMat } from '../domain/agenda.ts';
import { alertasDe, extrasAlertas } from '../domain/alertas.ts';
import { base } from '../domain/base.ts';
import { blocoDef, DASH_BLOCOS, DASH_GRUPOS, DASH_PADRAO, montaDashboard } from '../domain/dashboard.ts';
import { podeChave } from '../domain/mapa.ts';
import { fmt } from '../lib/fmt.ts';

const Config = z.object({ blocos: z.array(z.string()).min(1, 'Marque ao menos um bloco para salvar.') });

export default async function rotasInicio(app: FastifyInstance) {
  /** Dashboard: blocos disponíveis para o acesso, os marcados (salvos ou padrão) e o conteúdo de cada um. */
  app.get('/dashboard', { preHandler: app.exigeLogin }, async (req, rep) => {
    const u = req.usuario!;
    if (u.ehAluno) return rep.code(403).send({ erro: 'O aluno entra na Minha área.' });
    const disponiveis = DASH_BLOCOS.filter((b) => podeChave(u, b.chave));
    const cfg = await prisma.dashboardConfig.findUnique({ where: { usuarioId: u.id } });
    const ks = cfg?.blocos ?? DASH_PADRAO;
    const marcados = disponiveis.filter((b) => ks.includes(b.k)).map((b) => b.k);
    return {
      grupos: DASH_GRUPOS.filter((g) => disponiveis.some((b) => b.g === g)),
      disponiveis: disponiveis.map(blocoDef),
      padrao: DASH_PADRAO.filter((k) => disponiveis.some((b) => b.k === k)),
      marcados,
      salvoEm: cfg?.salvoEm ?? null,
      blocos: montaDashboard(await base(), marcados),
    };
  });

  app.put('/dashboard/config', { preHandler: app.exigeLogin }, async (req, rep) => {
    const u = req.usuario!;
    const r = Config.safeParse(req.body);
    if (!r.success) return rep.code(400).send({ erro: r.error.issues[0].message });
    const validos = new Set(DASH_BLOCOS.filter((b) => podeChave(u, b.chave)).map((b) => b.k));
    const blocos = r.data.blocos.filter((k) => validos.has(k));
    if (!blocos.length) return rep.code(400).send({ erro: 'Marque ao menos um bloco para salvar.' });
    const salvo = await prisma.dashboardConfig.upsert({
      where: { usuarioId: u.id },
      create: { usuarioId: u.id, blocos },
      update: { blocos, salvoEm: new Date() },
    });
    return { blocos: salvo.blocos, salvoEm: salvo.salvoEm };
  });

  app.get('/alertas', { preHandler: app.exigeLogin }, async (req) => {
    const b = await base();
    return { alertas: alertasDe(b, req.usuario!, await extrasAlertas(b)) };
  });

  /** Minha área: matrículas, saldo e próximas aulas de quem é aluno (ou colaborador que também estuda). */
  app.get('/minha-area', { preHandler: app.exigeLogin }, async (req, rep) => {
    const u = req.usuario!;
    const b = await base();
    const a = u.alunoId != null ? b.alunos.find((x) => x.id === u.alunoId) : undefined;
    if (!a) return rep.code(404).send({ erro: 'Entre com uma persona de aluno para ver as matrículas.' });
    const mats = alMat(a);
    const hoje = new Date();
    const fim = new Date();
    fim.setDate(fim.getDate() + 14);
    const prox = agNaAgenda(agAulasEntre(b, hoje, fim)).filter((x) => x.alunos.includes(a.name) && x.quando >= hoje);
    return {
      nome: u.nome,
      matriculas: mats.map((e) => ({
        id: e.id,
        curso: e.curso,
        modulo: e.modulo,
        modalidade: e.modalidade,
        usadas: e.usadas,
        total: e.total,
        cor: b.corCurso[e.curso] || '#1a4fd6',
      })),
      restam: mats.reduce((s, e) => s + Math.max(0, e.total - e.usadas), 0),
      proximas: prox.slice(0, 10).map((x) => ({
        quando: `${fmt.data(x.quando)} · ${agHH(x.quando.getHours())}`,
        rotulo: agRotulo(x),
        cor: agCor(b, x),
        prof: x.prof,
        sala: x.sala,
      })),
      totalProximas: prox.length,
    };
  });
}
