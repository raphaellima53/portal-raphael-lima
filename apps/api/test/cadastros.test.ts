/**
 * Testes dos cadastros simples da adequação ao Portal Alumni (domain/cadastros.ts): cada cadastro lista, cria,
 * edita e exclui; escolha fora da lista e campo obrigatório vazio são recusados; quem não tem a chave não entra.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { montaApp } from '../src/app.ts';
import { prisma } from '../src/db.ts';
import { CADASTROS } from '../src/domain/cadastros.ts';

let app: FastifyInstance;
let h: { cookie: string };
const PAIS: Record<string, string> = {};
const criados: { id: string; rid: string; pai?: string }[] = [];

type Tela = {
  campos: { k: string; tipo: string; req: boolean; padrao: unknown }[];
  opcoes: Record<string, { v: string; l: string }[]>;
  linhas: { id: string | number; valores: Record<string, unknown>; txt: Record<string, string> }[];
  pode: { criar: boolean; editar: boolean; excluir: boolean };
};

async function entra(login: string, senha: string) {
  const r = await app.inject({ method: 'POST', url: '/auth/login', payload: { login, senha } });
  return { cookie: `portal_sessao=${r.cookies.find((x) => x.name === 'portal_sessao')!.value}` };
}
const qs = (pai?: string) => (pai ? `?pai=${encodeURIComponent(pai)}` : '');
const tela = async (id: string, pai?: string) => {
  const r = await app.inject({ method: 'GET', url: `/cadastros/${id}${qs(pai)}`, headers: h });
  assert.equal(r.statusCode, 200, `${id}: ${r.body}`);
  return r.json() as Tela;
};

/** um valor válido para cada tipo de campo */
function valor(c: Tela['campos'][number], t: Tela, n: number): unknown {
  if (c.k === 'grade') return 'Seg e Qua · 08:00';
  if (c.tipo === 'escolha') return t.opcoes[c.k]?.[0]?.v ?? '';
  if (c.tipo === 'sim') return true;
  if (c.tipo === 'data') return c.k === 'fim' ? '2031-12-31' : `2031-10-${String(10 + n).padStart(2, '0')}`;
  if (c.tipo === 'mes') return '2031-10';
  if (c.tipo === 'numero') return '10';
  if (c.tipo === 'dinheiro') return '150.50';
  if (c.tipo === 'email') return `teste${n}@cadastro.teste`;
  if (c.tipo === 'url') return 'https://exemplo.teste/conteudo';
  if (c.tipo === 'cor') return '#003FB0';
  if (c.tipo === 'telefone') return '(11) 99999-0000';
  if (c.tipo === 'cep') return '01000-000';
  if (c.tipo === 'uf') return 'SP';
  return `Teste cadastro ${n}`;
}

before(async () => {
  app = await montaApp();
  h = await entra('admin@alumni.teste', 'alumni-admin');
  /* pais com o que os cadastros precisam: aluno com aulas passadas, professor com alocação */
  const alunos = await prisma.aluno.findMany({ where: { matriculas: { some: {} } }, select: { id: true }, take: 40 });
  for (const a of alunos) {
    const t = await tela('feedbacks-aula', String(a.id));
    if (t.opcoes.aulaChave.length) {
      PAIS.aluno = String(a.id);
      break;
    }
  }
  for (const p of await prisma.professor.findMany({ select: { id: true } })) {
    const t = await tela('pedidos-cancelamento', p.id);
    if (t.opcoes.alvo.length) {
      PAIS.professor = p.id;
      break;
    }
  }
  PAIS.usuario = String((await prisma.usuario.findFirstOrThrow({ where: { email: 'admin@alumni.teste' } })).id);
  /* o acerto precisa de um extrato do professor */
  await prisma.extratoProfessor.upsert({
    where: { professorId_mes: { professorId: PAIS.professor, mes: '2031-09' } },
    create: { professorId: PAIS.professor, mes: '2031-09' },
    update: {},
  });
});

after(async () => {
  for (const c of criados.reverse())
    await app.inject({ method: 'DELETE', url: `/cadastros/${c.id}/${c.rid}${qs(c.pai)}`, headers: h });
  await prisma.extratoProfessor.deleteMany({ where: { mes: { startsWith: '2031-' } } });
  await app.close();
  await prisma.$disconnect();
});

