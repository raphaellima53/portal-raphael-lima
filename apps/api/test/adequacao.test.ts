/**
 * Adequação ao Portal Alumni (22/09/2026): os campos novos das telas que já existiam gravam, voltam no formulário
 * e entram no log; as regras novas recusam o que não vale. Cada teste devolve os dados como estavam.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { montaApp } from '../src/app.ts';
import { prisma } from '../src/db.ts';
import { mudancas } from '../src/domain/auditoria.ts';
import { invalidaBase } from '../src/domain/base.ts';
import { doForm } from '../src/domain/cadastros.ts';

let app: FastifyInstance;
let h: { cookie: string };
before(async () => {
  app = await montaApp();
  invalidaBase();
  h = await entra('admin@alumni.teste', 'alumni-admin');
});
after(async () => {
  await app.close();
  await prisma.$disconnect();
});

async function entra(login: string, senha: string) {
  const r = await app.inject({ method: 'POST', url: '/auth/login', payload: { login, senha } });
  return { cookie: `portal_sessao=${r.cookies.find((x) => x.name === 'portal_sessao')!.value}` };
}
const req = async (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: object, hh = h) => {
  const r = await app.inject({ method, url, headers: hh, payload });
  return { status: r.statusCode, json: r.json() };
};
const END = {
  cep: '01310-100',
  rua: 'Av. Paulista',
  numero: '1000',
  complemento: '5º andar',
  bairro: 'Bela Vista',
  cidade: 'São Paulo',
  uf: 'SP',
};

describe('adequação ao Portal Alumni', () => {
  test('aluno: telefone, nascimento, gênero, endereço, responsável e origem', async () => {
    const a = await prisma.aluno.findFirstOrThrow({ where: { matriculas: { some: {} } }, orderBy: { id: 'asc' } });
    const f0 = (await req('GET', `/alunos/${a.id}/form`)).json;
    try {
      const put = await req('PUT', `/alunos/${a.id}`, {
        ...f0,
        telefone: '(11) 98888-7777',
        nascimento: '1990-05-17',
        genero: 'Feminino',
        endereco: END,
        responsavelFinanceiro: 'Empresa',
        origemExterna: 'Importação',
      });
      assert.equal(put.status, 200, JSON.stringify(put.json));
      const f1 = (await req('GET', `/alunos/${a.id}/form`)).json;
      assert.equal(f1.telefone, '(11) 98888-7777');
      assert.equal(f1.nascimento, '1990-05-17', 'a data não volta um dia');
      assert.deepEqual(f1.endereco, END);
      assert.equal(f1.responsavelFinanceiro, 'Empresa');
      const log = await prisma.logAlteracao.findFirst({
        where: { entidade: 'Aluno', entidadeId: String(a.id), acao: 'Dados editados' },
        orderBy: { id: 'desc' },
      });
      assert.match(log?.detalhe ?? '', /telefone/);
      const ruim = await req('PUT', `/alunos/${a.id}`, { ...f0, telefone: '123', endereco: END });
      assert.equal(ruim.status, 400);
      assert.match(ruim.json.erro, /Telefone com DDD/);
    } finally {
      await prisma.aluno.update({
        where: { id: a.id },
        data: {
          telefone: a.telefone,
          nascimento: a.nascimento,
          genero: a.genero,
          endereco: a.endereco ?? undefined,
          responsavelFinanceiro: a.responsavelFinanceiro,
          origemExterna: a.origemExterna,
        },
      });
      if (a.endereco == null) await prisma.$executeRaw`UPDATE "Aluno" SET endereco = NULL WHERE id = ${a.id}`;
      invalidaBase();
    }
  });

  test('matrícula: contrato com vigência, tipo, origem, ligada e congelamento', async () => {
    const m = await prisma.matricula.findFirstOrThrow({
      where: { desativadoEm: null, aluno: { matriculas: { some: {} } } },
      include: { curso: true },
      orderBy: { id: 'asc' },
    });
    const outra = await prisma.matricula.findFirstOrThrow({ where: { alunoId: { not: m.alunoId } } });
    const c0 = (await req('GET', `/alunos/${m.alunoId}/matriculas-contrato?mid=${m.id}`)).json;
    assert.deepEqual(c0.opcoes.tipos, ['Regular', 'Bolsa', 'Cortesia', 'Reposição', 'Teste']);
    const corpo = (contrato: object) => ({
      item: m.modulo,
      modalidade: m.modalidade,
      total: m.total,
      usadas: m.usadas,
      contrato: { ...c0.contrato, ...contrato },
    });
    try {
      const ok = await req(
        'PUT',
        `/alunos/${m.alunoId}/matriculas/${m.id}`,
        corpo({
          inicio: '2026-01-10',
          fim: '2026-12-20',
          statusTipo: 'Bolsa',
          origem: 'Renovação',
          congelada: true,
        }),
      );
      assert.equal(ok.status, 200, JSON.stringify(ok.json));
      const c1 = (await req('GET', `/alunos/${m.alunoId}/matriculas-contrato?mid=${m.id}`)).json;
      assert.equal(c1.contrato.inicio, '2026-01-10');
      assert.equal(c1.contrato.statusTipo, 'Bolsa');
      assert.equal(c1.contrato.congelada, true);
      assert.ok(c1.congeladaDesde, 'guarda desde quando está congelada');
      const inv = await req(
        'PUT',
        `/alunos/${m.alunoId}/matriculas/${m.id}`,
        corpo({ inicio: '2026-12-01', fim: '2026-01-01' }),
      );
      assert.match(inv.json.erro, /fim do contrato não pode vir antes/);
      const alheia = await req('PUT', `/alunos/${m.alunoId}/matriculas/${m.id}`, corpo({ vinculadaId: outra.id }));
      assert.match(alheia.json.erro, /mesmo aluno/);
    } finally {
      await prisma.matricula.update({
        where: { id: m.id },
        data: {
          inicio: m.inicio,
          fim: m.fim,
          statusTipo: m.statusTipo,
          origem: m.origem,
          congeladaEm: m.congeladaEm,
          ofertaId: m.ofertaId,
          vinculadaId: m.vinculadaId,
        },
      });
      invalidaBase();
    }
  });

  test('colaborador e professor: CPF, dados pessoais, endereço e skills', async () => {
    const lc = (await req('GET', '/config/colaboradores')).json.linhas[0];
    const cargo = lc.cargo === '—' ? '' : lc.cargo;
    const col0 = await prisma.colaborador.findUniqueOrThrow({ where: { id: lc.id } });
    const p0 = await prisma.professor.findFirstOrThrow({ where: { ativo: true }, orderBy: { ordem: 'asc' } });
    try {
      const cpfRuim = await req('PUT', `/config/colaboradores/${lc.id}`, { ...lc, cargo, cpf: '123' });
      assert.match(cpfRuim.json.erro, /11 dígitos/);
      const ok = await req('PUT', `/config/colaboradores/${lc.id}`, {
        ...lc,
        cargo,
        cpf: '123.456.789-09',
        admissao: '2024-03-01',
        endereco: END,
      });
      assert.equal(ok.status, 200, JSON.stringify(ok.json));
      const lc1 = (await req('GET', '/config/colaboradores')).json.linhas.find((x: { id: number }) => x.id === lc.id);
      assert.equal(lc1.cpf, '12345678909');
      assert.equal(lc1.admissao, '2024-03-01');

      const fp = (await req('GET', `/professores/${p0.id}/form`)).json;
      const skill =
        (await prisma.catalogo.findFirst({ where: { tipo: 'skills', ativo: true } }))?.nome ?? 'Conversação';
      const pp = await req('PUT', `/professores/${p0.id}`, {
        ...fp,
        cpf: '98765432100',
        skills: [skill],
        endereco: END,
      });
      assert.equal(pp.status, 200, JSON.stringify(pp.json));
      const fp1 = (await req('GET', `/professores/${p0.id}/form`)).json;
      assert.deepEqual(fp1.skills, [skill]);
      assert.equal(fp1.cpf, '98765432100');
    } finally {
      await prisma.colaborador.update({
        where: { id: col0.id },
        data: { cpf: col0.cpf, admissao: col0.admissao, endereco: col0.endereco ?? undefined },
      });
      if (col0.endereco == null)
        await prisma.$executeRaw`UPDATE "Colaborador" SET endereco = NULL WHERE id = ${col0.id}`;
      await prisma.professor.update({
        where: { id: p0.id },
        data: { cpf: p0.cpf, skills: p0.skills, endereco: p0.endereco ?? undefined },
      });
      if (p0.endereco == null) await prisma.$executeRaw`UPDATE "Professor" SET endereco = NULL WHERE id = ${p0.id}`;
      invalidaBase();
    }
  });

  test('empresa: representante, funcionários, endereço e contato completo do RH', async () => {
    const e0 = await prisma.empresa.findFirstOrThrow({ where: { turmaCurso: null }, orderBy: { ordem: 'asc' } });
    const f = (await req('GET', `/empresas/${e0.id}`)).json.form;
    try {
      const ok = await req('PUT', `/empresas/${e0.id}`, {
        ...f,
        representante: 'Marina Costa',
        funcionarios: 1200,
        rhDepartamento: 'Gente e Gestão',
        rhTelefone: '(11) 3333-4444',
        endereco: END,
      });
      assert.equal(ok.status, 200, JSON.stringify(ok.json));
      const g = (await req('GET', `/empresas/${e0.id}`)).json;
      assert.equal(g.form.funcionarios, 1200);
      assert.equal(g.form.rhDepartamento, 'Gente e Gestão');
      const linhas = JSON.stringify(g.dados);
      assert.match(linhas, /Marina Costa/);
      assert.match(linhas, /Av\. Paulista, 1000/);
    } finally {
      await prisma.empresa.update({
        where: { id: e0.id },
        data: {
          representante: e0.representante,
          funcionarios: e0.funcionarios,
          rhDepartamento: e0.rhDepartamento,
          rhTelefone: e0.rhTelefone,
          endereco: e0.endereco ?? undefined,
        },
      });
      if (e0.endereco == null) await prisma.$executeRaw`UPDATE "Empresa" SET endereco = NULL WHERE id = ${e0.id}`;
      invalidaBase();
    }
  });

  test('curso: antecedência e configuração da agenda; escolha fora da lista volta ao padrão', async () => {
    const c0 = await prisma.curso.findFirstOrThrow({ where: { estrutura: 'modulos' }, orderBy: { ordem: 'asc' } });
    const r = (await req('GET', `/cursos/${c0.id}?aba=regras`)).json.dados;
    assert.equal(r.configCampos.length, 8);
    try {
      const ok = await req('PUT', `/cursos/${c0.id}/regras`, {
        ...r,
        antecedencia: 12,
        config: { ...r.config, agendaPor: 'Aluno', onboarding: 'Inventado', presenca: false },
      });
      assert.equal(ok.status, 200, JSON.stringify(ok.json));
      const r1 = (await req('GET', `/cursos/${c0.id}?aba=regras`)).json.dados;
      assert.equal(r1.antecedencia, 12);
      assert.equal(r1.config.agendaPor, 'Aluno');
      assert.equal(r1.config.onboarding, 'Nenhum', 'opção inventada volta ao padrão');
      assert.equal(r1.config.presenca, false);
    } finally {
      await prisma.curso.update({
        where: { id: c0.id },
        data: { regras: c0.regras as never, configAgenda: c0.configAgenda ?? undefined },
      });
      if (c0.configAgenda == null)
        await prisma.$executeRaw`UPDATE "Curso" SET "configAgenda" = NULL WHERE id = ${c0.id}`;
      invalidaBase();
    }
  });

  test('sala: conta e licença do Zoom', async () => {
    const s = (await req('GET', '/config/salas')).json.linhas[0];
    const s0 = await prisma.sala.findUniqueOrThrow({ where: { id: s.id } });
    try {
      const ruim = await req('PUT', `/config/salas/${s.id}`, { ...s, zoomEmail: 'sem-arroba' });
      assert.match(ruim.json.erro, /E-mail do Zoom/);
      const ok = await req('PUT', `/config/salas/${s.id}`, {
        ...s,
        zoomEmail: 'Sala01@Alumni.teste',
        zoomLicencaAte: '2027-02-28',
      });
      assert.equal(ok.status, 200, JSON.stringify(ok.json));
      const s1 = (await req('GET', '/config/salas')).json.linhas.find((x: { id: number }) => x.id === s.id);
      assert.equal(s1.zoomEmail, 'sala01@alumni.teste');
      assert.equal(s1.zoomLicencaAte, '2027-02-28');
    } finally {
      await prisma.sala.update({
        where: { id: s0.id },
        data: { zoomEmail: s0.zoomEmail, zoomLicencaAte: s0.zoomLicencaAte },
      });
      invalidaBase();
    }
  });

  test('conta: troca de senha obrigatória some depois de trocar', async () => {
    const u = await prisma.usuario.findFirstOrThrow({
      where: { personaLetra: { not: null }, senhaTeste: { not: null } },
    });
    const senha = u.senhaTeste!;
    await prisma.usuario.update({ where: { id: u.id }, data: { trocarSenha: true } });
    try {
      const hp = await entra(u.email, senha);
      assert.equal((await req('GET', '/auth/me', undefined, hp)).json.usuario.trocarSenha, true);
      const t = await req('PUT', '/auth/senha', { atual: senha, nova: senha }, hp);
      assert.equal(t.status, 200, JSON.stringify(t.json));
      assert.equal((await req('GET', '/auth/me', undefined, hp)).json.usuario.trocarSenha, false);
    } finally {
      await prisma.usuario.update({ where: { id: u.id }, data: { trocarSenha: false } });
    }
  });

  test('alertas: o sino guarda o que já foi lido', async () => {
    const a = (await req('GET', '/alertas')).json.alertas;
    if (!a.length) return;
    await req('POST', '/alertas/lidas', {});
    const b = (await req('GET', '/alertas')).json.alertas;
    assert.ok(
      b.every((x: { lida: boolean }) => x.lida),
      'depois de abrir o sino, tudo lido',
    );
    const eu = await prisma.usuario.findFirstOrThrow({ where: { email: 'admin@alumni.teste' } });
    await prisma.notificacao.updateMany({ where: { usuarioId: eu.id }, data: { texto: 'mudou' } });
    const c = (await req('GET', '/alertas')).json.alertas;
    assert.ok(
      c.every((x: { lida: boolean }) => !x.lida),
      'alerta que muda volta a ser novo',
    );
  });

  test('turma: grade no formato certo e não exclui com aluno matriculado', async () => {
    const t = await prisma.turma.findFirstOrThrow({ orderBy: { id: 'asc' } });
    const tela = (await req('GET', '/cadastros/turmas')).json;
    const l = tela.linhas.find((x: { id: number }) => x.id === t.id);
    const ruim = await req('PUT', `/cadastros/turmas/${t.id}`, { ...l.valores, grade: 'segunda de manhã' });
    assert.match(ruim.json.erro, /Grade no formato/);
    const com = await prisma.matricula.count({ where: { cursoId: t.cursoId, modulo: t.nome, desativadoEm: null } });
    if (com) {
      const ex = await req('DELETE', `/cadastros/turmas/${t.id}`);
      assert.equal(ex.status, 400);
      assert.match(ex.json.erro, /inative em vez de excluir/);
    }
  });

  test('dinheiro em pt-BR e o que mudou na Auditoria', () => {
    const c = { k: 'valor', rotulo: 'Valor', tipo: 'dinheiro' as const };
    assert.deepEqual(doForm(c, '1.500,50'), { v: '1500.50' });
    assert.deepEqual(doForm(c, '1500.50'), { v: '1500.50' });
    assert.deepEqual(doForm(c, '150'), { v: '150.00' });
    assert.deepEqual(
      mudancas({ nome: 'A', inicio: '2026-01-02T00:00:00.000Z' }, { nome: 'B', inicio: '2026-01-02T00:00:00.000Z' }),
      ['nome: A → B'],
    );
    assert.deepEqual(mudancas(null, { data: '2026-03-04' }), ['data: 04/03/2026']);
  });
});
