import type * as React from 'react';
import { cn } from '@/lib/utils';

/** tabela do DS: cabeçalho em faixa cinza clara, respiro nas células, rolagem horizontal só na própria tabela */
function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table data-slot="table" className={cn('w-full border-collapse text-sm', className)} {...props} />
    </div>
  );
}
function THead({ className, ...props }: React.ComponentProps<'thead'>) {
  return <thead className={cn('bg-[#f7f8fa] dark:bg-hover', className)} {...props} />;
}
function TBody(props: React.ComponentProps<'tbody'>) {
  return <tbody {...props} />;
}
function Tr({ className, ...props }: React.ComponentProps<'tr'>) {
  return <tr className={cn('border-b border-borda-suave last:border-b-0', className)} {...props} />;
}
function Th({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      scope="col"
      className={cn(
        'h-11 border-b border-borda px-5 text-left align-middle font-semibold whitespace-nowrap text-apagado',
        className,
      )}
      {...props}
    />
  );
}
function Td({ className, ...props }: React.ComponentProps<'td'>) {
  return <td className={cn('px-5 py-3.5 align-middle text-texto-2', className)} {...props} />;
}

export { Table, TBody, Td, THead, Th, Tr };
