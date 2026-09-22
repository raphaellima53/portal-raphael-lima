/**
 * Seed com a base do artefato "01. Portal Raphael Lima.html" (fictícia, como lá).
 * Os dados saem de prisma/seed-data/base.json, gerado por tools/extrai-portal a partir do portal rodando.
 * Datas relativas (fim de contrato, vigência das empresas) são recalculadas a partir de hoje.
 * Rodar de novo apaga e recria tudo.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { prisma } from '../src/db.ts';
import { MATRIZ, PERFIS } from '../src/domain/acesso.ts';
import { hashSenha } from '../src/lib/senha.ts';

// biome-ignore lint/suspicious/noExplicitAny: JSON de seed
type J = any;
const base: J = JSON.parse(readFileSync(join(import.meta.dirname, 'seed-data', 'base.json'), 'utf8'));

const hoje = new Date();
hoje.setHours(12, 0, 0, 0);
const emDias = (n: number | null) => {
  if (n == null) return null;
  const d = new Date(hoje);
  d.setDate(d.getDate() + n);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
};
const diaUTC = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** valores iniciais dos catálogos da adequação ao Portal Alumni */
const CATALOGOS_ALUMNI: Record<string, string[]> = {
  categoriasServico: ['Atendimento', 'Acompanhamento', 'Consultoria'],
  tiposConteudo: ['Vídeo', 'Áudio', 'PDF', 'Link', 'Exercício', 'SCORM'],
  fontes: ['Própria', 'Parceiro', 'Livro didático', 'Internet'],
  categoriasCurriculo: ['Geral', 'Business', 'Conversação', 'Preparatório'],
  progressoes: ['Linear', 'Por módulo', 'Livre'],
  tiposGeracao: ['Automática', 'Manual'],
  visibilidadesOferta: ['Pública', 'Só convidados', 'Interna'],
};

async function limpa() {
  await prisma.$transaction([
    prisma.sessao.deleteMany(),
    prisma.dashboardConfig.deleteMany(),
    prisma.preferencia.deleteMany(),
    prisma.usuario.deleteMany(),
    /* adequação ao Portal Alumni: a matrícula aponta para a oferta, e a oferta e o serviço para o curso */
    prisma.matricula.deleteMany(),
    prisma.oferta.deleteMany(),
    prisma.servico.deleteMany(),
    prisma.aluno.deleteMany(),
    prisma.turma.deleteMany(),
    prisma.modulo.deleteMany(),
    prisma.curso.deleteMany(),
    prisma.professor.deleteMany(),
    prisma.empresa.deleteMany(),
    prisma.segmento.deleteMany(),
    prisma.sala.deleteMany(),
    prisma.feriado.deleteMany(),
    prisma.funcionamento.deleteMany(),
    prisma.catalogo.deleteMany(),
    prisma.departamento.deleteMany(),
    prisma.cargo.deleteMany(),
    prisma.colaborador.deleteMany(),
    prisma.curriculo.deleteMany(),
    prisma.conteudo.deleteMany(),
    prisma.calendario.deleteMany(),
    prisma.aulaAjuste.deleteMany(),
    prisma.logAlteracao.deleteMany(),
    prisma.evento.deleteMany(),
    prisma.fechamentoCompetencia.deleteMany(),
    prisma.lead.deleteMany(),
    prisma.parcelaPaga.deleteMany(),
    prisma.fluxoCard.deleteMany(),
    prisma.fluxoSemeado.deleteMany(),
    prisma.acessoLog.deleteMany(),
    prisma.configuracao.deleteMany(),
  ]);
}

