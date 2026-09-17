import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.ts';
import { podeAcao } from '../domain/acesso.ts';
import { agOfertas, agRotulo, crsItens, prDisp } from '../domain/agenda.ts';
import { dispChaveValida, dispPainel, dispTroca } from '../domain/alunos.ts';
import { type Base, base, invalidaBase, type ProfessorB } from '../domain/base.ts';
import { podeChave } from '../domain/mapa.ts';
import {
  type Avaliacao,
  FB_NOTAS,
  fbProf,
  fxDadas,
  linhaProfessor,
  permDe,
  prAgenda,
  prFeedbacks,
  prHabilitacao,
  prHistorico,
  prLogBase,
  prOfertas,
  prPerfil,
  prResumo,
  titularDe,
} from '../domain/professores.ts';
import { fmt } from '../lib/fmt.ts';
import { registra } from '../lib/log.ts';
import type { UsuarioSessao } from '../plugins/sessao.ts';

/** abas da ficha: [chave, rótulo, grupo] (PR_ABAS do portal) */
const PR_ABAS = [
  ['perfil', 'Perfil', 'dados'],
  ['log', 'Log', 'dados'],
  ['cursos', 'Cursos', 'acessos'],
  ['disponibilidade', 'Disponibilidade', 'acessos'],
  ['agenda', 'Agenda', 'historico'],
  ['feedbacks', 'Feedbacks', 'historico'],
] as const;
type Aba = (typeof PR_ABAS)[number][0];
const GRUPOS: Record<string, string> = { dados: 'Dados', acessos: 'Acessos', historico: 'Histórico' };
const ALIAS: Record<string, [Aba, string?]> = { habilitacao: ['cursos'], historico: ['agenda', 'passadas'] };
/** ações da linha por nível: Editar até o Editor, Desativar até o Gestor, Acessar como para todos */
const NIVEL = { editar: 3, desativar: 2, como: 5 } as const;
const pode = (u: UsuarioSessao, k: keyof typeof NIVEL) => !u.ehAluno && u.nivel <= NIVEL[k];
const podeOperar = (u: UsuarioSessao) => !u.ehAluno && podeAcao(u.nivel, 'criar');

const erro400 = (rep: FastifyReply, e: z.ZodError) => rep.code(400).send({ erro: e.issues[0].message });
async function exige(req: FastifyRequest, rep: FastifyReply, chaves: string[]) {
  const u = req.usuario;
  if (!u) return rep.code(401).send({ erro: 'Sessão expirada. Entre de novo.' });
  if (u.ehAluno || !chaves.some((c) => podeChave(u, c))) return rep.code(403).send({ erro: 'Sem acesso a esta tela.' });
}
const exigeLista = (req: FastifyRequest, rep: FastifyReply) => exige(req, rep, ['professores']);
const exigeFicha = (req: FastifyRequest, rep: FastifyReply) =>
  exige(
    req,
    rep,
    PR_ABAS.map(([k]) => `prof.${k}`),
  );
const exigeOperar = (chave: string) => async (req: FastifyRequest, rep: FastifyReply) => {
  const r = await exige(req, rep, [chave]);
  if (r) return r;
  if (!podeOperar(req.usuario!)) return rep.code(403).send({ erro: 'Seu acesso é só de leitura.' });
};
function profOu404(b: Base, id: string, rep: FastifyReply): ProfessorB | null {
  const t = b.professores.find((x) => x.id === id);
  if (!t) {
    rep.code(404).send({ erro: 'Professor não encontrado. O cadastro pode ter sido recarregado.' });
    return null;
  }
  return t;
}
const loga = (u: UsuarioSessao, t: { id: string; name: string }, acao: string, detalhe?: string) =>
  registra({ tipo: 'prof', id: t.id, nome: t.name, acao, detalhe, autor: u.nome });
const avaliacoesRegistradas = async (id: string): Promise<Avaliacao[]> =>
  (await prisma.avaliacaoProfessor.findMany({ where: { professorId: id }, orderBy: { quando: 'desc' } })).map((x) => ({
    quando: x.quando,
    aluno: x.aluno,
    curso: x.curso,
    aula: x.aula,
    nota: x.nota,
    texto: x.texto,
    registrada: true,
  }));
