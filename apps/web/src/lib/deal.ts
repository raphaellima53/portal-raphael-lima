'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { Tom } from './tipos';

/** situação pronta da API: [rótulo, tom] */
export type Sit = [string, Tom];
export type StatD = { v: string; l: string; tom?: Tom };

export type PedidoL = {
  id: number;
  data: string;
  alunoId: number | null;
  cliente: string;
  curso: string;
  oferta: string;
  tipo: string;
  forma: string;
  vendedor: string;
  renovacao: boolean;
  total: string;
  totalN: number;
  contrato: string | null;
  contratoId: number | null;
  situacao: Sit;
};
export type ParcelaL = {
  key: string;
  parcela: string;
  competencia: string;
  venc: string;
  valor: string;
  pago: string | null;
  nota: string | null;
  situacao: Sit;
  atraso: number;
  pagador: string;
  item: string | null;
};
export type NotaL = {
  id: number | null;
  numero: string;
  competencia: string;
  pagador: string;
  alunoId: number | null;
  origem: string;
  pedidoId: number | null;
  valor: string;
  emitida: string | null;
  situacao: Sit;
};
export type ContratoL = {
  id: number;
  nome: string;
  empresa: string;
  empresaId: string | null;
  cnpj: string;
  preset: string;
  vigencia: string;
  vig: Sit;
  beneficiarios: string;
  vendido: string;
  vencido: string;
  temVencido: boolean;
  status: string;
};

/** leitura de uma rota do Deal (caminho relativo a /deal) */
export const useDeal = <T>(caminho: string, ligado = true) =>
  useQuery({ queryKey: ['deal', caminho], queryFn: () => api<T>(`/deal${caminho}`), enabled: ligado });

/** ação do Deal: atualiza o Deal, as fichas e o financeiro do Portal (a baixa é a mesma parcela) */
export function useDealAcao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ caminho, json }: { caminho: string; json?: unknown }) =>
      api<{ msg: string; id?: number }>(`/deal${caminho}`, { method: 'POST', json: json ?? {} }),
    onSuccess: () => {
      for (const k of ['deal', 'alunos', 'empresas', 'relatorios', 'inicio']) qc.invalidateQueries({ queryKey: [k] });
    },
  });
}
