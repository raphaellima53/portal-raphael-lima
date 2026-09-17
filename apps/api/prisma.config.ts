import { defineConfig, env } from 'prisma/config';

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
    url: env('DATABASE_URL'),
  },
});
