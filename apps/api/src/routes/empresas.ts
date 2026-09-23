import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.ts';
import { podeAcao } from '../domain/acesso.ts';
import { agOfertas, alMat, alSit } from '../domain/agenda.ts';
import { type AlunoB, base, invalidaBase } from '../domain/base.ts';
import { SIT_TOM } from '../domain/cursos.ts';
import {
  aulas30,
  dataTxt,
  diaLocal,
  diaUTC,
  type EmpresaB,
  empAlertas,
  empCobranca,
  empDados,
  empDias,
  empPaga,
  empSit,
  moeda,
  presencaDe,
} from '../domain/empresas.ts';
import { podeChave } from '../domain/mapa.ts';
import { comExemplos } from '../lib/exemplos.ts';
import { fmt } from '../lib/fmt.ts';
import { registra } from '../lib/log.ts';
import { EnderecoIn, enderecoTxt } from '../lib/pessoa.ts';
import type { UsuarioSessao } from '../plugins/sessao.ts';

/* 23/09/2026: a aba Contratos mostra os contratos do Deal da empresa */
const ABAS = ['geral', 'alunos', 'contratos', 'historico'] as const;
/** gerente de conta que não é persona de teste (EMP_GERENTES do portal) */
const GERENTE_BASE = 'Hozana Galvão Jannuzzi';
/** gerir a conta vai até a hierarquia Editor; Colaborador e Visualizador só leem */
const podeGerir = (u: UsuarioSessao) => !u.ehAluno && podeAcao(u.nivel, 'editar');
const erro400 = (rep: FastifyReply, e: z.ZodError) => rep.code(400).send({ erro: e.issues[0].message });

async function exige(req: FastifyRequest, rep: FastifyReply) {
  const u = req.usuario;
  if (!u) return rep.code(401).send({ erro: 'Sessão expirada. Entre de novo.' });
  if (u.ehAluno || !podeChave(u, 'empresas')) return rep.code(403).send({ erro: 'Sem acesso a esta tela.' });
}
async function exigeGerir(req: FastifyRequest, rep: FastifyReply) {
  const r = await exige(req, rep);
  if (r) return r;
  if (!podeGerir(req.usuario!)) return rep.code(403).send({ erro: 'Gerir a conta vai até a hierarquia Editor.' });
}

export async function carregaEmpresas(): Promise<EmpresaB[]> {
  const l = await prisma.empresa.findMany({ orderBy: { ordem: 'asc' } });
  return l.map((e) => ({
    id: e.id,
    nome: e.nome,
    cnpj: e.cnpj,
    segmento: e.segmento,
    modelo: e.modelo as EmpresaB['modelo'],
    gerente: e.gerente,
    rhNome: e.rhNome,
    rhEmail: e.rhEmail,
    representante: e.representante ?? '',
    funcionarios: e.funcionarios,
    rhDepartamento: e.rhDepartamento,
    rhTelefone: e.rhTelefone,
    endereco: e.endereco,
    inicio: diaLocal(e.inicio),
    fim: diaLocal(e.fim),
    licencas: e.licencas,
    aulas: e.aulas,
    valor: Number(e.valor),
    subsidio: e.subsidio,
    desconto: e.desconto,
    renovaAuto: e.renovaAuto,
    turmaCurso: e.turmaCurso,
    cursos: e.cursos,
    relEm: e.relEm,
  }));
}
/** gerentes de conta: Gerente B2B, depois Gerente comercial, e a gerente da base (só com dados de exemplo) */
export async function gerentes() {
  const ps = await prisma.usuario.findMany({
    where: { status: { not: 'Bloqueado' }, perfilId: { in: [16, 6] } },
    orderBy: { ordem: 'asc' },
    select: { nome: true, perfilId: true },
  });
  return [
    ...new Set([
      ...ps.filter((x) => x.perfilId === 16).map((x) => x.nome),
      ...ps.filter((x) => x.perfilId === 6).map((x) => x.nome),
      ...((await comExemplos()) ? [GERENTE_BASE] : []),
    ]),
  ];
}
const loga = (u: UsuarioSessao, e: { id: string; nome: string }, acao: string, detalhe?: string) =>
  registra({ tipo: 'empresa', id: e.id, nome: e.nome, acao, detalhe, autor: u.nome });

const inteiro = (min: number, max: number) =>
  z.coerce.number().transform((n) => Math.min(max, Math.max(min, Math.trunc(n || 0))));
