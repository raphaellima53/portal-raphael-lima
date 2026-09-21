/**
 * Testes da base: login, sessão, menu por persona, Dashboard, alertas e Minha área.
 * Rodam contra o banco do .env (com o seed aplicado): pnpm test
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { montaApp } from '../src/app.ts';
import { prisma } from '../src/db.ts';
import { telaPermitida } from '../src/domain/acesso.ts';
import { agAulasEntre, agOfertas } from '../src/domain/agenda.ts';
import { base } from '../src/domain/base.ts';
import { DASH_BLOCOS, montaDashboard } from '../src/domain/dashboard.ts';

let app: FastifyInstance;
before(async () => {
  app = await montaApp();
});
after(async () => {
  await app.close();
  await prisma.$disconnect();
});

async function entra(login: string, senha: string) {
  const r = await app.inject({ method: 'POST', url: '/auth/login', payload: { login, senha } });
  assert.equal(r.statusCode, 200, r.body);
  const c = r.cookies.find((x) => x.name === 'portal_sessao');
  assert.ok(c, 'cookie de sessão');
  return { cookie: `portal_sessao=${c.value}` };
}

describe('login e sessão', () => {
  test('senha errada dá 401 com a mensagem do portal', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { login: 'persona.f@alumni.teste', senha: 'x' },
    });
    assert.equal(r.statusCode, 401);
    assert.match(r.json().erro, /Login ou senha incorretos/);
  });

  test('campos vazios dão 400', async () => {
    const r = await app.inject({ method: 'POST', url: '/auth/login', payload: { login: '', senha: '' } });
    assert.equal(r.statusCode, 400);
    assert.equal(r.json().erro, 'Preencha login e senha.');
  });

  test('sem sessão, /auth/me devolve usuario nulo e o dashboard dá 401', async () => {
    assert.equal((await app.inject({ url: '/auth/me' })).json().usuario, null);
    assert.equal((await app.inject({ url: '/dashboard' })).statusCode, 401);
  });

  test('as 20 personas aparecem na tela de login, com senha de teste', async () => {
    const ps = (await app.inject({ url: '/auth/personas' })).json().personas;
    assert.equal(ps.length, 20);
    assert.deepEqual(ps[0], {
      letra: 'A',
      tipo: 'Aluno',
      nome: 'Amanda Reis',
      hierarquia: 'Visualizador',
      cursos: ['Community'],
      modulos: ['Essential 2 (A1+)'],
      login: 'persona.a@alumni.teste',
      senha: 'alumni-a',
    });
  });

  test('logout encerra a sessão', async () => {
    const h = await entra('persona.l@alumni.teste', 'alumni-l');
    assert.equal((await app.inject({ url: '/auth/me', headers: h })).json().usuario.nome, 'Renata Bortolli');
    await app.inject({ method: 'POST', url: '/auth/logout', headers: h, payload: {} });
    assert.equal((await app.inject({ url: '/auth/me', headers: h })).json().usuario, null);
  });
});

describe('menu e acesso', () => {
  test('Admin: menu enxuto, com Configurações e Engenharia no menu da conta', async () => {
    const h = await entra('admin@alumni.teste', 'alumni-admin');
    const me = (await app.inject({ url: '/auth/me', headers: h })).json();
    type N = { label: string; lugar?: string; secoes?: { etapa: string }[] };
    assert.deepEqual(
      me.nav.map((n: N) => (n.lugar ? `${n.lugar}:${n.label}` : n.label)),
      ['Início', 'Agenda', 'Usuários', 'Produtos e serviços', 'Atividades', 'Auditoria', 'Configurações', 'conta:Engenharia'],
    );
    const secoes = (k: string) => me.nav.find((n: N) => n.label === k).secoes.map((x: { etapa: string }) => x.etapa);
    assert.deepEqual(secoes('Usuários'), ['Alunos', 'Equipe', 'Empresas']);
    assert.deepEqual(secoes('Produtos e serviços'), ['Cursos', 'Materiais', 'Serviços']);
    assert.deepEqual(secoes('Configurações').slice(0, 2), ['Painel', 'Acessos']);
    assert.equal(secoes('Atividades')[0], 'Setores');
    assert.equal(secoes('Atividades').at(-1), 'Relatórios');
  });

  test('professor: Agenda, Histórico de aulas e Meu perfil; o histórico é o das aulas dele', async () => {
    const h = await entra('persona.i@alumni.teste', 'alumni-i');
    const me = (await app.inject({ url: '/auth/me', headers: h })).json();
    assert.deepEqual(
      me.nav.map((n: { label: string }) => n.label),
      ['Agenda', 'Histórico de aulas', 'Meu perfil'],
    );
    const hist = (await app.inject({ url: '/historico-de-aulas?dias=60', headers: h })).json();
    assert.equal(hist.modo, 'professor');
    assert.ok(hist.aulas.length > 0);
    for (const a of hist.aulas) assert.ok(a.prof === 'Marina Pallotta' || a.sub === 'Marina Pallotta');
  });

  test('aluno entra na área do aluno e não abre o dashboard', async () => {
    const h = await entra('persona.a@alumni.teste', 'alumni-a');
    const me = (await app.inject({ url: '/auth/me', headers: h })).json();
    assert.deepEqual(
      me.nav.map((n: { label: string }) => n.label),
      ['Agenda', 'Histórico de aulas', 'Meu perfil'],
    );
    assert.equal((await app.inject({ url: '/dashboard', headers: h })).statusCode, 403);
    const area = (await app.inject({ url: '/minha-area', headers: h })).json();
    assert.equal(area.matriculas.length, 1);
    assert.equal(area.restam, 40);
  });

  test('colaborador que também é aluno (M) ganha a visão de aluno atrás do botão Aluno', async () => {
    const h = await entra('persona.m@alumni.teste', 'alumni-m');
    type N = { label: string; visao?: string };
    const nav: N[] = (await app.inject({ url: '/auth/me', headers: h })).json().nav;
    assert.deepEqual(
      nav.filter((n) => n.visao === 'aluno').map((n) => n.label),
      ['Agenda', 'Histórico de aulas', 'Meu perfil'],
    );
    assert.ok(!nav.some((n) => n.label === 'Engenharia'));
  });

  test('Diretoria tem hierarquia 1, mas Configurações e Auditoria são só do tipo Admin', () => {
    const u = {
      nivel: 1,
      areas: { adm: { acesso: 'total' as const, rotulo: 'Total' } },
      tipoPerfil: 'Colaborador' as const,
    };
    assert.equal(telaPermitida(u, { m: 'config', chave: 'cfg' }), false);
    assert.equal(telaPermitida(u, { m: 'auditoria', chave: 'auditoria' }), false);
    assert.equal(telaPermitida({ ...u, tipoPerfil: 'Admin' }, { m: 'config', chave: 'cfg' }), true);
  });
});

describe('agenda e dashboard', () => {
  test('mesma data, mesmo estado: a agenda é estável', async () => {
    const b = await base();
    const agora = new Date(2026, 8, 17, 9, 30);
    const s = new Date(2026, 8, 13);
    const f = new Date(2026, 8, 19);
    const a1 = agAulasEntre(b, s, f, agora).map((a) => `${a.k}:${a.estado}:${a.prof}`);
    const a2 = agAulasEntre(b, s, f, agora).map((a) => `${a.k}:${a.estado}:${a.prof}`);
    assert.deepEqual(a1, a2);
    assert.ok(a1.length > 50, `${a1.length} aulas`);
    assert.ok(!a1.some((k) => k.includes('|2026-09-13|')), 'domingo não tem aula');
  });

  test('turmas dedicadas saem da grade da turma', async () => {
    const ofs = agOfertas(await base());
    const t1 = ofs.find((o) => o.prod === 'FAAP' && o.mod === 'Turma 1');
    assert.deepEqual(
      { dias: t1?.dias, hora: t1?.hora, prof: t1?.prof },
      { dias: [1, 3], hora: 8, prof: 'John Whitaker' },
    );
  });

  test('todo bloco do dashboard monta sem erro', async () => {
    const blocos = montaDashboard(
      await base(),
      DASH_BLOCOS.map((b) => b.k),
      new Date(2026, 8, 17, 9, 30),
    );
    assert.equal(blocos.length, 15);
    for (const b of blocos) assert.notEqual(b.corpo.vazio, 'não foi possível montar este bloco', b.k);
  });

  test('dashboard do Gestor pedagógico só oferece os blocos que o acesso libera, e salva por usuário', async () => {
    const h = await entra('persona.f@alumni.teste', 'alumni-f');
    const d = (await app.inject({ url: '/dashboard', headers: h })).json();
    assert.ok(!d.disponiveis.some((b: { k: string }) => b.k === 'acessos'), 'acessos é de Configurações');
    assert.deepEqual(
      d.marcados,
      d.padrao.filter((k: string) => d.marcados.includes(k)),
    );
    const put = await app.inject({
      method: 'PUT',
      url: '/dashboard/config',
      headers: h,
      payload: { blocos: ['carga', 'acessos'] },
    });
    assert.deepEqual(put.json().blocos, ['carga'], 'bloco sem acesso é descartado');
    assert.equal(
      (await app.inject({ method: 'PUT', url: '/dashboard/config', headers: h, payload: { blocos: [] } })).statusCode,
      400,
    );
    const d2 = (await app.inject({ url: '/dashboard', headers: h })).json();
    assert.deepEqual(d2.marcados, ['carga']);
    await prisma.dashboardConfig.deleteMany({ where: { usuario: { email: 'persona.f@alumni.teste' } } });
  });

  test('aluno não tem alertas; alertas têm link para a tela onde se resolve', async () => {
    const ha = await entra('persona.b@alumni.teste', 'alumni-b');
    assert.deepEqual((await app.inject({ url: '/alertas', headers: ha })).json().alertas, []);
    const h = await entra('admin@alumni.teste', 'alumni-admin');
    for (const a of (await app.inject({ url: '/alertas', headers: h })).json().alertas) {
      assert.ok(a.n > 0);
      assert.match(a.href, /^\//);
    }
  });
});
