'use client';

import { create } from 'zustand';

/** Colunas escolhidas nos seletores, por perspectiva, enquanto a sessão estiver aberta (UI.rel do portal) */
type Colunas = {
  por: Record<string, string[]>;
  alterna: (pers: string, padrao: string[], k: string) => void;
};

export const useColunas = create<Colunas>()((set) => ({
  por: {},
  alterna: (pers, padrao, k) =>
    set((s) => {
      const l = [...(s.por[pers] ?? padrao)];
      const i = l.indexOf(k);
      if (i >= 0) {
        if (l.length > 1) l.splice(i, 1);
      } else l.push(k);
      return { por: { ...s.por, [pers]: l } };
    }),
}));
