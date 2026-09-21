'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { itemDoCaminho } from '@/components/shell/sidebar';
import { useMe } from '@/lib/consultas';
import type { ItemNav } from '@/lib/tipos';
import { cn } from '@/lib/utils';

/**
 * Abas da página nos menus com seções (Ações, Relatórios, Configurações, Engenharia):
 * linha 1 = seções do menu; linha 2 = telas da seção, com o nome do grupo antes das telas agrupadas.
 */
export function SecaoAbas({ item, tela }: { item: ItemNav; tela: string }) {
  const secoes = item.secoes ?? [];
  const atual = secoes.find((s) => s.telas.some((t) => t.tela === tela)) ?? secoes[0];
  if (!atual) return null;
  const aba = (href: string, rotulo: string, on: boolean, sub = false) => (
    <Link
      key={href}
      href={href}
      role="tab"
      aria-selected={on}
      className={cn(
        'inline-flex h-11 shrink-0 items-center rounded-t-sm border-b-2 px-3.5 whitespace-nowrap transition-colors',
        on ? 'border-azul font-semibold text-azul' : 'border-transparent text-apagado hover:text-texto',
        sub && 'h-10',
      )}
    >
      {rotulo}
    </Link>
  );
  let grupo: string | null = null;
  return (
    <div className="mb-5">
      {secoes.length > 1 && (
        <div
          role="tablist"
          aria-label="Seções"
          className="flex gap-1 overflow-x-auto border-b border-borda [scrollbar-width:none]"
        >
          {secoes.map((s) => aba(s.telas[0].href, s.etapa, s === atual))}
        </div>
      )}
      {atual.telas.length > 1 && (
        <div
          role="tablist"
          aria-label={atual.etapa}
          className="mt-2 flex items-center gap-1 overflow-x-auto border-b border-borda [scrollbar-width:none]"
        >
          {atual.telas.map((t) => {
            const rot = t.pai && t.pai !== grupo ? t.pai : null;
            grupo = t.pai;
            return (
              <span key={t.id} className="contents">
                {rot && <span className="ml-3 shrink-0 pr-1 font-bold text-apagado-2 first:ml-0">{rot}</span>}
                {aba(t.href, t.label, t.tela === tela, true)}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Abas do menu nas telas de rota própria (Alunos, Professores, Empresas, Cursos, Auditoria): a tela diz onde está. */
export function AbasDoMenu() {
  const caminho = usePathname();
  const me = useMe();
  const item = itemDoCaminho(me.data?.nav ?? [], caminho);
  const tela = item?.secoes?.flatMap((s) => s.telas).find((t) => t.href.split('?')[0] === caminho);
  if (!item || !tela) return null;
  return <SecaoAbas item={item} tela={tela.tela} />;
}
