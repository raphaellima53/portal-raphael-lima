'use client';

import { AlertTriangleIcon, XIcon } from 'lucide-react';
import type * as React from 'react';
import { Fragment } from 'react';
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export type GrupoAlerta = { titulo?: string; itens: React.ReactNode[] };

/**
 * Alerta da tela como ícone (pedido do usuário, 30/09/2026: "os alertas devem ser um ícone, não um bloco de texto").
 * Triângulo âmbar com o total; clicar abre o detalhe agrupado e, se houver, a ação que resolve.
 */
export function AlertaIcone({
  titulo,
  grupos,
  nota,
  acao,
}: {
  titulo: string;
  grupos: GrupoAlerta[];
  nota?: React.ReactNode;
  acao?: { rotulo: string; aoClicar: () => void };
}) {
  const n = grupos.reduce((s, g) => s + g.itens.length, 0);
  if (!n) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${titulo}: ${n}`}
          title={titulo}
          className="relative inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-[#f1d9a6] bg-ambar-suave text-ambar align-middle hover:brightness-95 focus-visible:outline-2 focus-visible:outline-azul"
        >
          <AlertTriangleIcon className="size-[18px]" aria-hidden />
          <span className="-top-1.5 -right-1.5 absolute h-5 min-w-5 rounded-full bg-ambar px-1 text-center font-bold text-sm text-white leading-5">
            {n > 99 ? '99+' : n}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="flex max-h-[min(480px,calc(100dvh-40px))] w-[380px] max-w-[calc(100vw-32px)] flex-col text-sm"
      >
        <div className="flex items-center gap-2.5 border-borda-suave border-b py-2.5 pr-2 pl-3.5">
          <AlertTriangleIcon className="size-4 shrink-0 text-ambar" aria-hidden />
          <b className="flex-1 text-texto">
            {n} {titulo.toLowerCase()}
          </b>
          <PopoverClose
            aria-label="Fechar"
            className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-apagado hover:bg-hover hover:text-texto"
          >
            <XIcon className="size-4" />
          </PopoverClose>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-3.5 py-2.5">
          {grupos
            .filter((g) => g.itens.length)
            .map((g, i) => (
              <div key={g.titulo ?? String(i)} className="mb-2.5 last:mb-0">
                {g.titulo && (
                  <div className="mb-0.5 font-semibold text-texto">
                    {g.titulo} <span className="font-normal text-apagado">· {g.itens.length}</span>
                  </div>
                )}
                <p className="text-texto-2">
                  {g.itens.map((x, j) => (
                    <Fragment key={j}>
                      {j > 0 && ', '}
                      {x}
                    </Fragment>
                  ))}
                </p>
              </div>
            ))}
        </div>
        {(nota || acao) && (
          <div className="flex flex-wrap items-center gap-2 border-borda-suave border-t px-3.5 py-2.5">
            {nota && <span className="flex-1 text-apagado">{nota}</span>}
            {acao && (
              <PopoverClose asChild>
                <button
                  type="button"
                  className="cursor-pointer font-semibold text-azul hover:underline"
                  onClick={acao.aoClicar}
                >
                  {acao.rotulo}
                </button>
              </PopoverClose>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
