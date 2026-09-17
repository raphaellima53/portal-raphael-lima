'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export type Auditoria = {
  linhas: {
    quando: string;
    quem: string;
    ent: string;
    acao: string;
    reg: string;
    href: string | null;
    det: string;
    vivo: boolean;
  }[];
  total: number;
  limite: number | null;
  vivos: number;
  entidades: string[];
  autores: string[];
};

export const useAuditoria = () => useQuery({ queryKey: ['auditoria'], queryFn: () => api<Auditoria>('/auditoria') });
