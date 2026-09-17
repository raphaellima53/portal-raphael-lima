import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.ts';
import { podeAcao } from '../domain/acesso.ts';
import {
  AL_SIT,
  agHH,
  agIndividual,
  agOfertas,
  alDisp,
  alMat,
  alSit,
  crsItens,
  crsRegras,
  DN,
} from '../domain/agenda.ts';
import {
  alAgenda,
  alAlocacoes,
  alHistorico,
  alLog,
  alMatriculas,
  alOfertas,
  alocAvalia,
  alocAviso,
  alocErro,
  alocLinhas,
  alPerfil,
  alQualidade,
  dispChaveValida,
  dispPainel,
  dispTroca,
  FB_AREAS,
  FB_CANAIS,
  FB_ST,
  FB_TIPOS,
  fichaTopo,
  linhaAluno,
  matTxt,
} from '../domain/alunos.ts';
import { BLACK_VALOR_PADRAO, folhaVeValor } from '../domain/aulas.ts';
import { type AlunoB, type Base, base, invalidaBase } from '../domain/base.ts';
import {
  AnexoIn,
  avancaFeedback,
  criaFeedback,
  FeedbackIn,
  garantirFeedbacks,
  lerAnexos,
} from '../domain/feedbacks-db.ts';
import { podeChave } from '../domain/mapa.ts';
import { fmt } from '../lib/fmt.ts';
import { registra } from '../lib/log.ts';
import type { UsuarioSessao } from '../plugins/sessao.ts';

/** abas da ficha: [chave, rótulo, grupo] (AL_ABAS do portal) */
const AL_ABAS = [
  ['perfil', 'Perfil', 'dados'],
  ['log', 'Log', 'dados'],
  ['cursos', 'Cursos', 'matriculas'],
  ['disponibilidade', 'Disponibilidade', 'matriculas'],
  ['agendamentos', 'Agendamentos', 'historico'],
  ['feedbacks', 'Feedbacks', 'historico'],
] as const;
type Aba = (typeof AL_ABAS)[number][0];
const GRUPOS: Record<string, string> = { dados: 'Dados', matriculas: 'Matrículas', historico: 'Histórico' };
/** abas antigas caem na subaba nova; o 2º item escolhe Próximas ou Passadas */
const ALIAS: Record<string, [Aba, string?]> = {
  matriculas: ['cursos'],
  alocacoes: ['cursos'],
  agenda: ['agendamentos', 'proximas'],
  historico: ['agendamentos', 'passadas'],
};
/** ações da linha por nível (AL_ACAO_NIVEL): Editar até o Editor, Desativar até o Gestor, Excluir só o Administrador */
const AL_ACAO_NIVEL = { editar: 3, desativar: 2, excluir: 1, como: 5 } as const;
const alPode = (u: UsuarioSessao, k: keyof typeof AL_ACAO_NIVEL) => !u.ehAluno && u.nivel <= AL_ACAO_NIVEL[k];
/** o dia a dia da ficha (matrícula, alocação, disponibilidade, feedback) vai até o Colaborador; Visualizador só lê */
const podeOperar = (u: UsuarioSessao) => !u.ehAluno && podeAcao(u.nivel, 'criar');
const quemAula = (u: UsuarioSessao) => ({
  nome: u.nome,
  nivel: u.nivel,
  areas: u.areas,
  tipoPerfil: u.tipoPerfil,
  ehAluno: u.ehAluno,
});

const erro400 = (rep: FastifyReply, e: z.ZodError) => rep.code(400).send({ erro: e.issues[0].message });
const ID = z.object({ id: z.coerce.number().int() });
const IDM = z.object({ id: z.coerce.number().int(), mid: z.coerce.number().int() });

async function exige(req: FastifyRequest, rep: FastifyReply, chaves: string[]) {
  const u = req.usuario;
  if (!u) return rep.code(401).send({ erro: 'Sessão expirada. Entre de novo.' });
  if (u.ehAluno || !chaves.some((c) => podeChave(u, c))) return rep.code(403).send({ erro: 'Sem acesso a esta tela.' });
}
const exigeLista = (req: FastifyRequest, rep: FastifyReply) => exige(req, rep, ['alunos']);
const exigeFicha = (req: FastifyRequest, rep: FastifyReply) =>
  exige(
    req,
    rep,
    AL_ABAS.map(([k]) => `aluno.${k}`),
  );
const exigeOperar = (chave: string) => async (req: FastifyRequest, rep: FastifyReply) => {
  const r = await exige(req, rep, [chave]);
  if (r) return r;
  if (!podeOperar(req.usuario!)) return rep.code(403).send({ erro: 'Seu acesso é só de leitura.' });
};

async function alunoOu404(b: Base, id: number, rep: FastifyReply): Promise<AlunoB | null> {
  const a = b.alunos.find((x) => x.id === id);
  if (!a) {
    rep.code(404).send({ erro: 'Aluno não encontrado. O cadastro pode ter sido excluído.' });
    return null;
  }
  return a;
}
const personasIds = async () =>
  new Set(
    (
      await prisma.usuario.findMany({
        where: { personaLetra: { not: null }, alunoId: { not: null } },
        select: { alunoId: true },
      })
    ).map((u) => u.alunoId!),
  );
