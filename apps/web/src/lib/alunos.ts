'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AcessoPessoa } from '@/components/acesso-pessoa';
import { api } from './api';
import type { PessoaExtra } from './cadastros';
import type { Tom } from './tipos';

export type Item = { nome: string; cor: string } | null;
export type StatA = { valor: string; rotulo: string; tom?: Tom };

export type AlunoLinha = {
  id: number;
  nome: string;
  email: string;
  cpf: string;
  sit: string;
  sitTom: Tom;
  matriculas: { curso: string; item: Item; modalidade: string; usadas: number; total: number }[];
  saldo: number;
  persona: boolean;
};
export type PodeLista = {
  criar: boolean;
  editar: boolean;
  desativar: boolean;
  excluir: boolean;
  como: boolean;
  ficha: boolean;
};
export type ListaResp = { alunos: AlunoLinha[]; produtos: string[]; situacoes: string[]; pode: PodeLista };

export type AbaAluno =
  | 'contratos'
  | 'perfil'
  | 'log'
  | 'cursos'
  | 'disponibilidade'
  | 'financeiro'
  | 'agendamentos'
  | 'feedbacks'
  | 'acesso';
/** um ID de usuário, vários perfis: aluno, professor e colaborador vinculados */
export type Vinculos = {
  usuario: { id: number; codigo: string; email: string; perfil: string; status: string } | null;
  papeis: { tipo: 'Aluno' | 'Professor' | 'Colaborador'; nome: string; href: string | null; atual: boolean }[];
};
export type Perfil = {
  blocos: { titulo: string; itens: { k: string; v: string | null; tom?: Tom }[] }[];
  vinculos?: Vinculos;
};
export type FinanceiroAba = {
  stats: { valor: string; rotulo: string; tom?: 'red' | 'green' }[];
  linhas: {
    key: string;
    curso: string;
    item: string;
    parcela: string;
    venc: string;
    valor: string;
    pago: string | null;
    sit: 'paga' | 'vencida' | 'aVencer';
    atraso: number;
  }[];
  cobranca: string | null;
};
export type LogAba = {
  linhas: { quando: string; quem: string; base: boolean; acao: string; vezes: number; detalhe: string }[];
};
export type Checagem = { ok: boolean; txt: string }[];
type AlocTopo = { mid: number; curso: string; cor: string; item: Item; modalidade: string };
export type AlocCard =
  | (AlocTopo & {
      ind: true;
      gravada: boolean;
      profs: string[];
      prof: string;
      dias: number[];
      hora: number;
      valor: number | null;
      checagem: Checagem;
    })
  | (AlocTopo & {
      ind: false;
      eTurma: boolean;
      horario: string | null;
      prof: string | null;
      profId: string | null;
      sala: string | null;
      ocupacao: string | null;
      checagem: Checagem;
      opcoes: { v: string; l: string; desabilitada: boolean }[];
    });
export type CursosAba = {
  ativas: {
    id: number;
    curso: string;
    cursoId: number | null;
    item: Item;
    modalidade: string;
    usadas: number;
    total: number;
    saldo: number;
    horarios: { txt: string; prof: string | null }[];
  }[];
  encerradas: { id: number; curso: string; item: Item; usadas: number; total: number; encerradaEm: string }[];
  alocacao: AlocCard[] | null;
};
export type DispAba = {
  stats: StatA[];
  dias: { k: string; rotulo: string }[];
  linhas: {
    k: string;
    rotulo: string;
    celulas: { k: string; estado: 'aula' | 'conflito' | 'livre' | 'fechada'; texto: string; rotulo: string }[];
  }[];
  conflitos: string[];
  abrirAlocacao: boolean;
};
export type AulaLinha = {
  k: string;
  data: string;
  horario: string;
  rotulo: string;
  cor: string;
  prod: string;
  prof: string;
  profId: string | null;
  estadoTag: [string, Tom];
};
export type AgendamentosAba =
  | { quando: 'proximas'; dias: number; aulas: (AulaLinha & { sala: string; agendarAte: string; limite: string })[] }
  | {
      quando: 'passadas';
      dias: number;
      stats: { aulas: number; presencas: number; faltas: number; pct: number | null; canceladas: number };
      aulas: (AulaLinha & {
        sub?: string;
        estado: string;
        presenca: 'presente' | 'falta' | 'pendente' | null;
      })[];
    };
export type Ponto = {
  k: string;
  t: string;
  n: number;
  nivel: 'red' | 'amber' | 'ok';
  area: string;
  ir: 'passadas' | 'cursos' | null;
  rot: string;
  d: string;
};
export type Feedback = {
  id: number;
  data: string;
  dataCompleta: string;
  tipo: string;
  tipoTom: Tom;
  area: string;
  curso: string;
  canal: string;
  texto: string;
  por: string;
  status: string;
  statusTom: Tom;
  anexos: { id: number; nome: string; img: boolean; tam: number }[];
};
export type FeedbacksAba = { dias: number; pontos: Ponto[]; stats: StatA[]; cursos: string[]; lista: Feedback[] };

