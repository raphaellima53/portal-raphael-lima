'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { Tom } from './tipos';

export type Criterio = { k: string; t: string; d: string; peso: number };
export type ItemAnalise = Criterio & { nivel: 'ok' | 'atencao' | 'falha'; detalhe: string; rotulo: string; tom: Tom };
export type Analise = {
  id: number;
  quando: string;
  nota: number;
  selo: string;
  tom: Tom;
  ok: number;
  atencao: number;
  falha: number;
  por: string;
  itens: ItemAnalise[];
};
export type RepoLinha = {
  nome: string;
  completo: string;
  descricao: string;
  url: string;
  linguagem: string;
  estrelas: number;
  forks: number;
  issues: number;
  atualizado: string;
  branch: string;
  privado: boolean;
  arquivado: boolean;
  fork: boolean;
  tamanhoKb: number;
  topicos: string[];
  licenca: string | null;
};
export type Repos = {
  dono: string;
  donoPadrao: string;
  comToken: boolean;
  criterios: Criterio[];
  linhas: RepoLinha[];
  analises: Record<string, Analise>;
};
export type Provedor = {
  k: 'anthropic' | 'openai' | 'gemini';
  nome: string;
  modelo: string;
  docs: string;
  chaveEnv: string;
  modeloEnv: string;
  configurado: boolean;
};
export type IA = { provedores: Provedor[]; algum: boolean };
export type RespostaIA = {
  k: string;
  nome: string;
  modelo: string;
  texto: string;
  ms: number;
  tokens: number | null;
  erro: string | null;
};

export const useRepos = (dono: string) =>
  useQuery({
    queryKey: ['engenharia', 'repos', dono],
    queryFn: () => api<Repos>(`/engenharia/repos${dono ? `?dono=${encodeURIComponent(dono)}` : ''}`),
    placeholderData: keepPreviousData,
    retry: false,
  });
export const useAnalises = (dono: string, repo: string | null) =>
  useQuery({
    queryKey: ['engenharia', 'analises', dono, repo],
    queryFn: () => api<{ linhas: Analise[] }>(`/engenharia/repos/${repo}/analises?dono=${encodeURIComponent(dono)}`),
    enabled: !!repo && !!dono,
  });
export const useIA = () => useQuery({ queryKey: ['engenharia', 'ia'], queryFn: () => api<IA>('/engenharia/ia') });

/** analisar repositório, perguntar à IA e explicar a análise */
export function useAcaoEng() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ caminho, json }: { caminho: string; json: unknown }) =>
      api<{ msg?: string; analise?: Analise; respostas?: RespostaIA[]; resposta?: RespostaIA }>(
        `/engenharia${caminho}`,
        { method: 'POST', json },
      ),
    onSuccess: () => {
      for (const k of ['engenharia', 'auditoria']) qc.invalidateQueries({ queryKey: [k] });
    },
  });
}
