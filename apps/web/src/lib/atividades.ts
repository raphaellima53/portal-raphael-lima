'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export type Cartao = {
  id: number;
  titulo: string;
  descricao: string;
  setor: string;
  frente: string;
  tipo: string;
  responsavel: string;
  prioridade: string;
  prazo: string | null;
  prazoIso: string;
  prazoHora: string;
  prazoTxt: string;
  atrasada: boolean;
  situacao: string;
  rel: { tipo: string; rot: string; id: string | null; nome: string; href: string | null } | null;
  modelo: { id: number; cadencia: string } | null;
  periodo: string | null;
  concluida: string | null;
  criado: string;
  criadoPor: string;
  hist: { quando: string; quem: string; acao: string; det: string }[];
};
export type Modelo = {
  id: number;
  nome: string;
  descricao: string;
  setor: string;
  tipo: string;
  cadencia: string;
  responsavel: string;
  prioridade: string;
};
export type Opcoes = {
  frentes: { frente: string; setores: string[] }[];
  tipos: string[];
  prioridades: string[];
  situacoes: { k: string; t: string; cor: string }[];
  cadencias: { k: string; t: string }[];
  rels: { k: string; t: string }[];
  pessoas: string[];
  eu: string;
  podeOperar: boolean;
  registros: Record<string, { v: string; l: string }[]>;
  modelos: Modelo[];
};
export type Quadro = { frente: string; setores: string[]; itens: Cartao[] };
export type Dash = {
  stats: {
    abertas: number;
    andamento: number;
    atrasadas: number;
    hoje: number;
    concluidas: number;
    naoRealizadas: number;
  };
  porSetor: {
    setor: string;
    frente: string;
    afazer: number;
    andamento: number;
    atrasadas: number;
    concluidas: number;
    naoRealizadas: number;
  }[];
  porResponsavel: { nome: string; abertas: number; atrasadas: number }[];
  proximos: Cartao[];
  ultimas: { id: number; titulo: string; quando: string; quem: string; acao: string; det: string }[];
  podeOperar: boolean;
};
export type Catalogo = {
  podeEditar: boolean;
  itens: (Modelo & { frente: string; ativo: boolean; abertas: number; total: number })[];
};

export const PRI_TOM: Record<string, 'red' | 'amber' | 'gray'> = { Alta: 'red', Média: 'amber', Baixa: 'gray' };
export const CADENCIA_ROT: Record<string, string> = {
  diaria: 'Diária',
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  mensal: 'Mensal',
  bimestral: 'Bimestral',
  trimestral: 'Trimestral',
  eventual: 'Eventual',
  projeto: 'Projeto',
};

export const useAtvOpcoes = () =>
  useQuery({ queryKey: ['atividades', 'opcoes'], queryFn: () => api<Opcoes>('/atividades/opcoes') });
export const useQuadro = (frente: string) =>
  useQuery({
    queryKey: ['atividades', 'quadro', frente],
    queryFn: () => api<Quadro>(`/atividades/quadro?frente=${encodeURIComponent(frente)}`),
  });
export const useAtvDash = () =>
  useQuery({ queryKey: ['atividades', 'dash'], queryFn: () => api<Dash>('/atividades/dash') });
export const useAtividade = (id: number | null) =>
  useQuery({
    queryKey: ['atividades', 'uma', id],
    queryFn: () => api<Cartao>(`/atividades/${id}`),
    enabled: id != null,
  });
export const useCatalogo = () =>
  useQuery({ queryKey: ['atividades', 'catalogo'], queryFn: () => api<Catalogo>('/atividades/catalogo') });

/** ações de Atividades: caminho relativo a /atividades; atualiza quadro, dashboard e catálogo */
export function useAtvAcao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ caminho, method = 'POST', json }: { caminho: string; method?: 'POST' | 'PATCH'; json?: unknown }) =>
      api<{ msg: string; id?: number; frente?: string }>(`/atividades${caminho}`, { method, json: json ?? {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['atividades'] }),
  });
}
