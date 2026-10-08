/**
 * Decisões do refinamento de 05/10/2026 (quadro "002. Scrum e Kanban do Portal"): troca de tipo do curso com
 * confirmação (2.2.3.4), cancelamento pela equipe sem prazo (2.4.3.2), professor nunca em dois lugares no mesmo
 * horário (2.5.3.3), turma excluída desvincula os alunos (2.6.3.2), CPF e e-mail (3.2.3.3), saldo pela agenda
 * (3.4.3.1) e contrato/pedido em PDF (3.5.3.2). Criam cursos e alunos de teste e apagam no fim.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { montaApp } from '../src/app.ts';
import { prisma } from '../src/db.ts';
import { agAulasEntre } from '../src/domain/agenda.ts';
import { cancelaPeloAluno } from '../src/domain/aulas.ts';
import { base, invalidaBase } from '../src/domain/base.ts';
import { cpfValido } from '../src/lib/pessoa.ts';

let app: FastifyInstance;
const criados: { cursos: number[]; alunos: number[] } = { cursos: [], alunos: [] };
const INICIO = new Date();
before(async () => {
  app = await montaApp();
});
after(async () => {
  await prisma.matricula.deleteMany({ where: { alunoId: { in: criados.alunos } } });
  await prisma.aluno.deleteMany({ where: { id: { in: criados.alunos } } });
  await prisma.curso.deleteMany({ where: { id: { in: criados.cursos } } });
  await prisma.lixeira.deleteMany({ where: { em: { gte: INICIO } } });
  await app.close();
  await prisma.$disconnect();
});

async function entra(login: string, senha: string) {
  const r = await app.inject({ method: 'POST', url: '/auth/login', payload: { login, senha } });
  return { cookie: `portal_sessao=${r.cookies.find((x) => x.name === 'portal_sessao')!.value}` };
}
const req = async (
  h: { cookie: string },
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  payload?: unknown,
) => {
  const r = await app.inject({ method, url, headers: h, payload: payload as object });
  return { status: r.statusCode, json: r.headers['content-type']?.includes('json') ? r.json() : null, r };
};
/** CPF válido a partir de 9 dígitos */
const cpfDe = (nove: string) => {
  const d = nove.split('').map(Number);
  const dv = (n: number) => ((d.slice(0, n).reduce((s, x, i) => s + x * (n + 1 - i), 0) * 10) % 11) % 10;
  d.push(dv(9));
  d.push(dv(10));
  return d.join('');
};
const sufixo = String(Date.now()).slice(-6);
const alunoNovo = (cpf: string, email: string) => ({
  nome: `Aluno decisão ${sufixo}`,
  cpf,
  email,
  telefone: '+55 (11) 98888-7777',
});

