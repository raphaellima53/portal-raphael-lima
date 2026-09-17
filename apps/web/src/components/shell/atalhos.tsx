'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { Me } from '@/lib/tipos';
import { useUI } from '@/stores/ui';

/** Teclado global: / busca · ? ajuda · g+letra navega · [ minimiza o menu. */
export function Atalhos({ me }: { me: Me }) {
  const router = useRouter();
  useEffect(() => {
    let g = 0;
    const destino = (tecla: string) => {
      const menu = { i: 'inicio', a: 'agenda', l: 'alunos', p: 'professores', c: 'cursos', r: 'relatorios' }[tecla];
      return menu ? me.nav.find((n) => n.key === menu)?.href : undefined;
    };
    const tecla = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const digitando = !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (digitando || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '?') {
        e.preventDefault();
        useUI.getState().setAjuda(true);
        return;
      }
      if (e.key === '/') {
        const busca = document.querySelector<HTMLInputElement>('main input[type=search], main [data-busca]');
        if (busca) {
          e.preventDefault();
          busca.focus();
        }
        return;
      }
      if (e.key === '[') {
        useUI.getState().alternaMini();
        return;
      }
      if (e.key === 'g') {
        g = Date.now();
        return;
      }
      if (g && Date.now() - g < 1200) {
        g = 0;
        const href = destino(e.key.toLowerCase());
        if (href) {
          e.preventDefault();
          router.push(href);
        }
      }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [me, router]);
  return null;
}
