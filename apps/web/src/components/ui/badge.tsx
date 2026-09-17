import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-sm font-semibold leading-none',
  {
    variants: {
      tom: {
        gray: 'bg-cinza-suave text-cinza',
        green: 'bg-verde-suave text-verde',
        amber: 'bg-ambar-suave text-ambar',
        red: 'bg-vermelho-suave text-vermelho',
        blue: 'bg-azul-suave text-azul',
        purple: 'bg-roxo-suave text-roxo',
      },
    },
    defaultVariants: { tom: 'gray' },
  },
);

function Badge({ className, tom, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ tom }), className)} {...props} />;
}

export { Badge, badgeVariants };
