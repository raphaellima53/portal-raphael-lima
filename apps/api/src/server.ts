import { montaApp } from './app.ts';
import { prisma } from './db.ts';
import { env } from './env.ts';

const app = await montaApp();
await app.listen({ port: env.PORT, host: env.HOST });
console.log(`API do Portal Raphael Lima em http://localhost:${env.PORT}`);

const parar = async () => {
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', parar);
process.on('SIGTERM', parar);
