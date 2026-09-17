'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ErroApi } from './api';
import type { Alerta, Dashboard, Me, MinhaArea, Persona } from './tipos';

export const chaves = {
  me: ['me'] as const,
  personas: ['personas'] as const,
  dashboard: ['dashboard'] as const,
  alertas: ['alertas'] as const,
  minhaArea: ['minha-area'] as const,
};

export const useMe = () =>
  useQuery({
    queryKey: chaves.me,
    queryFn: async () => {
      const r = await api<Me | { usuario: null }>('/auth/me');
      if (!r.usuario) throw new ErroApi(401, 'Sessão expirada. Entre de novo.');
      return r as Me;
    },
    retry: false,
    staleTime: 60_000,
  });

export const usePersonas = () =>
  useQuery({
    queryKey: chaves.personas,
    queryFn: () => api<{ personas: Persona[] }>('/auth/personas').then((r) => r.personas),
  });

export const useDashboard = (ativo = true) =>
  useQuery({ queryKey: chaves.dashboard, queryFn: () => api<Dashboard>('/dashboard'), enabled: ativo });

export const useAlertas = (ativo = true) =>
  useQuery({
    queryKey: chaves.alertas,
    queryFn: () => api<{ alertas: Alerta[] }>('/alertas').then((r) => r.alertas),
    enabled: ativo,
    refetchInterval: 60_000,
  });

export const useMinhaArea = () =>
  useQuery({ queryKey: chaves.minhaArea, queryFn: () => api<MinhaArea>('/minha-area') });

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: { login: string; senha: string }) =>
      api<{ ok: true; ehAluno: boolean }>('/auth/login', { method: 'POST', json: d }),
    onSuccess: () => qc.removeQueries(),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ ok: true }>('/auth/logout', { method: 'POST', json: {} }),
    onSettled: () => qc.clear(),
  });
}

export function useSalvarDashboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (blocos: string[]) =>
      api<{ blocos: string[]; salvoEm: string }>('/dashboard/config', { method: 'PUT', json: { blocos } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.dashboard }),
  });
}
