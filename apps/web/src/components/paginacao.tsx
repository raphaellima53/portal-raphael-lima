'use client';

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useState } from 'react';
import { Escolha } from '@/components/escolha';
import { Button } from '@/components/ui/button';

/** Paginação do DS: toda tabela com mais de 10 itens. Devolve a fatia da página e o rodapé. */
export function usePaginacao<T>(itens: T[], tamInicial = 10) {
  const [pag, setPag] = useState(1);
  const [tam, setTam] = useState(tamInicial);
  const paginas = Math.max(1, Math.ceil(itens.length / tam));
  const atual = Math.min(pag, paginas);
  const ini = (atual - 1) * tam;
  const fatia = itens.length > 10 ? itens.slice(ini, ini + tam) : itens;
  const rodape =
    itens.length > 10 ? (
      <div className="flex flex-wrap items-center gap-3 border-t border-borda-suave px-5 py-3 text-apagado">
        <span>
          Mostrando {ini + 1}–{Math.min(ini + tam, itens.length)} de {itens.length.toLocaleString('pt-BR')}
        </span>
        <span className="flex-1" />
        <span>Por página</span>
        <Escolha
          rotulo="Itens por página"
          valor={String(tam)}
          destacar={false}
          aoMudar={(v) => {
            setTam(Number(v));
            setPag(1);
          }}
          opcoes={['10', '25', '50'].map((v) => ({ v, l: v }))}
          className="w-[84px]"
        />
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Página anterior"
            disabled={atual <= 1}
            onClick={() => setPag(atual - 1)}
          >
            <ChevronLeftIcon />
          </Button>
          <b className="px-1 text-texto-2">
            {atual} de {paginas}
          </b>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Próxima página"
            disabled={atual >= paginas}
            onClick={() => setPag(atual + 1)}
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
    ) : null;
  return { fatia, rodape, setPag };
}