/** grava a habilitação: cursos e recorte por curso (sem recorte quando todos os itens valem) */
const gravaHabil = (id: string, cursos: string[], habil: Record<string, string[]> | null) =>
  prisma.professor.update({
    where: { id },
    data: { cursos, habilitacao: habil && Object.keys(habil).length ? habil : undefined },
  });

const ProfIn = z.object({
  nome: z.string().trim().min(2, 'Informe o nome.').max(160),
  email: z.union([z.literal(''), z.string().trim().email('E-mail inválido.').max(200)]).default(''),
  teto: z.coerce.number().int().min(1, 'O teto precisa ser de pelo menos 1 aula.').max(80).default(24),
  cursos: z.array(z.string()).max(40).default([]),
  ativo: z.boolean().default(true),
});

export default async function rotasProfessores(app: FastifyInstance) {
  app.get('/professores-opcoes', { preHandler: exigeLista }, async () => ({
    cursos: (await base()).cursos.map((c) => c.name),
  }));

  /* ---------------- lista ---------------- */
  app.get('/professores', { preHandler: exigeLista }, async (req) => {
    const u = req.usuario!;
    const b = await base();
    const ofs = agOfertas(b);
    return {
      professores: b.professores.map((t) => linhaProfessor(b, t, ofs)),
      cursos: b.cursos.map((c) => c.name),
      pode: {
        criar: podeOperar(u),
        editar: pode(u, 'editar'),
        desativar: pode(u, 'desativar'),
        como: pode(u, 'como') && !u.como,
        ficha: PR_ABAS.some(([k]) => podeChave(u, `prof.${k}`)),
      },
    };
  });

  /* ---------------- ficha ---------------- */
  app.get('/professores/:id', { preHandler: exigeFicha }, async (req, rep) => {
    const u = req.usuario!;
    const { id } = req.params as { id: string };
    const q = req.query as Record<string, string | undefined>;
    const b = await base();
    const t = profOu404(b, id, rep);
    if (!t) return;
    const ok = PR_ABAS.filter(([k]) => podeChave(u, `prof.${k}`));
    let pedida = String(q.aba ?? '');
    let quando = q.quando === 'passadas' ? 'passadas' : 'proximas';
    if (ALIAS[pedida]) {
      if (ALIAS[pedida][1]) quando = ALIAS[pedida][1]!;
      pedida = ALIAS[pedida][0];
    }
    const aba: Aba = ok.some(([k]) => k === pedida) ? (pedida as Aba) : ok[0][0];
    const hist = [30, 60, 90].includes(Number(q.hist)) ? Number(q.hist) : 60;
    const ofs = agOfertas(b);
    const agora = new Date();
    const grupos = Object.keys(GRUPOS)
      .filter((g) => ok.some((x) => x[2] === g))
      .map((g) => ({
        k: g,
        rotulo: GRUPOS[g],
        abas: ok.filter((x) => x[2] === g).map(([k, l]) => ({ k, rotulo: l })),
      }));
    const operar = podeOperar(u);

    let dados: unknown;
    if (aba === 'perfil') {
      const ult = await prisma.logAlteracao.findFirst({
        where: { entidade: 'Professor', entidadeId: t.id },
        orderBy: { quando: 'desc' },
      });
      dados = prPerfil(
        b,
        t,
        ofs,
        hist,
        fbProf(b, t, hist, ofs, await avaliacoesRegistradas(t.id), agora),
        ult ? { quando: ult.quando, acao: ult.acao } : null,
        agora,
      );
    } else if (aba === 'log') {
      const vivos = await prisma.logAlteracao.findMany({
        where: { entidade: 'Professor', entidadeId: t.id },
        orderBy: { quando: 'desc' },
      });
      const lb = prLogBase(t);
      dados = {
        linhas: [
          ...vivos.map((v) => ({
            quando: fmt.dataHora(v.quando, true),
            quem: v.autor,
            base: false,
            acao: v.acao,
            vezes: v.vezes,
            detalhe: v.detalhe ?? '',
          })),
          { quando: 'na base', quem: lb.quem, base: true, acao: lb.acao, vezes: 1, detalhe: lb.detalhe },
        ],
      };
    } else if (aba === 'cursos') {
      dados = { cursos: prHabilitacao(b, t, ofs) };
    } else if (aba === 'disponibilidade') {
      dados = { ...dispPainel(prDisp(b, t, ofs), prOfertas(ofs, t)), abrirAlocacao: false };
    } else if (aba === 'agenda') {
      if (quando === 'passadas') dados = { quando, ...prHistorico(b, t, hist, ofs, agora) };
      else {
        const dias = [7, 14, 30].includes(Number(q.dias)) ? Number(q.dias) : 14;
        dados = { quando, ...prAgenda(b, t, dias, ofs, agora) };
      }
    } else {
      const avs = fbProf(b, t, hist, ofs, await avaliacoesRegistradas(t.id), agora);
      const dadas = fxDadas(b, t.name, hist, ofs, agora).slice(0, 30);
      dados = {
        ...prFeedbacks(avs, hist),
        aulas: dadas.map((x) => ({
          k: x.k,
          rotulo: `${fmt.semana(x.quando)} ${String(x.quando.getHours()).padStart(2, '0')}:00 · ${agRotulo(x)}`,
        })),
        alunos: [...new Set(dadas.flatMap((x) => x.alunos))].sort((x, y) => x.localeCompare(y)),
        notas: [5, 4, 3, 2, 1].map((n) => ({ v: String(n), l: `${n} — ${FB_NOTAS[n]}` })),
      };
    }
    const r = prResumo(b, t, ofs);
    return {
      id: t.id,
      nome: t.name,
      ativo: t.active,
      sub: `${t.email} · ${t.cursos.length}${t.cursos.length === 1 ? ' curso habilitado' : ' cursos habilitados'}`,
      resumo: { ...r, teto: t.teto },
      grupos,
      aba,
      quando,
      dados,
      pode: {
        editar: pode(u, 'editar'),
        desativar: pode(u, 'desativar'),
        como: pode(u, 'como') && !u.como,
        operar,
        agenda: podeChave(u, 'agenda'),
        alunos: podeChave(u, 'aluno.perfil'),
      },
    };
  });

  /* ---------------- cadastro ---------------- */
  app.get('/professores/:id/form', { preHandler: exigeLista }, async (req, rep) => {
    const b = await base();
    const t = profOu404(b, (req.params as { id: string }).id, rep);
    if (!t) return;
    return { nome: t.name, email: t.email === '—' ? '' : t.email, teto: t.teto, cursos: t.cursos, ativo: t.active };
  });
  const salva = async (req: FastifyRequest, rep: FastifyReply, id: string | null) => {
    const u = req.usuario!;
    if (id == null ? !podeOperar(u) : !pode(u, 'editar'))
      return rep.code(403).send({ erro: 'Seu acesso não permite alterar o cadastro do professor.' });
    const p = ProfIn.safeParse(req.body);
    if (!p.success) return erro400(rep, p.error);
    const v = p.data;
    const b = await base();
    const antes = id ? profOu404(b, id, rep) : null;
    if (id && !antes) return;
    if (b.professores.some((x) => x !== antes && x.name.toLowerCase() === v.nome.toLowerCase()))
      return rep.code(409).send({ erro: 'Já existe um professor com esse nome.' });
    const validos = b.cursos.map((c) => c.name);
    const cursos = validos.filter((c) => v.cursos.includes(c));
    if (antes) {
      for (const c of b.cursos.filter((x) => antes.cursos.includes(x.name) && !cursos.includes(x.name))) {
        const tit = titularDe(antes, c);
        if (tit.length)
          return rep.code(409).send({
            erro: `${antes.name} é titular de ${tit.join(', ')} em ${c.name}. Troque o professor da turma antes de tirar a habilitação.`,
          });
      }
      const habil = antes.habil
        ? Object.fromEntries(Object.entries(antes.habil).filter(([c]) => cursos.includes(c)))
        : null;
      await prisma.professor.update({
        where: { id: antes.id },
        data: {
          nome: v.nome,
          email: v.email || '—',
          teto: v.teto,
          ativo: v.ativo,
          cursos,
          habilitacao: habil && Object.keys(habil).length ? habil : undefined,
        },
      });
      if (!habil || !Object.keys(habil).length)
        await prisma.$executeRaw`UPDATE "Professor" SET habilitacao = NULL WHERE id = ${antes.id}`;
      /* a alocação das aulas individuais guarda o nome do professor */
      if (antes.name !== v.nome)
        for (const a of b.alunos)
          for (const m of a.matriculas)
            if (m.aloc?.prof === antes.name)
              await prisma.matricula.update({ where: { id: m.id }, data: { alocacao: { ...m.aloc, prof: v.nome } } });
      const foto = (x: { nome: string; email: string; cursos: string[]; teto: number; ativo: boolean }) => [
        x.nome,
        x.email,
        [...x.cursos].sort(),
        x.teto,
        x.ativo,
      ];
      const f0 = foto({
        nome: antes.name,
        email: antes.email,
        cursos: antes.cursos,
        teto: antes.teto,
        ativo: antes.active,
      });
      const f1 = foto({ nome: v.nome, email: v.email || '—', cursos, teto: v.teto, ativo: v.ativo });
      const CAMPOS = ['nome', 'e-mail', 'cursos', 'teto semanal', 'situação'];
      const mud = CAMPOS.filter((_, j) => JSON.stringify(f0[j]) !== JSON.stringify(f1[j]));
      if (mud.length) await loga(u, { id: antes.id, name: v.nome }, 'Dados editados', mud.join(', '));
      invalidaBase();
      return { id: antes.id, msg: mud.length ? `Dados de ${v.nome} salvos.` : 'Nada mudou no cadastro.' };
    }
    const todos = await prisma.professor.findMany({ select: { id: true, ordem: true } });
    const novoId = `p${Math.max(0, ...todos.map((x) => Number(x.id.slice(1)) || 0)) + 1}`;
    await prisma.professor.create({
      data: {
        id: novoId,
        nome: v.nome,
        email: v.email || '—',
        teto: v.teto,
        ativo: v.ativo,
        cursos,
        disponibilidade: [],
        ordem: Math.max(0, ...todos.map((x) => x.ordem)) + 1,
      },
    });
    await loga(u, { id: novoId, name: v.nome }, 'Cadastro criado', v.nome);
    invalidaBase();
    return { id: novoId, msg: `${v.nome} cadastrado.` };
  };
  app.post('/professores', { preHandler: exigeLista }, (req, rep) => salva(req, rep, null));
  app.put('/professores/:id', { preHandler: exigeLista }, (req, rep) =>
    salva(req, rep, (req.params as { id: string }).id),
  );

  /* ---------------- ações da linha ---------------- */
  const ativo = (on: boolean) => async (req: FastifyRequest, rep: FastifyReply) => {
    const u = req.usuario!;
    if (!pode(u, 'desativar')) return rep.code(403).send({ erro: 'Desativar e reativar vão até o Gestor.' });
    const t = profOu404(await base(), (req.params as { id: string }).id, rep);
    if (!t) return;
    if (t.active === on) return rep.code(409).send({ erro: `${t.name} já está ${on ? 'ativo' : 'inativo'}.` });
    await prisma.professor.update({ where: { id: t.id }, data: { ativo: on } });
    await loga(
      u,
      t,
      on ? 'Professor reativado' : 'Professor desativado',
      on ? 'volta a aparecer para alocação' : 'sai da alocação e dos seletores de professor',
    );
    invalidaBase();
    return {
      msg: on
        ? `${t.name} reativado: volta a aparecer para alocação.`
        : `${t.name} desativado: sai da alocação e dos seletores de professor.`,
    };
  };
  app.post('/professores/:id/desativar', { preHandler: exigeLista }, ativo(false));
  app.post('/professores/:id/reativar', { preHandler: exigeLista }, ativo(true));
  app.post('/professores/:id/acessar-como', { preHandler: exigeLista }, async (req, rep) => {
    const u = req.usuario!;
    if (!pode(u, 'como') || u.como) return rep.code(403).send({ erro: 'Sem acesso.' });
    const t = profOu404(await base(), (req.params as { id: string }).id, rep);
    if (!t) return;
    const volta = z
      .object({
        volta: z
          .string()
          .regex(/^\/[\w\-/?=&%.]*$/)
          .max(300)
          .default('/professores'),
      })
      .safeParse(req.body ?? {});
    await prisma.sessao.update({
      where: { id: u.sessaoId },
      data: { comoProfId: t.id, comoAlunoId: null, comoVolta: volta.success ? volta.data.volta : '/professores' },
    });
    await loga(u, t, 'Acesso como o professor', `por ${u.nome}`);
    return { ir: '/inicio' };
  });

  /* ---------------- habilitação ---------------- */
  app.put('/professores/:id/habilitacao/curso', { preHandler: exigeOperar('prof.cursos') }, async (req, rep) => {
    const u = req.usuario!;
    const p = z.object({ curso: z.string() }).safeParse(req.body);
    if (!p.success) return erro400(rep, p.error);
    const b = await base();
    const t = profOu404(b, (req.params as { id: string }).id, rep);
    if (!t) return;
    const c = b.cursos.find((x) => x.name === p.data.curso);
    if (!c) return rep.code(404).send({ erro: 'Curso não encontrado.' });
    const on = t.cursos.includes(c.name);
    const n = crsItens(c).length;
    if (on) {
      const tit = titularDe(t, c);
      if (tit.length)
        return rep.code(409).send({
          erro: `${t.name} é titular de ${tit.join(', ')} em ${c.name}. Troque o professor da turma antes de tirar a habilitação.`,
        });
      const habil = { ...(t.habil ?? {}) };
      delete habil[c.name];
      await gravaHabil(
        t.id,
        t.cursos.filter((x) => x !== c.name),
        habil,
      );
      if (!Object.keys(habil).length)
        await prisma.$executeRaw`UPDATE "Professor" SET habilitacao = NULL WHERE id = ${t.id}`;
      await loga(u, t, 'Habilitação retirada', c.name);
      invalidaBase();
      return {
        msg: `${t.name} não é mais escalado em ${c.name}. As aulas que eram dele passam para os outros habilitados.`,
      };
    }
    await prisma.professor.update({ where: { id: t.id }, data: { cursos: [...t.cursos, c.name] } });
    await loga(u, t, 'Habilitado no curso', c.name);
    invalidaBase();
    return {
      msg: `${t.name} habilitado em ${c.name}${n ? `, em todos os ${n} ${c.estrutura === 'turmas' ? 'turmas' : 'módulos'} — clique neles para recortar` : ''}.`,
    };
  });
  app.put('/professores/:id/habilitacao/item', { preHandler: exigeOperar('prof.cursos') }, async (req, rep) => {
    const u = req.usuario!;
    const p = z.object({ curso: z.string(), item: z.string() }).safeParse(req.body);
    if (!p.success) return erro400(rep, p.error);
    const b = await base();
    const t = profOu404(b, (req.params as { id: string }).id, rep);
    if (!t) return;
    const c = b.cursos.find((x) => x.name === p.data.curso);
    const itens = c ? crsItens(c) : [];
    if (!c || !t.cursos.includes(c.name) || !itens.includes(p.data.item))
      return rep.code(400).send({ erro: 'Habilite o curso antes de recortar os módulos ou turmas.' });
    const x = p.data.item;
    const perm = new Set(permDe(t, c));
    if (perm.has(x)) {
      if (c.turmas.some((y) => y.name === x && y.professor === t.name))
        return rep.code(409).send({
          erro: `${t.name} é titular da ${x} em ${c.name}. Troque o professor da turma antes de tirar a habilitação.`,
        });
      perm.delete(x);
    } else perm.add(x);
    const habil = { ...(t.habil ?? {}) };
    if (!perm.size) {
      delete habil[c.name];
      await gravaHabil(
        t.id,
        t.cursos.filter((y) => y !== c.name),
        habil,
      );
      if (!Object.keys(habil).length)
        await prisma.$executeRaw`UPDATE "Professor" SET habilitacao = NULL WHERE id = ${t.id}`;
      await loga(u, t, 'Habilitação retirada', c.name);
      invalidaBase();
      return {
        msg: `Sem nenhum ${c.estrutura === 'turmas' ? 'turma' : 'módulo'}, ${c.name} saiu da habilitação de ${t.name}.`,
      };
    }
    const lista = itens.filter((y) => perm.has(y));
    if (lista.length === itens.length) delete habil[c.name];
    else habil[c.name] = lista;
    await gravaHabil(t.id, t.cursos, habil);
    if (!Object.keys(habil).length)
      await prisma.$executeRaw`UPDATE "Professor" SET habilitacao = NULL WHERE id = ${t.id}`;
    await loga(
      u,
      t,
      'Habilitação recortada',
      `${c.name} · ${perm.has(x) ? 'incluiu' : 'tirou'} ${x} · ${lista.length} de ${itens.length}`,
    );
    invalidaBase();
    return { msg: '' };
  });

  /* ---------------- disponibilidade ---------------- */
  app.put('/professores/:id/disponibilidade', { preHandler: exigeOperar('prof.disponibilidade') }, async (req, rep) => {
    const u = req.usuario!;
    const p = z.object({ k: z.string().refine(dispChaveValida, 'Hora inválida.') }).safeParse(req.body);
    if (!p.success) return erro400(rep, p.error);
    const b = await base();
    const t = profOu404(b, (req.params as { id: string }).id, rep);
    if (!t) return;
    const disp = dispTroca(prDisp(b, t, agOfertas(b)), p.data.k);
    await prisma.professor.update({ where: { id: t.id }, data: { disponibilidade: disp, dispDefinida: true } });
    await loga(u, t, 'Disponibilidade alterada', `${disp.length} horas disponíveis por semana`);
    invalidaBase();
    return { horas: disp.length };
  });

  /* ---------------- avaliação registrada ---------------- */
  app.post('/professores/:id/avaliacoes', { preHandler: exigeOperar('prof.feedbacks') }, async (req, rep) => {
    const u = req.usuario!;
    const p = z
      .object({
        aula: z
          .string({ message: 'Não há aula dada no período para avaliar.' })
          .min(1, 'Não há aula dada no período para avaliar.'),
        aluno: z.string().min(1, 'Escolha o aluno.'),
        nota: z.coerce.number({ message: 'Dê a nota.' }).int().min(1, 'Dê a nota.').max(5, 'Dê a nota.'),
        texto: z.string().trim().max(2000).default(''),
      })
      .safeParse(req.body);
    if (!p.success) return erro400(rep, p.error);
    const b = await base();
    const t = profOu404(b, (req.params as { id: string }).id, rep);
    if (!t) return;
    const hist = [30, 60, 90].includes(Number((req.query as { hist?: string }).hist))
      ? Number((req.query as { hist?: string }).hist)
      : 60;
    const dadas = fxDadas(b, t.name, hist, agOfertas(b)).slice(0, 30);
    const x = dadas.find((a) => a.k === p.data.aula);
    if (!x) return rep.code(400).send({ erro: 'Não há aula dada no período para avaliar.' });
    if (!dadas.some((a) => a.alunos.includes(p.data.aluno))) return rep.code(400).send({ erro: 'Escolha o aluno.' });
    await prisma.avaliacaoProfessor.create({
      data: {
        professorId: t.id,
        aluno: p.data.aluno,
        curso: x.prod,
        aula: `${agRotulo(x)} · ${fmt.semana(x.quando)}`,
        nota: p.data.nota,
        texto: p.data.texto || 'sem comentário',
        por: u.nome,
      },
    });
    await loga(u, t, 'Avaliação registrada', `${p.data.aluno} · nota ${p.data.nota} · ${agRotulo(x)}`);
    return { msg: `Avaliação de ${p.data.aluno} registrada: nota ${p.data.nota}.` };
  });
}
