'use client';

import { CircleHelpIcon, MenuIcon, PanelLeftOpenIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { iconeDe } from '@/components/icones';
import { Dica } from '@/components/ui/tooltip';
import type { ItemNav, Me } from '@/lib/tipos';
import { cn } from '@/lib/utils';
import { useUI } from '@/stores/ui';
import { Alertas } from './alertas';
import { BotaoBarra } from './botao-barra';
import { Conta } from './conta';
import { Logo } from './logo';

/** item do menu acende na própria tela e nas telas e fichas que moram debaixo dele */
export function itemAtivo(item: ItemNav, caminho: string) {
  const base = item.href.split('?')[0];
  if (item.secoes) {
    const menu = base.split('/')[1];
    return caminho.startsWith(`/${menu}/`) || caminho === `/${menu}`;
  }
  if (base === '/inicio') return caminho === '/inicio';
  return caminho === base || caminho.startsWith(`${base}/`);
}

export function Sidebar({ me, mini }: { me: Me; mini: boolean }) {
  const caminho = usePathname();
  const alternaMini = useUI((s) => s.alternaMini);
  const setAjuda = useUI((s) => s.setAjuda);
  const setGaveta = useUI((s) => s.setGaveta);
  const ehAluno = me.usuario.ehAluno;

  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          'flex items-center gap-2.5',
          mini ? 'justify-center px-0 pt-[18px] pb-2.5' : 'px-[18px] pt-5 pb-3.5',
        )}
      >
        <Logo mini={mini} href={ehAluno ? '/minha-area' : '/inicio'} />
      </div>
      <nav
        aria-label="Menu principal"
        className={cn('min-h-0 flex-1 overflow-y-auto pt-1 pb-3', mini ? 'px-2.5' : 'px-3')}
      >
        <ul className="grid gap-0.5">
          {me.nav.map((item) => {
            const Icone = iconeDe(item.icon);
            const on = itemAtivo(item, caminho);
            const link = (
              <Link
                href={item.href}
                aria-current={on ? 'page' : undefined}
                onClick={() => setGaveta(false)}
                className={cn(
                  'flex min-h-[42px] items-center gap-[11px] rounded-md text-sb-texto transition-colors hover:bg-white/6 hover:text-white',
                  mini ? 'justify-center px-0 py-2.5' : 'px-3 py-[9px]',
                  on && 'bg-azul font-semibold text-white shadow-[0_6px_16px_-6px_rgba(26,79,214,.7)] hover:bg-azul',
                )}
              >
                <Icone className="size-4 shrink-0" strokeWidth={1.8} aria-hidden />
                <span className={cn(mini && 'sr-only')}>{item.label}</span>
              </Link>
            );
            return <li key={item.key}>{mini ? <Dica texto={item.label}>{link}</Dica> : link}</li>;
          })}
        </ul>
      </nav>
      <div className={cn('flex flex-col gap-0.5 border-t border-white/7 pt-2', mini ? 'mx-2.5' : 'mx-3')}>
        {!ehAluno ? <Alertas mini={mini} ativo /> : <AlertasAluno mini={mini} />}
        <BotaoBarra
          icone={mini ? PanelLeftOpenIcon : MenuIcon}
          texto={mini ? 'Expandir' : 'Minimizar'}
          mini={mini}
          aria-pressed={mini}
          aria-label={mini ? 'Expandir menu' : 'Minimizar menu'}
          onClick={alternaMini}
          className="max-lg:hidden"
        />
        <BotaoBarra
          icone={CircleHelpIcon}
          texto="Ajuda e atalhos"
          mini={mini}
          aria-haspopup="dialog"
          onClick={() => setAjuda(true)}
        />
      </div>
      <div className={cn('pt-3 pb-3', mini ? 'mx-2.5' : 'mx-3')}>
        <Conta me={me} mini={mini} />
      </div>
    </div>
  );
}

/** o aluno não tem alertas: o sino fica, e o painel diz que não há nada */
function AlertasAluno({ mini }: { mini: boolean }) {
  return <Alertas mini={mini} ativo={false} />;
}