const loga = (u: UsuarioSessao, a: { id: number; name: string }, acao: string, detalhe?: string) =>
  registra({ tipo: 'aluno', id: String(a.id), nome: a.name, acao, detalhe, autor: u.nome });

/** turma: a ocupação acompanha quem entra e sai */
async function turmaOcupa(b: Base, curso: string, nome: string | null, d: number) {
  const c = b.cursos.find((x) => x.name === curso);
  if (c?.estrutura !== 'turmas' || !nome) return;
  const t = c.turmas.find((x) => x.name === nome);
  if (!t) return;
  await prisma.turma.update({ where: { id: t.id }, data: { ocupadas: Math.max(0, t.ocupadas + d) } });
}

/** os feedbacks de exemplo nascem na primeira leitura (fbAluno do portal) */
async function feedbacksDe(b: Base, a: AlunoB) {
  await garantirFeedbacks(b, [a]);
  return prisma.feedbackAluno.findMany({
    where: { alunoId: a.id },
    orderBy: [{ quando: 'desc' }, { id: 'desc' }],
    include: { anexos: { select: { id: true, nome: true, tipo: true, tam: true }, orderBy: { id: 'asc' } } },
  });
}

const MatriculaIn = z.object({
  curso: z.string().optional(),
  item: z.string().nullable().optional(),
  modalidade: z.enum(['Online', 'Presencial']),
  total: z.coerce
    .number({ message: 'Informe o pacote de aulas.' })
    .int()
    .min(1, 'Informe o pacote de aulas.')
    .max(9999),
  usadas: z.coerce.number().int().min(0).max(9999).optional(),
});

const AlunoIn = z.object({
  nome: z.string().trim().min(2, 'Informe o nome.').max(160),
  cpf: z
    .string()
    .trim()
    .transform((s) => s.replace(/\D/g, ''))
    .refine((s) => !s || s.length === 11, 'O CPF precisa de 11 dígitos.')
    .default(''),
  status: z.enum(AL_SIT as [string, ...string[]]).default('Ativo'),
  email: z.union([z.literal(''), z.string().trim().email('E-mail inválido.').max(200)]).default(''),
  empresa: z.string().default(''),
  contrato: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Data de contrato inválida.')
    .default(''),
  /** modalidade trocada em cada matrícula ativa, pelo id */
  modalidades: z.record(z.string(), z.enum(['Online', 'Presencial'])).default({}),
  nova: z
    .object({
      curso: z.string(),
      item: z.string().nullable().optional(),
      modalidade: z.enum(['Online', 'Presencial']),
      total: z.coerce.number().int(),
    })
    .nullable()
    .optional(),
});

/** valida a nova matrícula contra o curso: módulo ou turma, pacote e modalidade das regras */
function confereMatricula(b: Base, curso: string, item: string | null | undefined, modalidade: string, total: number) {
  const c = b.cursos.find((x) => x.name === curso && x.active !== false);
  if (!c) return { erro: 'Escolha o curso.' };
  const itens = crsItens(c);
  if (itens.length && (!item || !itens.includes(item))) return { erro: 'Escolha o módulo ou a turma.' };
  if (!(total > 0)) return { erro: 'Informe o pacote de aulas.' };
  if (!crsRegras(c).modalidades.includes(modalidade)) return { erro: 'Modalidade não aceita nas regras do curso.' };
  return { c, item: itens.length ? item! : null };
}

