import { z } from 'zod';

const Env = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
  PORT: z.coerce.number().int().default(3333),
  HOST: z.string().default('0.0.0.0'),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  TZ: z.string().default('America/Sao_Paulo'),
  COOKIE_SECRET: z.string().min(16, 'COOKIE_SECRET precisa de pelo menos 16 caracteres'),
  SESSION_DAYS: z.coerce.number().int().positive().default(7),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  GITHUB_TOKEN: z.string().default(''),
  GITHUB_OWNER: z.string().default(''),
  ANTHROPIC_API_KEY: z.string().default(''),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-5'),
  OPENAI_API_KEY: z.string().default(''),
  OPENAI_MODEL: z.string().default(''),
  GEMINI_API_KEY: z.string().default(''),
  GEMINI_MODEL: z.string().default(''),
});

export const env = Env.parse(process.env);
/* as regras da agenda leem hora local, como o portal no navegador */
process.env.TZ = env.TZ;
