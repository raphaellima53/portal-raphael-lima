/**
 * Engenharia › GitHub: os 16 critérios de saúde de um repositório.
 * Cada critério lê o clone raso e o que a API do GitHub conta sobre o repositório, e devolve
 * ok · atenção · falha com o porquê. A nota é a média ponderada pelo peso de cada critério.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export type RepoMeta = {
  nome: string;
  descricao: string;
  topicos: string[];
  branch: string;
  licenca: string | null;
  privado: boolean;
  issues: number;
  atualizado: string | null;
  tamanhoKb: number;
  arquivado: boolean;
};
export type Nivel = 'ok' | 'atencao' | 'falha';
export type Item = { k: string; t: string; d: string; peso: number; nivel: Nivel; detalhe: string };

/** o clone lido uma vez: caminhos relativos, conteúdo dos arquivos de raiz e o último commit */
export type Arvore = {
  arquivos: string[];
  tamanhos: Record<string, number>;
  le: (caminho: string) => string;
  ultimoCommit: Date | null;
  commits: number;
};

const IGNORA = new Set(['.git', 'node_modules', 'dist', 'build', '.next', 'vendor', '.venv', 'target']);
/** lista os arquivos do clone, sem entrar no que não é código-fonte */
export function lerArvore(raiz: string, ultimoCommit: Date | null, commits: number): Arvore {
  const arquivos: string[] = [];
  const tamanhos: Record<string, number> = {};
  const anda = (dir: string, nivel: number) => {
    if (nivel > 6) return;
    let itens: string[] = [];
    try {
      itens = readdirSync(dir);
    } catch {
      return;
    }
    for (const nome of itens) {
      if (IGNORA.has(nome)) continue;
      const cheio = join(dir, nome);
      let st: ReturnType<typeof statSync>;
      try {
        st = statSync(cheio);
      } catch {
        continue;
      }
      if (st.isDirectory()) anda(cheio, nivel + 1);
      else {
        const rel = relative(raiz, cheio).split('\\').join('/');
        arquivos.push(rel);
        tamanhos[rel] = st.size;
      }
    }
  };
  anda(raiz, 0);
  return {
    arquivos,
    tamanhos,
    le: (caminho: string) => {
      try {
        return readFileSync(join(raiz, caminho), 'utf8');
      } catch {
        return '';
      }
    },
    ultimoCommit,
    commits,
  };
}

const tem = (a: Arvore, re: RegExp) => a.arquivos.filter((f) => re.test(f));
const raiz = (a: Arvore, nomes: string[]) =>
  a.arquivos.filter((f) => !f.includes('/') && nomes.includes(f.toLowerCase()));
const lista = (fs: string[], max = 3) =>
  fs.slice(0, max).join(', ') + (fs.length > max ? ` e mais ${fs.length - max}` : '');
const dias = (d: Date | null, agora: Date) => (d ? Math.floor((+agora - +d) / 864e5) : null);
/** chaves de API deixadas no código: o que casa aqui é sempre erro */
const SEGREDOS: [RegExp, string][] = [
  [/sk-ant-[A-Za-z0-9_-]{20,}/, 'chave da Anthropic'],
  [/sk-(proj-)?[A-Za-z0-9]{32,}/, 'chave da OpenAI'],
  [/AIza[0-9A-Za-z_-]{30,}/, 'chave do Google'],
  [/gh[pousr]_[A-Za-z0-9]{30,}/, 'token do GitHub'],
  [/-----BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY-----/, 'chave privada'],
  [/AKIA[0-9A-Z]{16}/, 'chave da AWS'],
];
const CODIGO = /\.(ts|tsx|js|jsx|mjs|cjs|py|rb|go|java|kt|php|cs|rs|json|ya?ml|env|sh|sql|md)$/i;
const GRANDE = 5 * 1024 * 1024;

type Ctx = { a: Arvore; m: RepoMeta; agora: Date };
type Def = { k: string; t: string; d: string; peso: number; ver: (c: Ctx) => [Nivel, string] };

