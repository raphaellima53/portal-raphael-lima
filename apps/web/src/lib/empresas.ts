'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { Endereco } from './cadastros';
import type { Tom } from './tipos';

export type EmpresaLinha = {
  id: string;
  nome: string;
  segmento: string;
  cnpj: string;
  modelo: 'B2B' | 'B2B2C';
  turmaDedicada: boolean;
  gerente: string;
  dias: number;
  licencas: string;
  consumo: string;
  presenca: string;
  fim: string;
  sit: string;
  sitTom: Tom;
  alertas: { t: string; tom: Tom }[];
};
export type ListaEmpresas = { eu: string; gerentes: string[]; podeGerir: boolean; empresas: EmpresaLinha[] };

export type EmpresaForm = {
  nome: string;
  cnpj: string;
  segmento: string;
  modelo: 'B2B' | 'B2B2C';
  gerente: string;
  inicio: string;
  fim: string;
  licencas: number;
  aulas: number;
  valor: number;
  subsidio: number;
  desconto: number;
  cursos: string[];
  renovaAuto: boolean;
  rhNome: string;
  rhEmail: string;
  turmaCurso?: string | null;
  /* adequação ao Portal Alumni */
  representante: string;
  funcionarios: number | null;
  rhDepartamento: string;
  rhTelefone: string;
  endereco: Endereco;
};
export type AbaEmpresa = 'geral' | 'alunos' | 'historico';
export type GeralEmp = {
  stats: { valor: string; rotulo: string; tom?: Tom; sub?: string }[];
  alertas: string[];
  contrato: [string, string][];
  gestao: [string, string][];
};
export type AlunosEmp =
  | {
      turma: true;
      cursoId: number;
      turmas: { nome: string; grupo: string; professor: string; grade: string; modalidade: string; vagas: string }[];
    }
  | {
      turma: false;
      cobranca: string;
      alunos: {
        id: number;
        nome: string;
        email: string;
        cursos: string;
        aulas: string;
        presenca: string;
        paga: string;
        sit: string;
        sitTom: Tom;
      }[];
      semEmpresa: { id: number; nome: string; email: string }[];
    };
export type HistoricoEmp = {
  linhas: { quando: string; quem: string; base: boolean; acao: string; vezes: number; detalhe: string }[];
};
export type FichaEmpresa = {
  id: string;
  nome: string;
  modelo: 'B2B' | 'B2B2C';
  sit: string;
  sitTom: Tom;
  segmento: string;
  gerente: string;
  turma: boolean;
  aba: AbaEmpresa;
  dados: GeralEmp | AlunosEmp | HistoricoEmp;
  podeGerir: boolean;
  form: EmpresaForm;
  renovar: { fim: string; fimAtual: string; licencas: number; valor: number };
};
export type OpcoesEmpresa = { gerentes: string[]; cursos: string[]; segmentos: string[] };

export const useEmpresas = () => useQuery({ queryKey: ['empresas'], queryFn: () => api<ListaEmpresas>('/empresas') });
export const useEmpresa = (id: string, aba: string) =>
  useQuery({
    queryKey: ['empresa', id, aba],
    queryFn: () => api<FichaEmpresa>(`/empresas/${encodeURIComponent(id)}?aba=${aba}`),
    placeholderData: (ant) => (ant?.id === id ? ant : undefined),
  });
export const useOpcoesEmpresa = (ativo: boolean) =>
  useQuery({ queryKey: ['empresas-opcoes'], queryFn: () => api<OpcoesEmpresa>('/empresas-opcoes'), enabled: ativo });

/** ações da conta: caminho relativo a /empresas, método e corpo */
export function useAcaoEmpresa() {
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
    }) =>
      api<{ msg: string; id?: string; email?: { para: string; assunto: string; corpo: string } }>(
        `/empresas${caminho}`,
        {
          method,
          json: json ?? (method === 'DELETE' ? undefined : {}),
        },
      ),
    onSuccess: () => {
      for (const k of ['empresas', 'empresa', 'alunos', 'aluno', 'dashboard']) qc.invalidateQueries({ queryKey: [k] });
    },
  });
}
