'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { Tom } from './tipos';

export type Alocacao = {
  tipos: { k: string; t: string; tom: Tom; d: string }[];
  cursos: string[];
  itens: {
    tipo: string;
    curso: string;
    quem: string;
    oque: string;
    quando: string;
    det: string;
    href: string;
    rotIr: string;
  }[];
};
export type Fechamento = {
  meses: { v: string; l: string }[];
  ym: string;
  rotulo: string;
  situacao: { t: string; tom: Tom };
  fechada: { txt: string } | null;
  parcial: boolean;
  naoFin: number;
  veValor: boolean;
  podeOperar: boolean;
  linhas: {
    nome: string;
    profId: string | null;
    pagas: number;
    presenca: number;
    falta: number;
    descontadas: number;
    pendentes: number;
    horas: string;
    bruto: string;
    desconto: string;
    liquido: string;
  }[];
  total: {
    pagas: number;
    presenca: number;
    falta: number;
    descontadas: number;
    pendentes: number;
    horas: string;
    bruto: string;
    desconto: string;
    liquido: string;
  } | null;
};
export type AulasFolha = {
  titulo: string;
  sub: string;
  aulas: {
    k: string;
    quando: string;
    aula: string;
    noLugar: string | null;
    presenca: string;
    situacao: [string, string];
    suporte: string | null;
    valor: string;
    marca: string;
  }[];
};
export type Funil = {
  etapas: { k: string; t: string; cor: string }[];
  consultores: string[];
  eu: string;
  cursos: string[];
  origens: string[];
  motivos: string[];
  podeOperar: boolean;
  leads: {
    id: string;
    nome: string;
    email: string;
    curso: string;
    origem: string;
    consultor: string;
    etapa: string;
    motivo: string;
    alunoId: number | null;
    quando: string;
  }[];
};
export type Atendimentos = {
  podeOperar: boolean;
  tipos: string[];
  areas: string[];
  canais: string[];
  situacoes: string[];
  alunos: { id: number; nome: string; cursos: string[] }[];
  itens: {
    id: number;
    alunoId: number;
    aluno: string;
    idade: string;
    data: string;
    tipo: string;
    tipoTom: Tom;
    area: string;
    curso: string;
    texto: string;
    por: string;
    canal: string;
    status: string;
    statusTom: Tom;
  }[];
};
export type Valor = string | number | string[] | null;
export type Valores = Record<string, Valor>;
export type CampoFluxo = {
  k: string;
  t: string;
  tipo: 'select' | 'text' | 'textarea' | 'chips' | 'date' | 'number' | 'email';
  obrig: boolean;
  full: boolean;
  recarrega: boolean;
  ajuda: string;
  ph: string;
  ops: { v: string; l: string }[] | null;
};
export type CardFluxo = {
  id: string;
  etapa: string;
  fim: boolean;
  titulo: string;
  sub: string;
  dias: string;
  mudou: string;
  criado: string;
  quem: string;
  prox: { k: string; t: string } | null;
  ant: { k: string; t: string } | null;
  alts: { k: string; t: string }[];
  exigeProx: string[];
  hist: { de?: string; para: string; quem: string; quando: string; nota?: string }[];
  v: Valores;
};
export type FluxoTela = {
  key: string;
  t: string;
  um: string;
  novo: string;
  como: string;
  podeOperar: boolean;
  etapas: { k: string; t: string; cor: string; d: string; fim: boolean; alt: boolean }[];
  campos: CampoFluxo[];
  cards: CardFluxo[];
};

export const useAlocacao = () =>
  useQuery({ queryKey: ['acoes', 'alocacao'], queryFn: () => api<Alocacao>('/acoes/alocacao') });
export const useFechamento = (mes: string) =>
  useQuery({
    queryKey: ['acoes', 'fechamento', mes],
    queryFn: () => api<Fechamento>(`/acoes/fechamento${mes ? `?mes=${mes}` : ''}`),
    placeholderData: (ant) => ant,
  });
export const useAulasFolha = (mes: string, prof: string | null) =>
  useQuery({
    queryKey: ['acoes', 'folha', mes, prof],
    queryFn: () => api<AulasFolha>(`/acoes/fechamento/aulas?mes=${mes}&prof=${encodeURIComponent(prof ?? '')}`),
    enabled: !!prof,
  });
export const useFunil = () => useQuery({ queryKey: ['acoes', 'funil'], queryFn: () => api<Funil>('/acoes/funil') });
export const useAtendimentos = () =>
  useQuery({ queryKey: ['acoes', 'atendimentos'], queryFn: () => api<Atendimentos>('/acoes/atendimentos') });
export const useFluxo = (key: string) =>
  useQuery({ queryKey: ['acoes', 'fluxo', key], queryFn: () => api<FluxoTela>(`/acoes/fluxos/${key}`) });
export const camposFluxo = (key: string, v: Valores) =>
  api<{ campos: CampoFluxo[] }>(`/acoes/fluxos/${key}/campos`, { method: 'POST', json: { v } });

/** uma ação qualquer de Ações: caminho relativo a /acoes */
export function useAcao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      caminho,
      method = 'POST',
      json,
    }: {
      caminho: string;
      method?: 'POST' | 'PUT' | 'DELETE';
      json?: unknown;
    }) => api<{ msg: string; alunoId?: number }>(`/acoes${caminho}`, { method, json: json ?? {} }),
    onSuccess: () => {
      for (const k of [
        'acoes',
        'alertas',
        'agenda',
        'aluno',
        'alunos',
        'professores',
        'professor',
        'dashboard',
        'aula',
      ])
        qc.invalidateQueries({ queryKey: [k] });
    },
  });
}
