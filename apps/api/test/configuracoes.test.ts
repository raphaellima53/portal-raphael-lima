/**
 * Testes de Configurações: só Admin, usuários (validação, criar, editar, governança, bloqueio), sessões, catálogos,
 * feriados, políticas com justificativa, alertas e mapa de telas.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { montaApp } from '../src/app.ts';
import { prisma } from '../src/db.ts';

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
  return { cookie: `portal_sessao=${r.cookies.find((x) => x.name === 'portal_sessao')!.value}` };
}
type H = { cookie: string };
const get = (url: string, headers: H) => app.inject({ method: 'GET', url, headers });
const envia = (method: 'POST' | 'PUT' | 'DELETE', url: string, headers: H, payload: object = {}) =>
  app.inject({ method, url, headers, payload });

describe('configurações', () => {
  test('só o tipo de perfil Admin abre Configurações', async () => {
    const f = await entra('persona.f@alumni.teste', 'alumni-f');
    assert.equal((await get('/config/usuarios', f)).statusCode, 403);
    const h = await entra('admin@alumni.teste', 'alumni-admin');
    const r = (await get('/config/usuarios', h)).json();
    assert.ok(r.linhas.length >= 32);
    assert.equal(r.stats[0].v, r.linhas.length);
  });

  test('novo usuário: falta, cria com convite, edita e registra a troca de perfil', async () => {
    const h = await entra('admin@alumni.teste', 'alumni-admin');
    const falta = await envia('POST', '/config/usuarios', h, { nome: 'Teste Config' });
    assert.equal(falta.statusCode, 400);
    assert.equal(
      falta.json().erro,
      'Para salvar o usuário, falta: e-mail de acesso, perfil, hierarquia, justificativa da concessão.',
    );
    const email = `cfg.${Date.now()}@alumni.teste`;
    const semSetor = await envia('POST', '/config/usuarios', h, {
      nome: 'Teste Config',
      email,
      perfilId: 5,
      nivel: 4,
      justificativa: 'teste',
    });
    assert.match(semSetor.json().erro, /acesso a pelo menos um setor/);
    const cria = await envia('POST', '/config/usuarios', h, {
      nome: 'Teste Config',
      email,
      perfilId: 5,
      nivel: 4,
      setores: { com: 'total' },
      justificativa: 'contratação de teste',
    });
    assert.equal(cria.statusCode, 200, cria.body);
    assert.equal(cria.json().msg, `Teste Config criado: convite enviado para ${email}.`);
    const lista = (await get('/config/usuarios', h)).json();
    const u = lista.linhas.find((x: { email: string }) => x.email === email);
    assert.equal(u.status, 'Convite pendente');
    assert.equal(u.resumo, 'Colaborador · Comercial');
    const ed = await envia('PUT', `/config/usuarios/${u.id}`, h, {
      nome: 'Teste Config',
      perfilId: 6,
      nivel: 2,
      setores: { com: 'total' },
    });
    assert.equal(ed.statusCode, 200, ed.body);
    const ses = (await get('/config/sessoes', h)).json();
    assert.ok(
      ses.historico.some(
        (x: { evento: string; detalhe: string }) =>
          x.evento === 'perfil alterado' &&
          x.detalhe.startsWith('Teste Config: Colaborador · Comercial → Gestor · Comercial'),
      ),
    );
    const previa = (
      await envia('POST', '/config/usuarios/previa', h, { perfilId: 8, nivel: 4, setores: { ped: 'restrito' } })
    ).json();
    assert.equal(previa.setores.find((s: { id: string }) => s.id === 'ped').recorte.nome, 'Plantão');
  });

  test('governança: ninguém altera o próprio acesso', async () => {
    const h = await entra('admin@alumni.teste', 'alumni-admin');
    const eu = (await get('/config/usuarios', h)).json().linhas.find((x: { eu: boolean }) => x.eu);
    const r = await envia('PUT', `/config/usuarios/${eu.id}`, h, {
      nome: eu.nome,
      perfilId: 1,
      nivel: 2,
      setores: { adm: 'total' },
    });
    assert.equal(r.statusCode, 403);
    assert.match(r.json().erro, /Ninguém altera o próprio acesso/);
  });

  test('bloquear encerra as sessões na hora; reativar devolve o acesso', async () => {
    const q = await entra('persona.q@alumni.teste', 'alumni-q');
    assert.ok((await get('/auth/me', q)).json().usuario);
    const h = await entra('admin@alumni.teste', 'alumni-admin');
    const alvo = (await get('/config/usuarios', h))
      .json()
      .linhas.find((x: { email: string }) => x.email === 'persona.q@alumni.teste');
    const b = (await envia('POST', '/config/usuarios/massa', h, { acao: 'bloquear', ids: [alvo.id] })).json();
    assert.equal(b.msg, 'Usuários bloqueados: 1 usuário.');
    assert.equal((await get('/auth/me', q)).json().usuario, null);
    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { login: 'persona.q@alumni.teste', senha: 'alumni-q' },
    });
    assert.equal(login.statusCode, 401);
    await envia('POST', '/config/usuarios/massa', h, { acao: 'ativar', ids: [alvo.id] });
    assert.ok((await get('/auth/me', await entra('persona.q@alumni.teste', 'alumni-q'))).json().usuario);
    const ses = (await get('/config/sessoes', h)).json();
    assert.ok(
      ses.historico.some(
        (x: { quem: string; resultado: string; detalhe: string }) =>
          x.quem === 'Quirino Batista' && x.resultado === 'recusado' && x.detalhe.startsWith('usuário bloqueado'),
      ),
    );
  });

  test('sessões: encerrar a de outra pessoa', async () => {
    const r = await entra('persona.r@alumni.teste', 'alumni-r');
    const h = await entra('admin@alumni.teste', 'alumni-admin');
    const s = (await get('/config/sessoes', h))
      .json()
      .ativas.find((x: { nome: string }) => x.nome === 'Rosana Figueira');
    const e = (await envia('POST', `/config/sessoes/${s.id}/encerrar`, h)).json();
    assert.equal(e.msg, 'Sessão de Rosana Figueira encerrada. A conta continua ativa.');
    assert.equal((await get('/auth/me', r)).json().usuario, null);
  });

  test('catálogos: cria, não duplica, trava exclusão em uso e exclui o que não usa', async () => {
    const h = await entra('admin@alumni.teste', 'alumni-admin');
    const nome = `Idioma ${Date.now()}`;
    assert.equal((await envia('POST', '/config/catalogo/idiomas', h, { nome })).json().msg, `${nome} criado.`);
    assert.equal(
      (await envia('POST', '/config/catalogo/idiomas', h, { nome: nome.toUpperCase() })).json().erro,
      'Já existe idioma com esse nome.',
    );
    const c = (await get('/config/catalogo/idiomas', h)).json();
    const novo = c.linhas.find((x: { nome: string }) => x.nome === nome);
    const ingles = c.linhas.find((x: { nome: string }) => x.nome === 'Inglês');
    assert.ok(ingles.uso > 0);
    assert.equal(
      (await envia('DELETE', `/config/catalogo/idiomas/${ingles.id}`, h)).json().erro,
      'Está em uso: inative em vez de excluir.',
    );
    assert.equal((await envia('DELETE', `/config/catalogo/idiomas/${novo.id}`, h)).json().msg, `${nome} excluído.`);
    assert.equal(
      (await envia('POST', '/config/catalogo/cargos', h, { nome: 'Cargo sem departamento' })).json().erro,
      'Escolha o departamento.',
    );
  });

  test('feriados: importa os nacionais, cria recesso e remove', async () => {
    const h = await entra('admin@alumni.teste', 'alumni-admin');
    const imp = (await envia('POST', '/config/feriados/importar', h, { ano: 2031 })).json();
    assert.match(imp.msg, /^(13 feriados nacionais de 2031 importados|Os feriados nacionais de 2031 já estavam)/);
    const f = (await get('/config/feriados?ano=2031', h)).json();
    assert.ok(f.nacionais);
    assert.ok(
      f.linhas.some((x: { data: string; nome: string }) => x.data === '11/04/2031' && x.nome === 'Sexta-feira Santa'),
    );
    assert.equal(
      (await envia('POST', '/config/feriados/recesso', h, { nome: 'R', ini: '2031-07-10', fim: '2031-07-01' })).json()
        .erro,
      'O último dia precisa ser depois do primeiro.',
    );
    const doRecesso = async () =>
      (await get('/config/feriados?ano=2031', h))
        .json()
        .linhas.filter((l: { nome: string }) => l.nome === 'Recesso teste');
    /* começa limpo, mesmo que uma execução anterior tenha parado no meio */
    for (const x of await doRecesso()) await envia('DELETE', `/config/feriados/${x.id}`, h);
    const rec = (
      await envia('POST', '/config/feriados/recesso', h, {
        nome: 'Recesso teste',
        ini: '2031-07-07',
        fim: '2031-07-09',
      })
    ).json();
    assert.equal(rec.msg, 'Recesso teste: 3 dias sem aula.');
    const dias = await doRecesso();
    assert.equal(dias.length, 3);
    assert.match(
      (await envia('DELETE', `/config/feriados/${dias[0].id}`, h)).json().msg,
      /removido: a agenda volta a gerar aula/,
    );
    for (const x of dias.slice(1)) await envia('DELETE', `/config/feriados/${x.id}`, h);
  });

  test('políticas: nada mudou, exige justificativa e salva', async () => {
    const h = await entra('admin@alumni.teste', 'alumni-admin');
    const p = (await get('/config/politicas', h)).json();
    assert.equal(
      (await envia('PUT', '/config/politicas', h, { valores: p.valores })).json().msg,
      'Nada mudou desde o último salvamento.',
    );
    const novo = { ...p.valores, janela: String(Number(p.valores.janela) + 1) };
    assert.equal((await envia('PUT', '/config/politicas', h, { valores: novo, just: 'x' })).statusCode, 400);
    const ok = (await envia('PUT', '/config/politicas', h, { valores: novo, just: 'decisão da diretoria' })).json();
    assert.equal(ok.msg, 'Salvo: 1 campo · justificativa na Auditoria.');
    await envia('PUT', '/config/politicas', h, { valores: p.valores, just: 'volta ao valor do teste' });
  });

  test('alertas: novo alerta conta os avisos e entra na execução', async () => {
    const h = await entra('admin@alumni.teste', 'alumni-admin');
    assert.equal(
      (await envia('POST', '/config/alertas', h, { nome: 'A', tipo: 'saldo', n: 5, para: [] })).json().erro,
      'Escolha quem recebe.',
    );
    const nome = `Inadimplentes ${Date.now()}`;
    const c = (await envia('POST', '/config/alertas', h, { nome, tipo: 'inad', n: 0, para: ['Financeiro'] })).json();
    assert.ok(c.msg.startsWith(`${nome} criado e ligado: hoje ele geraria `), c.msg);
    const ex = (await envia('POST', '/config/alertas/executar', h)).json();
    assert.ok(ex.msg.includes(`${nome}:`));
    const a = (await get('/config/alertas', h)).json().pers.find((x: { nome: string }) => x.nome === nome);
    assert.equal((await envia('DELETE', `/config/alertas/pers/${a.id}`, h)).json().msg, `${nome} excluído.`);
  });

  test('mapa de telas: descreve cada tela e marca Engenharia como a construir', async () => {
    const h = await entra('admin@alumni.teste', 'alumni-admin');
    const t = (await get('/config/telas', h)).json();
    assert.equal(t.linhas[0].label, 'Dashboard');
    assert.ok(t.linhas.find((l: { href: string }) => l.href === '/agenda').mostra.length > 50);
    assert.equal(t.linhas.find((l: { area: string }) => l.area === 'Engenharia').sit, 'con');
  });
});
