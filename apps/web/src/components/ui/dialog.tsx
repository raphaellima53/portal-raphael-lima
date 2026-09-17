'use client';

import { XIcon } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import type * as React from 'react';
import { cn } from '@/lib/utils';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

function DialogContent({
  className,
  children,
  tamanho = 'md',
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { tamanho?: 'sm' | 'md' | 'lg' }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgba(10,16,35,.45)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          'fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-borda bg-card shadow-el-4 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          tamanho === 'sm' ? 'max-w-[520px]' : tamanho === 'lg' ? 'max-w-[920px]' : 'max-w-[680px]',
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function DialogHead({
  titulo,
  descricao,
  className,
}: {
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start gap-3 border-b border-borda-suave px-5 py-4', className)}>
      <div className="min-w-0 flex-1">
        <DialogPrimitive.Title className="text-lg font-bold text-texto">{titulo}</DialogPrimitive.Title>
        {descricao ? (
          <DialogPrimitive.Description className="mt-0.5 text-apagado">{descricao}</DialogPrimitive.Description>
        ) : null}
      </div>
      <DialogPrimitive.Close
        aria-label="Fechar"
        className="grid size-9 cursor-pointer place-items-center rounded-md text-apagado hover:bg-bg hover:text-texto"
      >
        <XIcon className="size-4" />
      </DialogPrimitive.Close>
    </div>
  );
}

function DialogBody({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('overflow-y-auto px-5 py-4', className)} {...props} />;
}

function DialogFoot({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex flex-wrap items-center justify-end gap-2 border-t border-borda-suave px-5 py-3', className)}
      {...props}
    />
  );
}

export { Dialog, DialogBody, DialogClose, DialogContent, DialogFoot, DialogHead, DialogTrigger };
