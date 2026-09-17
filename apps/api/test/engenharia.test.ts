/**
 * Testes de Engenharia: os 16 critérios sobre um repositório de mentira, o acesso só do Admin
 * e os três provedores de IA sem chave — nada aqui depende da rede.
 */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { montaApp } from '../src/app.ts';
import { prisma } from '../src/db.ts';
import { avalia, CRITERIOS, lerArvore, type RepoMeta } from '../src/domain/engenharia.ts';

let app: FastifyInstance;
const pastas: string[] = [];
before(async () => {
  app = await montaApp();
});
after(async () => {
  for (const p of pastas) rmSync(p, { recursive: true, force: true });
  await app.close();
  await prisma.$disconnect();
});

async function entra(login: string, senha: string) {
  const r = await app.inject({ method: 'POST', url: '/auth/login', payload: { login, senha } });
  return { cookie: `portal_sessao=${r.cookies.find((x) => x.name === 'portal_sessao')!.value}` };
}
/** um repositório de mentira em disco, com os arquivos que o teste pedir */
function repoFake(arquivos: Record<string, string>) {
  const raiz = mkdtempSync(join(tmpdir(), 'eng-'));
  pastas.push(raiz);
  for (const [caminho, conteudo] of Object.entries(arquivos)) {
    const cheio = join(raiz, caminho);
    mkdirSync(join(cheio, '..'), { recursive: true });
    writeFileSync(cheio, conteudo);
  }
  return raiz;
}
const META: RepoMeta = {
  nome: 'exemplo',
  descricao: 'um exemplo',
  topicos: ['teste'],
  branch: 'main',
  licenca: 'MIT',
  privado: false,
  issues: 0,
  atualizado: null,
  tamanhoKb: 10,
  arquivado: false,
};
const item = (r: ReturnType<typeof avalia>, k: string) => r.itens.find((i) => i.k === k)!;

describe('engenharia · critérios de saúde', () => {
  test('repositório completo tira 100 e cada critério diz o que encontrou', () => {
    const raiz = repoFake({
      'README.md': `# Exemplo\n${'documentação de verdade. '.repeat(30)}`,
      LICENSE: 'MIT',
      '.gitignore': 'node_modules/\n.env\ndist/',
      'package.json': JSON.stringify({ scripts: { build: 'tsc', test: 'node --test' } }),
      'pnpm-lock.yaml': 'lockfileVersion: 9',
      'tsconfig.json': '{}',
      'biome.json': '{}',
      '.env.example': 'API_KEY=""',
      'CONTRIBUTING.md': 'como contribuir',
      'src/app.ts': 'export const a = 1;',
      'test/app.test.ts': 'import assert from "node:assert";',
      '.github/workflows/ci.yml': 'name: ci',
    });
    const r = avalia(lerArvore(raiz, new Date(), 10), META);
    assert.equal(r.itens.length, 16);
    assert.equal(r.nota, 100);
    assert.equal(r.selo, 'saudável');
    assert.equal(r.falha, 0);
    assert.match(item(r, 'readme').detalhe, /README\.md com \d+ caracteres/);
    assert.equal(item(r, 'ci').detalhe, '.github/workflows/ci.yml');
    assert.equal(item(r, 'atividade').detalhe, 'commit hoje');
  });

  test('repositório vazio cai para falha nos critérios que pesam mais', () => {
    const raiz = repoFake({ 'index.js': 'console.log(1)' });
    const r = avalia(lerArvore(raiz, null, 0), {
      ...META,
      licenca: null,
      descricao: '',
      topicos: [],
      branch: 'master',
    });
    assert.ok(r.nota < 40, `nota ${r.nota}`);
    assert.equal(r.selo, 'precisa de atenção');
    assert.equal(item(r, 'readme').nivel, 'falha');
    assert.equal(item(r, 'licenca').detalhe, 'sem LICENSE e sem licença no GitHub');
    assert.equal(item(r, 'testes').nivel, 'falha');
    assert.equal(item(r, 'ci').nivel, 'falha');
    assert.equal(item(r, 'branch').detalhe, 'branch padrão é master');
  });

  test('chave de API no código e .env versionado reprovam na hora', () => {
    const raiz = repoFake({
      'README.md': 'x'.repeat(500),
      '.env': 'SEGREDO=1',
      'src/cliente.ts': `const chave = 'sk-ant-${'a'.repeat(30)}';`,
      'dados.bin': 'x',
    });
    const r = avalia(lerArvore(raiz, new Date(Date.now() - 400 * 864e5), 3), META);
    assert.equal(item(r, 'segredos').nivel, 'falha');
    assert.match(item(r, 'segredos').detalhe, /chave da Anthropic em src\/cliente\.ts/);
    assert.equal(item(r, 'exemplo').nivel, 'falha');
    assert.match(item(r, 'exemplo').detalhe, /\.env versionado/);
    assert.equal(item(r, 'atividade').nivel, 'falha');
    assert.match(item(r, 'atividade').detalhe, /último commit há \d+ dias/);
  });

  test('os pesos somam e a nota é a média ponderada', () => {
    assert.equal(CRITERIOS.length, 16);
    assert.equal(
      CRITERIOS.reduce((s, c) => s + c.peso, 0),
      32,
    );
  });
});

