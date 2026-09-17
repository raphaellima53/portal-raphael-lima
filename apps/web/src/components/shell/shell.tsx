'use client';

import { BellIcon, MenuIcon, XIcon } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import type * as React from 'react';
import { useEffect, useSyncExternalStore } from 'react';
import { ErroApi } from '@/lib/api';
import { useMe } from '@/lib/consultas';
import { cn } from '@/lib/utils';
import { useUI } from '@/stores/ui';
import { Ajuda } from './ajuda';
import { Atalhos } from './atalhos';
import { FaixaComoAluno } from './como-aluno';
import { Logo } from './logo';
import { Sidebar } from './sidebar';

/**
 * Casca do portal: barra lateral flutuante (desktop), gaveta com barra no topo (mobile e tablet),
 * guarda de sessão e o conteúdo da tela.
 */
export function Shell({ children }: { children: React.ReactNode }) {
  const me = useMe();
  const router = useRouter();
  const caminho = usePathname();
  const mini = useUI((s) => s.sbMini);
  const gaveta = useUI((s) => s.gaveta);
  const setGaveta = useUI((s) => s.setGaveta);
  const desktop = useDesktop();

  useEffect(() => {
    if (me.error instanceof ErroApi && me.error.status === 401)
      router.replace(`/login?volta=${encodeURIComponent(caminho)}`);
  }, [me.error, router, caminho]);

  useEffect(() => {
    if (!gaveta) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setGaveta(false);
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [gaveta, setGaveta]);

  if (!me.data) {
    return (
      <div className="grid min-h-dvh place-items-center text-apagado" role="status">
        {me.isError && !(me.error instanceof ErroApi && me.error.status === 401)
          ? 'Não foi possível falar com a API.'
          : 'Carregando…'}
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <a
        href="#conteudo"
        className="sr-only rounded-md bg-azul px-4 py-2.5 font-semibold text-white shadow-el-3 focus:not-sr-only focus:fixed focus:top-3 focus:left-4 focus:z-[400]"
      >
        Pular para o conteúdo
      </a>
      <Atalhos me={me.data} />
      <Ajuda />

      {/* barra do topo: só mobile e tablet */}
      <header
        className="sticky top-0 z-30 flex h-[60px] items-center gap-3 border-b border-borda bg-card px-3 lg:hidden"
        style={{ top: 'env(safe-area-inset-top, 0px)' }}
      >
        <button
          type="button"
          aria-label={gaveta ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={gaveta}
          aria-controls="menu-lateral"
          onClick={() => setGaveta(!gaveta)}
          className="grid size-10 cursor-pointer place-items-center rounded-md text-texto-2 hover:bg-hover"
        >
          {gaveta ? <XIcon className="size-5" /> : <MenuIcon className="size-5" />}
        </button>
        <Logo escuro={false} href={me.data.usuario.ehAluno ? '/minha-area' : '/inicio'} />
        <span className="flex-1" />
        {!me.data.usuario.ehAluno && (
          <button
            type="button"
            aria-label="Alertas"
            onClick={() => {
              setGaveta(true);
              useUI.getState().setAlertas(true);
            }}
            className="grid size-10 cursor-pointer place-items-center rounded-md text-texto-2 hover:bg-hover"
          >
            <BellIcon className="size-5" />
          </button>
        )}
      </header>

      {gaveta && (
        <div
          className="fixed inset-0 z-40 bg-[rgba(10,16,35,.45)] lg:hidden"
          aria-hidden
          onClick={() => setGaveta(false)}
        />
      )}

      <aside
        id="menu-lateral"
        aria-label="Barra lateral"
        className={cn(
          'sidebar-fundo fixed top-2.5 bottom-2.5 left-2.5 z-50 overflow-hidden rounded-xl transition-[width,transform] duration-200',
          mini ? 'lg:w-[72px]' : 'lg:w-[258px]',
          'w-[min(300px,86vw)]',
          gaveta ? 'translate-x-0' : 'max-lg:-translate-x-[calc(100%+20px)]',
        )}
        inert={!gaveta && !desktop ? true : undefined}
      >
        <Sidebar me={me.data} mini={mini && desktop} />
      </aside>

      <main
        id="conteudo"
        tabIndex={-1}
        className={cn(
          'min-w-0 px-4 pt-5 pb-8 transition-[padding] duration-200 sm:px-5 lg:pt-8 lg:pr-[51px] lg:pb-[18px]',
          mini ? 'lg:pl-[110px]' : 'lg:pl-[296px]',
        )}
      >
        <FaixaComoAluno me={me.data} />
        {children}
      </main>
    </div>
  );
}

const mq = () => window.matchMedia('(min-width: 1024px)');
/** desktop = 1024px ou mais: a barra lateral fica fixa; abaixo disso vira gaveta */
function useDesktop() {
  return useSyncExternalStore(
    (cb) => {
      const m = mq();
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => mq().matches,
    () => true,
  );
}