export default async function rotasAlunos(app: FastifyInstance) {
  /* ---------------- opções dos formulários ---------------- */
  app.get('/alunos-opcoes', { preHandler: exigeFicha }, async () => {
    const b = await base();
    const empresas = await prisma.empresa.findMany({ orderBy: { nome: 'asc' }, select: { nome: true } });
    return {
      situacoes: AL_SIT,
      empresas: empresas.map((e) => e.nome),
      cursos: b.cursos
        .filter((c) => c.active !== false)
        .map((c) => ({
          nome: c.name,
          estrutura: c.estrutura,
          itens: crsItens(c),
          modalidades: crsRegras(c).modalidades,
          pacote: crsRegras(c).pacote,
        })),
      fb: { tipos: FB_TIPOS, areas: FB_AREAS, canais: FB_CANAIS, situacoes: FB_ST },
    };
  });

  /* ---------------- lista ---------------- */
  app.get('/alunos', { preHandler: exigeLista }, async (req) => {
    const u = req.usuario!;
    const b = await base();
    const ordem = await prisma.aluno.findMany({ orderBy: [{ ordem: 'asc' }, { id: 'desc' }], select: { id: true } });
    const pos = new Map(ordem.map((x, i) => [x.id, i]));
    const personas = await personasIds();
    return {
      alunos: [...b.alunos]
        .sort((x, y) => (pos.get(x.id) ?? 0) - (pos.get(y.id) ?? 0))
        .map((a) => linhaAluno(b, a, personas)),
      produtos: b.cursos.map((c) => c.name),
      situacoes: AL_SIT,
      pode: {
        criar: podeOperar(u),
        editar: alPode(u, 'editar'),
        desativar: alPode(u, 'desativar'),
        excluir: alPode(u, 'excluir'),
        como: alPode(u, 'como'),
        ficha: AL_ABAS.some(([k]) => podeChave(u, `aluno.${k}`)),
      },
    };
  });

  /* ---------------- ficha ---------------- */
  app.get('/alunos/:id', { preHandler: exigeFicha }, async (req, rep) => {
    const u = req.usuario!;
    const { id } = ID.parse(req.params);
    const q = req.query as Record<string, string | undefined>;
    const b = await base();
    const a = await alunoOu404(b, id, rep);
    if (!a) return;
    const ok = AL_ABAS.filter(([k]) => podeChave(u, `aluno.${k}`));
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

    let dados: unknown;
    if (aba === 'perfil') {
      const fb = await feedbacksDe(b, a);
      const ult = await prisma.logAlteracao.findFirst({
        where: { entidade: 'Aluno', entidadeId: String(a.id) },
        orderBy: { quando: 'desc' },
      });
      dados = alPerfil(b, a, ofs, hist, {
        abertos: fb.filter((x) => x.status !== 'Concluído').length,
        ultima: ult ? { quando: ult.quando, acao: ult.acao } : null,
      });
    } else if (aba === 'log') {
      const vivos = await prisma.logAlteracao.findMany({
        where: { entidade: 'Aluno', entidadeId: String(a.id) },
        orderBy: { quando: 'desc' },
      });
      dados = alLog(
        a,
        vivos.map((v) => ({ quando: v.quando, autor: v.autor, acao: v.acao, detalhe: v.detalhe, vezes: v.vezes })),
        agora,
      );
    } else if (aba === 'cursos') {
      dados = {
        ...alMatriculas(b, a, ofs),
        alocacao: podeChave(u, 'aluno.alocacao')
          ? alAlocacoes(b, a, ofs, folhaVeValor(quemAula(u)), BLACK_VALOR_PADRAO)
          : null,
      };
    } else if (aba === 'disponibilidade') {
      dados = {
        ...dispPainel(alDisp(b, a, ofs), alOfertas(ofs, a)),
        abrirAlocacao: podeChave(u, 'aluno.alocacao'),
      };
    } else if (aba === 'agendamentos') {
      if (quando === 'passadas') dados = { quando, ...alHistorico(b, a, hist, ofs, agora) };
      else {
        const dias = [7, 14, 30].includes(Number(q.dias)) ? Number(q.dias) : 14;
        dados = { quando, ...alAgenda(b, a, dias, ofs, agora) };
      }
    } else {
      const fb = await feedbacksDe(b, a);
      const conta = (t: string) => fb.filter((x) => x.tipo === t).length;
      dados = {
        dias: hist,
        pontos: alQualidade(b, a, hist, ofs, agora),
        stats: [
          { valor: String(fb.length), rotulo: 'registros' },
          { valor: String(conta('Reclamação')), rotulo: 'reclamações', tom: conta('Reclamação') ? 'red' : undefined },
          { valor: String(conta('Elogio')), rotulo: 'elogios', tom: conta('Elogio') ? 'green' : undefined },
          { valor: String(conta('Sugestão')), rotulo: 'sugestões' },
          {
            valor: String(conta('Qualidade')),
            rotulo: 'ocorrências de qualidade',
            tom: conta('Qualidade') ? 'amber' : undefined,
          },
          {
            valor: String(fb.filter((x) => x.status !== 'Concluído').length),
            rotulo: 'sem tratativa concluída',
            tom: fb.some((x) => x.status === 'Aberto') ? 'amber' : undefined,
          },
        ],
        cursos: [...new Set(alMat(a).map((e) => e.curso))],
        lista: fb.map((f) => ({
          id: f.id,
          data: fmt.data(f.quando),
          dataCompleta: fmt.dataHora(f.quando),
          tipo: f.tipo,
          tipoTom: FB_TIPOS.find((x) => x[0] === f.tipo)?.[1] ?? 'gray',
          area: f.area,
          curso: f.curso,
          canal: f.canal,
          texto: f.texto,
          por: f.por,
          status: f.status,
          statusTom: FB_ST.find((x) => x[0] === f.status)?.[1] ?? 'gray',
          anexos: f.anexos.map((x) => ({ id: x.id, nome: x.nome, img: x.tipo.startsWith('image/'), tam: x.tam })),
        })),
      };
    }
    const personas = await personasIds();
    return {
      ...fichaTopo(b, a, ofs, hist, agora),
      grupos,
      aba,
      quando,
      dados,
      persona: personas.has(a.id),
      inativo: alSit(a) === 'Inativo',
      pode: {
        editar: alPode(u, 'editar'),
        desativar: alPode(u, 'desativar'),
        excluir: alPode(u, 'excluir') && !personas.has(a.id),
        como: alPode(u, 'como'),
        operar: podeOperar(u),
        agenda: podeChave(u, 'agenda'),
      },
    };
  });

  /* ---------------- cadastro: novo e editar ---------------- */
  app.get('/alunos/:id/form', { preHandler: exigeLista }, async (req, rep) => {
    const { id } = ID.parse(req.params);
    const b = await base();
    const a = await alunoOu404(b, id, rep);
    if (!a) return;
    return {
      nome: a.name,
      cpf: a.cpf ?? '',
      status: alSit(a),
      email: a.email === '—' ? '' : a.email,
      empresa: a.empresa ?? '',
      contrato: a.contratoFim ? fmt.iso(a.contratoFim) : '',
      matriculas: alMat(a).map((e) => ({
        id: e.id,
        curso: e.curso,
        item: e.modulo,
        modalidade: e.modalidade || 'Online',
        usadas: e.usadas,
        total: e.total,
      })),
    };
  });

  const salvaAluno = async (req: FastifyRequest, rep: FastifyReply, id: number | null) => {
    const u = req.usuario!;
    if (id == null ? !podeOperar(u) : !alPode(u, 'editar'))
      return rep.code(403).send({ erro: 'Seu acesso não permite alterar o cadastro do aluno.' });
    const p = AlunoIn.safeParse(req.body);
    if (!p.success) return erro400(rep, p.error);
    const v = p.data;
    const b = await base();
    const antes = id == null ? null : await alunoOu404(b, id, rep);
    if (id != null && !antes) return;
    let nova: ReturnType<typeof confereMatricula> | null = null;
    if (v.nova?.curso) {
      if (!(v.nova.total > 0)) return rep.code(400).send({ erro: 'Informe o pacote de aulas da nova matrícula.' });
      nova = confereMatricula(b, v.nova.curso, v.nova.item, v.nova.modalidade, v.nova.total);
      if ('erro' in nova) return rep.code(400).send({ erro: nova.erro });
    }
    const emp = v.empresa ? await prisma.empresa.findUnique({ where: { nome: v.empresa } }) : null;
    if (v.empresa && !emp) return rep.code(400).send({ erro: 'Empresa não encontrada.' });
    const dados = {
      nome: v.nome,
      email: v.email || '—',
      emailPlaceholder: !v.email,
      cpf: v.cpf,
      status: v.status,
      desativadoEm: v.status === 'Cancelado' || v.status === 'Inativo' ? (antes?.desativadoEm ?? new Date()) : null,
      empresaId: emp?.id ?? null,
      contratoFim: v.contrato ? new Date(`${v.contrato}T00:00:00Z`) : null,
    };
    let alunoId = id;
    if (id == null) {
      const topo = await prisma.aluno.aggregate({ _min: { ordem: true } });
      const criado = await prisma.aluno.create({
        data: { ...dados, ordem: (topo._min.ordem ?? 0) - 1, disponibilidade: [] },
      });
      alunoId = criado.id;
    } else {
      await prisma.aluno.update({ where: { id }, data: dados });
      for (const e of alMat(antes!)) {
        const m = v.modalidades[String(e.id)];
        if (m && m !== (e.modalidade || 'Online'))
          await prisma.matricula.update({ where: { id: e.id }, data: { modalidade: m } });
      }
    }
    if (nova && !('erro' in nova)) {
      const ordem = antes ? antes.matriculas.length : 0;
      await prisma.matricula.create({
        data: {
          alunoId: alunoId!,
          cursoId: nova.c.id,
          modulo: nova.item,
          usadas: 0,
          total: v.nova!.total,
          modalidade: v.nova!.modalidade,
          ordem,
        },
      });
      await turmaOcupa(b, nova.c.name, nova.item, 1);
    }
    invalidaBase();
    const nb = await base();
    const depois = nb.alunos.find((x) => x.id === alunoId)!;
    if (id == null) {
      await loga(u, depois, 'Cadastro criado', depois.name);
      return { id: alunoId, msg: `${depois.name} cadastrado.` };
    }
    const foto = (a: AlunoB) => [
      a.name,
      a.email,
      a.cpf || null,
      alSit(a),
      a.empresa,
      a.contratoFim ? fmt.iso(a.contratoFim) : null,
      a.matriculas.map((e) => [e.curso, e.modalidade || 'Online', !!e.desativadoEm]),
    ];
    const CAMPOS = ['nome', 'e-mail', 'CPF', 'situação', 'empresa', 'contrato', 'matrículas'];
    const f0 = foto(antes!);
    const f1 = foto(depois);
    const mud = CAMPOS.filter((_, j) => JSON.stringify(f0[j]) !== JSON.stringify(f1[j]));
    if (mud.length) await loga(u, depois, 'Dados editados', mud.join(', '));
    return { id: alunoId, msg: mud.length ? `Dados de ${depois.name} salvos.` : 'Nada mudou no cadastro.' };
  };
  app.post('/alunos', { preHandler: exigeLista }, (req, rep) => salvaAluno(req, rep, null));
  app.put('/alunos/:id', { preHandler: exigeLista }, (req, rep) => salvaAluno(req, rep, ID.parse(req.params).id));

  /* ---------------- ações da linha ---------------- */
  app.post('/alunos/:id/desativar', { preHandler: exigeLista }, async (req, rep) => {
    const u = req.usuario!;
    if (!alPode(u, 'desativar')) return rep.code(403).send({ erro: 'Desativar vai até o Gestor.' });
    const { id } = ID.parse(req.params);
    const a = await alunoOu404(await base(), id, rep);
    if (!a) return;
    if (alSit(a) === 'Inativo') return rep.code(409).send({ erro: `${a.name} já está inativo.` });
    await prisma.aluno.update({
      where: { id },
      data: { statusAntes: alSit(a), status: 'Inativo', desativadoEm: new Date() },
    });
    await loga(u, a, 'Aluno desativado', `estava ${alSit(a)}`);
    invalidaBase();
    return { msg: `${a.name} desativado. Dá para reativar pelo mesmo menu.` };
  });
  app.post('/alunos/:id/reativar', { preHandler: exigeLista }, async (req, rep) => {
    const u = req.usuario!;
    if (!alPode(u, 'desativar')) return rep.code(403).send({ erro: 'Reativar vai até o Gestor.' });
    const { id } = ID.parse(req.params);
    const a = await alunoOu404(await base(), id, rep);
    if (!a) return;
    if (alSit(a) !== 'Inativo') return rep.code(409).send({ erro: `${a.name} não está inativo.` });
    const reg = await prisma.aluno.findUnique({ where: { id }, select: { statusAntes: true } });
    const volta = reg?.statusAntes && reg.statusAntes !== 'Inativo' ? reg.statusAntes : 'Ativo';
    await prisma.aluno.update({
      where: { id },
      data: { status: volta, statusAntes: null, desativadoEm: volta === 'Cancelado' ? a.desativadoEm : null },
    });
    await loga(u, a, 'Aluno reativado', `volta como ${volta}`);
    invalidaBase();
    return { msg: `${a.name} reativado como ${volta}.` };
  });
  app.delete('/alunos/:id', { preHandler: exigeLista }, async (req, rep) => {
    const u = req.usuario!;
    if (!alPode(u, 'excluir')) return rep.code(403).send({ erro: 'Excluir aluno é só do Administrador.' });
    const { id } = ID.parse(req.params);
    const b = await base();
    const a = await alunoOu404(b, id, rep);
    if (!a) return;
    if ((await personasIds()).has(id))
      return rep.code(409).send({ erro: 'Persona de teste não se exclui. Use Desativar.' });
    const n = alMat(a).length;
    for (const e of alMat(a)) await turmaOcupa(b, e.curso, e.modulo, -1);
    await prisma.$transaction([
      prisma.usuario.updateMany({ where: { alunoId: id }, data: { alunoId: null } }),
      prisma.aluno.delete({ where: { id } }),
    ]);
    await loga(u, a, 'Aluno excluído', `${n} matrículas ativas`);
    invalidaBase();
    return { msg: `${a.name} foi excluído da base.` };
  });
  app.post('/alunos/:id/acessar-como', { preHandler: exigeLista }, async (req, rep) => {
    const u = req.usuario!;
    if (!alPode(u, 'como')) return rep.code(403).send({ erro: 'Sem acesso.' });
    const { id } = ID.parse(req.params);
    const a = await alunoOu404(await base(), id, rep);
    if (!a) return;
    const volta = z
      .object({
        volta: z
          .string()
          .regex(/^\/[\w\-/?=&%.]*$/)
          .max(300)
          .default('/alunos'),
      })
      .safeParse(req.body ?? {});
    await prisma.sessao.update({
      where: { id: u.sessaoId },
      data: { comoAlunoId: id, comoProfId: null, comoVolta: volta.success ? volta.data.volta : '/alunos' },
    });
    await loga(u, a, 'Acesso como o aluno', `por ${u.nome}`);
    return { ir: '/minha-area' };
  });

  /* ---------------- matrículas ---------------- */
  app.post('/alunos/:id/matriculas', { preHandler: exigeOperar('aluno.cursos') }, async (req, rep) => {
    const u = req.usuario!;
    const { id } = ID.parse(req.params);
    const p = MatriculaIn.safeParse(req.body);
    if (!p.success) return erro400(rep, p.error);
    const b = await base();
    const a = await alunoOu404(b, id, rep);
    if (!a) return;
    const r = confereMatricula(b, p.data.curso ?? '', p.data.item, p.data.modalidade, p.data.total);
    if ('erro' in r) return rep.code(400).send({ erro: r.erro });
    await prisma.matricula.create({
      data: {
        alunoId: id,
        cursoId: r.c.id,
        modulo: r.item,
        usadas: 0,
        total: p.data.total,
        modalidade: p.data.modalidade,
        ordem: a.matriculas.length,
      },
    });
    await turmaOcupa(b, r.c.name, r.item, 1);
    const txt = matTxt({ curso: r.c.name, modulo: r.item });
    await loga(u, a, 'Nova matrícula', `${txt} · ${p.data.modalidade} · 0/${p.data.total} aulas`);
    invalidaBase();
    return {
      msg: `${a.name} matriculado em ${r.c.name}${r.item ? ` · ${r.item}` : ''}. Veja o horário e a alocação logo abaixo, em Cursos.`,
    };
  });
  app.put('/alunos/:id/matriculas/:mid', { preHandler: exigeOperar('aluno.cursos') }, async (req, rep) => {
    const u = req.usuario!;
    const { id, mid } = IDM.parse(req.params);
    const p = MatriculaIn.safeParse(req.body);
    if (!p.success) return erro400(rep, p.error);
    const b = await base();
    const a = await alunoOu404(b, id, rep);
    if (!a) return;
    const e = alMat(a).find((x) => x.id === mid);
    if (!e) return rep.code(404).send({ erro: 'Matrícula não encontrada.' });
    const c = b.cursos.find((x) => x.name === e.curso);
    const itens = c ? crsItens(c) : [];
    if (itens.length && (!p.data.item || !itens.includes(p.data.item)))
      return rep.code(400).send({ erro: 'Escolha o módulo ou a turma.' });
    const usadas = Math.max(0, p.data.usadas ?? 0);
    if (usadas > p.data.total) return rep.code(400).send({ erro: 'Aulas usadas não podem passar do pacote.' });
    if (c && !crsRegras(c).modalidades.includes(p.data.modalidade))
      return rep.code(400).send({ erro: 'Modalidade não aceita nas regras do curso.' });
    const item = itens.length ? p.data.item! : null;
    const mesmo = (e.modulo ?? null) === item;
    if (!mesmo) {
      await turmaOcupa(b, e.curso, e.modulo, -1);
      await turmaOcupa(b, e.curso, item, 1);
    }
    await prisma.matricula.update({
      where: { id: mid },
      data: {
        modulo: item,
        usadas,
        total: p.data.total,
        modalidade: p.data.modalidade,
        ...(mesmo ? {} : { alocacao: undefined }),
      },
    });
    if (!mesmo) await prisma.$executeRaw`UPDATE "Matricula" SET alocacao = NULL WHERE id = ${mid}`;
    const mudou =
      !mesmo || usadas !== e.usadas || p.data.total !== e.total || p.data.modalidade !== (e.modalidade || 'Online');
    if (mudou)
      await loga(
        u,
        a,
        'Matrícula editada',
        `${matTxt({ curso: e.curso, modulo: item })} · ${p.data.modalidade} · ${usadas}/${p.data.total} aulas`,
      );
    invalidaBase();
    return { msg: mudou ? `Matrícula em ${e.curso} salva.` : 'Nada mudou na matrícula.' };
  });
  app.post('/alunos/:id/matriculas/:mid/encerrar', { preHandler: exigeOperar('aluno.cursos') }, async (req, rep) => {
    const u = req.usuario!;
    const { id, mid } = IDM.parse(req.params);
    const b = await base();
    const a = await alunoOu404(b, id, rep);
    if (!a) return;
    const e = alMat(a).find((x) => x.id === mid);
    if (!e) return rep.code(404).send({ erro: 'Matrícula ativa não encontrada.' });
    await turmaOcupa(b, e.curso, e.modulo, -1);
    await prisma.matricula.update({ where: { id: mid }, data: { desativadoEm: new Date() } });
    await loga(u, a, 'Matrícula encerrada', matTxt(e));
    invalidaBase();
    return { msg: `Matrícula em ${e.curso} encerrada — saiu da grade e da agenda. Dá para reativar logo abaixo.` };
  });
  app.post('/alunos/:id/matriculas/:mid/reativar', { preHandler: exigeOperar('aluno.cursos') }, async (req, rep) => {
    const u = req.usuario!;
    const { id, mid } = IDM.parse(req.params);
    const b = await base();
    const a = await alunoOu404(b, id, rep);
    if (!a) return;
    const e = a.matriculas.find((x) => x.id === mid && x.desativadoEm);
    if (!e) return rep.code(404).send({ erro: 'Matrícula encerrada não encontrada.' });
    await turmaOcupa(b, e.curso, e.modulo, 1);
    await prisma.matricula.update({ where: { id: mid }, data: { desativadoEm: null } });
    await loga(u, a, 'Matrícula reativada', matTxt(e));
    invalidaBase();
    return { msg: `Matrícula em ${e.curso} reativada — volta à grade e à agenda.` };
  });

  /* ---------------- alocação ---------------- */
  const AlocIn = z.object({
    prof: z.string().max(160).default(''),
    dias: z.array(z.number().int().min(1).max(6)).max(6).default([]),
    hora: z.number().int().min(7).max(21),
    valor: z.number().int().min(0).max(100000).optional(),
  });
  const alocContexto = async (req: FastifyRequest, rep: FastifyReply) => {
    const { id, mid } = IDM.parse(req.params);
    const b = await base();
    const a = await alunoOu404(b, id, rep);
    if (!a) return null;
    const e = alMat(a).find((x) => x.id === mid);
    const c = e && b.cursos.find((x) => x.name === e.curso);
    if (!e || !c) {
      rep.code(404).send({ erro: 'Matrícula ativa não encontrada.' });
      return null;
    }
    return { b, a, e, c };
  };
  app.post(
    '/alunos/:id/matriculas/:mid/alocacao/previa',
    { preHandler: exigeOperar('aluno.alocacao') },
    async (req, rep) => {
      const ctx = await alocContexto(req, rep);
      if (!ctx) return;
      const p = AlocIn.safeParse(req.body);
      if (!p.success) return erro400(rep, p.error);
      const { b, a, e, c } = ctx;
      const r = alocAvalia(b, a, c.name, e.modulo, p.data.prof, p.data.dias, p.data.hora, agOfertas(b));
      return { checagem: alocLinhas(r, crsRegras(c).exigeDisp, true) };
    },
  );
  app.put('/alunos/:id/matriculas/:mid/alocacao', { preHandler: exigeOperar('aluno.alocacao') }, async (req, rep) => {
    const u = req.usuario!;
    const ctx = await alocContexto(req, rep);
    if (!ctx) return;
    const p = AlocIn.safeParse(req.body);
    if (!p.success) return erro400(rep, p.error);
    const { b, a, e, c } = ctx;
    if (!agIndividual(c, e.modulo))
      return rep.code(400).send({ erro: 'Turma e módulo em grupo trocam de item, não de horário.' });
    const f = { ...p.data, dias: [...new Set(p.data.dias)].sort() };
    if (f.prof && !b.professores.some((t) => t.name === f.prof))
      return rep.code(400).send({ erro: 'Professor não encontrado.' });
    const r = alocAvalia(b, a, c.name, e.modulo, f.prof, f.dias, f.hora, agOfertas(b));
    const erro = alocErro(c, f, r);
    if (erro) return rep.code(409).send({ erro: `${erro} Nada foi salvo.` });
    const veValor = folhaVeValor(quemAula(u)) && c.estrutura === 'nenhuma';
    const valor = veValor && f.valor != null ? f.valor : e.aloc?.valor;
    const aloc = { prof: f.prof, dias: f.dias, hora: f.hora, ...(valor != null ? { valor } : {}) };
    await prisma.matricula.update({ where: { id: e.id }, data: { alocacao: aloc } });
    await loga(
      u,
      a,
      'Alocação salva',
      `${matTxt(e)} · ${f.prof} · ${f.dias.map((d) => DN[d]).join(' e ')} ${agHH(f.hora)}`,
    );
    if (veValor && f.valor != null && e.aloc?.valor !== f.valor)
      await registra({
        tipo: 'config',
        id: 'alocacao',
        nome: 'Alocação',
        acao: 'Valor hora/aula da alocação',
        detalhe: `${a.name} · ${c.name} · ${f.prof} · R$ ${f.valor}`,
        autor: u.nome,
      });
    invalidaBase();
    return { msg: alocAviso(r), aviso: r.foraA.length > 0 };
  });
  app.delete(
    '/alunos/:id/matriculas/:mid/alocacao',
    { preHandler: exigeOperar('aluno.alocacao') },
    async (req, rep) => {
      const u = req.usuario!;
      const ctx = await alocContexto(req, rep);
      if (!ctx) return;
      if (!ctx.e.aloc) return { msg: 'Já está na sugestão da grade.' };
      await prisma.$executeRaw`UPDATE "Matricula" SET alocacao = NULL WHERE id = ${ctx.e.id}`;
      await loga(u, ctx.a, 'Alocação voltou à sugestão da grade', matTxt(ctx.e));
      invalidaBase();
      return { msg: 'Voltou à sugestão da grade.' };
    },
  );
  app.post('/alunos/:id/matriculas/:mid/item', { preHandler: exigeOperar('aluno.alocacao') }, async (req, rep) => {
    const u = req.usuario!;
    const ctx = await alocContexto(req, rep);
    if (!ctx) return;
    const { b, a, e, c } = ctx;
    const p = z.object({ item: z.string() }).safeParse(req.body);
    if (!p.success) return erro400(rep, p.error);
    const eTurma = c.estrutura === 'turmas';
    const novo = p.data.item;
    if (novo === e.modulo)
      return rep.code(400).send({ erro: `Escolha ${eTurma ? 'outra turma' : 'outro módulo'} na lista.` });
    if (!crsItens(c).includes(novo) || novo === 'Private FLOW')
      return rep.code(400).send({ erro: `${eTurma ? 'Turma' : 'Módulo'} não encontrado neste curso.` });
    const t = eTurma ? c.turmas.find((z) => z.name === novo) : undefined;
    if (t && t.ocupadas >= t.vagas) return rep.code(409).send({ erro: `${novo} está lotada.` });
    await turmaOcupa(b, c.name, e.modulo, -1);
    await turmaOcupa(b, c.name, novo, 1);
    await prisma.$executeRaw`UPDATE "Matricula" SET modulo = ${novo}, alocacao = NULL WHERE id = ${e.id}`;
    await loga(u, a, 'Mudou de turma ou módulo', `${c.name} · ${e.modulo} → ${novo}`);
    invalidaBase();
    return { msg: `Agora em ${novo}. A grade e a agenda já mostram o novo horário.` };
  });

  /* ---------------- disponibilidade ---------------- */
  app.put('/alunos/:id/disponibilidade', { preHandler: exigeOperar('aluno.disponibilidade') }, async (req, rep) => {
    const u = req.usuario!;
    const { id } = ID.parse(req.params);
    const p = z.object({ k: z.string().refine(dispChaveValida, 'Hora inválida.') }).safeParse(req.body);
    if (!p.success) return erro400(rep, p.error);
    const b = await base();
    const a = await alunoOu404(b, id, rep);
    if (!a) return;
    const disp = dispTroca(alDisp(b, a, agOfertas(b)), p.data.k);
    await prisma.aluno.update({ where: { id }, data: { disponibilidade: disp, dispDefinida: true } });
    await loga(u, a, 'Disponibilidade alterada', `${disp.length} horas disponíveis por semana`);
    invalidaBase();
    return { horas: disp.length };
  });

  /* ---------------- feedbacks ---------------- */
  app.post(
    '/alunos/:id/feedbacks',
    { preHandler: exigeOperar('aluno.feedbacks'), bodyLimit: 80 * 1024 * 1024 },
    async (req, rep) => {
      const u = req.usuario!;
      const { id } = ID.parse(req.params);
      const p = FeedbackIn.safeParse(req.body);
      if (!p.success) return erro400(rep, p.error);
      const b = await base();
      const a = await alunoOu404(b, id, rep);
      if (!a) return;
      const r = await criaFeedback(b, a, u.nome, p.data);
      if ('erro' in r) return rep.code(400).send({ erro: r.erro });
      return r;
    },
  );
  const fbContexto = async (req: FastifyRequest, rep: FastifyReply) => {
    const { id, fid } = z.object({ id: z.coerce.number().int(), fid: z.coerce.number().int() }).parse(req.params);
    const b = await base();
    const a = await alunoOu404(b, id, rep);
    if (!a) return null;
    const f = await prisma.feedbackAluno.findFirst({ where: { id: fid, alunoId: id } });
    if (!f) {
      rep.code(404).send({ erro: 'Registro não encontrado.' });
      return null;
    }
    return { a, f };
  };
  app.post('/alunos/:id/feedbacks/:fid/avancar', { preHandler: exigeOperar('aluno.feedbacks') }, async (req, rep) => {
    const u = req.usuario!;
    const ctx = await fbContexto(req, rep);
    if (!ctx) return;
    const { a, f } = ctx;
    const r = await avancaFeedback(a, f, u.nome);
    if ('erro' in r) return rep.code(409).send({ erro: r.erro });
    return r;
  });
  app.post(
    '/alunos/:id/feedbacks/:fid/anexos',
    { preHandler: exigeOperar('aluno.feedbacks'), bodyLimit: 80 * 1024 * 1024 },
    async (req, rep) => {
      const u = req.usuario!;
      const ctx = await fbContexto(req, rep);
      if (!ctx) return;
      const p = z.object({ anexos: z.array(AnexoIn).max(5, 'Envie até 5 arquivos por vez.') }).safeParse(req.body);
      if (!p.success) return erro400(rep, p.error);
      if (!p.data.anexos.length) return rep.code(400).send({ erro: 'Escolha ao menos um arquivo.' });
      const r = lerAnexos(p.data.anexos);
      if ('erro' in r) return rep.code(400).send({ erro: r.erro });
      await prisma.anexo.createMany({ data: r.anexos.map((x) => ({ ...x, feedbackId: ctx.f.id })) });
      await loga(u, ctx.a, 'Anexo incluído', `${ctx.f.tipo} · ${r.anexos.map((x) => x.nome).join(', ')}`);
      const n = r.anexos.length;
      return {
        msg: `${n} ${n === 1 ? 'arquivo anexado' : 'arquivos anexados'} ao registro de ${ctx.f.area.toLowerCase()}.`,
      };
    },
  );
  app.get('/anexos/:aid', { preHandler: exigeFicha }, async (req, rep) => {
    const { aid } = z.object({ aid: z.coerce.number().int() }).parse(req.params);
    const x = await prisma.anexo.findUnique({ where: { id: aid } });
    if (!x) return rep.code(404).send({ erro: 'Anexo não encontrado.' });
    const img = x.tipo.startsWith('image/');
    return rep
      .header('Content-Type', x.tipo)
      .header('Cross-Origin-Resource-Policy', 'same-site')
      .header('Cache-Control', 'private, max-age=3600')
      .header('Content-Disposition', `${img ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(x.nome)}`)
      .send(Buffer.from(x.dados));
  });
}