/** Os 16 critérios, na ordem em que aparecem na tela */
export const CRITERIOS: Def[] = [
  {
    k: 'readme',
    t: 'README que explica o projeto',
    d: 'Existe README na raiz com pelo menos 400 caracteres.',
    peso: 3,
    ver: ({ a }) => {
      const f = raiz(a, ['readme.md', 'readme.rst', 'readme.txt', 'readme'])[0];
      if (!f) return ['falha', 'nenhum README na raiz'];
      const n = a.le(f).trim().length;
      return n >= 400
        ? ['ok', `${f} com ${n.toLocaleString('pt-BR')} caracteres`]
        : ['atencao', `${f} tem só ${n} caracteres`];
    },
  },
  {
    k: 'licenca',
    t: 'Licença declarada',
    d: 'Sem licença, ninguém pode reusar o código com segurança.',
    peso: 2,
    ver: ({ a, m }) => {
      if (m.licenca) return ['ok', `licença ${m.licenca}`];
      const f = raiz(a, ['license', 'license.md', 'license.txt', 'licence', 'copying'])[0];
      return f ? ['ok', `arquivo ${f}`] : ['falha', 'sem LICENSE e sem licença no GitHub'];
    },
  },
  {
    k: 'descricao',
    t: 'Descrição e tópicos no GitHub',
    d: 'Quem chega pela busca entende o que é o repositório.',
    peso: 1,
    ver: ({ m }) => {
      if (m.descricao && m.topicos.length) return ['ok', `${m.topicos.length} tópicos`];
      if (m.descricao) return ['atencao', 'tem descrição, mas nenhum tópico'];
      return ['falha', m.topicos.length ? 'tem tópicos, mas nenhuma descrição' : 'sem descrição e sem tópicos'];
    },
  },
  {
    k: 'gitignore',
    t: '.gitignore no lugar',
    d: 'Dependências, builds e segredos ficam fora do versionamento.',
    peso: 2,
    ver: ({ a }) => {
      const f = raiz(a, ['.gitignore'])[0];
      if (!f) return ['falha', 'sem .gitignore'];
      const txt = a.le(f);
      const falta = ['node_modules', '.env'].filter((x) => !txt.includes(x));
      return falta.length ? ['atencao', `não ignora ${falta.join(' nem ')}`] : ['ok', 'ignora dependências e .env'];
    },
  },
  {
    k: 'branch',
    t: 'Branch padrão main',
    d: 'Convenção atual do GitHub para a branch principal.',
    peso: 1,
    ver: ({ m }) => (m.branch === 'main' ? ['ok', 'main'] : ['atencao', `branch padrão é ${m.branch}`]),
  },
  {
    k: 'lockfile',
    t: 'Dependências travadas',
    d: 'Lockfile garante a mesma instalação em qualquer máquina.',
    peso: 2,
    ver: ({ a }) => {
      const ls = tem(
        a,
        /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb?|poetry\.lock|Cargo\.lock|go\.sum|Gemfile\.lock|requirements\.txt)$/,
      );
      return ls.length ? ['ok', lista(ls)] : ['falha', 'nenhum lockfile'];
    },
  },
  {
    k: 'scripts',
    t: 'Comandos de build e teste',
    d: 'O projeto diz como é construído e testado.',
    peso: 2,
    ver: ({ a }) => {
      const pk = raiz(a, ['package.json'])[0];
      if (!pk) {
        const outros = raiz(a, [
          'makefile',
          'pyproject.toml',
          'cargo.toml',
          'go.mod',
          'gemfile',
          'pom.xml',
          'build.gradle',
        ]);
        return outros.length ? ['ok', `projeto ${outros[0]}`] : ['atencao', 'sem package.json nem equivalente'];
      }
      let s: Record<string, string> = {};
      try {
        s = (JSON.parse(a.le(pk)) as { scripts?: Record<string, string> }).scripts ?? {};
      } catch {
        return ['falha', 'package.json inválido'];
      }
      const falta = ['build', 'test'].filter((x) => !Object.keys(s).some((k) => k === x || k.startsWith(`${x}:`)));
      return falta.length
        ? ['atencao', `sem script de ${falta.join(' nem ')}`]
        : ['ok', `${Object.keys(s).length} scripts`];
    },
  },
  {
    k: 'testes',
    t: 'Testes automatizados',
    d: 'Arquivos de teste no repositório.',
    peso: 3,
    ver: ({ a }) => {
      const ls = tem(a, /(^|\/)(tests?|spec|__tests__|e2e)\/|\.(test|spec)\.[a-z]+$|_test\.(go|py|rb)$/i);
      return ls.length ? ['ok', `${ls.length} arquivos de teste`] : ['falha', 'nenhum arquivo de teste'];
    },
  },
  {
    k: 'ci',
    t: 'Integração contínua',
    d: 'Workflow do GitHub Actions ou outro CI no repositório.',
    peso: 3,
    ver: ({ a }) => {
      const ls = tem(a, /^\.github\/workflows\/.+\.ya?ml$|^\.gitlab-ci\.yml$|^azure-pipelines\.yml$|^\.circleci\//);
      return ls.length ? ['ok', lista(ls)] : ['falha', 'sem workflow de CI'];
    },
  },
  {
    k: 'lint',
    t: 'Linter ou formatador',
    d: 'Padrão de código conferido por ferramenta.',
    peso: 2,
    ver: ({ a }) => {
      const ls = tem(
        a,
        /(^|\/)(biome\.jsonc?|\.eslintrc.*|eslint\.config\.[a-z]+|\.prettierrc.*|ruff\.toml|\.rubocop\.yml|\.golangci\.ya?ml)$/i,
      );
      return ls.length ? ['ok', lista(ls)] : ['atencao', 'sem configuração de linter'];
    },
  },
  {
    k: 'tipos',
    t: 'Tipagem ou configuração de linguagem',
    d: 'tsconfig, pyproject, go.mod e afins.',
    peso: 1,
    ver: ({ a }) => {
      const ls = tem(a, /(^|\/)(tsconfig.*\.json|jsconfig\.json|pyproject\.toml|mypy\.ini|go\.mod|Cargo\.toml)$/);
      return ls.length ? ['ok', lista(ls)] : ['atencao', 'sem configuração de tipos'];
    },
  },
  {
    k: 'exemplo',
    t: 'Exemplo de variáveis de ambiente',
    d: 'Um .env.example diz o que configurar sem expor segredo.',
    peso: 2,
    ver: ({ a }) => {
      const ex = tem(a, /(^|\/)\.env\.(example|sample|template)$/);
      const reais = tem(a, /(^|\/)\.env(\.local|\.production)?$/);
      if (reais.length) return ['falha', `arquivo ${lista(reais)} versionado`];
      return ex.length ? ['ok', lista(ex)] : ['atencao', 'sem .env.example'];
    },
  },
  {
    k: 'segredos',
    t: 'Sem segredo no código',
    d: 'Chaves de API e chaves privadas não podem estar versionadas.',
    peso: 4,
    ver: ({ a }) => {
      const achados: string[] = [];
      for (const f of a.arquivos.filter((x) => CODIGO.test(x) && (a.tamanhos[x] ?? 0) < 512 * 1024)) {
        const txt = a.le(f);
        for (const [re, nome] of SEGREDOS) if (re.test(txt)) achados.push(`${nome} em ${f}`);
        if (achados.length >= 3) break;
      }
      return achados.length ? ['falha', lista(achados)] : ['ok', 'nenhum padrão de chave encontrado'];
    },
  },
  {
    k: 'atividade',
    t: 'Repositório ativo',
    d: 'Commit nos últimos 90 dias e repositório não arquivado.',
    peso: 2,
    ver: ({ a, m, agora }) => {
      if (m.arquivado) return ['falha', 'repositório arquivado'];
      const n = dias(a.ultimoCommit, agora);
      if (n == null) return ['atencao', 'sem histórico no clone'];
      if (n <= 90) return ['ok', n === 0 ? 'commit hoje' : `último commit há ${n} ${n === 1 ? 'dia' : 'dias'}`];
      return [n <= 365 ? 'atencao' : 'falha', `último commit há ${n} dias`];
    },
  },
  {
    k: 'peso',
    t: 'Sem arquivo pesado versionado',
    d: 'Arquivo acima de 5 MB no repositório trava clone e revisão.',
    peso: 1,
    ver: ({ a }) => {
      const ls = Object.entries(a.tamanhos)
        .filter(([, n]) => n > GRANDE)
        .map(([f, n]) => `${f} (${(n / 1024 / 1024).toFixed(1)} MB)`);
      return ls.length ? ['atencao', lista(ls)] : ['ok', 'nenhum arquivo acima de 5 MB'];
    },
  },
  {
    k: 'contrib',
    t: 'Como contribuir e reportar',
    d: 'CONTRIBUTING, guia de estilo do projeto ou pasta docs.',
    peso: 1,
    ver: ({ a }) => {
      const ls = tem(
        a,
        /(^|\/)(CONTRIBUTING(\.md)?|CODE_OF_CONDUCT(\.md)?|SECURITY(\.md)?|AGENTS\.md|CLAUDE\.md)$|^docs?\//i,
      );
      return ls.length ? ['ok', lista(ls)] : ['atencao', 'sem CONTRIBUTING nem docs'];
    },
  },
];

