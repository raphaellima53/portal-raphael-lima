import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.ts';
import { podeAcao } from '../domain/acesso.ts';
import { fecHoras, fecMeses, fecRotulo } from '../domain/acoes.ts';
import { agOfertas } from '../domain/agenda.ts';
import { finMesDe, folhaVeValor } from '../domain/aulas.ts';
import { base } from '../domain/base.ts';
import { garantirFeedbacks } from '../domain/feedbacks-db.ts';
import {
  type Cobranca,
  FIN_PARCELAS,
  finCarteira,
  finCobrancas,
  finCompetencia,
  finPct,
  finR,
  finRk,
} from '../domain/financeiro.ts';
import { podeChave } from '../domain/mapa.ts';
import type { Avaliacao } from '../domain/professores.ts';
import {
  type Pers,
  QR_PERIODOS,
  QR_QUAL,
  REL_CAMPOS,
  REL_NUM,
  REL_PADRAO,
  REL_PERS,
  type Recorte,
  RP,
  RP_TELA,
  relatorio,
  relLinhas,
  relQual,
} from '../domain/relatorios.ts';
import { hrefAluno, hrefCurso, hrefProf } from '../domain/rotas.ts';
import { fmt } from '../lib/fmt.ts';
import { registra } from '../lib/log.ts';
import type { UsuarioSessao } from '../plugins/sessao.ts';

const exigeTela =
  (tela: string | ((req: FastifyRequest) => string)) => async (req: FastifyRequest, rep: FastifyReply) => {
    const u = req.usuario;
    if (!u) return rep.code(401).send({ erro: 'Sessão expirada. Entre de novo.' });
    const t = typeof tela === 'string' ? tela : tela(req);
    if (!t) return rep.code(404).send({ erro: 'Relatório não encontrado.' });
    if (u.ehAluno || !podeChave(u, t)) return rep.code(403).send({ erro: 'Sem acesso a esta tela.' });
  };
/** registrar pagamento vai até o Colaborador; Visualizador só lê */
const podeOperar = (u: UsuarioSessao) => !u.ehAluno && podeAcao(u.nivel, 'criar');

const RecorteQ = z.object({
  dias: z.coerce
    .number()
    .refine((v) => QR_PERIODOS.some(([d]) => d === v))
    .catch(30),
  curso: z.string().max(160).catch(''),
  grupo: z.enum(['curso', 'item']).catch('curso'),
  qual: z.string().max(40).catch(''),
});

/** o recorte com o que mora no banco: feedbacks abertos e avaliações registradas */
export async function recorte(q: { dias: number; curso: string; grupo: 'curso' | 'item' }): Promise<Recorte> {
  const b = await base();
  const ofs = agOfertas(b);
  await garantirFeedbacks(b, b.alunos, ofs);
  const [abertos, avs] = await Promise.all([
    prisma.feedbackAluno.findMany({ where: { status: { not: 'Concluído' } }, select: { alunoId: true } }),
    prisma.avaliacaoProfessor.findMany({ orderBy: { quando: 'desc' } }),
  ]);
  const ids = new Set(abertos.map((x) => x.alunoId));
  const porProf = new Map<string, Avaliacao[]>();
  for (const x of avs) {
    const l = porProf.get(x.professorId) ?? [];
    l.push({
      quando: x.quando,
      aluno: x.aluno,
      curso: x.curso,
      aula: x.aula,
      nota: x.nota,
      texto: x.texto,
      registrada: true,
    });
    porProf.set(x.professorId, l);
  }
  const curso = b.cursos.some((c) => c.name === q.curso) ? q.curso : '';
  return {
    b,
    ofs,
    agora: new Date(),
    dias: q.dias,
    curso,
    grupo: q.grupo,
    fbAbertos: new Set(b.alunos.filter((a) => ids.has(a.id)).map((a) => a.name)),
    avs: porProf,
  };
}

