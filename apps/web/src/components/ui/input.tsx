import type * as React from 'react';
import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-10 w-full min-w-0 rounded-md border border-borda-forte bg-card px-3 text-sm text-texto transition-[border-color,box-shadow] duration-150 placeholder:text-apagado-2 hover:border-[#b7c1d1] focus:border-azul focus:shadow-anel focus-visible:outline-none aria-invalid:border-vermelho aria-invalid:shadow-[0_0_0_3px_rgba(196,40,53,.14)] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
