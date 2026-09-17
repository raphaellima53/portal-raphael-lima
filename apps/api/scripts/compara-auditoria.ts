/**
 * Confere a Auditoria contra o portal recém-aberto (só o histórico da base; rode depois do seed).
 * 1) node tools/extrai-portal/sonda.cjs tools/extrai-portal/auditoria.expr.js tools/extrai-portal/auditoria.json
 * 2) pnpm tsx --env-file=.env scripts/compara-auditoria.ts ../../tools/extrai-portal/auditoria.json
 */
import { readFileSync } from 'node:fs';
import { prisma } from '../src/db.ts';
import { audLinhas } from '../src/domain/auditoria.ts';
import { base } from '../src/domain/base.ts';
/* o seed tem e-mails fictícios: o lado do portal passa pela mesma troca antes de comparar */
import { anonimizaEmails } from './anonimiza.ts';

const portal = JSON.parse(anonimizaEmails(readFileSync(process.argv[2], 'utf8'))) as unknown[];
const logs = await prisma.logAlteracao.findMany({ where: { origem: 'base' } });
const api = audLinhas(await base(), logs, new Set()).map((x) => [
  x.quando,
  x.quem,
  x.ent,
  x.acao,
  x.reg,
  x.det,
  x.vivo ? 1 : 0,
]);
const ok = JSON.stringify(api) === JSON.stringify(portal);
if (!ok) console.log('portal:', JSON.stringify(portal), '\napi:   ', JSON.stringify(api));
console.log(ok ? 'auditoria igual ao portal' : 'HÁ DIFERENÇAS');
await prisma.$disconnect();
process.exit(ok ? 0 : 1);
