'use client';

import { ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import { corTom, Stat, Trilho } from '@/components/ds';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHead, CardTitle } from '@/components/ui/card';
import type { BlocoDef, CorpoBloco, Linha, Seg } from '@/lib/tipos';
import { cn } from '@/lib/utils';

const Segs = ({ s }: { s?: Seg[] }) => (
  <>
    {(s ?? []).map((x, i) => (
      <span key={i} className={cn(x.tom && corTom[x.tom])} style={x.cor ? { color: x.cor } : undefined}>
        {x.t}
      </span>
    ))}
  </>
);

/** uma linha do bloco (dash-l): nome e valor, a linha de apoio e a barra; com link, a linha inteira abre a tela de origem */
function LinhaBloco({ l }: { l: Linha }) {
  const texto = l.nome.map((s) => s.t).join('');
  const conteudo = (
    <>
      <span className="min-w-0 truncate font-semibold text-texto group-hover:text-azul">
        <Segs s={l.nome} />
      </span>
      <span className="text-right font-semibold whitespace-nowrap text-texto-2">
        {l.valorBadge ? <Badge tom={l.valorBadge.tom}>{l.valorBadge.t}</Badge> : l.valor}
      </span>
      {l.sub?.length ? (
        <span className="col-span-2 min-w-0 text-apagado">
          <Segs s={l.sub} />
        </span>
      ) : null}
      {l.barra ? <Trilho className="col-span-2" pct={l.barra.pct} cor={l.barra.cor} rotulo={texto} /> : null}
    </>
  );
  const cls =
    'group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-[3px] border-b border-borda-suave py-2 last:border-b-0';
  return l.href ? (
    <Link href={l.href} className={cls}>
      {conteudo}
    </Link>
  ) : (
    <div className={cls}>{conteudo}</div>
  );
}

export function CorpoDoBloco({ c }: { c: CorpoBloco }) {
  return (
    <>
      {c.kpis?.length ? (
        <div className="flex flex-wrap gap-x-6 gap-y-1.5 border-b border-borda-suave pt-1.5 pb-2.5">
          {c.kpis.map((k, i) => (
            <div key={i} className="flex items-baseline gap-1.5 text-apagado">
              {k.ponto ? <i className="size-2 self-center rounded-full" style={{ background: k.ponto }} /> : null}
              <b className={cn('text-xl font-bold text-texto', k.tom && corTom[k.tom])}>{k.valor}</b>
              <span>{k.rotulo}</span>
            </div>
          ))}
        </div>
      ) : null}
      {c.linhas?.map((l, i) => (
        <LinhaBloco key={i} l={l} />
      ))}
      {c.vazio ? <div className="py-[18px] text-center text-apagado-2">{c.vazio}</div> : null}
      {c.pe ? <div className="pt-2 text-apagado-2">{c.pe}</div> : null}
    </>
  );
}

/** Bloco do Dashboard: todas as caixas com a mesma altura e o conteúdo rolando por dentro (pedido de 17/09/2026). */
export function Bloco({ b }: { b: BlocoDef & { corpo: CorpoBloco } }) {
  if (b.semCard) {
    return (
      <div className="col-span-full grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5" data-k={b.k}>
        {(b.corpo.stats ?? []).map((s) => (
          <Stat key={s.rotulo} valor={s.valor} rotulo={s.rotulo} tom={s.tom} />
        ))}
      </div>
    );
  }
  return (
    <Card className="flex h-[400px] flex-col overflow-hidden sm:h-[var(--dash-caixa-h)]" data-k={b.k}>
      <CardHead className="shrink-0">
        <CardTitle>{b.t}</CardTitle>
        <span className="flex-1" />
        {b.abrir ? (
          <Button asChild variant="ghost" size="sm">
            <Link href={b.abrir.href}>
              {b.abrir.rotulo} <ChevronRightIcon />
            </Link>
          </Button>
        ) : null}
      </CardHead>
      <p className="mx-[18px] mt-2.5 shrink-0 leading-[1.4] text-apagado">{b.d}</p>
      <section
        // biome-ignore lint/a11y/noNoninteractiveTabindex: região com rolagem precisa receber foco pelo teclado
        tabIndex={0}
        aria-label={`${b.t}, conteúdo com rolagem`}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-1.5 pb-3.5 [scrollbar-gutter:stable] focus-visible:outline-offset-[-2px]"
      >
        <CorpoDoBloco c={b.corpo} />
      </section>
    </Card>
  );
}
