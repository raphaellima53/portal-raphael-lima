'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { Tom } from './tipos';

export type CursoCard = {
  id: number;
  n: number;
  nome: string;
  cor: string;
  idioma: string;
  tipo: string;
  descricao: string;
  autoAgenda: boolean;
  ativo: boolean;
  estrutura: 'modulos' | 'turmas' | 'nenhuma';
  itens: string[];
  profs: number;
  alunos: number;
};
export type StatT = { valor: string; rotulo: string; tom?: Tom };
export type AlunoRoster = {
  alunoId: number;
  nome: string;
  usadas: number;
  total: number;
  modalidade: string;
  situacao: string;
  modulo: string | null;
};
export type CurRef = { id: string; nome: string } | null;
export type ProfHab = { id: string; nome: string; recorte: string | null };
export type Geral =
  | {
      estrutura: 'turmas';
      stats: StatT[];
      turmas: {
        n: string;
        nome: string;
        grupo: string;
        professor: string;
        grade: string;
        sala: string;
        modalidade: string;
        vagas: number;
        ocupadas: number;
        periodo: string;
        curriculo: CurRef;
        alunos: AlunoRoster[];
      }[];
      profs: ProfHab[];
    }
  | {
      estrutura: 'modulos';
      stats: StatT[];
      modulos: { n: string; nome: string; cor: string; alunos: number; presenciais: number; curriculo: CurRef }[];
      alunos: AlunoRoster[];
      profs: ProfHab[];
    }
  | { estrutura: 'nenhuma'; stats: StatT[]; curriculo: CurRef; alunos: AlunoRoster[]; profs: ProfHab[] };
export type Regras = {
  estrutura: string;
  estruturaTxt: string;
  tipoIdioma: string;
  vagas: number;
  duracao: number;
  modalidades: string[];
  pacote: number;
  cancelamento: number;
  autoAgenda: boolean;
  exigeDisp: boolean;
  valorAula: number;
  horarios: number;
  /* adequação ao Portal Alumni: antecedência para marcar e configuração da agenda */
  antecedencia: number;
  config: Record<string, string | boolean>;
  configCampos: { k: string; rotulo: string; ajuda: string; opcoes?: string[] }[];
};
export type CurriculoAba = {
  stats: StatT[];
  lista: {
    id: string;
    nome: string;
    aplicado: string;
    publicada: string | null;
    rascunho: string | null;
    conteudos: number;
    semLink: number;
    publicadaEm: string | null;
  }[];
  emRascunho: { id: string; nome: string; versao: string }[];
  semCurriculo: string[];
  eTurma: boolean;
};
export type Grade = {
  stats: StatT[];
  coluna: string;
  linhas: {
    item: string;
    quem: string;
    alunoId: number | null;
    dias: string;
    horario: string;
    prof: string;
    profId: string | null;
    sala: string;
    ocupacao: string;
  }[];
};
export type CursoForm = {
  nome: string;
  descricao: string;
  idioma: string;
  tipo: string;
  estrutura: 'modulos' | 'turmas' | 'nenhuma';
  cor: string;
  itens: { nome: string; cor: string; sigla: string; descricao: string; vagas: number | null }[];
  autoAgenda: boolean;
  ativo: boolean;
  /* adequação ao Portal Alumni */
  sigla: string;
  natureza: 'Curso' | 'Serviço' | 'Assinatura';
  visibilidadeOferta: string;
  tipoSala: string;
};
export type Aba = 'geral' | 'regras' | 'curriculo' | 'grade';
export type OpcoesCurso = { idiomas: string[]; tipos: string[]; visibilidades: string[]; tiposSala: string[] };
export type CursoResp = {
  id: number;
  nome: string;
  cor: string;
  sub: string;
  abas: Aba[];
  aba: Aba;
  dados: Geral | Regras | CurriculoAba | Grade;
  form: CursoForm;
  opcoes: OpcoesCurso;
  pode: { agenda: boolean; editar: boolean; criar: boolean; curriculo: boolean };
};

export const useCatalogo = () =>
  useQuery({ queryKey: ['cursos'], queryFn: () => api<{ cursos: CursoCard[]; podeCriar: boolean }>('/cursos') });
export const useCurso = (id: number, aba: string) =>
  useQuery({
    queryKey: ['curso', id, aba],
    queryFn: () => api<CursoResp>(`/cursos/${id}?aba=${aba}`),
    enabled: Number.isFinite(id),
  });
export const useOpcoesCurso = (ativo: boolean) =>
  useQuery({
    queryKey: ['cursos-opcoes'],
    queryFn: () => api<OpcoesCurso>('/cursos-opcoes'),
    enabled: ativo,
  });

const invalidaCursos = (qc: ReturnType<typeof useQueryClient>) => {
  for (const k of ['cursos', 'curso', 'agenda', 'dashboard', 'curriculo', 'aula'])
    qc.invalidateQueries({ queryKey: [k] });
};

export function useSalvarCurso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...d }: CursoForm & { id: number | null }) =>
      api<{ id: number; msg: string }>(id == null ? '/cursos' : `/cursos/${id}`, {
        method: id == null ? 'POST' : 'PUT',
        json: d,
      }),
    onSuccess: () => invalidaCursos(qc),
  });
}

export function useSalvarRegras(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: Omit<Regras, 'estrutura' | 'estruturaTxt' | 'tipoIdioma' | 'horarios' | 'configCampos'>) =>
      api<{ msg: string }>(`/cursos/${id}/regras`, { method: 'PUT', json: d }),
    onSuccess: () => invalidaCursos(qc),
  });
}

/* ---------------- currículos ---------------- */
export type Conteudo = {
  titulo: string;
  formato: string;
  gram: string;
  voc: [string, string][];
  links: { pre: string; in: string; post: string };
};
export type CurriculoResp = {
  id: string;
  nome: string;
  grupo: string;
  tipo: 'produto' | 'acervo';
  idioma: string;
  aplicado: string[];
  cor: string | null;
  versoes: {
    k: number;
    nome: string;
    situacao: string;
    data: string;
    conteudos: Conteudo[];
    ehPublicada: boolean;
    ehRascunho: boolean;
  }[];
  proxima: string;
  curso: { id: number; estrutura: string; itens: string[] } | null;
  pode: { editar: boolean; editarItens: boolean; excluir: boolean };
};
export type CurriculoFormOpcoes = {
  curso: { nome: string; estrutura: string; itens: string[] } | null;
  copiar: { id: string; nome: string }[];
  acervos: string[];
  atual: { nome: string; aplicado: string[]; categoria: string } | null;
  categorias: string[];
};

export const useCurriculo = (id: string) =>
  useQuery({ queryKey: ['curriculo', id], queryFn: () => api<CurriculoResp>(`/curriculos/${encodeURIComponent(id)}`) });
export const useCurriculoFormOpcoes = (p: { id?: string; grupo?: string } | null) =>
  useQuery({
    queryKey: ['curriculo-form', p],
    queryFn: () =>
      api<CurriculoFormOpcoes>(
        `/curriculos-form?${new URLSearchParams(Object.entries(p ?? {}).filter((e): e is [string, string] => !!e[1])).toString()}`,
      ),
    enabled: !!p,
  });

type RespVersao = { versao?: number; msg: string; id?: string; grupo?: string };
export function useAcaoCurriculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ caminho, method = 'POST', json }: { caminho: string; method?: string; json?: unknown }) =>
      api<RespVersao>(`/curriculos${caminho}`, { method, json: json ?? {} }),
    onSuccess: () => invalidaCursos(qc),
  });
}
