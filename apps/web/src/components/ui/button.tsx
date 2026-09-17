import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type * as React from 'react';
import { cn } from '@/lib/utils';

/* botão do DS: 40px (36px no sm), raio 10, sombra el-1 e hover com profundidade */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border text-sm font-medium transition-[background,box-shadow,transform,border-color,color] duration-150 disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 focus-visible:outline-2 focus-visible:outline-azul focus-visible:outline-offset-2 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          'border-borda bg-card text-texto-2 shadow-el-1 hover:border-borda-forte hover:shadow-el-2 hover:text-texto',
        primary:
          'border-azul bg-azul font-semibold text-white shadow-el-1 hover:border-azul-escuro hover:bg-azul-escuro hover:shadow-[0_6px_16px_-6px_rgba(26,79,214,.55)]',
        ghost: 'border-transparent bg-transparent text-apagado shadow-none hover:bg-bg hover:text-texto',
        perigo: 'border-vermelho bg-vermelho text-white hover:bg-[#a81f2b]',
        link: 'border-transparent bg-transparent p-0 text-azul shadow-none hover:underline h-auto',
      },
      size: {
        default: 'h-10 px-4',
        sm: 'h-9 px-3',
        icon: 'size-10 p-0',
        'icon-sm': 'size-9 p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'button';
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