const EmpresaIn = z.object({
  nome: z.string().trim().min(1, 'Dê o nome da empresa.').max(160),
  cnpj: z.string().trim().max(20).default(''),
  segmento: z.string().trim().max(80).default(''),
  modelo: z.enum(['B2B', 'B2B2C']),
  gerente: z.string().min(1, 'Escolha o gerente da conta.'),
  inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Preencha início e fim do contrato.'),
  fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Preencha início e fim do contrato.'),
  licencas: inteiro(0, 1e6).default(0),
  aulas: inteiro(0, 1e7).default(0),
  valor: inteiro(0, 1e7).default(0),
  subsidio: inteiro(0, 100).default(100),
  desconto: inteiro(0, 100).default(0),
  cursos: z.array(z.string()).max(40).default([]),
  renovaAuto: z.boolean().default(true),
  rhNome: z.string().trim().max(120).default(''),
  rhEmail: z.string().trim().max(160).default(''),
  /* adequação ao Portal Alumni: representante legal, funcionários, endereço e o resto do contato no RH */
  representante: z.string().trim().max(160).default(''),
  funcionarios: z.coerce.number().int().min(0).max(1e7).nullable().default(null),
  rhDepartamento: z.string().trim().max(120).default(''),
  rhTelefone: z.string().trim().max(30).default(''),
  endereco: EnderecoIn,
});

