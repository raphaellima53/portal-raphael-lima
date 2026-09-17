'use client';

import { DropdownMenu as DM } from 'radix-ui';
import type * as React from 'react';
import { cn } from '@/lib/utils';

const DropdownMenu = DM.Root;
const DropdownMenuTrigger = DM.Trigger;

function DropdownMenuContent({ className, sideOffset = 8, ...props }: React.ComponentProps<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(
          'z-50 min-w-[220px] rounded-lg border border-borda bg-card p-1.5 text-texto shadow-el-3 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className,
        )}
        {...props}
      />
    </DM.Portal>
  );
}

function DropdownMenuItem({
  className,
  perigo,
  ...props
}: React.ComponentProps<typeof DM.Item> & { perigo?: boolean }) {
  return (
    <DM.Item
      className={cn(
        'flex min-h-10 cursor-pointer items-center gap-2.5 rounded-sm px-3 py-2 text-sm text-texto-2 outline-none select-none data-[highlighted]:bg-hover data-[highlighted]:text-texto [&_svg]:size-4 [&_svg]:text-apagado',
        perigo && 'data-[highlighted]:bg-vermelho-suave data-[highlighted]:text-vermelho',
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof DM.Separator>) {
  return <DM.Separator className={cn('-mx-1.5 my-1 h-px bg-borda-suave', className)} {...props} />;
}

const DropdownMenuLabel = DM.Label;

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
};
