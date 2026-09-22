/**
 * Configurações › Pessoas e acessos: Usuários (lista, ações em massa, novo e editar), Perfis e hierarquias,
 * Sessões e acessos e Documentação › Personas de teste. Só o tipo de perfil Admin abre Configurações.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.ts';
import {
  ACOES,
  AREAS,
  type AreaId,
  type Areas,
  acessoResumo,
  areasDaTela,
  MATRIZ,
  NIVEIS,
  nivelDe,
  PERFIS,
  PERFIS_SISTEMA,
  perfilNome,
  RECORTES,
} from '../domain/acesso.ts';
import { restauraModelo, salvaModelo } from '../domain/acesso-modelo.ts';
import { acessoDaPessoa } from '../domain/acesso-pessoa.ts';
import { base } from '../domain/base.ts';
import {
  acessoTelas,
  dispositivo,
  ipCurto,
  NU_SEG,
  nuRotulo,
  nuTelas,
  SES_POL,
  setoresDetalhe,
  USU_STATUS,
} from '../domain/configuracoes.ts';
import { podeChave, TELAS_MAPA } from '../domain/mapa.ts';
import { Prisma } from '../generated/prisma/client.ts';
import { logAcesso } from '../lib/acesso-log.ts';
import { fmt } from '../lib/fmt.ts';
import { registra } from '../lib/log.ts';
import { abreSessao, fechaSessao, type UsuarioSessao } from '../plugins/sessao.ts';

export async function exigeCfg(req: FastifyRequest, rep: FastifyReply) {
  const u = req.usuario;
  if (!u) return rep.code(401).send({ erro: 'Sessão expirada. Entre de novo.' });
  if (u.ehAluno || !podeChave(u, 'cfg'))
    return rep.code(403).send({ erro: 'Só o tipo de perfil Admin abre Configurações.' });
}
/** registro na Auditoria com o nome da tela de Configurações (cfgLog) */
export const cfgLog = (u: UsuarioSessao, tela: string, acao: string, detalhe: string, motivo?: string) =>
  registra({
    tipo: 'config',
    id: tela,
    nome: TELAS_MAPA.find((t) => t.tela === tela)?.label ?? tela,
    acao,
    detalhe,
    autor: u.nome,
    motivo,
  });
export const erro400 = (rep: FastifyReply, e: z.ZodError) => rep.code(400).send({ erro: e.issues[0].message });

const perfilDe = (id: number | null) => PERFIS.find((p) => p.id === id) ?? null;
const ehAdmin1 = (x: { perfilId: number | null; nivel: number; status: string }) =>
  x.status === 'Ativo' && x.nivel === 1 && perfilDe(x.perfilId)?.perfil === 'Admin';
const relativo = (d: Date, agora = new Date()) => {
  const min = Math.max(0, Math.round((+agora - +d) / 6e4));
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  return fmt.dataHora(d);
};

const Setores = z.record(z.string(), z.enum(['total', 'restrito']));
/** os setores escolhidos no formulário viram áreas com o rótulo do cargo (nuArea + nuRotulo) */
const areasDe = (perfilId: number | null, setores: Record<string, 'total' | 'restrito'>): Areas => {
  const out: Areas = {};
  for (const ar of AREAS) {
    const v = setores[ar.id];
    if (v) out[ar.id] = { acesso: v, rotulo: nuRotulo(perfilId, ar.id as AreaId, v) };
  }
  return out;
};

const UsuarioIn = z.object({
  nome: z.string().trim().max(160).default(''),
  email: z.string().trim().toLowerCase().max(200).default(''),
  perfilId: z.number().int().nullable().default(null),
  nivel: z.number().int().min(0).max(5).default(0),
  setores: Setores.default({}),
  pessoa: z.string().trim().max(200).default(''),
  colaborador: z.string().trim().max(200).default(''),
  /** um ID, vários perfis: o aluno e o professor vinculados ao usuário (ausente = não mexe) */
  alunoId: z.number().int().nullable().optional(),
  professor: z.string().trim().max(200).optional(),
  telefone: z.string().trim().max(40).default(''),
  validoAte: z.string().max(10).default(''),
  responsavel: z.string().trim().max(200).default(''),
  justificativa: z.string().trim().max(500).default(''),
  observacoes: z.string().trim().max(2000).default(''),
  seguranca: z.record(z.string(), z.boolean()).default({}),
  convite: z.boolean().default(true),
  /* adequação ao Portal Alumni: foto do perfil e troca de senha obrigatória no próximo login */
  foto: z.union([z.literal(''), z.string().trim().url('Endereço da foto inválido.').max(500)]).default(''),
  trocarSenha: z.boolean().default(false),
});

