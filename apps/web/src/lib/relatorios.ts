'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { Tom } from './tipos';

type Opcao = { v: string; l: string };
export type Valor = string | number;

export type Relatorio = {
  k: string;
  t: string;
  pers: string;
  arquivo: string;
  periodo: boolean;
  agrupa: boolean;
  recorte: string;
  qualidade: Opcao[];
  qualRotulo: string;
  cols: { k: string; t: string; num: boolean }[];
  resumo: { v: string; t: string; tom?: Tom }[];
  linhas: { href: string | null; v: Record<string, Valor> }[];
  filtro: { dias: number; curso: string; grupo: 'curso' | 'item'; qual: string };
  periodos: Opcao[];
  cursos: string[];
};
export type Seletores = {
  perspectivas: Opcao[];
  filtro: { pers: string; qual: string; prod: string };
  dias: number;
  campos: { k: string; t: string; num: boolean }[];
  padrao: string[];
  qualidade: Opcao[];
  produtos: string[] | null;
  linhas: { href: string; v: Record<string, Valor> }[];
};
type Variacao = { pct: string; tom: Tom; vs: string } | null;
export type CobLinha = {
  key: string;
  pagador: string;
  curso: string;
  item: string;
  parcela: string;
  venc: string;
  valor: string;
  situacao: { t: string; tom: Tom };
  pago: boolean;
  href: string | null;
};
export type Financeiro = {
  meses: Opcao[];
  ym: string;
  curso: string;
  cursos: string[];
  mesCurto: string;
  recorte: string;
  kpis: { v: string; t: string; tom?: Tom; var?: Variacao; detalhe?: string }[];
  serie: {
    ym: string;
    rotulo: string;
    nome: string;
    receita: number;
    custo: number;
    receitaTxt: string;
    custoTxt: string;
    margem: string;
    negativa: boolean;
  }[];
  resumoMes: string;
  porCurso: {
    curso: string;
    href: string | null;
    valor: string;
    por: string;
    dadas: number;
    alunosAula: number;
    receita: string;
    custo: string;
    margem: string;
    negativa: boolean;
    margemPct: string;
    canc: number | string;
  }[];
  porProf: {
    prof: string;
    href: string | null;
    dadas: number;
    horas: string;
    valorHora: string;
    custo: string;
    daFolha: string;
  }[];
  parcelas: number;
  cobrancas: { vencidas: CobLinha[]; aVencer: CobLinha[]; pagas: CobLinha[] };
  podePagar: boolean;
};

const qs = (p: Record<string, string>) => {
  const e = Object.entries(p).filter(([, v]) => v !== '');
  return e.length ? `?${new URLSearchParams(e).toString()}` : '';
};

export const useRelatorio = (tela: string, p: Record<string, string>) =>
  useQuery({
    queryKey: ['relatorios', tela, p],
    queryFn: () => api<Relatorio>(`/relatorios/rp/${tela}${qs(p)}`),
    placeholderData: keepPreviousData,
  });
export const useSeletores = (p: Record<string, string>) =>
  useQuery({
    queryKey: ['relatorios', 'seletores', p],
    queryFn: () => api<Seletores>(`/relatorios/seletores${qs(p)}`),
    placeholderData: keepPreviousData,
  });
export const useFinanceiro = (p: Record<string, string>) =>
  useQuery({
    queryKey: ['relatorios', 'financeiro', p],
    queryFn: () => api<Financeiro>(`/relatorios/financeiro${qs(p)}`),
    placeholderData: keepPreviousData,
  });
export function usePagar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) =>
      api<{ msg: string }>('/relatorios/financeiro/pagar', { method: 'POST', json: { key } }),
    onSuccess: () => {
      for (const k of ['relatorios', 'acoes', 'alertas', 'aluno']) qc.invalidateQueries({ queryKey: [k] });
    },
  });
}

/** CSV com ; e BOM, que o Excel em pt-BR abre certo — mesmas linhas e colunas da tela */
export function baixaCsv(arquivo: string, cols: { k: string; t: string }[], linhas: Record<string, Valor>[]) {
  const cel = (v: Valor | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const texto = [
    cols.map((c) => cel(c.t)).join(';'),
    ...linhas.map((l) => cols.map((c) => cel(l[c.k])).join(';')),
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([String.fromCharCode(0xfeff) + texto], { type: 'text/csv;charset=utf-8' }));
  const el = document.createElement('a');
  el.href = url;
  el.download = `${arquivo}.csv`;
  el.click();
  URL.revokeObjectURL(url);
}
