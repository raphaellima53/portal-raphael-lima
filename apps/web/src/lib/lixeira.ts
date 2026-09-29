'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useMe } from './consultas';

/**
 * Lixeira (24/09/2026): o Admin exclui qualquer registro; ele vai com o que depende dele para
 * Configurações › Lixeira, de onde é restaurado igual ou apagado de vez.
 */
export type Previa = { rotulo: string; nome: string; junto: string[]; recusa: string | null };
export type ItemLixeira = {
  id: number;
  tipo: string;
  rotulo: string;
  nome: string;
  resumo: string;
  por: string;
  em: string;
};

/** Excluir é só do tipo de perfil Admin */
export const useEhAdmin = () => useMe().data?.usuario.tipoPerfil === 'Admin';

export const usePrevia = (tipo: string, id: string | null) =>
  useQuery({
    queryKey: ['lixeira-previa', tipo, id],
    queryFn: () => api<Previa>(`/lixeira/previa?tipo=${tipo}&id=${encodeURIComponent(id ?? '')}`),
    enabled: !!id,
    gcTime: 0,
  });

/**
 * depois de excluir ou restaurar, tudo pode ter mudado: recarrega as telas — um instante depois, para a tela que
 * excluiu receber o aviso e navegar antes (a página do registro excluído vira "não encontrado" ao recarregar)
 */
const recarrega = (qc: ReturnType<typeof useQueryClient>) => {
  setTimeout(() => qc.invalidateQueries(), 0);
};

export function useExcluir() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tipo, id }: { tipo: string; id: string }) =>
      api<{ msg: string }>(`/lixeira/${tipo}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => recarrega(qc),
  });
}

export const useLixeira = () =>
  useQuery({
    queryKey: ['lixeira'],
    queryFn: () => api<{ itens: ItemLixeira[]; tipos: { v: string; l: string }[] }>('/lixeira'),
  });

export function useRestaurar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<{ msg: string }>(`/lixeira/${id}/restaurar`, { method: 'POST' }),
    onSuccess: () => recarrega(qc),
  });
}

export function useApagarDeVez() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<{ msg: string }>(`/lixeira/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lixeira'] }),
  });
}