export default async function rotasEmpresas(app: FastifyInstance) {
  app.get('/empresas-opcoes', { preHandler: exige }, async () => {
    const b = await base();
    return {
      gerentes: await gerentes(),
      cursos: b.cursos.filter((c) => c.estrutura !== 'turmas').map((c) => c.name),
      segmentos: (await prisma.segmento.findMany({ orderBy: { nome: 'asc' } })).map((s) => s.nome),
    };
  });

  /* ---------------- lista ---------------- */
  app.get('/empresas', { preHandler: exige }, async (req) => {
    const u = req.usuario!;
    const b = await base();
    const ps = aulas30(b, agOfertas(b));
    const emps = await carregaEmpresas();
    const eu = u.perfilId === 16 ? u.nome : '';
    return {
      eu,
      gerentes: await gerentes(),
      podeGerir: podeGerir(u),
      empresas: emps
        .map((e) => {
          const d = empDados(b, e, ps);
          const sit = empSit(e);
          return {
            id: e.id,
            nome: e.nome,
            segmento: e.segmento,
            cnpj: e.cnpj,
            modelo: e.modelo,
            turmaDedicada: !!e.turmaCurso,
            gerente: e.gerente,
            dias: empDias(e),
            licencas: d.turma ? `${d.licUsadas}/${d.licContr} vagas` : `${d.licUsadas}/${d.licContr}`,
            consumo: d.contratadas
              ? `${d.consumo} de ${d.contratadas} · ${Math.round((d.consumo / d.contratadas) * 100)}%`
              : '—',
            presenca: d.presenca == null ? '—' : `${d.presenca}%`,
            fim: dataTxt(e.fim),
            sit: sit[0],
            sitTom: sit[1],
            alertas: empAlertas(e, d).map(([t, tom]) => ({ t, tom })),
          };
        })
        .sort((x, y) => x.dias - y.dias),
    };
  });

  /* ---------------- ficha ---------------- */
  app.get('/empresas/:id', { preHandler: exige }, async (req, rep) => {
    const u = req.usuario!;
    const { id } = req.params as { id: string };
    const pedida = String((req.query as { aba?: string }).aba ?? '');
    const aba = (ABAS as readonly string[]).includes(pedida) ? pedida : 'geral';
    const e = (await carregaEmpresas()).find((x) => x.id === id);
    if (!e) return rep.code(404).send({ erro: 'Esta conta não existe mais.' });
    const b = await base();
    const ps = aulas30(b, agOfertas(b));
    const d = empDados(b, e, ps);
    const sit = empSit(e);
    const dias = empDias(e);
    const crs = e.turmaCurso ? b.cursos.find((c) => c.name === e.turmaCurso) : undefined;
    let dados: unknown;
    if (aba === 'contratos') {
      dados = { empresaId: e.id };
    } else if (aba === 'geral') {
      const pct = d.contratadas ? Math.round((d.consumo / d.contratadas) * 100) : 0;
      dados = {
        stats: [
          {
            valor: `${d.licUsadas}/${d.licContr}`,
            rotulo: d.turma ? 'vagas ocupadas nas turmas' : 'licenças em uso',
            tom: !d.turma && d.licUsadas > d.licContr ? 'red' : undefined,
          },
          {
            valor: d.contratadas ? `${pct}%` : '—',
            rotulo: 'aulas consumidas',
            tom: pct >= 85 ? 'amber' : undefined,
            sub: d.contratadas ? `${d.consumo} de ${d.contratadas}` : '',
          },
          {
            valor: d.presenca == null ? '—' : `${d.presenca}%`,
            rotulo: d.presencaRot,
            tom: d.presenca != null && d.presenca < 80 ? 'amber' : undefined,
          },
          {
            valor: dias < 0 ? 'encerrado' : `${dias} dias`,
            rotulo: 'até o fim do contrato',
            tom: dias <= 30 ? 'red' : dias <= 60 ? 'amber' : undefined,
            sub: dataTxt(e.fim),
          },
          ...(d.turma
            ? []
            : [
                {
                  valor: moeda(d.receitaEmpresa + d.receitaAluno),
                  rotulo: 'receita mensal',
                  sub:
                    e.modelo === 'B2B'
                      ? 'paga pela empresa'
                      : `${moeda(d.receitaEmpresa)} empresa · ${moeda(d.receitaAluno)} colaboradores`,
                },
              ]),
        ],
        alertas: empAlertas(e, d).map(([t]) => t),
        contrato: [
          ['Modelo', empCobranca(e)],
          ['Vigência', `${dataTxt(e.inicio)} a ${dataTxt(e.fim)}`],
          ['Renovação', e.renovaAuto ? 'automática por 12 meses' : 'manual — precisa de Renovar contrato'],
          ...(d.turma
            ? [['Turmas', `${crs?.turmas.length ?? 0} turmas de ${e.turmaCurso}`]]
            : [
                ['Licenças', `${e.licencas} · ${moeda(e.valor)} por licença ao mês`],
                ['Aulas contratadas', String(e.aulas)],
              ]),
          ['Cursos liberados', e.cursos.join(', ') || '—'],
          ['CNPJ', e.cnpj || '—'],
          ['Representante legal', e.representante || '—'],
          ['Funcionários', e.funcionarios == null ? '—' : e.funcionarios.toLocaleString('pt-BR')],
          ['Endereço', enderecoTxt(e.endereco) || '—'],
        ],
        gestao: [
          ['Gerente da conta', e.gerente],
          [
            'Contato no RH',
            [e.rhNome, e.rhDepartamento, e.rhEmail, e.rhTelefone].filter((x) => x && x !== '—').join(' · ') || '—',
          ],
          ['Segmento', e.segmento],
          ['Último relatório', e.relEm ? `${dataTxt(e.relEm)} para ${e.rhEmail}` : 'nenhum enviado'],
        ],
      };
    } else if (aba === 'alunos' && d.turma && crs) {
      dados = {
        turma: true,
        cursoId: crs.id,
        turmas: crs.turmas.map((t) => ({
          nome: t.name,
          grupo: t.grupo || '—',
          professor: t.professor || '—',
          grade: t.grade || '—',
          modalidade: t.modalidade || '—',
          vagas: `${t.ocupadas || 0}/${t.vagas || 0}`,
        })),
      };
    } else if (aba === 'alunos') {
      const linha = (a: AlunoB) => {
        const ms = alMat(a);
        const s = alSit(a);
        return {
          id: a.id,
          nome: a.name,
          email: a.email,
          cursos: ms.map((m) => m.curso).join(', ') || '—',
          aulas: `${ms.reduce((x, m) => x + m.usadas, 0)}/${ms.reduce((x, m) => x + m.total, 0)}`,
          presenca: presencaDe(b, a.name, ps),
          paga: empPaga(e),
          sit: s,
          sitTom: SIT_TOM[s] ?? 'gray',
        };
      };
      dados = {
        turma: false,
        cobranca: empCobranca(e),
        alunos: d.alunos.map(linha),
        semEmpresa: b.alunos
          .filter((a) => !a.empresa && alSit(a) !== 'Inativo')
          .sort((x, y) => x.name.localeCompare(y.name))
          .map((a) => ({ id: a.id, nome: a.name, email: a.email })),
      };
    } else {
      const logs = await prisma.logAlteracao.findMany({
        where: { entidade: 'Empresa', entidadeId: e.id },
        orderBy: { quando: 'desc' },
      });
      dados = {
        linhas: [
          ...logs.map((x) => ({
            quando: fmt.dataHora(x.quando, true),
            quem: x.autor,
            base: false,
            acao: x.acao,
            vezes: x.vezes,
            detalhe: x.detalhe ?? '',
          })),
          {
            quando: dataTxt(e.inicio),
            quem: 'base',
            base: true,
            acao: 'Contrato assinado',
            vezes: 1,
            detalhe: `${e.modelo} · ${empCobranca(e)}`,
          },
        ],
      };
    }
    return {
      id: e.id,
      nome: e.nome,
      modelo: e.modelo,
      sit: sit[0],
      sitTom: sit[1],
      segmento: e.segmento,
      gerente: e.gerente,
      turma: d.turma,
      aba,
      dados,
      podeGerir: podeGerir(u),
      veContratos: podeChave(u, 'acFechamento') || podeChave(u, 'acFunil'),
      form: {
        nome: e.nome,
        cnpj: e.cnpj,
        segmento: e.segmento === '—' ? '' : e.segmento,
        modelo: e.modelo,
        gerente: e.gerente,
        inicio: fmt.iso(e.inicio),
        fim: fmt.iso(e.fim),
        licencas: e.licencas,
        aulas: e.aulas,
        valor: e.valor,
        subsidio: e.subsidio,
        desconto: e.desconto,
        cursos: e.cursos,
        renovaAuto: e.renovaAuto,
        rhNome: e.rhNome === '—' ? '' : e.rhNome,
        rhEmail: e.rhEmail === '—' ? '' : e.rhEmail,
        turmaCurso: e.turmaCurso,
        representante: e.representante,
        funcionarios: e.funcionarios,
        rhDepartamento: e.rhDepartamento,
        rhTelefone: e.rhTelefone,
        endereco: EnderecoIn.parse(e.endereco ?? {}),
      },
      renovar: {
        fim: (() => {
          const h = new Date();
          h.setHours(0, 0, 0, 0);
          const x = new Date(Math.max(+e.fim, +h));
          x.setFullYear(x.getFullYear() + 1);
          return fmt.iso(x);
        })(),
        fimAtual: dataTxt(e.fim),
        licencas: e.licencas,
        valor: e.valor,
      },
    };
  });

  /* ---------------- nova e editar ---------------- */
  const salva = async (req: FastifyRequest, rep: FastifyReply, id: string | null) => {
    const u = req.usuario!;
    const p = EmpresaIn.safeParse(req.body);
    if (!p.success) return erro400(rep, p.error);
    const v = p.data;
    const emps = await carregaEmpresas();
    const e = id ? emps.find((x) => x.id === id) : null;
    if (id && !e) return rep.code(404).send({ erro: 'Esta conta não existe mais.' });
    if (emps.some((x) => x !== e && x.nome.toLowerCase() === v.nome.toLowerCase()))
      return rep.code(409).send({ erro: 'Já existe uma empresa com esse nome.' });
    const ini = diaUTC(v.inicio);
    const fim = diaUTC(v.fim);
    if (Number.isNaN(+ini) || Number.isNaN(+fim))
      return rep.code(400).send({ erro: 'Preencha início e fim do contrato.' });
    if (+fim <= +ini) return rep.code(400).send({ erro: 'O fim do contrato precisa ser depois do início.' });
    if (v.rhEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.rhEmail))
      return rep.code(400).send({ erro: 'O e-mail do RH não parece válido.' });
    if (!(await gerentes()).includes(v.gerente)) return rep.code(400).send({ erro: 'Escolha o gerente da conta.' });
    const turma = !!e?.turmaCurso;
    if (!turma && v.licencas < 1) return rep.code(400).send({ erro: 'A conta precisa de pelo menos 1 licença.' });
    const b = await base();
    const validos = b.cursos.filter((c) => c.estrutura !== 'turmas').map((c) => c.name);
    const dados = {
      nome: v.nome,
      cnpj: v.cnpj,
      segmento: v.segmento || '—',
      modelo: v.modelo,
      gerente: v.gerente,
      inicio: ini,
      fim,
      renovaAuto: v.renovaAuto,
      rhNome: v.rhNome || '—',
      rhEmail: v.rhEmail || '—',
      representante: v.representante || null,
      funcionarios: v.funcionarios,
      rhDepartamento: v.rhDepartamento,
      rhTelefone: v.rhTelefone,
      endereco: Object.values(v.endereco).some(Boolean) ? v.endereco : undefined,
      ...(turma
        ? {}
        : {
            licencas: v.licencas,
            aulas: v.aulas,
            valor: v.valor,
            subsidio: v.modelo === 'B2B' ? 100 : v.subsidio,
            desconto: v.modelo === 'B2B' ? 0 : v.desconto,
            cursos: v.cursos.filter((c) => validos.includes(c)),
          }),
    };
    if (e) {
      await prisma.empresa.update({ where: { id: e.id }, data: dados });
      const depois = (await carregaEmpresas()).find((x) => x.id === e.id)!;
      await loga(u, depois, 'Empresa editada', `${depois.modelo} · ${empCobranca(depois)}`);
      invalidaBase();
      return { id: e.id, msg: 'Empresa salva.' };
    }
    const novoId = `e${Math.max(0, ...emps.map((x) => Number(x.id.slice(1)) || 0)) + 1}`;
    const ordem = Math.max(0, ...(await prisma.empresa.findMany({ select: { ordem: true } })).map((x) => x.ordem)) + 1;
    await prisma.empresa.create({
      data: {
        id: novoId,
        ordem,
        licencas: 0,
        aulas: 0,
        valor: 0,
        subsidio: 100,
        desconto: 0,
        cursos: [],
        ...dados,
      },
    });
    await loga(u, { id: novoId, nome: v.nome }, 'Empresa criada', `${v.modelo} · ${v.licencas} licenças`);
    return { id: novoId, msg: `${v.nome} criada. Vincule os alunos na aba Alunos.` };
  };
  app.post('/empresas', { preHandler: exigeGerir }, (req, rep) => salva(req, rep, null));
  app.put('/empresas/:id', { preHandler: exigeGerir }, (req, rep) =>
    salva(req, rep, (req.params as { id: string }).id),
  );

  /* ---------------- renovar ---------------- */
  app.post('/empresas/:id/renovar', { preHandler: exigeGerir }, async (req, rep) => {
    const u = req.usuario!;
    const { id } = req.params as { id: string };
    const e = (await carregaEmpresas()).find((x) => x.id === id);
    if (!e) return rep.code(404).send({ erro: 'Esta conta não existe mais.' });
    const p = z
      .object({
        fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        licencas: z.coerce.number().int().optional(),
        aulas: z.coerce.number().int().optional(),
        valor: z.coerce.number().int().optional(),
      })
      .safeParse(req.body);
    const novoFim = p.success ? new Date(`${p.data.fim}T00:00:00`) : null;
    if (!p.success || !novoFim || +novoFim <= +e.fim)
      return rep.code(400).send({ erro: `O novo fim precisa ser depois de ${dataTxt(e.fim)}.` });
    const v = p.data;
    let extra = {};
    if (!e.turmaCurso) {
      if (!((v.licencas ?? 0) >= 1)) return rep.code(400).send({ erro: 'A conta precisa de pelo menos 1 licença.' });
      extra = {
        licencas: v.licencas,
        aulas: e.aulas + Math.max(0, v.aulas ?? 0),
        valor: Math.max(0, v.valor ?? 0),
      };
    }
    await prisma.empresa.update({ where: { id }, data: { fim: diaUTC(v.fim), ...extra } });
    await loga(
      u,
      e,
      'Contrato renovado',
      `${dataTxt(e.fim)} → ${dataTxt(novoFim)}${e.turmaCurso ? '' : ` · ${v.licencas} licenças`}`,
    );
    return { msg: `Contrato renovado até ${dataTxt(novoFim)}.` };
  });

  /* ---------------- relatório ao RH ---------------- */
  app.post('/empresas/:id/relatorio', { preHandler: exigeGerir }, async (req, rep) => {
    const u = req.usuario!;
    const { id } = req.params as { id: string };
    const e = (await carregaEmpresas()).find((x) => x.id === id);
    if (!e) return rep.code(404).send({ erro: 'Esta conta não existe mais.' });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.rhEmail))
      return rep.code(400).send({ erro: 'Cadastre o e-mail do RH em Editar empresa antes de enviar o relatório.' });
    const b = await base();
    const ps = aulas30(b, agOfertas(b));
    const d = empDados(b, e, ps);
    const mes = new Date().toLocaleDateString('pt-BR', { month: 'long' });
    await prisma.empresa.update({ where: { id }, data: { relEm: new Date() } });
    await loga(
      u,
      e,
      'Relatório enviado ao RH',
      `${e.rhEmail} · ${d.presenca == null ? '' : `${d.presenca}% · `}${d.consumo} aulas`,
    );
    const linhas = d.turma
      ? [
          `Turmas de ${e.turmaCurso}: ${d.licUsadas} de ${d.licContr} vagas ocupadas.`,
          `Aulas consumidas: ${d.consumo} de ${d.contratadas}.`,
          `Aulas realizadas nos últimos 30 dias: ${d.presenca == null ? '—' : `${d.presenca}%`}.`,
        ]
      : [
          `Licenças em uso: ${d.licUsadas} de ${d.licContr}.`,
          `Aulas consumidas: ${d.consumo} de ${d.contratadas}.`,
          `Presença nos últimos 30 dias: ${d.presenca == null ? '—' : `${d.presenca}%`}.`,
          '',
          'Alunos:',
          ...d.alunos.map((a) => {
            const ms = alMat(a);
            return `- ${a.name}: ${ms.reduce((x, m) => x + m.usadas, 0)} aulas usadas, presença ${presencaDe(b, a.name, ps)}`;
          }),
        ];
    return {
      msg: `Relatório de ${mes} enviado para ${e.rhEmail}: ${d.turma ? 'turmas, vagas e aulas realizadas' : 'alunos, presença e consumo de aulas'}.`,
      email: {
        para: e.rhEmail,
        assunto: `Relatório de ${mes} · ${e.nome}`,
        corpo: [
          `Olá, ${e.rhNome}.`,
          '',
          `Segue o relatório de ${mes} da conta ${e.nome}.`,
          '',
          ...linhas,
          '',
          `${u.nome}`,
        ].join('\n'),
      },
    };
  });

  /* ---------------- vincular e desvincular aluno ---------------- */
  app.post('/empresas/:id/alunos', { preHandler: exigeGerir }, async (req, rep) => {
    const u = req.usuario!;
    const { id } = req.params as { id: string };
    const e = (await carregaEmpresas()).find((x) => x.id === id);
    if (!e) return rep.code(404).send({ erro: 'Esta conta não existe mais.' });
    const p = z.object({ alunoId: z.coerce.number().int().positive() }).safeParse(req.body);
    if (!p.success) return rep.code(400).send({ erro: 'Escolha o aluno para vincular.' });
    const b = await base();
    const a = b.alunos.find((x) => x.id === p.data.alunoId);
    if (!a) return rep.code(400).send({ erro: 'Escolha o aluno para vincular.' });
    if (a.empresa) return rep.code(409).send({ erro: `${a.name} já é aluno de ${a.empresa}.` });
    await prisma.aluno.update({ where: { id: a.id }, data: { empresaId: e.id } });
    await loga(u, e, 'Aluno vinculado', a.name);
    await registra({
      tipo: 'aluno',
      id: String(a.id),
      nome: a.name,
      acao: 'Vinculado à empresa',
      detalhe: `${e.nome} · ${e.modelo}`,
      autor: u.nome,
    });
    invalidaBase();
    const nb = await base();
    const d = empDados(nb, e, aulas30(nb, agOfertas(nb)));
    return {
      msg: `${a.name} agora é aluno de ${e.nome}.${d.licUsadas > d.licContr ? ` A conta passou do limite de ${d.licContr} licenças.` : ''}`,
    };
  });
  app.delete('/empresas/:id/alunos/:alunoId', { preHandler: exigeGerir }, async (req, rep) => {
    const u = req.usuario!;
    const { id, alunoId } = req.params as { id: string; alunoId: string };
    const e = (await carregaEmpresas()).find((x) => x.id === id);
    if (!e) return rep.code(404).send({ erro: 'Esta conta não existe mais.' });
    const a = (await base()).alunos.find((x) => x.id === Number(alunoId));
    if (!a || a.empresa !== e.nome)
      return rep.code(404).send({ erro: 'Este aluno não está vinculado a esta empresa.' });
    await prisma.aluno.update({ where: { id: a.id }, data: { empresaId: null } });
    await loga(u, e, 'Aluno desvinculado', a.name);
    await registra({
      tipo: 'aluno',
      id: String(a.id),
      nome: a.name,
      acao: 'Desvinculado da empresa',
      detalhe: `${e.nome} · passa a B2C`,
      autor: u.nome,
    });
    invalidaBase();
    return { msg: `${a.name} saiu de ${e.nome} e passa a B2C.` };
  });
}
