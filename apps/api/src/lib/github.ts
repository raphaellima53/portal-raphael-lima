/**
 * GitHub: lista os repositórios de um dono e clona o escolhido para a análise de saúde.
 * O token é opcional — sem ele a API pública responde 60 vezes por hora e só mostra repositório público.
 */
import { execFile } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { RepoMeta } from '../domain/engenharia.ts';
import { env } from '../env.ts';

const exec = promisify(execFile);
const API = 'https://api.github.com';
/* na Vercel só /tmp é gravável */
export const PASTA_CLONES = process.env.VERCEL ? join(tmpdir(), 'repos') : join(process.cwd(), '.repos');

export class ErroGitHub extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
  }
}

type RepoApi = {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  pushed_at: string | null;
  updated_at: string | null;
  default_branch: string;
  private: boolean;
  archived: boolean;
  fork: boolean;
  size: number;
  topics?: string[];
  license?: { spdx_id?: string; name?: string } | null;
};

async function ghFetch<T>(caminho: string): Promise<T> {
  const cab: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'user-agent': 'portal-raphael-lima',
    'x-github-api-version': '2022-11-28',
  };
  if (env.GITHUB_TOKEN) cab.authorization = `Bearer ${env.GITHUB_TOKEN}`;
  let r: Response;
  try {
    r = await fetch(`${API}${caminho}`, { headers: cab, signal: AbortSignal.timeout(20_000) });
  } catch (e) {
    throw new ErroGitHub(`Não deu para falar com o GitHub: ${(e as Error).message}`);
  }
  if (r.status === 404) throw new ErroGitHub('Não encontrado no GitHub. Confira o dono e o repositório.', 404);
  if (r.status === 401 || r.status === 403) {
    const resta = r.headers.get('x-ratelimit-remaining');
    throw new ErroGitHub(
      resta === '0'
        ? 'Limite da API do GitHub esgotado. Configure GITHUB_TOKEN no .env da API para subir o limite.'
        : 'O GitHub recusou o acesso. Confira o GITHUB_TOKEN no .env da API.',
      403,
    );
  }
  if (!r.ok) throw new ErroGitHub(`O GitHub respondeu ${r.status}.`);
  return (await r.json()) as T;
}

const linha = (x: RepoApi) => ({
  nome: x.name,
  completo: x.full_name,
  descricao: x.description ?? '',
  url: x.html_url,
  linguagem: x.language ?? '—',
  estrelas: x.stargazers_count,
  forks: x.forks_count,
  issues: x.open_issues_count,
  atualizado: x.pushed_at ?? x.updated_at,
  branch: x.default_branch,
  privado: x.private,
  arquivado: x.archived,
  fork: x.fork,
  tamanhoKb: x.size,
  topicos: x.topics ?? [],
  licenca: x.license?.spdx_id && x.license.spdx_id !== 'NOASSERTION' ? x.license.spdx_id : null,
});
export type RepoLinha = ReturnType<typeof linha>;

/** repositórios do dono, dos mais recentes para os mais antigos (usuário ou organização) */
export async function listaRepos(dono: string): Promise<RepoLinha[]> {
  const q = 'per_page=100&sort=pushed&direction=desc';
  let dados: RepoApi[];
  try {
    dados = await ghFetch<RepoApi[]>(`/users/${encodeURIComponent(dono)}/repos?${q}`);
  } catch (e) {
    if (e instanceof ErroGitHub && e.status === 404)
      dados = await ghFetch<RepoApi[]>(`/orgs/${encodeURIComponent(dono)}/repos?${q}`);
    else throw e;
  }
  return dados.map(linha);
}

export async function repoDe(dono: string, nome: string): Promise<RepoLinha> {
  return linha(await ghFetch<RepoApi>(`/repos/${encodeURIComponent(dono)}/${encodeURIComponent(nome)}`));
}

export const metaDe = (r: RepoLinha): RepoMeta => ({
  nome: r.nome,
  descricao: r.descricao,
  topicos: r.topicos,
  branch: r.branch,
  licenca: r.licenca,
  privado: r.privado,
  issues: r.issues,
  atualizado: r.atualizado,
  tamanhoKb: r.tamanhoKb,
  arquivado: r.arquivado,
});

/** clone raso do repositório numa pasta de trabalho (apps/api/.repos, fora do versionamento) */
export async function clona(dono: string, nome: string) {
  const destino = join(PASTA_CLONES, `${dono}__${nome}`);
  mkdirSync(PASTA_CLONES, { recursive: true });
  rmSync(destino, { recursive: true, force: true });
  const url = env.GITHUB_TOKEN
    ? `https://x-access-token:${env.GITHUB_TOKEN}@github.com/${dono}/${nome}.git`
    : `https://github.com/${dono}/${nome}.git`;
  try {
    await exec('git', ['clone', '--depth', '50', '--quiet', url, destino], { timeout: 120_000 });
  } catch (e) {
    const bruto = String((e as { stderr?: string }).stderr ?? (e as Error).message);
    /* o token nunca aparece na mensagem de erro */
    const msg = env.GITHUB_TOKEN ? bruto.split(env.GITHUB_TOKEN).join('***') : bruto;
    throw new ErroGitHub(`Não deu para clonar ${dono}/${nome}: ${msg.trim().split('\n').pop()}`);
  }
  const git = async (args: string[]) => {
    try {
      return (await exec('git', ['-C', destino, ...args], { timeout: 30_000 })).stdout.trim();
    } catch {
      return '';
    }
  };
  const iso = await git(['log', '-1', '--format=%cI']);
  const n = await git(['rev-list', '--count', 'HEAD']);
  return { destino, ultimoCommit: iso ? new Date(iso) : null, commits: Number(n) || 0 };
}

export const limpaClone = (dono: string, nome: string) =>
  rmSync(join(PASTA_CLONES, `${dono}__${nome}`), { recursive: true, force: true });
