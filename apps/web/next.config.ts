import type { NextConfig } from 'next';

/* O front chama /api/... no próprio domínio e o Next repassa para a API (apps/api).
   Assim o cookie de sessão é do mesmo site, em localhost e em produção (Vercel). */
const API_ORIGIN = (process.env.API_ORIGIN ?? 'http://localhost:3333').replace(/\/+$/, '');

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: false,
  devIndicators: false,
  async rewrites() {
    return [{ source: '/api/:caminho*', destination: `${API_ORIGIN}/:caminho*` }];
  },
};

export default config;