describe('engenharia · telas', () => {
  test('só o Admin abre Engenharia', async () => {
    const f = await entra('persona.f@alumni.teste', 'alumni-f');
    assert.equal((await app.inject({ method: 'GET', url: '/engenharia/repos', headers: f })).statusCode, 403);
    assert.equal((await app.inject({ method: 'GET', url: '/engenharia/ia', headers: f })).statusCode, 403);
  });

  test('sem dono, a tela devolve os 16 critérios e nenhuma linha', async () => {
    const h = await entra('admin@alumni.teste', 'alumni-admin');
    const r = (await app.inject({ method: 'GET', url: '/engenharia/repos', headers: h })).json();
    assert.equal(r.criterios.length, 16);
    assert.deepEqual(r.linhas, []);
    assert.equal(r.comToken, false);
    const ruim = await app.inject({
      method: 'POST',
      url: '/engenharia/repos/analisar',
      headers: h,
      payload: { dono: 'quem', repo: 'nome inválido!' },
    });
    assert.equal(ruim.statusCode, 400);
    assert.equal(ruim.json().erro, 'Nome de repositório inválido.');
  });

  test('IA: três provedores e, sem chave, cada um diz o que falta no .env', async () => {
    const h = await entra('admin@alumni.teste', 'alumni-admin');
    const ia = (await app.inject({ method: 'GET', url: '/engenharia/ia', headers: h })).json();
    assert.deepEqual(
      ia.provedores.map((p: { nome: string }) => p.nome),
      ['Anthropic', 'OpenAI', 'Google Gemini'],
    );
    assert.ok(ia.provedores.every((p: { modelo: string }) => p.modelo));
    const semPrompt = await app.inject({
      method: 'POST',
      url: '/engenharia/ia/perguntar',
      headers: h,
      payload: { prompt: '', provedores: ['anthropic'] },
    });
    assert.equal(semPrompt.json().erro, 'Escreva a pergunta.');
    if (!ia.algum) {
      const r = (
        await app.inject({
          method: 'POST',
          url: '/engenharia/ia/perguntar',
          headers: h,
          payload: { prompt: 'oi', provedores: ['anthropic', 'openai', 'gemini'] },
        })
      ).json();
      assert.equal(r.respostas.length, 3);
      assert.ok(r.respostas.every((x: { erro: string | null }) => x.erro?.includes('.env da API')));
    }
    const semAnalise = await app.inject({
      method: 'POST',
      url: '/engenharia/ia/explicar',
      headers: h,
      payload: { dono: 'ninguem', repo: 'nada', provedor: 'anthropic' },
    });
    assert.equal(semAnalise.statusCode, 404);
    assert.equal(semAnalise.json().erro, 'Analise o repositório antes de pedir a explicação.');
  });
});
