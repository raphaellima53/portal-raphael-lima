'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Estado de interface. Menu minimizado fica guardado no navegador (no portal: localStorage alumni.sbMini). */
type UI = {
  sbMini: boolean;
  alternaMini: () => void;
  gaveta: boolean;
  setGaveta: (on: boolean) => void;
  ajuda: boolean;
  setAjuda: (on: boolean) => void;
  alertas: boolean;
  setAlertas: (on: boolean) => void;
  /** visão secundária de quem também estuda: 'aluno' mostra a área do aluno no menu */
  visao: 'principal' | 'aluno';
  setVisao: (v: 'principal' | 'aluno') => void;
};

export const useUI = create<UI>()(
  persist(
    (set) => ({
      sbMini: false,
      alternaMini: () => set((s) => ({ sbMini: !s.sbMini, alertas: false })),
      gaveta: false,
      setGaveta: (gaveta) => set({ gaveta }),
      ajuda: false,
      setAjuda: (ajuda) => set({ ajuda }),
      alertas: false,
      setAlertas: (alertas) => set({ alertas }),
      visao: 'principal',
      setVisao: (visao) => set({ visao }),
    }),
    { name: 'portal.ui', partialize: (s) => ({ sbMini: s.sbMini, visao: s.visao }) },
  ),
);
