'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

/** Community Flow: 1 crédito de aula particular a cada 5 presenças nos níveis, agendado pelo aluno */
export type FlowResumo = {
  curso: string;
  modulo: string;
  aCada: number;
  desde: string;
  presencas: number;
  ganhos: number;
  usados: number;
  saldo: number;
  faltam: number;
  agendadas: { k: string; data: string; horario: string; prof: string; cancelarAte: string; podeCancelar: boolean }[];
  /** regras do módulo: agendar e cancelar até X antes */
  regras: { agendar: string; cancelar: string };
};
export type FlowResp =
  | { adesao: false }
  | (FlowResumo & {
      adesao: true;
      janela: number;
      duracao: number;
      /* horários com vaga: professor e vagas que sobram (quem já agendou não aparece) */
      dias: { data: string; txt: string; horas: { hora: string; prof: string; vagas: number; total: number }[] }[];
    });

export const useFlow = (alunoId?: number, ativo = true) =>
  useQuery({
    queryKey: ['flow', alunoId ?? 'eu'],
    queryFn: () => api<FlowResp>(`/flow${alunoId != null ? `?alunoId=${alunoId}` : ''}`),
    enabled: ativo,
  });

/** o próprio aluno cancela a aula Flow agendada (até o prazo do módulo): o crédito e a vaga voltam */
export function useCancelarFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (k: string) =>
      api<{ msg: string }>('/aulas/acao', { method: 'POST', json: { k, acao: 'meuCancelamento' } }),
    onSuccess: () => {
      for (const key of ['flow', 'agenda', 'agenda-agendar', 'aula', 'dashboard', 'alertas'])
        qc.invalidateQueries({ queryKey: [key] });
    },
  });
}

export function useAgendarFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: { alunoId?: number; data: string; hora: string }) =>
      api<{ msg: string; k: string; data: string }>('/flow/agendar', { method: 'POST', json: d }),
    onSuccess: () => {
      for (const key of ['flow', 'agenda', 'agenda-agendar', 'aluno', 'dashboard', 'alertas'])
        qc.invalidateQueries({ queryKey: [key] });
    },
  });
}
