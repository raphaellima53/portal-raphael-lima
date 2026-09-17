'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { Tom } from './tipos';

export type Vista = 'mensal' | 'semanal' | 'diaria' | 'kanban';
export type Filtros = { aluno: string; prof: string; prod: string; mod: string; tipo: string; qual: string };
export const FILTROS_VAZIOS: Filtros = { aluno: '', prof: '', prod: '', mod: '', tipo: '', qual: '' };

export type AulaItem = {
  k: string;
  iso: string;
  hora: number;
  quando: string;
  rotulo: string;
  cor: string;
  prod: string;
  mod: string | null;
  quem: string;
  prof: string;
  sub: string | null;
  sala: string;
  n: number;
  vagas: number;
  estado: string;
};
export type EventoItem = {
  id: string;
  tipo: string;
  titulo: string;
  iso: string;
  hora: number;
  ini: string;
  fim: string;
  nPart: number;
  pessoas: string;
  local: string;
};
export type Dia = { iso: string; dia: number; dow: number; rot: string; feriado: boolean; hoje: boolean };
export type OpcoesAgenda =
  | { soAluno: true; cursosDoAluno: string[] }
  | {
      soAluno: false;
      presa: Record<string, string> | null;
      alunos: string[];
      colaboradores: string[];
      prestadores: string[];
      produtos: string[];
      modulos: string[];
    };
export type AgendaResp = {
  vista: Vista;
  ref: string;
  hoje: string;
  horaAgora: number;
  periodo: string;
  filtros: Filtros;
  titulo: string;
  sub: string;
  dias?: Dia[];
  regua?: number[];
  aulas?: AulaItem[];
  eventos?: EventoItem[];
  vazio?: string | null;
  diaSemana?: string;
  colunas?: { k: string; rot: string; cor: string; desc: string; aulas: AulaItem[] }[];
  qualidades?: { k: string; l: string }[];
  periodos?: { k: string; l: string }[];
  opcoes: OpcoesAgenda;
  podeCriarEvento: boolean;
  podeMassa: boolean;
};

export type Layout = { agF: Filtros; vista: Vista; periodo: string };

export type AulaModelo = {
  k: string;
  rot: string;
  estado: string;
  est: [string, Tom];
  tipo: string;
  prod: string;
  mod: string | null;
  modRot: string | null;
  corCurso: string;
  trava: string;
  titulo: string;
  rotulo: string;
  dataTxt: string;
  horario: string;
  iso: string;
  prof: string;
  sub: string | null;
  podeAlterarProf: boolean;
  profsHabilitados: string[];
  sala: { zoom: boolean; nome: string; url: string };
  ehAluno: boolean;
  materiais: { pre: string; in: string; post: string };
  gravacao: string;
  n: number;
  alunos: { nome: string; email: string; fora: boolean }[];
  extra: number;
  podeGerenciar: boolean;
  cancelada: boolean;
  podeCancelar: boolean;
  podeReabrir: boolean;
  folha: null | {
    ve: boolean;
    valor: number | null;
    valorTxt: string | null;
    valorBase: number | null;
    origem: string;
    alterado: boolean;
    valorMotivo: string;
    sit: [string, Tom];
    suporte: { motivo: string; detalhe: string } | null;
    fechada: boolean;
    podeValor: boolean;
    podeSuporte: boolean;
    podeTirarSuporte: boolean;
    motivos: string[];
  };
  pagina: {
    concluida: boolean;
    iniciada: boolean;
    podePresenca: boolean;
    marcados: number;
    aviso: string;
    lista: { nome: string; email: string; p: 'presente' | 'falta' | 'pendente' | null }[];
    semCadastro: number;
  };
  apresentacao: {
    est: [string, Tom];
    podeOperar: boolean;
    podeConteudo: boolean;
    podeNotas: boolean;
    trava: string;
    slides: Slide[];
    curriculo: string;
    conteudoAtual: string;
    conteudos: { grupo: string; itens: { v: string; l: string }[] }[];
    zoom: {
      aberta: boolean;
      minutos: number | null;
      durou: number | null;
      gravando: boolean;
      gravou: boolean;
      enviado: string | null;
    };
    emAulaHa: number | null;
    presentes: number;
    notas: string;
  };
};
export type Slide =
  | { k: 'capa'; rot: string; titulo: string; sub: string; meta: string }
  | { k: 'aq' | 'pr' | 'fim'; rot: string; texto: string }
  | { k: 'voc'; rot: string; palavras: { w: string; classe: string }[]; texto: string }
  | { k: 'gram'; rot: string; titulo: string; texto: string }
  | { k: 'mat'; rot: string; titulo: string; url: string };

