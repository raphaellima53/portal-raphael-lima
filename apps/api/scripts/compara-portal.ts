/**
 * Confere o Dashboard da API contra o do portal original.
 * 1) node tools/extrai-portal/sonda.cjs tools/extrai-portal/dashboard.expr.js tools/extrai-portal/dashboard.json
 * 2) pnpm tsx --env-file=.env scripts/compara-portal.ts ../../tools/extrai-portal/dashboard.json
 * Usa o mesmo "agora" da captura, para as duas agendas gerarem as mesmas aulas.
 */
import { readFileSync } from 'node:fs';
import { prisma } from '../src/db.ts';
import { base } from '../src/domain/base.ts';
import { type CorpoBloco, DASH_BLOCOS, montaDashboard } from '../src/domain/dashboard.ts';
/* o seed tem e-mails fictícios: o lado do portal passa pela mesma troca antes de comparar */
import { anonimizaEmails } from './anonimiza.ts';

const portal = JSON.parse(anonimizaEmails(readFileSync(process.argv[2], 'utf8'))) as {
  agora: string;
  blocos: { k: string; t: string }[];
};
const agora = new Date(portal.agora);

const texto = (c: CorpoBloco) =>
  [
    ...(c.stats ?? []).map((s) => `${s.valor} ${s.rotulo}`),
    ...(c.kpis ?? []).map((k) => `${k.valor} ${k.rotulo}`),
    ...(c.linhas ?? []).map((l) =>
      [l.nome.map((s) => s.t).join(''), l.valor ?? l.valorBadge?.t, (l.sub ?? []).map((s) => s.t).join('')]
        .filter(Boolean)
        .join(' '),
    ),
    c.vazio,
    c.pe,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

const blocos = montaDashboard(
  await base(),
  DASH_BLOCOS.map((b) => b.k),
  agora,
);
let erros = 0;
for (const p of portal.blocos) {
  const a = blocos.find((x) => x.k === p.k);
  const t = a ? texto(a.corpo) : '(sem bloco)';
  const norm = (s: string) => s.replace(/\s+/g, '').replace(/·/g, '');
  const ok = norm(t) === norm(p.t);
  if (!ok) erros++;
  console.log(`${ok ? 'ok  ' : 'DIF '} ${p.k}`);
  if (!ok) console.log(`  portal: ${p.t}\n  api:    ${t}`);
}
console.log(erros ? `${erros} bloco(s) diferentes` : 'todos os blocos iguais ao portal');
await prisma.$disconnect();
process.exitCode = erros ? 1 : 0;