export const PONTOS: Record<Nivel, number> = { ok: 1, atencao: 0.5, falha: 0 };
export const NIVEL_TOM: Record<Nivel, string> = { ok: 'green', atencao: 'amber', falha: 'red' };
export const NIVEL_ROTULO: Record<Nivel, string> = { ok: 'ok', atencao: 'atenção', falha: 'falha' };

/** avalia os 16 critérios e devolve a nota de 0 a 100 */
export function avalia(a: Arvore, m: RepoMeta, agora = new Date()) {
  const itens: Item[] = CRITERIOS.map((c) => {
    const [nivel, detalhe] = c.ver({ a, m, agora });
    return { k: c.k, t: c.t, d: c.d, peso: c.peso, nivel, detalhe };
  });
  const total = itens.reduce((s, i) => s + i.peso, 0);
  const nota = Math.round((itens.reduce((s, i) => s + i.peso * PONTOS[i.nivel], 0) / total) * 100);
  return {
    itens,
    nota,
    selo: nota >= 85 ? 'saudável' : nota >= 60 ? 'com pendências' : 'precisa de atenção',
    tom: nota >= 85 ? 'green' : nota >= 60 ? 'amber' : 'red',
    ok: itens.filter((i) => i.nivel === 'ok').length,
    atencao: itens.filter((i) => i.nivel === 'atencao').length,
    falha: itens.filter((i) => i.nivel === 'falha').length,
  };
}
export type Analise = ReturnType<typeof avalia>;