export type FichaResp = {
  id: number;
  nome: string;
  sit: string;
  sitTom: Tom;
  sub: string;
  resumo: { matriculas: number; restantes: number; porSemana: number; presenca: number | null; dias: number };
  grupos: { k: string; rotulo: string; abas: { k: AbaAluno; rotulo: string }[] }[];
  aba: AbaAluno;
  quando: 'proximas' | 'passadas';
  dados: Perfil | LogAba | CursosAba | DispAba | FinanceiroAba | AgendamentosAba | FeedbacksAba | AcessoPessoa;
  persona: boolean;
  inativo: boolean;
  pode: {
    editar: boolean;
    desativar: boolean;
    excluir: boolean;
    como: boolean;
    operar: boolean;
    agenda: boolean;
  };
};
export type OpcoesAluno = {
  situacoes: string[];
  empresas: string[];
  cursos: { nome: string; estrutura: string; itens: string[]; modalidades: string[]; pacote: number }[];
  fb: { tipos: [string, Tom][]; areas: string[]; canais: string[]; situacoes: [string, Tom][] };
  /* Novo aluno (24/09/2026): Matrícula e Nivelamento */
  ofertas: { id: number; nome: string; curso: string; aulas: number; parcelasMax: number; mercado: string }[];
  contratos: { id: number; nome: string; empresa: string }[];
  formas: { id: number; nome: string }[];
  cefr: string[];
  generos: string[];
};
export type AlunoForm = PessoaExtra & {
  responsavelFinanceiro: string;
  origemExterna: string;
  nome: string;
  cpf: string;
  status: string;
  email: string;
  empresa: string;
  contrato: string;
  matriculas: { id: number; curso: string; item: string | null; modalidade: string; usadas: number; total: number }[];
};

export const useAlunos = () => useQuery({ queryKey: ['alunos'], queryFn: () => api<ListaResp>('/alunos') });
export const useFicha = (id: number, params: Record<string, string>) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
  return useQuery({
    queryKey: ['aluno', id, qs],
    queryFn: () => api<FichaResp>(`/alunos/${id}?${qs}`),
    enabled: Number.isFinite(id),
    placeholderData: (ant) => (ant?.id === id ? ant : undefined),
  });
};
export const useOpcoesAluno = (ativo: boolean) =>
  useQuery({ queryKey: ['alunos-opcoes'], queryFn: () => api<OpcoesAluno>('/alunos-opcoes'), enabled: ativo });
export const useFormAluno = (id: number | null, ativo: boolean) =>
  useQuery({
    queryKey: ['aluno-form', id],
    queryFn: () => api<AlunoForm>(`/alunos/${id}/form`),
    enabled: ativo && id != null,
    gcTime: 0,
  });

/** o que muda um aluno mexe também na agenda, nos cursos e no Dashboard */
export const invalidaAlunos = (qc: ReturnType<typeof useQueryClient>) => {
  for (const k of ['alunos', 'aluno', 'aluno-form', 'agenda', 'curso', 'cursos', 'dashboard', 'alertas'])
    qc.invalidateQueries({ queryKey: [k] });
};

type Metodo = 'POST' | 'PUT' | 'DELETE';
/** uma ação qualquer da ficha ou da lista: caminho relativo a /alunos, método e corpo */
export function useAcaoAluno() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ caminho, method = 'POST', json }: { caminho: string; method?: Metodo; json?: unknown }) =>
      api<{ msg: string; id?: number; ir?: string; aviso?: boolean; horas?: number }>(`/alunos${caminho}`, {
        method,
        json: json ?? (method === 'DELETE' ? undefined : {}),
      }),
    onSuccess: () => invalidaAlunos(qc),
  });
}

export const previaAlocacao = (id: number, mid: number, json: { prof: string; dias: number[]; hora: number }) =>
  api<{ checagem: Checagem }>(`/alunos/${id}/matriculas/${mid}/alocacao/previa`, { method: 'POST', json });

/** arquivo escolhido → { nome, tipo, base64 } para o corpo JSON */
export const arquivoParaEnvio = (f: File) =>
  new Promise<{ nome: string; tipo: string; base64: string }>((ok, erro) => {
    const r = new FileReader();
    r.onload = () =>
      ok({ nome: f.name, tipo: f.type || 'application/octet-stream', base64: String(r.result).split(',')[1] ?? '' });
    r.onerror = () => erro(new Error(`Não foi possível ler ${f.name}.`));
    r.readAsDataURL(f);
  });

/** contrato da matrícula (adequação ao Portal Alumni): vigência, tipo, origem, oferta, ligada e congelamento */
export type ContratoMat = {
  inicio: string;
  fim: string;
  statusTipo: string;
  origem: string;
  ofertaId: string;
  vinculadaId: number | null;
  congelada: boolean;
};
export type ContratoResp = {
  contrato: ContratoMat;
  congeladaDesde: string | null;
  opcoes: {
    tipos: string[];
    origens: string[];
    ofertas: { v: string; l: string }[];
    vinculadas: { v: string; l: string }[];
  };
};
export const useContratoMatricula = (alunoId: number, mid: number | null, ativo: boolean) =>
  useQuery({
    queryKey: ['aluno-contrato', alunoId, mid],
    queryFn: () => api<ContratoResp>(`/alunos/${alunoId}/matriculas-contrato${mid ? `?mid=${mid}` : ''}`),
    enabled: ativo,
    gcTime: 0,
  });
