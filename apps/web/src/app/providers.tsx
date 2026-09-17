'use client';

import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import type * as React from 'react';
import { useState } from 'react';
import { DicaProvider } from '@/components/ui/tooltip';
import { ErroApi } from '@/lib/api';

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => {
    const cliente: QueryClient = new QueryClient({
      /* sessão que expira no meio do uso: o me é recarregado e a casca leva ao login */
      queryCache: new QueryCache({
        onError: (e, q) => {
          if (e instanceof ErroApi && e.status === 401 && q.queryKey[0] !== 'me')
            cliente.invalidateQueries({ queryKey: ['me'] });
        },
      }),
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          refetchOnWindowFocus: false,
          retry: (n, e) => !(e instanceof ErroApi && e.status < 500) && n < 2,
        },
      },
    });
    return cliente;
  });
  return (
    /* tema claro por padrão, sempre — o escuro fica disponível, mas não segue o sistema */
    <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <QueryClientProvider client={qc}>
        <DicaProvider>{children}</DicaProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
