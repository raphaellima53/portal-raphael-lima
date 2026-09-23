'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { PessoaExtra } from './cadastros';
import type { Tom } from './tipos';

export type Stat = { v: number | string; t: string; tom?: Tom };
export type Opcao = { v: string; l: string };

export type Usuarios = {
  linhas: {
    id: number;
    nome: string;
    email: string;
    perfil: string;
    perfilTom: Tom;
    resumo: string;
    mfa: boolean;
    ultimo: string;
    nunca: boolean;
    sem30: boolean;
    status: string;
    statusTom: Tom;
    persona: string | null;
    eu: boolean;
  }[];
  stats: Stat[];
  perfis: string[];
  status: string[];
};
export type Setores = Record<string, 'total' | 'restrito'>;
export type UsuarioForm = {
  perfis: {
    id: number;
    nome: string;
    tipo: string;
    cargo: string;
    area: string;
    hierarquia: string;
    sugestao: { nivel: number; setores: Setores } | null;
  }[];
  niveis: { n: number; nome: string; acoes: (number | null)[] }[];
  acoes: string[];
  pessoas: { nome: string; email: string; tipo: string; usuario: string | null }[];
  colaboradores: string[];
  /** um ID, vários perfis: alunos e professores que o usuário pode representar */
  alunos: { id: number; nome: string; usuario: string | null }[];
  professores: string[];
  responsaveis: string[];
  seguranca: { k: string; t: string; padrao: boolean }[];
  usuario: {
    id: number;
    nome: string;
    email: string;
    perfilId: number | null;
    nivel: number;
    setores: Setores;
    pessoa: string;
    colaborador: string;
    alunoId: number | null;
    professor: string;
    telefone: string;
    validoAte: string;
    responsavel: string;
    justificativa: string;
    observacoes: string;
    foto: string;
    trocarSenha: boolean;
    seguranca: Record<string, boolean>;
    eu: boolean;
  } | null;
};
export type Previa = {
  aluno: boolean;
  setores: {
    id: string;
    nome: string;
    acesso: '' | 'total' | 'restrito';
    rotulo: string;
    total: string | null;
    recorte: { nome: string; desc: string; telas: string[] } | null;
  }[];
  configuracoes: boolean;
  telas: number | null;
  resumo: string | null;
};
export type Perfis = {
  modelo: [string, string, string][];
  acoes: string[];
  areas: string[];
  perfis: { idCargo: number | null; perfil: string; cargo: string; area: string; hierarquia: string; ativo: boolean }[];
  niveis: { nome: string; acoes: (number | null)[] }[];
  edicao: PerfisEdicao;
  cargos: { cargo: string; nivel: string; acoes: (number | null)[] }[];
  setores: { cargo: string; nivel: string; areas: ({ acesso: string; rotulo: string } | null)[] }[];
  telas: { label: string; menu: string; areas: boolean[] }[];
  recortes: { titulo: string; padrao: boolean; texto: string }[];
};
export type AcessoSetor = { acesso: 'total' | 'restrito'; rotulo: string };
export type PerfilEd = {
  id: number;
  tipo: string;
  cargo: string;
  idCargo: number | null;
  area: string;
  nivel: number;
  areas: Record<string, AcessoSetor>;
  resumo: string;
  ativo: boolean;
  sistema: string | null;
  travado: boolean;
  usuarios: number;
};
export type NivelEd = { n: number; nome: string; acoes: (number | null)[]; nota: string };
export type PerfisEdicao = {
  personalizado: boolean;
  salvoEm: string | null;
  perfis: PerfilEd[];
  niveis: NivelEd[];
  setores: { id: string; nome: string; recortes: { v: string; l: string; desc: string }[] }[];
};
export type Sessoes = {
  ativas: { id: string; nome: string; estaSessao: boolean; dispositivo: string; origem: string; ultima: string }[];
  politicas: { k: string; t: string; d: string; on: boolean }[];
  historico: {
    id: number;
    quando: string;
    quem: string;
    evento: string;
    resultado: string;
    tom: Tom;
    detalhe: string;
  }[];
};
export type Personas = {
  stats: Stat[];
  linhas: {
    letra: string;
    tipo: string;
    cursos: string[];
    modulos: string[];
    objetivo: string;
    nome: string;
    login: string;
    senha: string;
    resumo: string;
    ativo: boolean;
  }[];
};
export type Colaboradores = {
  linhas: ({
    id: number;
    nome: string;
    email: string;
    departamento: string;
    cargo: string;
    ativo: boolean;
    cpf: string;
    admissao: string;
    /** 24/09/2026: Colaborador ou Prestador (com CNPJ) */
    vinculo: 'Colaborador' | 'Prestador';
    cnpj: string;
  } & PessoaExtra)[];
  cargos: { nome: string; departamento: string }[];
};
export type Prestadores = {
  linhas: {
    id: string;
    nome: string;
    email: string;
    cursos: { nome: string; cor: string }[];
    aulas: number;
    teto: number;
    ativo: boolean;
    href: string;
  }[];
};
export type Catalogo = {
  k: string;
  t: string;
  um: string;
  novo: string;
  linhas: {
    id: number;
    nome: string;
    descricao: string;
    departamento: string;
    formato: string;
    ativo: boolean;
    uso: number;
    pessoas: number;
    dados?: Record<string, string | boolean>;
  }[];
  departamentos: string[];
  formatos: string[];
  /** campos a mais do catálogo (atributos do tipo de curso, categoria da skill) */
  extras: { k: string; rotulo: string; tipo: 'sim' | 'texto' | 'escolha'; opcoes?: string[]; ajuda?: string }[];
};
export type Salas = {
  linhas: {
    id: number;
    nome: string;
    atende: string;
    cor: string | null;
    tipo: string;
    zoom: boolean;
    ativo: boolean;
    zoomEmail: string;
    zoomLicencaAte: string;
  }[];
  tipos: string[];
  alvos: Opcao[];
};
export type Feriados = {
  ano: number;
  anos: string[];
  nacionais: boolean;
  linhas: { id: number; data: string; dia: string; nome: string; origem: string }[];
};
export type Dias = { linhas: { dia: number; nome: string; aberto: boolean; inicio: string; fim: string }[] };
export type CampoPol =
  | { k: string; t: string; tipo: 'texto'; padrao: string; req?: boolean }
  | { k: string; t: string; tipo: 'radio'; ops: string[]; padrao: string }
  | { k: string; t: string; tipo: 'chave'; d: string; padrao: boolean };
