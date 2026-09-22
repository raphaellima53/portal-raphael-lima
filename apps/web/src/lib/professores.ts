'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AcessoPessoa } from '@/components/acesso-pessoa';
import type { DispAba, LogAba, Perfil, StatA } from './alunos';
import { api } from './api';
import type { PessoaExtra } from './cadastros';
import type { Tom } from './tipos';

export type ProfLinha = {
  id: string;
  nome: string;
  email: string;
  cursos: { nome: string; cor: string }[];
  aulas: number;
  teto: number;
  acimaTeto: boolean;
  ativo: boolean;
};
export type PodeProfLista = { criar: boolean; editar: boolean; desativar: boolean; como: boolean; ficha: boolean };
export type ListaProf = { professores: ProfLinha[]; cursos: string[]; pode: PodeProfLista };

export type AbaProf = 'perfil' | 'log' | 'cursos' | 'disponibilidade' | 'agenda' | 'feedbacks' | 'acesso';
export type HabCurso = {
  id: number;
  curso: string;
  cor: string;
  ativo: boolean;
  on: boolean;
  eTurma: boolean;
  resumo: string;
  itens: { nome: string; on: boolean; titular: boolean }[];
};
type AulaProf = {
  k: string;
  data: string;
  horario: string;
  rotulo: string;
  cor: string;
  prod: string;
  quem: string;
  alunoId: number | null;
  alunos: string;
  estadoTag: [string, Tom];
};
export type AgendaProf =
  | { quando: 'proximas'; dias: number; aulas: (AulaProf & { sala: string })[] }
  | { quando: 'passadas'; dias: number; stats: StatA[]; aulas: (AulaProf & { estado: string })[] };
export type FeedbacksProf = {
  dias: number;
  stats: StatA[];
  lista: {
    quando: string;
    aluno: string;
    curso: string;
    aula: string;
    nota: number;
    texto: string;
    registrada: boolean;
  }[];
  porCurso: { curso: string; n: number; media: string }[];
  aulas: { k: string; rotulo: string }[];
  alunos: string[];
  notas: { v: string; l: string }[];
};
export type FichaProf = {
  id: string;
  nome: string;
  ativo: boolean;
  sub: string;
  resumo: { horarios: number; aulas: number; alunos: number; fora: number; teto: number };
  grupos: { k: string; rotulo: string; abas: { k: AbaProf; rotulo: string }[] }[];
  aba: AbaProf;
  quando: 'proximas' | 'passadas';
  dados: Perfil | LogAba | { cursos: HabCurso[] } | DispAba | AgendaProf | FeedbacksProf | AcessoPessoa;
  pode: { editar: boolean; desativar: boolean; como: boolean; operar: boolean; agenda: boolean; alunos: boolean };
};
export type ProfForm = PessoaExtra & {
  cpf: string;
  skills: string[];
  nome: string;
  email: string;
  teto: number;
  cursos: string[];
  ativo: boolean;
};

export const useProfessores = () =>
  useQuery({ queryKey: ['professores'], queryFn: () => api<ListaProf>('/professores') });
export const useFichaProf = (id: string, params: Record<string, string>) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
  return useQuery({
    queryKey: ['professor', id, qs],
    queryFn: () => api<FichaProf>(`/professores/${encodeURIComponent(id)}?${qs}`),
    placeholderData: (ant) => (ant?.id === id ? ant : undefined),
  });
};
export const useOpcoesProf = (ativo: boolean) =>
  useQuery({
    queryKey: ['professores-opcoes'],
    queryFn: () => api<{ cursos: string[] }>('/professores-opcoes'),
    enabled: ativo,
  });
export const useFormProf = (id: string | null, ativo: boolean) =>
  useQuery({
    queryKey: ['professor-form', id],
    queryFn: () => api<ProfForm>(`/professores/${id}/form`),
    enabled: ativo && id != null,
    gcTime: 0,
  });

/** ações do professor: caminho relativo a /professores, método e corpo */
export function useAcaoProf() {
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
      api<{ msg: string; id?: string; ir?: string; horas?: number }>(`/professores${caminho}`, {
        method,
        json: json ?? (method === 'DELETE' ? undefined : {}),
      }),
    onSuccess: () => {
      for (const k of [
        'professores',
        'professor',
        'professor-form',
        'agenda',
        'curso',
        'cursos',
        'aluno',
        'dashboard',
        'alertas',
      ])
        qc.invalidateQueries({ queryKey: [k] });
    },
  });
}