async function main() {
  await limpa();

  await prisma.catalogo.createMany({ data: base.catalogos });
  /* os catálogos da adequação ao Portal Alumni (os mesmos valores da migração 20260922170000_catalogos_alumni) */
  await prisma.catalogo.createMany({
    data: Object.entries(CATALOGOS_ALUMNI).flatMap(([tipo, nomes]) =>
      nomes.map((nome, ordem) => ({ tipo, nome, ativo: true, ordem })),
    ),
    skipDuplicates: true,
  });
  await prisma.departamento.createMany({ data: base.departamentos });
  await prisma.cargo.createMany({ data: base.cargos });
  await prisma.colaborador.createMany({ data: base.colaboradores });
  await prisma.segmento.createMany({ data: base.segmentos.map((nome: string) => ({ nome })) });
  await prisma.sala.createMany({ data: base.salas });
  await prisma.feriado.createMany({ data: base.feriados.map((f: J) => ({ ...f, data: diaUTC(f.data) })) });
  await prisma.funcionamento.createMany({ data: base.funcionamento });
  /* histórico de acesso do portal (SES_LOG): hoje e ontem, na hora de cada evento */
  const diaHora = (dias: number, hm: string) => {
    const d = new Date();
    d.setDate(d.getDate() - dias);
    const [h, m] = hm.split(':').map(Number);
    d.setHours(h, m, 0, 0);
    return d;
  };
  await prisma.acessoLog.createMany({
    data: (
      [
        [0, '09:10', 'Hozana Galvão Jannuzzi', 'login', 'sucesso', 'MFA aprovado'],
        [0, '08:31', 'Eduardo Krausz', 'login', 'sucesso', 'sem MFA — perfil não exige'],
        [0, '08:12', 'Admin User', 'login', 'sucesso', 'MFA aprovado'],
        [0, '07:52', 'desconhecido', 'login', 'recusado', 'senha incorreta · 3ª tentativa · e-mail não cadastrado'],
        [0, '07:44', 'Maria Emilia Wendler Müller', 'login', 'sucesso', 'MFA aprovado'],
        [1, '19:03', 'Arthur Braz', 'login', 'recusado', 'usuário bloqueado'],
        [1, '18:20', 'Bruno Tavares Nogueira', 'login', 'sucesso', 'MFA aprovado'],
        [
          1,
          '17:40',
          'Admin User',
          'perfil alterado',
          'executado',
          'Juliana A. de O. Lima: CX → Customer Care · just.: mudança de área',
        ],
      ] as [number, string, string, string, string, string][]
    ).map(([d, hm, quem, evento, resultado, detalhe]) => ({
      quando: diaHora(d, hm),
      quem,
      evento,
      resultado,
      detalhe,
    })),
  });

  await prisma.empresa.createMany({
    data: base.empresas.map(({ inicioDias, fimDias, ...e }: J) => ({
      ...e,
      inicio: emDias(inicioDias)!,
      fim: emDias(fimDias)!,
    })),
  });
  const empresaId = new Map<string, string>(base.empresas.map((e: J) => [e.nome, e.id]));

  await prisma.professor.createMany({
    data: base.professores.map((p: J) => ({ ...p, habilitacao: p.habilitacao ?? undefined, disponibilidade: [] })),
  });
  const professorId = new Map<string, string>(base.professores.map((p: J) => [p.nome, p.id]));

  const cursoId = new Map<string, number>();
  for (const c of base.cursos) {
    const criado = await prisma.curso.create({
      data: {
        nome: c.nome,
        cor: c.cor,
        estrutura: c.estrutura,
        formato: c.formato,
        tipo: c.tipo,
        idioma: c.idioma,
        ativo: c.ativo,
        autoAgenda: c.autoAgenda,
        descricao: c.descricao,
        regras: c.regras,
        ordem: c.ordem,
        modulos: { create: c.modulos },
        turmas: {
          create: c.turmas.map(({ professor, ...t }: J) => ({
            ...t,
            professorId: professor ? professorId.get(professor) : null,
          })),
        },
      },
    });
    cursoId.set(c.nome, criado.id);
  }

  for (const [ordem, a] of base.alunos.entries()) {
    await prisma.aluno.create({
      data: {
        id: a.id,
        ordem,
        nome: a.nome,
        email: a.email,
        cpf: a.cpf,
        emailPlaceholder: a.emailPlaceholder,
        status: a.status,
        desativadoEm: emDias(a.desativadoDias),
        empresaId: a.empresa ? (empresaId.get(a.empresa) ?? null) : null,
        contratoFim: emDias(a.contratoFimDias),
        disponibilidade: [],
        matriculas: {
          create: a.matriculas.map((m: J) => ({
            cursoId: cursoId.get(m.curso)!,
            modulo: m.modulo,
            usadas: m.usadas,
            total: m.total,
            modalidade: m.modalidade,
            desativadoEm: emDias(m.desativadoDias),
            alocacao: m.alocacao ?? undefined,
            ordem: m.ordem,
          })),
        },
      },
    });
  }
  /* o id do aluno vem do portal; a sequência continua depois do maior */
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"Aluno"', 'id'), (SELECT MAX(id) FROM "Aluno"))`,
  );

  await prisma.curriculo.createMany({ data: base.curriculos });

  const alunoPorNome = new Map<string, number>(base.alunos.map((a: J) => [a.nome, a.id]));
  for (const p of base.personas) {
    const m = MATRIZ[p.perfilId] ?? { nivel: 5, areas: {} };
    await prisma.usuario.create({
      data: {
        nome: p.nome,
        email: p.login,
        senhaHash: await hashSenha(p.senha),
        senhaTeste: p.senha,
        perfilId: p.perfilId,
        nivel: m.nivel,
        areas: m.areas,
        status: 'Ativo',
        mfa: PERFIS.find((x) => x.id === p.perfilId)?.perfil === 'Admin',
        ultimoAcesso: 'persona de teste',
        personaLetra: p.letra,
        personaTipo: p.tipo,
        personaCursos: p.cursos,
        personaModulos: p.modulos,
        objetivo: p.objetivo,
        agendaPresa: p.agenda ?? undefined,
        alunoId: p.alunoNome ? (alunoPorNome.get(p.alunoNome) ?? null) : null,
        ordem: p.ordem,
      },
    });
  }
  await prisma.usuario.createMany({
    data: base.usuarios.map((u: J) => ({
      nome: u.nome,
      email: u.email,
      senhaHash: null,
      perfilId: null,
      nivel: 5,
      areas: {},
      status: u.status,
      mfa: u.mfa,
      perfilLegado: u.perfil,
      escopoLegado: u.escopo,
      ultimoAcesso: u.ultimoAcesso,
      ordem: u.ordem,
    })),
  });

  await prisma.logAlteracao.createMany({
    data: base.historicoBase.map((h: J) => {
      const [d, hm] = h.quando.split(' ');
      const [dd, mm, aa] = d.split('/').map(Number);
      const [hh, mi] = hm.split(':').map(Number);
      return {
        quando: new Date(aa, mm - 1, dd, hh, mi),
        autor: h.autor,
        entidade: h.entidade,
        nome: h.nome,
        acao: h.acao,
        detalhe: h.detalhe === '—' ? null : h.detalhe,
        origem: 'base',
      };
    }),
  });

  /* eventos de exemplo: nascem na semana corrente, no mesmo dia da semana e hora em que estavam no portal */
  const inicioSemana = (d: Date) => {
    const x = new Date(d);
    x.setDate(d.getDate() - d.getDay());
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const refSnap = new Date(base.geradoEm);
  const semSnap = inicioSemana(refSnap);
  const semHoje = inicioSemana(new Date());
  const reancora = (min: number) => {
    const t = new Date(Math.round((refSnap.getTime() + min * 6e4) / 6e4) * 6e4);
    const k = Math.round((new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime() - semSnap.getTime()) / 864e5);
    const d = new Date(semHoje);
    d.setDate(semHoje.getDate() + k);
    d.setHours(t.getHours(), t.getMinutes(), 0, 0);
    return d;
  };
  await prisma.evento.createMany({
    data: base.eventos.map((e: J) => ({
      id: e.id,
      tipo: e.tipo,
      titulo: e.titulo,
      inicio: reancora(e.iniMin),
      fim: reancora(e.fimMin),
      local: e.local || '',
      descricao: e.desc || '',
      participantes: e.part,
      criadoPor: e.por,
      exemplo: !!e.exemplo,
    })),
  });

  /* leads: mesmo número de dias atrás e mesma hora do dia em que estavam no portal */
  const relativo = (min: number) => {
    const t = new Date(refSnap.getTime() + min * 6e4);
    const diaSnap = new Date(refSnap.getFullYear(), refSnap.getMonth(), refSnap.getDate());
    const k = Math.round((new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime() - diaSnap.getTime()) / 864e5);
    const d = new Date();
    d.setDate(d.getDate() + k);
    d.setHours(t.getHours(), t.getMinutes(), t.getSeconds(), 0);
    return d;
  };
  await prisma.lead.createMany({
    data: base.leads.map((l: J, ordem: number) => ({
      id: l.id,
      nome: l.nome,
      email: l.email,
      origem: l.origem,
      curso: l.curso,
      consultor: l.consultor,
      etapa: l.etapa,
      motivo: l.motivo || '',
      alunoId: null,
      entrou: relativo(l.entrouMin),
      mudou: relativo(l.mudouMin),
      ordem,
    })),
  });

  const contagem = {
    usuarios: await prisma.usuario.count(),
    alunos: await prisma.aluno.count(),
    matriculas: await prisma.matricula.count(),
    cursos: await prisma.curso.count(),
    professores: await prisma.professor.count(),
    curriculos: await prisma.curriculo.count(),
  };
  console.log('seed ok', contagem);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