export type Politicas = {
  secoes: { n: number; t: string; d: string; campos: CampoPol[] }[];
  valores: Record<string, string | boolean>;
};
export type Alertas = {
  padrao: { k: string; icone: string; t: string; d: string; on: boolean }[];
  pers: { id: string; nome: string; desc: string; on: boolean }[];
  gatilhos: Opcao[];
  para: string[];
  canais: string[];
};
export type Painel = {
  stats: [string, string, string][];
  dominios: [string, number, number, number, string][];
  prontidao: [string, number, string][];
  alteracoes: [string, string, string, string, string, string][];
};
export type Execucoes = {
  linhas: {
    i: number;
    quando: string;
    ator: string;
    verbo: string;
    alvo: string;
    resultado: string;
    tom: Tom;
    critica: string;
    payload: Record<string, unknown>;
  }[];
};
export type Curriculos = {
  linhas: {
    id: string;
    nome: string;
    grupo: string;
    tipo: string;
    cor: string | null;
    aplicado: string;
    publicada: string | null;
    rascunho: string | null;
    conteudos: number;
    semLink: number;
    publicadaEm: string | null;
  }[];
};
export type Telas = {
  areas: string[];
  linhas: {
    id: string;
    label: string;
    area: string;
    caminho: string;
    sit: 'ok' | 'con';
    tipo: string;
    mostra: string;
    acoes: string[];
    det: { t: string; d: string }[];
    vai: string[];
    sub: string[];
    href: string;
  }[];
};

/** leitura de uma tela de Configurações */
export const useCfg = <T>(caminho: string, ligado = true) =>
  useQuery({
    queryKey: ['config', caminho],
    queryFn: () => api<T>(`/config${caminho}`),
    enabled: ligado,
    placeholderData: keepPreviousData,
  });

/** toda escrita de Configurações: devolve a mensagem e recarrega o que depende dela */
export function useAcaoCfg() {
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
      api<{ msg: string; id?: number; ir?: string; ano?: number }>(`/config${caminho}`, { method, json: json ?? {} }),
    onSuccess: () => {
      for (const k of ['config', 'agenda', 'cursos', 'curso', 'professores', 'auditoria', 'me', 'alertas'])
        qc.invalidateQueries({ queryKey: [k] });
    },
  });
}

export const usePrevia = (json: { perfilId: number | null; nivel: number; setores: Setores }, ligado: boolean) =>
  useQuery({
    queryKey: ['config', 'previa', json],
    queryFn: () => api<Previa>('/config/usuarios/previa', { method: 'POST', json }),
    enabled: ligado,
    placeholderData: keepPreviousData,
  });