export type EventoDetalhe = {
  id: string;
  tipo: string;
  titulo: string;
  desc: string;
  local: string;
  link: boolean;
  data: string;
  ini: string;
  fim: string;
  dataTxt: string;
  part: { g: 'colaborador' | 'prestador' | 'aluno'; n: string; grupo: string }[];
  por: string;
  choques: string[];
  podeEditar: boolean;
  podeExcluir: boolean;
};

export type AcaoAula =
  | { acao: 'professor'; prof: string }
  | { acao: 'cancelar' | 'reabrir' | 'todosPresentes' | 'iniciar' | 'valorVoltar' | 'suporteTirar' }
  | { acao: 'zoomAbrir' | 'zoomGravar' | 'zoomEnviar' | 'zoomEncerrar' }
  | { acao: 'concluir'; apresentacao?: boolean }
  | { acao: 'agendamento'; aluno: string }
  | { acao: 'presenca'; aluno: string; valor: 'presente' | 'falta' }
  | { acao: 'valor'; valor: number; motivo: string }
  | { acao: 'suporte'; motivo: string; detalhe: string }
  | { acao: 'conteudo'; conteudo: string }
  | { acao: 'notas'; texto: string };

const qs = (p: Record<string, string | undefined>) =>
  new URLSearchParams(Object.entries(p).filter((e): e is [string, string] => !!e[1])).toString();

export const useAgenda = (p: { vista: Vista; data?: string; periodo?: string; minha?: boolean } & Partial<Filtros>) =>
  useQuery({
    queryKey: ['agenda', p],
    queryFn: () =>
      api<AgendaResp>(
        `/agenda?${qs({ ...p, minha: p.minha ? '1' : undefined } as Record<string, string | undefined>)}`,
      ),
    placeholderData: keepPreviousData,
  });

export const useLayoutAgenda = (ativo: boolean) =>
  useQuery({
    queryKey: ['agenda-layout'],
    queryFn: () => api<{ salvo: Layout | null }>('/agenda/layout'),
    enabled: ativo,
    staleTime: 5 * 60_000,
  });

export function useSalvarLayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (l: Layout | null): Promise<{ salvo: Layout | null }> =>
      l
        ? api<{ salvo: Layout }>('/agenda/layout', { method: 'PUT', json: l })
        : api<{ salvo: null }>('/agenda/layout', { method: 'DELETE' }),
    onSuccess: (r) => qc.setQueryData(['agenda-layout'], r),
  });
}

export const useAula = (k: string | null) =>
  useQuery({
    queryKey: ['aula', k],
    queryFn: () => api<AulaModelo>(`/aulas/detalhe?k=${encodeURIComponent(k!)}`),
    enabled: !!k,
  });

/** ações na aula: ao terminar, a agenda, a aula, o dashboard e os alertas são relidos */
export function useAcaoAula(k: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: AcaoAula) => api<{ msg: string }>('/aulas/acao', { method: 'POST', json: { k, ...a } }),
    onSuccess: () => {
      for (const key of ['aula', 'agenda', 'dashboard', 'alertas', 'historico-aulas'])
        qc.invalidateQueries({ queryKey: [key] });
    },
  });
}

