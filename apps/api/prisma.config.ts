import { defineConfig } from 'prisma/config';

/* o .env é opcional: no CI as variáveis já vêm do ambiente */
try {
  process.loadEnvFile?.('.env');
} catch {}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    /* migrações pela conexão direta quando houver (Supabase: DATABASE_URL é o pooler);
       vazio só no build, onde o prisma generate não conecta */
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || '',
  },
});
