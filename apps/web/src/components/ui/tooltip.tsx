'use client';

import { Tooltip as TooltipPrimitive } from 'radix-ui';
import type * as React from 'react';

/** Tooltip só para dar nome a botão de ícone — explicação é texto visível (regra do portal). */
function Dica({
  texto,
  children,
  lado = 'right',
}: {
  texto: string;
  children: React.ReactNode;
  lado?: 'right' | 'top' | 'bottom' | 'left';
}) {
  return (
    <TooltipPrimitive.Root delayDuration={250}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={lado}
          sideOffset={10}
          className="z-50 rounded-sm bg-[#0f172a] px-2.5 py-1.5 text-sm font-medium text-white shadow-el-3 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0"
        >
          {texto}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

const DicaProvider = TooltipPrimitive.Provider;

export { Dica, DicaProvider };