export const useEvento = (id: string | null) =>
  useQuery({
    queryKey: ['evento', id],
    queryFn: () => api<EventoDetalhe>(`/eventos/${encodeURIComponent(id!)}`),
    enabled: !!id,
  });

export const usePessoasEvento = (ativo: boolean) =>
  useQuery({
    queryKey: ['eventos-pessoas'],
    queryFn: () =>
      api<{ grupos: { g: 'colaborador' | 'prestador' | 'aluno'; rot: string; pessoas: string[] }[] }>(
        '/eventos/pessoas',
      ),
    enabled: ativo,
    staleTime: 5 * 60_000,
  });

export type EventoForm = {
  tipo: 'Reunião' | 'Evento';
  titulo: string;
  data: string;
  ini: string;
  fim: string;
  local: string;
  desc: string;
  part: { g: 'colaborador' | 'prestador' | 'aluno'; n: string }[];
  confirmar: boolean;
};

export function useSalvarEvento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...d }: EventoForm & { id: string | null }) =>
      api<{ id: string; data: string; msg: string }>(id ? `/eventos/${encodeURIComponent(id)}` : '/eventos', {
        method: id ? 'PUT' : 'POST',
        json: d,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agenda'] });
      qc.invalidateQueries({ queryKey: ['evento'] });
    },
  });
}

export function useExcluirEvento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ msg: string }>(`/eventos/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agenda'] }),
  });
}

export function useZoomDia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: string) => api<{ msg: string }>('/agenda/zoom-dia', { method: 'POST', json: { data } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['aula'] }),
  });
}

export const usePreviaMassa = (ks: string[] | null) =>
  useQuery({
    queryKey: ['massa', ks],
    queryFn: () =>
      api<{ aulas: { k: string; rot: string; prof: string }[]; futuras: number; profs: string[] }>(
        '/agenda/massa/previa',
        {
          method: 'POST',
          json: { ks },
        },
      ),
    enabled: !!ks?.length,
  });

export function useMassa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: { ks: string[]; acao: string; prof?: string }) =>
      api<{ msg: string }>('/agenda/massa', { method: 'POST', json: d }),
    onSuccess: () => {
      for (const key of ['agenda', 'aula', 'dashboard', 'alertas']) qc.invalidateQueries({ queryKey: [key] });
    },
  });
}

export type Historico = {
  dias: number;
  stats: { aulas: number; presencas: number; faltas: number; pct: number | null; canceladas: number };
  aulas: {
    k: string;
    data: string;
    horario: string;
    rotulo: string;
    cor: string;
    prod: string;
    prof: string;
    sub: string | null;
    estado: string;
    estadoTag: [string, Tom];
    presenca: 'presente' | 'falta' | 'pendente' | null;
  }[];
};
export const useHistoricoAulas = (dias: number) =>
  useQuery({
    queryKey: ['historico-aulas', dias],
    queryFn: () => api<Historico>(`/historico-de-aulas?dias=${dias}`),
    placeholderData: keepPreviousData,
  });

/* ---- datas AAAA-MM-DD sem fuso ---- */
const paraUTC = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const deUTC = (d: Date) => d.toISOString().slice(0, 10);
export const somaDias = (iso: string, n: number) => {
  const d = paraUTC(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return deUTC(d);
};
export const somaMeses = (iso: string, n: number) => {
  const d = paraUTC(iso);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  return deUTC(d);
};
/** anterior/próximo andam no passo da visão aberta */
export function passo(vista: Vista, periodo: string, ref: string, dir: number) {
  if (vista === 'mensal' || (vista === 'kanban' && periodo === 'mes')) return somaMeses(ref, dir);
  if (vista === 'diaria' || (vista === 'kanban' && periodo === 'hoje')) return somaDias(ref, dir);
  return somaDias(ref, 7 * dir);
}