describe('decisões de 05/10/2026', () => {
  test('3.2.3.3: CPF com dígito verificador, CPF e e-mail únicos', async () => {
    assert.equal(cpfValido('529.982.247-25'), true);
    assert.equal(cpfValido('111.111.111-11'), false);
    assert.equal(cpfValido('529.982.247-24'), false);
    const adm = await entra('admin@alumni.teste', 'alumni-admin');
    const ruim = await req(adm, 'POST', '/alunos', alunoNovo('529.982.247-24', `dec.${sufixo}@x.teste`));
    assert.equal(ruim.status, 400);
    assert.match(ruim.json.erro, /CPF inválido/);
    const cpf = cpfDe(`9${sufixo}12`);
    const ok = await req(adm, 'POST', '/alunos', alunoNovo(cpf, `dec.${sufixo}@x.teste`));
    assert.equal(ok.status, 200, ok.json?.erro);
    criados.alunos.push(ok.json.id);
    const cpfRep = await req(adm, 'POST', '/alunos', alunoNovo(cpf, `dec2.${sufixo}@x.teste`));
    assert.equal(cpfRep.status, 409);
    assert.match(cpfRep.json.erro, /CPF já é do aluno/);
    const mailRep = await req(adm, 'POST', '/alunos', alunoNovo(cpfDe(`8${sufixo}34`), `DEC.${sufixo}@x.teste`));
    assert.equal(mailRep.status, 409);
    assert.match(mailRep.json.erro, /e-mail já é do aluno/);
    /* editar o próprio cadastro com o mesmo CPF e e-mail continua valendo */
    const ed = await req(adm, 'PUT', `/alunos/${ok.json.id}`, alunoNovo(cpf, `dec.${sufixo}@x.teste`));
    assert.equal(ed.status, 200, ed.json?.erro);
  });

  test('2.5.3.3: o professor não fica em dois cursos no mesmo dia e horário', async () => {
    const prof = await prisma.professor.findFirst({ where: { ativo: true }, orderBy: { nome: 'asc' } });
    assert.ok(prof, 'o seed precisa de um professor ativo');
    const adm = await entra('admin@alumni.teste', 'alumni-admin');
    const curso = (nome: string, dia: number, hora: string) => ({
      nome,
      cor: '#123456',
      estrutura: 'modulos',
      idioma: 'Inglês',
      itens: [
        {
          nome: 'Módulo do teste',
          cor: '#123456',
          cefr: 'A1',
          vagas: 4,
          agendamento: { valor: 1, unidade: 'h' },
          cancelamento: { valor: 1, unidade: 'h' },
          horarios: [{ dia, hora, professorId: prof.id }],
        },
      ],
    });
    const a = await req(adm, 'POST', '/cursos', curso(`Curso A ${sufixo}`, 2, '10:00'));
    assert.equal(a.status, 200, a.json?.erro);
    criados.cursos.push(a.json.id);
    invalidaBase();
    const choque = await req(adm, 'POST', '/cursos', curso(`Curso B ${sufixo}`, 2, '10:00'));
    assert.equal(choque.status, 400);
    assert.match(choque.json.erro, /não pode estar em dois lugares/);
    /* mesmo professor em outro horário: pode */
    const livre = await req(adm, 'POST', '/cursos', curso(`Curso B ${sufixo}`, 2, '14:00'));
    assert.equal(livre.status, 200, livre.json?.erro);
    criados.cursos.push(livre.json.id);
  });

  test('2.6.3.2 e 3.4.3.1: turma excluída desvincula; saldo = total − agendadas + canceladas', async () => {
    const adm = await entra('admin@alumni.teste', 'alumni-admin');
    const novo = await req(adm, 'POST', '/cursos', {
      nome: `Curso turmas ${sufixo}`,
      cor: '#123456',
      estrutura: 'turmas',
      idioma: 'Inglês',
      itens: [
        { nome: 'Turma X', cor: '#123456', cefr: 'A1', vagas: 8 },
        { nome: 'Turma Y', cor: '#123456', cefr: 'A1', vagas: 8 },
      ],
    });
    assert.equal(novo.status, 200, novo.json?.erro);
    criados.cursos.push(novo.json.id);
    await prisma.turma.updateMany({ where: { cursoId: novo.json.id }, data: { grade: 'Seg e Qua · 10:00' } });
    const alunoId = criados.alunos[0];
    assert.ok(alunoId, 'depende do aluno criado no teste de CPF');
    const inicio = new Date(Date.now() - 21 * 864e5).toISOString().slice(0, 10);
    const mat = await req(adm, 'POST', `/alunos/${alunoId}/matriculas`, {
      curso: `Curso turmas ${sufixo}`,
      item: 'Turma X',
      modalidade: 'Online',
      total: 40,
      contrato: { inicio },
    });
    assert.equal(mat.status, 200, mat.json?.erro);
    invalidaBase();
    let b = await base();
    let e = b.alunos.find((a) => a.id === alunoId)!.matriculas.find((m) => m.modulo === 'Turma X')!;
    assert.ok((e.agendadas ?? 0) > 0, 'a grade Seg e Qua gera aulas na vigência');
    assert.equal(e.usadas, (e.agendadas ?? 0) - (e.canceladas ?? 0));
    /* cancelar o aluno numa aula futura devolve 1 ao saldo */
    const antes = e.usadas;
    const futura = agAulasEntre(b, new Date(), new Date(Date.now() + 20 * 864e5)).find(
      (a) =>
        a.prod === `Curso turmas ${sufixo}` && a.mod === 'Turma X' && a.estado !== 'cancelada' && a.quando > new Date(),
    );
    assert.ok(futura);
    const canc = await req(adm, 'POST', '/aulas/acao', {
      k: futura.k,
      acao: 'agendamento',
      aluno: b.alunos.find((a) => a.id === alunoId)!.name,
    });
    assert.equal(canc.status, 200, canc.json?.erro);
    invalidaBase();
    b = await base();
    e = b.alunos.find((a) => a.id === alunoId)!.matriculas.find((m) => m.modulo === 'Turma X')!;
    assert.equal(e.usadas, antes - 1);
    /* tirar a Turma X do curso (sem trocar o tipo) deixa a matrícula sem turma e avisa no perfil */
    const ed = await req(adm, 'PUT', `/cursos/${novo.json.id}`, {
      nome: `Curso turmas ${sufixo}`,
      cor: '#123456',
      estrutura: 'turmas',
      idioma: 'Inglês',
      itens: [{ nome: 'Turma Y', cor: '#123456', cefr: 'A1', vagas: 8 }],
    });
    assert.equal(ed.status, 200, ed.json?.erro);
    assert.match(ed.json.msg, /1 aluno ficou sem turma/);
    const m = await prisma.matricula.findFirst({ where: { alunoId, cursoId: novo.json.id } });
    assert.equal(m?.modulo, null);
    const log = await prisma.logAlteracao.findFirst({
      where: { entidadeId: String(alunoId), acao: { contains: 'nova alocação' } },
    });
    assert.ok(log, 'o Log do aluno registra a nova alocação');
    const ficha = await req(adm, 'GET', `/alunos/${alunoId}?aba=cursos`);
    assert.equal(ficha.status, 200);
    const achaAtivas = (o: unknown): { curso: string; semTurma: boolean }[] =>
      o && typeof o === 'object'
        ? Array.isArray((o as { ativas?: unknown }).ativas)
          ? (o as { ativas: { curso: string; semTurma: boolean }[] }).ativas
          : Object.values(o).flatMap(achaAtivas)
        : [];
    const linha = achaAtivas(ficha.json).find((x) => x.curso === `Curso turmas ${sufixo}`);
    assert.equal(linha?.semTurma, true);
  });

  test('2.2.3.4: trocar o tipo com itens pede confirmação e não grava sem ela', async () => {
    const adm = await entra('admin@alumni.teste', 'alumni-admin');
    const id = criados.cursos.at(-1)!;
    const troca = { nome: `Curso turmas ${sufixo}`, cor: '#123456', estrutura: 'nenhuma', idioma: 'Inglês', itens: [] };
    const pede = await req(adm, 'PUT', `/cursos/${id}`, troca);
    assert.equal(pede.status, 409);
    assert.match(pede.json.erro, /Grupo Regular para Particular/);
    assert.equal((await prisma.curso.findUnique({ where: { id } }))?.estrutura, 'turmas');
    const vai = await req(adm, 'PUT', `/cursos/${id}`, { ...troca, confirmarTroca: true });
    assert.equal(vai.status, 200, vai.json?.erro);
    assert.equal((await prisma.curso.findUnique({ where: { id } }))?.estrutura, 'nenhuma');
  });

  test('2.4.3.2: Admin e colaboradores cancelam pelo aluno; o aluno e o professor não', () => {
    const p = (tipoPerfil: 'Admin' | 'Colaborador' | 'Prestador' | 'Aluno', nivel: number) => ({
      nome: 'x',
      nivel,
      areas: {} as never,
      tipoPerfil,
      ehAluno: tipoPerfil === 'Aluno',
    });
    assert.equal(cancelaPeloAluno(p('Admin', 1)), true);
    assert.equal(cancelaPeloAluno(p('Colaborador', 4)), true);
    assert.equal(cancelaPeloAluno(p('Colaborador', 5)), false);
    assert.equal(cancelaPeloAluno(p('Prestador', 3)), false);
    assert.equal(cancelaPeloAluno(p('Aluno', 9)), false);
  });

  test('3.5.3.2: contrato e pedido em PDF (baixar e visualizar)', async () => {
    const adm = await entra('admin@alumni.teste', 'alumni-admin');
    const ct = await prisma.contratoEmpresa.findFirst({ orderBy: { id: 'asc' } });
    const pd = await prisma.pedido.findFirst({ orderBy: { id: 'asc' } });
    for (const [url, nome] of [
      ct && [`/deal/contratos/${ct.id}/pdf`, `contrato-${ct.id}`],
      pd && [`/deal/pedidos/${pd.id}/pdf`, `pedido-${pd.id}`],
    ].filter(Boolean) as [string, string][]) {
      const r = await app.inject({ method: 'GET', url, headers: adm });
      assert.equal(r.statusCode, 200, r.body.slice(0, 200));
      assert.equal(r.headers['content-type'], 'application/pdf');
      assert.match(String(r.headers['content-disposition']), new RegExp(`attachment; filename="${nome}.pdf"`));
      assert.equal(r.rawPayload.subarray(0, 5).toString(), '%PDF-');
      assert.match(r.rawPayload.toString('latin1'), /%%EOF$/);
      const ver = await app.inject({ method: 'GET', url: `${url}?ver=1`, headers: adm });
      assert.match(String(ver.headers['content-disposition']), /^inline/);
    }
    const sem = await app.inject({ method: 'GET', url: '/deal/contratos/999999/pdf', headers: adm });
    assert.equal(sem.statusCode, 404);
  });
});