describe('cadastros simples', () => {
  test('achou aluno com aulas e professor com alocação', () => {
    assert.ok(PAIS.aluno, 'nenhum aluno com aulas nos últimos 90 dias');
    assert.ok(PAIS.professor, 'nenhum professor com alocação');
  });

  CADASTROS.forEach((c, n) => {
    test(`${c.titulo}: cria, edita e exclui`, async () => {
      const pai = c.pai ? PAIS[c.pai] : undefined;
      const t = await tela(c.id, pai);
      assert.ok(t.pode.criar && t.pode.editar && t.pode.excluir, 'o Admin pode tudo');
      const corpo = Object.fromEntries(t.campos.map((f) => [f.k, valor(f, t, n)]));
      const cria = await app.inject({
        method: 'POST',
        url: `/cadastros/${c.id}${qs(pai)}`,
        headers: h,
        payload: corpo,
      });
      assert.equal(cria.statusCode, 200, `${c.id}: ${cria.body}`);
      const rid = String(cria.json().id);
      criados.push({ id: c.id, rid, pai });

      const depois = await tela(c.id, pai);
      const linha = depois.linhas.find((l) => String(l.id) === rid);
      assert.ok(linha, 'o registro novo aparece na lista');
      for (const f of t.campos.filter((x) => x.tipo === 'data' || x.tipo === 'dinheiro'))
        assert.equal(String(linha.valores[f.k]), f.tipo === 'dinheiro' ? '150.50' : String(corpo[f.k]), f.k);

      const texto = t.campos.find((f) => f.tipo === 'texto' || f.tipo === 'longo');
      if (texto) {
        const ed = await app.inject({
          method: 'PUT',
          url: `/cadastros/${c.id}/${rid}${qs(pai)}`,
          headers: h,
          payload: { ...corpo, [texto.k]: 'Editado no teste' },
        });
        assert.equal(ed.statusCode, 200, `${c.id}: ${ed.body}`);
        const v = (await tela(c.id, pai)).linhas.find((l) => String(l.id) === rid)!;
        assert.equal(v.valores[texto.k], 'Editado no teste');
      }

      const ex = await app.inject({ method: 'DELETE', url: `/cadastros/${c.id}/${rid}${qs(pai)}`, headers: h });
      assert.equal(ex.statusCode, 200, `${c.id}: ${ex.body}`);
      criados.pop();
      assert.ok(!(await tela(c.id, pai)).linhas.some((l) => String(l.id) === rid), 'sumiu da lista');
    });
  });

  test('só os obrigatórios preenchidos: opcionais vazios gravam (texto vazio, número no padrão, nulo onde cabe)', async () => {
    for (const [id, pai] of [
      ['servicos', undefined],
      ['ofertas', undefined],
      ['conteudos', undefined],
      ['ciclos', undefined],
      ['nivelamentos', PAIS.aluno],
      ['sessoes-pedagogicas', PAIS.professor],
    ] as const) {
      const t = await tela(id, pai);
      const corpo = Object.fromEntries(
        t.campos.map((f, n) => [f.k, f.req ? valor(f, t, n) : f.tipo === 'sim' ? false : '']),
      );
      const r = await app.inject({ method: 'POST', url: `/cadastros/${id}${qs(pai)}`, headers: h, payload: corpo });
      assert.equal(r.statusCode, 200, `${id}: ${r.body}`);
      criados.push({ id, rid: String(r.json().id), pai });
    }
  });

  test('recusa escolha fora da lista e obrigatório vazio', async () => {
    const pai = PAIS.aluno;
    const outra = await prisma.matricula.findFirstOrThrow({ where: { alunoId: { not: Number(pai) } } });
    const fora = await app.inject({
      method: 'POST',
      url: `/cadastros/nivelamentos?pai=${pai}`,
      headers: h,
      payload: { matriculaId: String(outra.id), cefr: 'B1' },
    });
    assert.equal(fora.statusCode, 400);
    assert.match(fora.json().erro, /escolha uma opção/);
    const vazio = await app.inject({ method: 'POST', url: `/cadastros/servicos`, headers: h, payload: { nome: '' } });
    assert.equal(vazio.statusCode, 400);
    assert.match(vazio.json().erro, /Preencha nome/);
    const semPai = await app.inject({ method: 'GET', url: '/cadastros/datas-bloqueadas', headers: h });
    assert.equal(semPai.statusCode, 400);
  });

  test('data do banco não volta um dia e fim antes do início é recusado', async () => {
    const pai = PAIS.professor;
    const r = await app.inject({
      method: 'POST',
      url: `/cadastros/ausencias?pai=${pai}`,
      headers: h,
      payload: { inicio: '2031-12-10', fim: '2031-12-01', motivo: 'x' },
    });
    assert.equal(r.statusCode, 400);
    assert.match(r.json().erro, /fim não pode vir antes/);
    const ok = await app.inject({
      method: 'POST',
      url: `/cadastros/ausencias?pai=${pai}`,
      headers: h,
      payload: { inicio: '2031-12-01', fim: '2031-12-10', motivo: 'férias' },
    });
    const rid = String(ok.json().id);
    criados.push({ id: 'ausencias', rid, pai });
    const l = (await tela('ausencias', pai)).linhas.find((x) => String(x.id) === rid)!;
    assert.equal(l.txt.inicio, '01/12/2031');
  });

  test('sem a chave da tela não entra', async () => {
    const r = await app.inject({ method: 'GET', url: '/cadastros/ofertas' });
    assert.equal(r.statusCode, 401);
    const aluno = await prisma.usuario.findFirst({ where: { alunoId: { not: null }, senhaTeste: { not: null } } });
    if (aluno) {
      const ha = await entra(aluno.email, aluno.senhaTeste!);
      const x = await app.inject({ method: 'GET', url: '/cadastros/ofertas', headers: ha });
      assert.equal(x.statusCode, 403);
    }
  });
});
