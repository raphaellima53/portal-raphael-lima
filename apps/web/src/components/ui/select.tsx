'use client';

import { CheckIcon, ChevronDownIcon } from 'lucide-react';
import { Select as S } from 'radix-ui';
import type * as React from 'react';
import { cn } from '@/lib/utils';

const Select = S.Root;
const SelectGroup = S.Group;
const SelectValue = S.Value;

function SelectTrigger({
  className,
  children,
  ativo,
  ...props
}: React.ComponentProps<typeof S.Trigger> & { ativo?: boolean }) {
  return (
    <S.Trigger
      data-slot="select-trigger"
      className={cn(
        'flex h-10 w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-md border border-borda-forte bg-card px-3 text-left text-sm text-texto transition-[border-color,box-shadow] duration-150 hover:border-[#b7c1d1] focus:border-azul focus:shadow-anel focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-apagado-2 [&>span]:truncate',
        ativo && 'border-azul-linha bg-azul-suave font-semibold text-azul',
        className,
      )}
      {...props}
    >
      {children}
      <S.Icon asChild>
        <ChevronDownIcon className="size-4 shrink-0 text-apagado" />
      </S.Icon>
    </S.Trigger>
  );
}

function SelectContent({ className, children, position = 'popper', ...props }: React.ComponentProps<typeof S.Content>) {
  return (
    <S.Portal>
      <S.Content
        data-slot="select-content"
        position={position}
        sideOffset={6}
        collisionPadding={12}
        className={cn(
          'z-[60] max-h-[min(360px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-borda bg-card text-texto shadow-el-3 data-[state=open]:animate-in data-[state=open]:fade-in-0',
          className,
        )}
        {...props}
      >
        <S.Viewport className="p-1.5">{children}</S.Viewport>
      </S.Content>
    </S.Portal>
  );
}

function SelectItem({ className, children, ...props }: React.ComponentProps<typeof S.Item>) {
  return (
    <S.Item
      data-slot="select-item"
      className={cn(
        'relative flex min-h-9 cursor-pointer items-center gap-2 rounded-sm py-2 pr-8 pl-3 text-sm text-texto-2 outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-azul-suave data-[highlighted]:text-azul data-[state=checked]:font-semibold data-[state=checked]:text-texto',
        className,
      )}
      {...props}
    >
      <S.ItemText>{children}</S.ItemText>
      <S.ItemIndicator className="absolute right-2.5">
        <CheckIcon className="size-4 text-azul" />
      </S.ItemIndicator>
    </S.Item>
  );
}

function SelectLabel({ className, ...props }: React.ComponentProps<typeof S.Label>) {
  return <S.Label className={cn('px-3 pt-2.5 pb-1 text-sm font-bold text-apagado', className)} {...props} />;
}

export { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue };
