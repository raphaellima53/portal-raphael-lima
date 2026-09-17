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
    }),
    { name: 'portal.ui', partialize: (s) => ({ sbMini: s.sbMini }) },
  ),
);
