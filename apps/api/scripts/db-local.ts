/**
 * PostgreSQL 18 local sem Docker (embedded-postgres).
 * O caminho oficial é o docker-compose da raiz (`pnpm db:up`); este script serve para máquinas sem Docker.
 * Usa as mesmas credenciais do compose e guarda os dados em apps/api/.pgdata. Fica rodando até Ctrl+C.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

const DIR = join(import.meta.dirname, '..', '.pgdata');
const porta = Number(process.env.DB_LOCAL_PORT ?? 5432);

const pg = new EmbeddedPostgres({
  databaseDir: DIR,
  user: 'portal',
  password: 'portal',
  port: porta,
  persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
});

const novo = !existsSync(join(DIR, 'PG_VERSION'));
if (novo) await pg.initialise();
await pg.start();
if (novo) await pg.createDatabase('portal');
console.log(`PostgreSQL local em postgresql://portal:portal@localhost:${porta}/portal (Ctrl+C para parar)`);

const parar = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', parar);
process.on('SIGTERM', parar);
setInterval(() => {}, 1 << 30);