export default async function rotasConfigAcessos(app: FastifyInstance) {
  /* ================= Usuários ================= */
  app.get('/config/usuarios', { preHandler: exigeCfg }, async (req) => {
    const eu = req.usuario!;
    const [us, ult] = await Promise.all([
      prisma.usuario.findMany({ orderBy: [{ ordem: 'asc' }, { id: 'asc' }] }),
      prisma.sessao.groupBy({ by: ['usuarioId'], _max: { criadaEm: true } }),
    ]);
    const ultimo = new Map(ult.map((x) => [x.usuarioId, x._max.criadaEm]));
    const agora = Date.now();
    const linhas = us.map((u) => {
      const p = perfilDe(u.perfilId);
      const perfil = p ? perfilNome(p) : (u.perfilLegado ?? '—');
      const d = ultimo.get(u.id);
      const txt = d ? fmt.dataHora(d) : (u.ultimoAcesso ?? 'nunca acessou');
      const dias = String(txt).match(/há (\d+) dias/);
      return {
        id: u.id,
        nome: u.nome,
        email: u.email,
        perfil,
        perfilTom: perfil === 'Administrador' ? 'red' : perfil === 'Auditor' ? 'purple' : 'blue',
        resumo: p ? acessoResumo({ nivel: u.nivel, areas: u.areas as Areas }, p) : (u.escopoLegado ?? '—'),
        mfa: u.mfa,
        ultimo: txt,
        nunca: txt === 'nunca acessou',
        sem30: txt === 'nunca acessou' || (dias ? +dias[1] >= 30 : d ? agora - +d >= 30 * 864e5 : false),
        status: u.status,
        statusTom: USU_STATUS[u.status] ?? 'gray',
        persona: u.personaLetra,
        eu: u.id === eu.id,
      };
    });
    const n = (f: (l: (typeof linhas)[number]) => boolean) => linhas.filter(f).length;
    const pl = (k: number, um: string, varios: string) => (k === 1 ? um : varios);
    const conv = n((l) => l.status === 'Convite pendente');
    const bloq = n((l) => l.status === 'Bloqueado');
    return {
      linhas,
      stats: [
        { v: linhas.length, t: 'usuários' },
        { v: n((l) => l.status === 'Ativo'), t: 'ativos', tom: 'green' },
        { v: conv, t: pl(conv, 'convite pendente', 'convites pendentes'), tom: 'amber' },
        { v: bloq, t: pl(bloq, 'bloqueado', 'bloqueados'), tom: 'red' },
        { v: n((l) => l.mfa), t: 'com MFA', tom: 'green' },
        { v: n((l) => l.sem30), t: 'sem acesso há 30+ dias', tom: 'amber' },
      ],
      perfis: [...new Set(linhas.map((l) => l.perfil))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
      status: Object.keys(USU_STATUS),
    };
  });

  app.post('/config/usuarios/massa', { preHandler: exigeCfg }, async (req, rep) => {
    const eu = req.usuario!;
    const r = z
      .object({
        acao: z.enum(['convite', 'mfa', 'bloquear', 'ativar']),
        ids: z.array(z.number().int()).min(1).max(500),
      })
      .safeParse(req.body);
    if (!r.success) return rep.code(400).send({ erro: 'Selecione ao menos um usuário.' });
    const { acao, ids } = r.data;
    const us = await prisma.usuario.findMany({ where: { id: { in: ids } }, orderBy: { ordem: 'asc' } });
    if (!us.length) return rep.code(404).send({ erro: 'Usuários não encontrados. A lista pode ter mudado.' });
    const rot = {
      convite: 'Convite reenviado',
      mfa: 'MFA exigido',
      bloquear: 'Usuários bloqueados',
      ativar: 'Usuários reativados',
    }[acao];
    for (const u of us) {
      if (acao === 'bloquear' && u.id !== eu.id) {
        await prisma.usuario.update({ where: { id: u.id }, data: { status: 'Bloqueado' } });
        /* bloquear encerra as sessões na hora */
        await prisma.sessao.updateMany({
          where: { usuarioId: u.id, encerradaEm: null },
          data: { encerradaEm: new Date(), encerradaPor: eu.nome },
        });
        await logAcesso(u.nome, 'bloqueio', 'executado', `por ${eu.nome}`);
      }
      if (acao === 'ativar' && u.status !== 'Convite pendente')
        await prisma.usuario.update({ where: { id: u.id }, data: { status: 'Ativo' } });
      if (acao === 'mfa') await prisma.usuario.update({ where: { id: u.id }, data: { mfa: true } });
      if (acao === 'convite' && u.status !== 'Ativo')
        await prisma.usuario.update({ where: { id: u.id }, data: { status: 'Convite pendente' } });
    }
    await cfgLog(eu, 'usuarios', rot, us.map((u) => u.nome).join(', '));
    const si = acao === 'bloquear' && us.some((u) => u.id === eu.id) ? ' Você não bloqueia a si mesmo.' : '';
    return { msg: `${rot}: ${us.length} ${us.length === 1 ? 'usuário' : 'usuários'}.${si}` };
  });

  app.get('/config/usuarios/form', { preHandler: exigeCfg }, async (req) => {
    const id = Number((req.query as { id?: string }).id) || null;
    const [colabs, profs, alunos, usuarios] = await Promise.all([
      prisma.colaborador.findMany({ orderBy: { ordem: 'asc' }, select: { nome: true, email: true } }),
      prisma.professor.findMany({ orderBy: { ordem: 'asc' }, select: { nome: true, email: true } }),
      prisma.aluno.findMany({ orderBy: { ordem: 'asc' }, select: { nome: true, email: true } }),
      prisma.usuario.findMany({ orderBy: { ordem: 'asc' } }),
    ]);
    const vistos = new Set<string>();
    const pessoas: { nome: string; email: string; tipo: string; usuario: string | null }[] = [];
    const add = (nome: string, email: string, tipo: string) => {
      if (!nome || vistos.has(nome)) return;
      vistos.add(nome);
      const ja = usuarios.find((u) => u.email === String(email).toLowerCase());
      pessoas.push({ nome, email: email || '', tipo, usuario: ja ? ja.status : null });
    };
    for (const e of colabs) add(e.nome, e.email, 'Colaborador');
    for (const t of profs) add(t.nome, t.email, 'Professor');
    for (const a of alunos) add(a.nome, a.email, 'Aluno');
    pessoas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const u = id ? usuarios.find((x) => x.id === id) : null;
    const setores = u
      ? Object.fromEntries(
          Object.entries(u.areas as Areas)
            .filter(([, a]) => a && a.acesso !== 'proprio')
            .map(([k, a]) => [k, a!.acesso]),
        )
      : {};
    return {
      perfis: PERFIS.filter((p) => p.ativo !== false || p.id === u?.perfilId).map((p) => ({
        id: p.id,
        nome: perfilNome(p),
        tipo: p.perfil,
        cargo: p.cargo,
        area: p.area || '—',
        hierarquia: p.hierarquia || '—',
        sugestao: MATRIZ[p.id]
          ? {
              nivel: MATRIZ[p.id].nivel,
              setores: Object.fromEntries(
                Object.entries(MATRIZ[p.id].areas)
                  .filter(([, a]) => a && a.acesso !== 'proprio')
                  .map(([k, a]) => [k, a!.acesso]),
              ),
            }
          : null,
      })),
      niveis: NIVEIS.map((n) => ({ n: n.n, nome: n.nome, acoes: n.acoes })),
      acoes: ACOES,
      pessoas,
      colaboradores: colabs.map((c) => c.nome),
      alunos: (await prisma.aluno.findMany({ orderBy: { nome: 'asc' }, select: { id: true, nome: true } })).map(
        (a) => ({
          id: a.id,
          nome: a.nome,
          usuario: usuarios.find((x) => x.alunoId === a.id && x.id !== id)?.nome ?? null,
        }),
      ),
      professores: profs.map((t) => t.nome).sort((x, z) => x.localeCompare(z, 'pt-BR')),
      responsaveis: usuarios
        .filter((x) => x.status === 'Ativo' && (x.perfilLegado === 'Administrador' || ehAdmin1(x)))
        .map((x) => x.nome),
      seguranca: NU_SEG.map(([k, t, padrao]) => ({ k, t, padrao })),
      usuario: u
        ? {
            id: u.id,
            nome: u.nome,
            email: u.email,
            perfilId: u.perfilId,
            nivel: u.nivel,
            setores,
            pessoa: u.pessoa ?? u.nome,
            colaborador: u.colaborador ?? '',
            alunoId: u.alunoId,
            professor: (u.agendaPresa as { prof?: string } | null)?.prof ?? '',
            telefone: u.telefone ?? '',
            validoAte: u.validoAte ? u.validoAte.toISOString().slice(0, 10) : '',
            responsavel: u.responsavel ?? '',
            justificativa: u.justificativa ?? '',
            observacoes: u.observacoes ?? '',
            foto: u.foto ?? '',
            trocarSenha: u.trocarSenha,
            seguranca: (u.seguranca as Record<string, boolean>) ?? {},
            eu: u.id === req.usuario!.id,
          }
        : null,
    };
  });

  /** o que a hierarquia e os setores escolhidos liberam: detalhe por setor, telas no menu e resumo */
  app.post('/config/usuarios/previa', { preHandler: exigeCfg }, async (req, rep) => {
    const r = z
      .object({ perfilId: z.number().int().nullable(), nivel: z.number().int().min(0).max(5), setores: Setores })
      .safeParse(req.body);
    if (!r.success) return erro400(rep, r.error);
    const p = perfilDe(r.data.perfilId);
    const areas = areasDe(r.data.perfilId, r.data.setores);
    const u = { nivel: r.data.nivel, areas, tipoPerfil: p?.perfil ?? null };
    return {
      aluno: p?.perfil === 'Aluno',
      setores: setoresDetalhe(areas),
      configuracoes: r.data.nivel === 1,
      telas: r.data.nivel ? acessoTelas(u) : null,
      resumo: r.data.nivel ? acessoResumo(u, p) : null,
    };
  });

  const salvaUsuario = async (req: FastifyRequest, rep: FastifyReply, id: number | null) => {
    const eu = req.usuario!;
    const r = UsuarioIn.safeParse(req.body);
    if (!r.success) return erro400(rep, r.error);
    const v = r.data;
    const atual = id ? await prisma.usuario.findUnique({ where: { id } }) : null;
    if (id && !atual) return rep.code(404).send({ erro: 'Usuário não encontrado.' });
    const p = perfilDe(v.perfilId);
    const areas = p?.perfil === 'Aluno' ? (MATRIZ[p.id]?.areas ?? {}) : areasDe(v.perfilId, v.setores);
    const falta: string[] = [];
    if (!v.nome) falta.push('nome de exibição');
    if (!id && !v.email) falta.push('e-mail de acesso');
    if (!p) falta.push('perfil');
    if (!v.nivel) falta.push('hierarquia');
    if (!id && !v.justificativa) falta.push('justificativa da concessão');
    const comSetor = AREAS.some((a) => areas[a.id] && ['total', 'restrito'].includes(areas[a.id]!.acesso));
    if (p && p.perfil !== 'Aluno' && v.nivel !== 1 && !comSetor) falta.push('acesso a pelo menos um setor');
    if (falta.length) return rep.code(400).send({ erro: `Para salvar o usuário, falta: ${falta.join(', ')}.` });
    if (!id && !z.string().email().safeParse(v.email).success)
      return rep.code(400).send({ erro: 'E-mail de acesso inválido.' });
    if (v.alunoId != null) {
      const outro = await prisma.usuario.findFirst({ where: { alunoId: v.alunoId, NOT: { id: id ?? -1 } } });
      if (outro) return rep.code(400).send({ erro: `Esse aluno já está vinculado ao usuário ${outro.nome}.` });
    }
    const vinculos = {
      ...(v.alunoId !== undefined ? { alunoId: v.alunoId } : {}),
      /* professor vinculado: a agenda do prestador fica presa nele */
      ...(v.professor !== undefined && p?.perfil === 'Prestador'
        ? { agendaPresa: v.professor ? { prof: v.professor } : Prisma.DbNull }
        : {}),
    };
    const validoAte = /^\d{4}-\d{2}-\d{2}$/.test(v.validoAte) ? new Date(`${v.validoAte}T00:00:00Z`) : null;
    const extras = {
      pessoa: v.pessoa || null,
      colaborador: v.colaborador || null,
      telefone: v.telefone || null,
      validoAte,
      responsavel: v.responsavel || eu.nome,
      observacoes: v.observacoes || null,
      foto: v.foto || null,
      trocarSenha: v.trocarSenha,
      seguranca: Object.fromEntries(NU_SEG.map(([k, , padrao]) => [k, k in v.seguranca ? v.seguranca[k] : padrao])),
    };
    if (!atual) {
      if (await prisma.usuario.findUnique({ where: { email: v.email } }))
        return rep.code(400).send({ erro: `${v.email} já tem usuário. Edite o existente em vez de criar outro.` });
      const comConvite = v.convite && extras.seguranca.convite;
      const ordem = ((await prisma.usuario.aggregate({ _min: { ordem: true } }))._min.ordem ?? 0) - 1;
      const novo = await prisma.usuario.create({
        data: {
          nome: v.nome,
          email: v.email,
          perfilId: p!.id,
          nivel: v.nivel,
          areas,
          status: comConvite ? 'Convite pendente' : 'Inativo',
          mfa: !!extras.seguranca.mfa,
          ultimoAcesso: 'nunca acessou',
          justificativa: v.justificativa,
          ordem,
          ...extras,
          ...vinculos,
        },
      });
      await cfgLog(
        eu,
        'usuarios',
        'Usuário criado',
        `${v.nome} · ${perfilNome(p)} · ${comConvite ? 'convite enviado' : 'sem convite'} · just.: ${v.justificativa}`,
      );
      return {
        id: novo.id,
        msg: comConvite
          ? `${v.nome} criado: convite enviado para ${v.email}.`
          : `${v.nome} criado sem convite: o acesso fica suspenso até reenviar o convite.`,
      };
    }
    const mudaAcesso =
      atual.perfilId !== p!.id || atual.nivel !== v.nivel || JSON.stringify(atual.areas) !== JSON.stringify(areas);
    if (mudaAcesso && atual.id === eu.id)
      return rep
        .code(403)
        .send({ erro: 'Ninguém altera o próprio acesso, nem o Administrador: peça a outro administrador.' });
    if (mudaAcesso && ehAdmin1(atual) && !(v.nivel === 1 && p!.perfil === 'Admin')) {
      const admins = (await prisma.usuario.findMany({ where: { status: 'Ativo', nivel: 1 } })).filter(ehAdmin1);
      if (admins.length <= 1)
        return rep
          .code(403)
          .send({ erro: 'O sistema recusa rebaixar o último administrador: a base ficaria sem quem conceda acesso.' });
    }
    await prisma.usuario.update({
      where: { id: atual.id },
      data: {
        nome: v.nome,
        perfilId: p!.id,
        nivel: v.nivel,
        areas,
        perfilLegado: null,
        escopoLegado: null,
        justificativa: v.justificativa || atual.justificativa,
        ...extras,
        ...vinculos,
      },
    });
    if (mudaAcesso) {
      const antes =
        atual.perfilId != null
          ? acessoResumo({ nivel: atual.nivel, areas: atual.areas as Areas }, perfilDe(atual.perfilId))
          : (atual.perfilLegado ?? '—');
      const depois = acessoResumo({ nivel: v.nivel, areas }, p);
      await logAcesso(
        eu.nome,
        'perfil alterado',
        'executado',
        `${v.nome}: ${antes} → ${depois}${v.justificativa ? ` · just.: ${v.justificativa}` : ''}`,
      );
    }
    await cfgLog(
      eu,
      'usuarios',
      'Usuário editado',
      `${v.nome} · ${perfilNome(p)} · ${acessoResumo({ nivel: v.nivel, areas }, p)}`,
    );
    return { id: atual.id, msg: `${v.nome} salvo.` };
  };
  app.post('/config/usuarios', { preHandler: exigeCfg }, (req, rep) => salvaUsuario(req, rep, null));
  app.put('/config/usuarios/:id', { preHandler: exigeCfg }, (req, rep) =>
    salvaUsuario(req, rep, Number((req.params as { id: string }).id)),
  );

  /* ================= Perfis e hierarquias ================= */
  app.get('/config/perfis', { preHandler: exigeCfg }, async () => {
    const uso = await prisma.usuario.groupBy({ by: ['perfilId'], _count: { _all: true } });
    const usuariosDo = new Map(uso.map((x) => [x.perfilId, x._count._all]));
    const salvo = await prisma.configuracao.findUnique({ where: { chave: 'acessoModelo' } });
    const nivelNome = (n?: number) => {
      const x = n ? nivelDe(n) : undefined;
      return x ? `${x.n} — ${x.nome}` : '—';
    };
    const telas = nuTelas();
    return {
      modelo: [
        ['Tipo de perfil', 'o tipo de usuário', [...new Set(PERFIS.map((p) => p.perfil))].join(' · ')],
        [
          'Cargo',
          'a função',
          PERFIS.filter((p) => p.cargo)
            .map((p) => p.cargo)
            .join(' · '),
        ],
        ['Hierarquia', 'o que pode fazer', NIVEIS.map((n) => `${n.n} ${n.nome}`).join(' · ')],
        [
          'Setor',
          'onde pode atuar',
          `${AREAS.map((a) => a.nome).join(' · ')} — cada setor libera telas e abas de Cursos, Alunos, Professores e Relatórios; Auditoria e Configurações só para o tipo de perfil Admin`,
        ],
      ],
      acoes: ACOES,
      areas: AREAS.map((a) => a.nome),
      perfis: PERFIS.map((p) => ({
        idCargo: p.idCargo,
        perfil: p.perfil,
        cargo: p.cargo || '—',
        area: p.area || '—',
        hierarquia: p.hierarquia || '—',
        ativo: p.ativo !== false,
      })),
      niveis: NIVEIS.map((n) => ({ nome: `${n.n} — ${n.nome}`, acoes: n.acoes })),
      edicao: {
        personalizado: !!salvo,
        salvoEm: salvo ? `${fmt.dataHora(salvo.salvoEm)} por ${salvo.por}` : null,
        perfis: PERFIS.map((p) => ({
          id: p.id,
          tipo: p.perfil,
          cargo: p.cargo,
          idCargo: p.idCargo,
          area: p.area,
          nivel: MATRIZ[p.id]?.nivel ?? 5,
          areas: Object.fromEntries(
            Object.entries(MATRIZ[p.id]?.areas ?? {})
              .filter(([, a]) => a && a.acesso !== 'proprio')
              .map(([k, a]) => [
                k,
                {
                  acesso: a!.acesso,
                  rotulo: a!.acesso === 'restrito' && RECORTES[k as AreaId]?.[a!.rotulo] ? a!.rotulo : 'padrao',
                },
              ]),
          ),
          resumo: acessoResumo(MATRIZ[p.id] ?? { nivel: 5, areas: {} }, p),
          ativo: p.ativo !== false,
          sistema: PERFIS_SISTEMA[p.id] ?? null,
          travado: p.id === 1 || p.id === 15,
          usuarios: usuariosDo.get(p.id) ?? 0,
        })),
        niveis: NIVEIS.map((n) => ({ n: n.n, nome: n.nome, acoes: n.acoes, nota: n.nota ?? '' })),
        setores: AREAS.map((a) => ({
          id: a.id,
          nome: a.nome,
          recortes: Object.entries(RECORTES[a.id] ?? {}).map(([k, r]) => ({
            v: k,
            l: k === 'padrao' ? 'Restrito padrão' : k,
            desc: r.desc,
          })),
        })),
      },
      cargos: [...PERFIS]
        .sort((a, b) => (MATRIZ[a.id]?.nivel ?? 9) - (MATRIZ[b.id]?.nivel ?? 9) || a.id - b.id)
        .map((p) => ({
          cargo: p.cargo || p.perfil,
          nivel: nivelNome(MATRIZ[p.id]?.nivel),
          acoes: nivelDe(MATRIZ[p.id]?.nivel ?? 0)?.acoes ?? [],
        })),
      setores: PERFIS.map((p) => ({
        cargo: p.cargo || p.perfil,
        nivel: nivelNome(MATRIZ[p.id]?.nivel),
        areas: AREAS.map((a) => MATRIZ[p.id]?.areas[a.id] ?? null),
      })),
      telas: telas
        .filter((t) => t.m !== 'config')
        .map((t) => ({ label: t.label, menu: t.menuLabel, areas: AREAS.map((a) => areasDaTela(t).includes(a.id)) })),
      recortes: AREAS.flatMap((ar) =>
        Object.entries(RECORTES[ar.id] ?? {}).map(([rot, r]) => ({
          titulo: `${ar.nome} · ${rot === 'padrao' ? 'Restrito padrão' : rot}`,
          padrao: rot === 'padrao',
          texto: `${r.desc}: ${
            setoresDetalhe({ [ar.id]: { acesso: 'restrito', rotulo: rot } })
              .find((s) => s.id === ar.id)
              ?.recorte?.telas.join(' · ') || 'nenhuma tela'
          }.`,
        })),
      ),
    };
  });

  /* ================= Perfis e hierarquias: edição do modelo de acesso ================= */
  const AcessoIn = z.object({ acesso: z.enum(['total', 'restrito']), rotulo: z.string().trim().max(80).default('') });
  const PerfilIn = z.object({
    tipo: z.enum(['Colaborador', 'Prestador']),
    cargo: z.string().trim().min(2, 'Informe o cargo.').max(80),
    area: z.string().trim().max(80).default(''),
    nivel: z.number().int().min(1).max(5),
    areas: z.record(z.string(), AcessoIn).default({}),
    ativo: z.boolean().default(true),
    /** leva a hierarquia e os setores novos a quem já tem o perfil */
    aplicar: z.boolean().default(false),
  });
  const TRAVADOS: Record<number, string> = {
    1: 'O perfil Admin tem sempre acesso total e não se edita.',
    15: 'O perfil Aluno vê só os próprios dados e não se edita.',
  };
  /** os setores do formulário, com o rótulo do recorte no restrito (ou "Total") */
  const areasValidas = (v: Record<string, z.infer<typeof AcessoIn>>): Areas | string => {
    const out: Areas = {};
    for (const [k, a] of Object.entries(v)) {
      const ar = AREAS.find((x) => x.id === k);
      if (!ar) return `Setor desconhecido: ${k}.`;
      if (a.acesso === 'total') out[ar.id] = { acesso: 'total', rotulo: 'Total' };
      else {
        const rot = a.rotulo || 'padrao';
        if (!RECORTES[ar.id]?.[rot]) return `Recorte restrito desconhecido em ${ar.nome}: ${rot}.`;
        out[ar.id] = { acesso: 'restrito', rotulo: rot === 'padrao' ? 'Restrito' : rot };
      }
    }
    return out;
  };
  const salvaPerfil = async (req: FastifyRequest, rep: FastifyReply, id: number | null) => {
    const eu = req.usuario!;
    const r = PerfilIn.safeParse(req.body);
    if (!r.success) return erro400(rep, r.error);
    const v = r.data;
    const atual = id != null ? perfilDe(id) : null;
    if (id != null && !atual) return rep.code(404).send({ erro: 'Perfil não encontrado.' });
    if (id != null && TRAVADOS[id]) return rep.code(400).send({ erro: TRAVADOS[id] });
    const uso = atual ? PERFIS_SISTEMA[atual.id] : undefined;
    if (atual && uso && v.tipo !== atual.perfil)
      return rep.code(400).send({ erro: `O tipo deste perfil não muda: ele é usado como ${uso}.` });
    if (uso && !v.ativo) return rep.code(400).send({ erro: `Este perfil não se inativa: ele é usado como ${uso}.` });
    if (PERFIS.some((p) => p.id !== id && p.cargo.toLowerCase() === v.cargo.toLowerCase()))
      return rep.code(400).send({ erro: `Já existe um perfil com o cargo ${v.cargo}.` });
    if (v.area && !AREAS.some((a) => a.nome === v.area))
      return rep.code(400).send({ erro: 'Escolha o setor do cargo.' });
    const areas = areasValidas(v.areas);
    if (typeof areas === 'string') return rep.code(400).send({ erro: areas });
    if (v.nivel !== 1 && !Object.keys(areas).length)
      return rep.code(400).send({ erro: 'Libere pelo menos um setor, ou o perfil não abre tela nenhuma.' });
    const nivelNome = nivelDe(v.nivel)?.nome ?? '';
    let novoId = id ?? 0;
    await salvaModelo((m) => {
      if (id == null) {
        novoId = Math.max(...m.perfis.map((p) => p.id)) + 1;
        const idCargo = Math.max(0, ...m.perfis.map((p) => p.idCargo ?? 0)) + 1;
        m.perfis.push({
          id: novoId,
          perfil: v.tipo,
          cargo: v.cargo,
          idCargo,
          area: v.area,
          hierarquia: nivelNome,
          ativo: v.ativo,
        });
      } else {
        const p = m.perfis.find((x) => x.id === id);
        if (p)
          Object.assign(p, { perfil: v.tipo, cargo: v.cargo, area: v.area, hierarquia: nivelNome, ativo: v.ativo });
      }
      m.matriz[novoId] = { nivel: v.nivel, areas };
    }, eu.nome);
    let aplicados = 0;
    if (id != null && v.aplicar) {
      /* ninguém altera o próprio acesso: o usuário da sessão fica de fora */
      const r2 = await prisma.usuario.updateMany({
        where: { perfilId: id, NOT: { id: eu.id } },
        data: { nivel: v.nivel, areas: areas as object },
      });
      aplicados = r2.count;
    }
    const aplicadoTxt = v.aplicar ? ` · aplicado a ${aplicados} usuário(s)` : '';
    await cfgLog(
      eu,
      'perfis',
      id == null ? 'Perfil criado' : 'Perfil alterado',
      `${v.tipo} · ${v.cargo} · ${acessoResumo({ nivel: v.nivel, areas })}${v.ativo ? '' : ' · inativo'}${aplicadoTxt}`,
    );
    return {
      id: novoId,
      msg:
        id == null
          ? `Perfil ${v.cargo} criado.`
          : `Perfil ${v.cargo} salvo.${v.aplicar ? ` Acesso atualizado em ${aplicados} usuário(s).` : ''}`,
    };
  };
  app.post('/config/perfis', { preHandler: exigeCfg }, (req, rep) => salvaPerfil(req, rep, null));
  app.put('/config/perfis/:id', { preHandler: exigeCfg }, (req, rep) =>
    salvaPerfil(req, rep, Number((req.params as { id: string }).id)),
  );
  app.delete('/config/perfis/:id', { preHandler: exigeCfg }, async (req, rep) => {
    const id = Number((req.params as { id: string }).id);
    const p = perfilDe(id);
    if (!p) return rep.code(404).send({ erro: 'Perfil não encontrado.' });
    if (PERFIS_SISTEMA[id])
      return rep.code(400).send({ erro: `Este perfil não se exclui: ele é usado como ${PERFIS_SISTEMA[id]}.` });
    const n = await prisma.usuario.count({ where: { perfilId: id } });
    if (n)
      return rep.code(400).send({ erro: `${n} usuário(s) usam este perfil. Troque o perfil deles ou inative este.` });
    await salvaModelo((m) => {
      m.perfis = m.perfis.filter((x) => x.id !== id);
      delete m.matriz[id];
    }, req.usuario!.nome);
    await cfgLog(req.usuario!, 'perfis', 'Perfil excluído', perfilNome(p));
    return { msg: `Perfil ${p.cargo || p.perfil} excluído.` };
  });

  const NivelIn = z.object({
    nome: z.string().trim().min(2, 'Informe o nome da hierarquia.').max(40),
    nota: z.string().trim().max(200).default(''),
    acoes: z.array(z.union([z.literal(0), z.literal(1), z.null()])).length(ACOES.length),
  });
  app.put('/config/perfis/niveis/:n', { preHandler: exigeCfg }, async (req, rep) => {
    const n = Number((req.params as { n: string }).n);
    const atual = nivelDe(n);
    if (!atual) return rep.code(404).send({ erro: 'Hierarquia não encontrada.' });
    const r = NivelIn.safeParse(req.body);
    if (!r.success) return erro400(rep, r.error);
    const v = r.data;
    if (NIVEIS.some((x) => x.n !== n && x.nome.toLowerCase() === v.nome.toLowerCase()))
      return rep.code(400).send({ erro: `Já existe a hierarquia ${v.nome}.` });
    /* o Administrador faz tudo, e Usuários e Configurações são só dele: essas colunas não mudam */
    const acoes = n === 1 ? atual.acoes : v.acoes.map((x, i) => (i >= 6 ? 0 : x));
    if (acoes[0] !== 1) return rep.code(400).send({ erro: 'Toda hierarquia precisa ao menos visualizar.' });
    await salvaModelo((m) => {
      const nv = m.niveis.find((x) => x.n === n);
      if (!nv) return;
      for (const p of m.perfis) if (p.hierarquia === nv.nome) p.hierarquia = v.nome;
      Object.assign(nv, { nome: v.nome, acoes, nota: v.nota || undefined });
    }, req.usuario!.nome);
    const mudou = ACOES.flatMap((a, i) =>
      atual.acoes[i] !== acoes[i] ? [`${a}: ${acoes[i] ? 'pode' : 'não pode'}`] : [],
    );
    const renomeada = atual.nome !== v.nome ? ` → ${v.nome}` : '';
    await cfgLog(
      req.usuario!,
      'perfis',
      'Hierarquia alterada',
      `${atual.n} — ${atual.nome}${renomeada}${mudou.length ? ` · ${mudou.join(', ')}` : ''}`,
    );
    return { msg: `Hierarquia ${v.nome} salva.` };
  });
  app.post('/config/perfis/restaurar', { preHandler: exigeCfg }, async (req) => {
    await restauraModelo();
    await cfgLog(req.usuario!, 'perfis', 'Modelo restaurado', 'perfis e hierarquias de volta ao padrão do portal');
    return { msg: 'Perfis e hierarquias voltaram ao padrão do portal.' };
  });

  /* ================= Sessões e acessos ================= */
  const politicasSessao = async () => {
    const c = await prisma.configuracao.findUnique({ where: { chave: 'sessoesPoliticas' } });
    const v = (c?.valor as Record<string, boolean>) ?? {};
    return SES_POL.map(([k, t, d, padrao]) => ({ k, t, d, on: k in v ? v[k] : padrao }));
  };
  /* acesso de uma pessoa (o colaborador não tem ficha: o cadastro dele mostra a mesma seção Acesso) */
  app.get('/config/acesso', { preHandler: exigeCfg }, async (req, rep) => {
    const q = req.query as { colab?: string; aluno?: string; prof?: string };
    const de = q.colab
      ? { colabId: Number(q.colab) }
      : q.aluno
        ? { alunoId: Number(q.aluno) }
        : q.prof
          ? { profId: q.prof }
          : null;
    const r = de ? await acessoDaPessoa(await base(), de, req.usuario!) : null;
    if (!r) return rep.code(404).send({ erro: 'Pessoa não encontrada.' });
    return r;
  });

  app.get('/config/sessoes', { preHandler: exigeCfg }, async (req) => {
    const eu = req.usuario!;
    const [ss, hist] = await Promise.all([
      prisma.sessao.findMany({
        where: { encerradaEm: null, expiraEm: { gt: new Date() }, usuario: { status: 'Ativo' } },
        include: { usuario: { select: { nome: true } } },
        orderBy: { vistaEm: 'desc' },
      }),
      prisma.acessoLog.findMany({ orderBy: [{ quando: 'desc' }, { id: 'desc' }], take: 500 }),
    ]);
    const tom: Record<string, string> = { sucesso: 'green', recusado: 'red', executado: 'amber', encerrada: 'gray' };
    return {
      ativas: ss.map((s) => ({
        id: s.id,
        nome: s.usuario.nome,
        estaSessao: s.id === eu.sessaoId,
        dispositivo: dispositivo(s.userAgent),
        origem: ipCurto(s.ip),
        ultima: relativo(s.vistaEm),
      })),
      politicas: await politicasSessao(),
      historico: hist.map((h) => ({
        id: h.id,
        quando: fmt.dataHora(h.quando, true),
        quem: h.quem,
        evento: h.evento,
        resultado: h.resultado,
        tom: tom[h.resultado] ?? 'gray',
        detalhe: h.detalhe,
      })),
    };
  });
  const encerra = async (
    eu: UsuarioSessao,
    alvo: { id: string; userAgent: string | null; usuario: { nome: string } }[],
  ) => {
    for (const s of alvo) {
      await prisma.sessao.update({ where: { id: s.id }, data: { encerradaEm: new Date(), encerradaPor: eu.nome } });
      await logAcesso(s.usuario.nome, 'logout forçado', 'encerrada', `por ${eu.nome} · ${dispositivo(s.userAgent)}`);
    }
  };
  app.post('/config/sessoes/:id/encerrar', { preHandler: exigeCfg }, async (req, rep) => {
    const eu = req.usuario!;
    const { id } = req.params as { id: string };
    if (id === eu.sessaoId) return rep.code(400).send({ erro: 'Esta é a sua sessão: use Sair no menu da conta.' });
    const s = await prisma.sessao.findUnique({ where: { id }, include: { usuario: { select: { nome: true } } } });
    if (!s || s.encerradaEm) return rep.code(404).send({ erro: 'Sessão não encontrada ou já encerrada.' });
    await encerra(eu, [s]);
    await cfgLog(eu, 'sessoes', 'Sessão encerrada', s.usuario.nome);
    return { msg: `Sessão de ${s.usuario.nome} encerrada. A conta continua ativa.` };
  });
  app.post('/config/sessoes/encerrar-outras', { preHandler: exigeCfg }, async (req, rep) => {
    const eu = req.usuario!;
    const ss = await prisma.sessao.findMany({
      where: { encerradaEm: null, expiraEm: { gt: new Date() }, NOT: { id: eu.sessaoId } },
      include: { usuario: { select: { nome: true } } },
    });
    if (!ss.length) return rep.code(400).send({ erro: 'Não há outras sessões ativas.' });
    await encerra(eu, ss);
    await cfgLog(
      eu,
      'sessoes',
      'Todas as outras sessões encerradas',
      [...new Set(ss.map((s) => s.usuario.nome))].join(', '),
    );
    return {
      msg:
        ss.length === 1
          ? `Sessão de ${ss[0].usuario.nome} encerrada. A conta continua ativa.`
          : `${ss.length} sessões encerradas. As contas continuam ativas.`,
    };
  });
  app.put('/config/sessoes/politicas/:k', { preHandler: exigeCfg }, async (req, rep) => {
    const eu = req.usuario!;
    const { k } = req.params as { k: string };
    const pol = SES_POL.find((x) => x[0] === k);
    if (!pol) return rep.code(404).send({ erro: 'Política não encontrada.' });
    const atual = await politicasSessao();
    const on = !atual.find((x) => x.k === k)!.on;
    const valor = Object.fromEntries(atual.map((x) => [x.k, x.k === k ? on : x.on]));
    await prisma.configuracao.upsert({
      where: { chave: 'sessoesPoliticas' },
      create: { chave: 'sessoesPoliticas', valor, por: eu.nome },
      update: { valor, por: eu.nome },
    });
    await cfgLog(eu, 'sessoes', on ? 'Política ligada' : 'Política desligada', pol[1]);
    return { msg: `${pol[1]}: ${on ? 'ligada' : 'desligada'}.` };
  });

  /* ================= Documentação › Personas de teste ================= */
  app.get('/config/personas', { preHandler: exigeCfg }, async () => {
    const us = await prisma.usuario.findMany({ where: { personaLetra: { not: null } }, orderBy: { ordem: 'asc' } });
    const linhas = us.map((u) => {
      const areas = u.areas as Areas;
      const aluno = u.personaTipo === 'Aluno';
      return {
        letra: u.personaLetra!,
        tipo: u.personaTipo ?? '—',
        cursos: u.personaCursos,
        modulos: u.personaModulos,
        objetivo: u.objetivo || '—',
        nome: u.nome,
        login: u.email,
        senha: u.senhaTeste ?? '—',
        resumo: aluno
          ? 'Visualizador · área do aluno'
          : `${acessoResumo({ nivel: u.nivel, areas }, perfilDe(u.perfilId))} · ${acessoTelas({ nivel: u.nivel, areas })} telas`,
        ativo: u.status === 'Ativo',
      };
    });
    return {
      stats: [
        { v: linhas.filter((l) => l.tipo === 'Aluno').length, t: 'alunos' },
        { v: linhas.filter((l) => l.tipo !== 'Aluno' && l.letra !== 'Admin').length, t: 'colaboradores' },
        { v: linhas.filter((l) => l.letra === 'Admin').length, t: 'admin de teste' },
        { v: new Set(us.map((u) => u.nivel)).size, t: 'níveis em uso' },
        { v: linhas.length, t: 'logins' },
      ],
      linhas,
    };
  });
  /** Entrar como: troca a sessão para a persona (para voltar, Sair e entrar de novo como Admin) */
  app.post('/config/personas/:letra/entrar', { preHandler: exigeCfg }, async (req, rep) => {
    const eu = req.usuario!;
    const { letra } = req.params as { letra: string };
    const p = await prisma.usuario.findUnique({ where: { personaLetra: letra } });
    if (!p) return rep.code(404).send({ erro: 'Persona não encontrada.' });
    if (p.status !== 'Ativo')
      return rep.code(400).send({ erro: `${p.nome} está ${p.status.toLowerCase()}: reative em Usuários.` });
    await logAcesso(eu.nome, 'logout', 'sucesso', `Entrar como ${p.nome}`);
    await fechaSessao(rep, req);
    await abreSessao(rep, req, p.id);
    await logAcesso(p.nome, 'login', 'sucesso', `Entrar como, por ${eu.nome}`);
    return { ir: PERFIS.find((x) => x.id === p.perfilId)?.perfil === 'Aluno' ? '/minha-agenda' : '/inicio' };
  });
}
