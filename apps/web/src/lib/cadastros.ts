'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

/** Cadastros simples da adequação ao Portal Alumni (apps/api/src/domain/cadastros.ts). */
export type TipoCampo =
  | 'texto'
  | 'longo'
  | 'numero'
  | 'dinheiro'
  | 'data'
  | 'mes'
  | 'sim'
  | 'escolha'
  | 'email'
  | 'url'
  | 'cor'
  | 'telefone'
  | 'cep'
  | 'uf';
export type Opcao = { v: string; l: string };
export type CampoCad = {
  k: string;
  rotulo: string;
  tipo: TipoCampo;
  req: boolean;
  largo: boolean;
  ajuda: string | null;
  padrao: string | number | boolean;
};
export type LinhaCad = {
  id: number | string;
  rotulo: string;
  valores: Record<string, string | boolean>;
  txt: Record<string, string>;
};
export type TelaCad = {
  id: string;
  titulo: string;
  um: string;
  novo: string;
  sobre: string;
  campos: CampoCad[];
  colunas: { k: string; rotulo: string }[];
  filtros: { k: string; rotulo: string; opcoes: Opcao[] }[];
  opcoes: Record<string, Opcao[]>;
  linhas: LinhaCad[];
  pode: { ver: boolean; criar: boolean; editar: boolean; excluir: boolean };
};

const qs = (pai?: string | number | null) => (pai != null && pai !== '' ? `?pai=${encodeURIComponent(pai)}` : '');

export const useCadastro = (id: string, pai?: string | number | null) =>
  useQuery({
    queryKey: ['cadastros', id, pai ?? null],
    queryFn: () => api<TelaCad>(`/cadastros/${id}${qs(pai)}`),
    placeholderData: keepPreviousData,
  });

export function useAcaoCadastro(id: string, pai?: string | number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rid, method, json }: { rid?: number | string; method: 'POST' | 'PUT' | 'DELETE'; json?: unknown }) =>
      api<{ msg: string; id?: number | string }>(`/cadastros/${id}${rid != null ? `/${rid}` : ''}${qs(pai)}`, {
        method,
        json: json ?? {},
      }),
    onSuccess: () => {
      /* os cadastros se cruzam (extrato e acertos, calendário e ciclos): recarrega todos, e o log das fichas */
      for (const k of ['cadastros', 'aluno', 'professor', 'auditoria']) qc.invalidateQueries({ queryKey: [k] });
    },
  });
}

/** nomes ativos de catálogos para os formulários (gêneros, responsáveis financeiros, skills…) */
export const useCatalogos = (tipos: string[], ativo = true) =>
  useQuery({
    queryKey: ['catalogo-opcoes', tipos.join(',')],
    queryFn: () => api<Record<string, string[]>>(`/catalogo-opcoes?tipos=${tipos.join(',')}`),
    enabled: ativo,
    staleTime: 60_000,
  });

export type Endereco = {
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
};
export type PessoaExtra = { telefone: string; nascimento: string; genero: string; endereco: Endereco };
export const ENDERECO_VAZIO: Endereco = {
  cep: '',
  rua: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
};
export const PESSOA_VAZIA: PessoaExtra = { telefone: '', nascimento: '', genero: '', endereco: ENDERECO_VAZIO };