const cobLinha = (c: Cobranca) => ({
  key: c.key,
  pagador: c.pagador,
  curso: c.curso,
  item: c.item,
  parcela: c.parcela,
  venc: fmt.data(c.venc),
  valor: finR(c.valor),
  situacao: c.pago
    ? { t: `paga em ${fmt.data(c.pago)}`, tom: 'green' }
    : c.sit === 'vencida'
      ? { t: `${c.atraso}${c.atraso === 1 ? ' dia' : ' dias'} em atraso`, tom: 'red' }
      : { t: 'a vencer', tom: 'amber' },
  pago: !!c.pago,
  href:
    c.tipo === 'aluno' && c.alunoId ? hrefAluno(c.alunoId, 'cursos') : c.cursoId ? hrefCurso(c.cursoId, 'grade') : null,
});

export default async function rotasRelatorios(app: FastifyInstance) {
  /* ================= Alunos · Professores · Cursos ================= */
  app.get(
    '/relatorios/rp/:tela',
    {
      preHandler: exigeTela((req) =>
        RP_TELA[(req.params as { tela: string }).tela] ? (req.params as { tela: string }).tela : '',
      ),
    },
    async (req) => {
      const { tela } = req.params as { tela: string };
      const q = RecorteQ.parse(req.query);
      const r = await recorte(q);
      const k = RP_TELA[tela];
      const qual = QR_QUAL[RP[k].pers].some(([v]) => v === q.qual) ? q.qual : '';
      return {
        ...relatorio(r, k, qual),
        filtro: { dias: r.dias, curso: r.curso, grupo: r.grupo, qual },
        periodos: QR_PERIODOS.map(([v, l]) => ({ v: String(v), l })),
        cursos: r.b.cursos.map((c) => c.name),
      };
    },
  );

  /* ================= Seletores ================= */
  app.get('/relatorios/seletores', { preHandler: exigeTela('relatorio') }, async (req, rep) => {
    const u = req.usuario!;
    const q = z
      .object({ pers: z.string().catch(''), qual: z.string().catch(''), prod: z.string().catch('') })
      .parse(req.query);
    const pode = REL_PERS.filter(([, , ch]) => podeChave(u, ch));
    if (!pode.length) return rep.code(403).send({ erro: 'Seu acesso não abre alunos, professores nem cursos.' });
    const pers: Pers = pode.find(([k]) => k === q.pers)?.[0] ?? pode[0][0];
    const r = await recorte({ dias: 30, curso: '', grupo: 'curso' });
    let ls: (Record<string, string | number> & { href: string })[] = relLinhas(r.b, pers, r.ofs);
    const prod = r.b.cursos.some((c) => c.name === q.prod) && pers !== 'professor' ? q.prod : '';
    if (prod && pers === 'aluno') ls = ls.filter((l) => l.produto === prod);
    if (prod && pers === 'curso') ls = ls.filter((l) => l.nome === prod);
    const qual = QR_QUAL[pers].some(([v]) => v === q.qual) ? q.qual : '';
    if (qual) {
      const m = relQual(r, pers);
      ls = ls.filter((l) => m[String(l.nome)]?.[qual]);
    }
    return {
      perspectivas: pode.map(([v, l]) => ({ v, l })),
      filtro: { pers, qual, prod },
      dias: r.dias,
      campos: REL_CAMPOS[pers].map(([k, t]) => ({ k, t, num: REL_NUM.includes(k) })),
      padrao: REL_PADRAO[pers],
      qualidade: QR_QUAL[pers].map(([v, l]) => ({ v, l })),
      produtos: pers === 'professor' ? null : r.b.cursos.map((c) => c.name),
      linhas: ls.map(({ href, ...v }) => ({ href, v })),
    };
  });

  /* ================= Financeiro › Dashboard financeiro ================= */
  app.get('/relatorios/financeiro', { preHandler: exigeTela('rpFinanceiro') }, async (req) => {
    const u = req.usuario!;
    const q = z.object({ mes: z.string().catch(''), curso: z.string().catch('') }).parse(req.query);
    const b = await base();
    const agora = new Date();
    const ofs = agOfertas(b);
    const meses = fecMeses(agora);
    const ym = meses.includes(q.mes) ? q.mes : meses[0];
    const curso = b.cursos.some((c) => c.name === q.curso) ? q.curso : '';
    const ant = meses[meses.indexOf(ym) + 1];
    const serie = meses
      .slice()
      .reverse()
      .map((m) => finCompetencia(b, m, curso, agora, 0, ofs));
    const d = serie.find((s) => s.ym === ym)!;
    const da = ant ? finCompetencia(b, ant, curso, agora, d.parcial ? agora.getDate() : 0, ofs) : null;
    const pagasDb = await prisma.parcelaPaga.findMany();
    const cobs = finCobrancas(b, new Map(pagasDb.map((p) => [p.chave, p.quando])), agora).filter(
      (c) => !curso || c.curso === curso,
    );
    const noMes = (x: Date) => finMesDe(x) === ym;
    const vencidas = cobs.filter((c) => c.sit === 'vencida').sort((x, z) => z.atraso - x.atraso);
    const aVencer = cobs
      .filter((c) => !c.pago && noMes(c.venc) && c.sit === 'aVencer')
      .sort((x, z) => +x.venc - +z.venc);
    const pagas = cobs.filter((c) => c.pago && noMes(c.pago)).sort((x, z) => +z.pago! - +x.pago!);
    const soma = (ls: Cobranca[]) => ls.reduce((s, c) => s + c.valor, 0);
    const rotMes = fecRotulo(ym);
    const mesCurto = rotMes.split(' de ')[0];
    const variacao = (v: number, va: number | undefined) => {
      if (!da || !va) return null;
      const p = Math.round(((v - va) / Math.abs(va)) * 100);
      return {
        pct: `${p >= 0 ? '+' : ''}${p}%`,
        tom: p >= 0 ? 'green' : 'red',
        vs: ` vs ${d.parcial ? `1 a ${agora.getDate()} de ` : ''}${fecRotulo(ant).split(' de ')[0]}`,
      };
    };
    const parcelas = (n: number) => `${n} ${n === 1 ? 'parcela' : 'parcelas'}`;
    const ve = folhaVeValor({
      nome: u.nome,
      nivel: u.nivel,
      areas: u.areas,
      tipoPerfil: u.tipoPerfil,
      ehAluno: u.ehAluno,
    });
    return {
      meses: meses.map((m) => ({ v: m, l: fecRotulo(m) })),
      ym,
      curso,
      cursos: b.cursos.map((c) => c.name),
      mesCurto,
      recorte: `${d.parcial ? `1º de ${mesCurto} a ${fmt.data(d.ate)} · mês em andamento` : `${rotMes} · mês completo`} · ${curso || 'todos os cursos'}`,
      kpis: [
        { v: finRk(d.receita), t: 'receita reconhecida', var: variacao(d.receita, da?.receita) },
        { v: finRk(d.custo), t: 'custo de professores', var: variacao(d.custo, da?.custo) },
        {
          v: finRk(d.margem),
          t: `margem bruta · ${finPct(d.margem, d.receita)}`,
          tom: d.margem < 0 ? 'red' : 'green',
          var: variacao(d.margem, da?.margem),
        },
        { v: finRk(soma(pagas)), t: `recebido em ${mesCurto}`, detalhe: parcelas(pagas.length) },
        {
          v: finRk(soma(vencidas)),
          t: 'vencido em aberto',
          tom: vencidas.length ? 'red' : undefined,
          detalhe: `${parcelas(vencidas.length)} · ${new Set(vencidas.map((c) => c.pagador)).size} pagadores`,
        },
        {
          v: finRk(finCarteira(b, cobs, curso)),
          t: 'carteira a reconhecer',
          detalhe: 'o que resta dos pacotes e contratos',
        },
      ],
      serie: serie.map((s) => ({
        ym: s.ym,
        rotulo: `${fecRotulo(s.ym).split(' de ')[0]}/${s.ym.slice(2, 4)}${s.parcial ? ' (parcial)' : ''}`,
        nome: fecRotulo(s.ym),
        receita: Math.round(s.receita * 100) / 100,
        custo: Math.round(s.custo * 100) / 100,
        receitaTxt: finRk(s.receita),
        custoTxt: finRk(s.custo),
        margem: `margem ${finPct(s.margem, s.receita)}`,
        negativa: s.margem < 0,
      })),
      resumoMes: `${d.dadas} aulas dadas e ${fecHoras(d.min)} em ${mesCurto}${d.perdida ? ` · ${finR(d.perdida)} não realizados em aulas canceladas` : ''}`,
      porCurso: d.cursos.map((c) => {
        const cb = b.cursos.find((x) => x.name === c.curso);
        const m = c.receita - c.custo;
        return {
          curso: c.curso,
          href: cb ? hrefCurso(cb.id, 'regras') : null,
          valor: finR(c.valor),
          por: cb?.estrutura === 'turmas' ? 'turma' : 'aluno',
          dadas: c.dadas,
          alunosAula: c.alunosAula,
          receita: finR(c.receita),
          custo: finR(c.custo),
          margem: finR(m),
          negativa: m < 0,
          margemPct: finPct(m, c.receita),
          canc: c.canc || '—',
        };
      }),
      porProf: d.profs.map((p) => {
        const t = b.professores.find((x) => x.name === p.prof);
        return {
          prof: p.prof,
          href: t ? hrefProf(t.id, 'agenda', { quando: 'passadas' }) : null,
          dadas: p.dadas,
          horas: (Math.round(p.horas * 10) / 10).toFixed(1).replace('.', ','),
          valorHora: ve ? finR(p.valorHora) : '—',
          custo: finR(p.custo),
          daFolha: finPct(p.custo, d.custo),
        };
      }),
      parcelas: FIN_PARCELAS,
      cobrancas: {
        vencidas: vencidas.map(cobLinha),
        aVencer: aVencer.map(cobLinha),
        pagas: pagas.map(cobLinha),
      },
      podePagar: podeOperar(u),
    };
  });

  app.post('/relatorios/financeiro/pagar', { preHandler: exigeTela('rpFinanceiro') }, async (req, rep) => {
    const u = req.usuario!;
    if (!podeOperar(u)) return rep.code(403).send({ erro: 'Seu acesso é só de leitura.' });
    const p = z.object({ key: z.string().min(1).max(300) }).safeParse(req.body);
    if (!p.success) return rep.code(400).send({ erro: 'Parcela não informada.' });
    const b = await base();
    const pagasDb = await prisma.parcelaPaga.findMany();
    const c = finCobrancas(b, new Map(pagasDb.map((x) => [x.chave, x.quando]))).find((x) => x.key === p.data.key);
    if (!c) return rep.code(404).send({ erro: 'Parcela não encontrada. A lista pode ter mudado; recarregue.' });
    if (c.pago) return rep.code(409).send({ erro: `Parcela ${c.parcela} de ${c.pagador} já está paga.` });
    await prisma.parcelaPaga.create({ data: { chave: c.key, por: u.nome } });
    await registra({
      tipo: c.tipo === 'aluno' ? 'aluno' : 'curso',
      id: String(c.logId),
      nome: c.tipo === 'aluno' ? c.pagador : c.curso,
      acao: 'Pagamento registrado',
      detalhe: `${c.curso} · ${c.item} · parcela ${c.parcela} · ${finR(c.valor)}`,
      autor: u.nome,
    });
    return {
      msg: `Parcela ${c.parcela} de ${c.pagador} (${c.curso} · ${c.item}) registrada como paga: ${finR(c.valor)}.`,
    };
  });
}
