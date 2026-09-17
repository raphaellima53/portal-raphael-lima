/**
 * Confere menu, seções e chaves de acesso de cada persona contra o portal original.
 * 1) node tools/extrai-portal/sonda.cjs tools/extrai-portal/acesso.expr.js tools/extrai-portal/acesso.json
 * 2) pnpm tsx --env-file=.env scripts/compara-acesso.ts ../../tools/extrai-portal/acesso.json
 * O menu Engenharia (GitHub e IA) é novo e não existe no portal: fica fora da comparação.
 */
import { readFileSync } from 'node:fs';
import { prisma } from '../src/db.ts';
import { type Areas, PERFIS, type TipoPerfil } from '../src/domain/acesso.ts';
import { chavesDe, navDe } from '../src/domain/mapa.ts';
/* o seed tem e-mails fictícios: o lado do portal passa pela mesma troca antes de comparar */
import { anonimizaEmails } from './anonimiza.ts';

type P = { login: string; menu: string[]; secoes: Record<string, string[]>; chaves: string[] };
const portal = JSON.parse(anonimizaEmails(readFileSync(process.argv[2], 'utf8'))) as P[];
let erros = 0;
for (const p of portal) {
  const u = await prisma.usuario.findUniqueOrThrow({ where: { email: p.login } });
  const tipoPerfil = (PERFIS.find((x) => x.id === u.perfilId)?.perfil ?? null) as TipoPerfil | null;
  const pessoa = {
    nivel: u.nivel,
    areas: u.areas as Areas,
    tipoPerfil,
    ehAluno: tipoPerfil === 'Aluno',
    temAluno: tipoPerfil !== 'Aluno' && u.alunoId != null,
  };
  const nav = navDe(pessoa).filter((n) => n.key !== 'engenharia');
  const menu = nav.map((n) => n.label);
  const secoes = Object.fromEntries(
    ['acoes', 'relatorios', 'config'].map((m) => [
      m,
      nav.find((n) => n.key === m)?.secoes?.flatMap((s) => s.telas.map((t) => t.tela)) ?? [],
    ]),
  );
  const chaves = pessoa.ehAluno ? [] : chavesDe(pessoa).filter((c) => c !== 'engenharia');
  const dif: string[] = [];
  if (menu.join(',') !== p.menu.join(','))
    dif.push(`menu\n    portal ${p.menu.join(', ')}\n    api    ${menu.join(', ')}`);
  for (const m of Object.keys(p.secoes))
    if (p.secoes[m].join(',') !== secoes[m].join(',')) dif.push(`${m}: portal ${p.secoes[m]} · api ${secoes[m]}`);
  const a = new Set(chaves);
  const b = new Set(p.chaves);
  const so = [...a].filter((x) => !b.has(x));
  const falta = [...b].filter((x) => !a.has(x));
  if (so.length || falta.length) dif.push(`chaves só na api: ${so} · só no portal: ${falta}`);
  if (dif.length) erros++;
  console.log(
    `${dif.length ? 'DIF ' : 'ok  '} ${p.login} (${menu.length} itens, ${chaves.length} chaves)${dif.length ? `\n  ${dif.join('\n  ')}` : ''}`,
  );
}
console.log(erros ? `${erros} persona(s) diferentes` : 'todas as personas iguais ao portal');
await prisma.$disconnect();
process.exitCode = erros ? 1 : 0;
