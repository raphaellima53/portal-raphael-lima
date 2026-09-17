/**
 * Confere Configurações contra o portal recém-aberto (rode logo depois do seed).
 * 1) node tools/extrai-portal/sonda.cjs tools/extrai-portal/configuracoes.expr.js tools/extrai-portal/configuracoes.json
 * 2) pnpm tsx --env-file=.env scripts/compara-configuracoes.ts ../../tools/extrai-portal/configuracoes.json
 */
import { readFileSync } from 'node:fs';
import { montaApp } from '../src/app.ts';
import { prisma } from '../src/db.ts';
import { base } from '../src/domain/base.ts';
import { alertaConta, ferNacionais } from '../src/domain/configuracoes.ts';
import { fmt } from '../src/lib/fmt.ts';
/* o seed tem e-mails fictícios: o lado do portal passa pela mesma troca antes de comparar */
import { anonimizaEmails } from './anonimiza.ts';

type J = Record<string, unknown>;
const portal = JSON.parse(anonimizaEmails(readFileSync(process.argv[2], 'utf8')));
let ok = 0;
let erros = 0;
const confere = (nome: string, p: unknown, a: unknown) => {
  const jp = JSON.stringify(p);
  const ja = JSON.stringify(a);
  if (jp === ja) ok++;
  else {
    erros++;
    console.log(`DIFERE ${nome}\n  portal: ${jp.slice(0, 1200)}\n  api:    ${ja.slice(0, 1200)}`);
  }
};
const app = await montaApp();
const r = await app.inject({
  method: 'POST',
  url: '/auth/login',
  payload: { login: 'admin@alumni.teste', senha: 'alumni-admin' },
});
const headers = { cookie: `portal_sessao=${r.cookies.find((x) => x.name === 'portal_sessao')!.value}` };
const get = async (url: string) => (await app.inject({ method: 'GET', url, headers })).json();

const us = await get('/config/usuarios');
confere(
  'usuários',
  portal.usuarios.map((u: J) => [u.nome, u.email, u.perfil, u.resumo, u.status, !!u.mfa]),
  us.linhas.map((u: J) => [u.nome, u.email, u.perfil, u.resumo, u.status, u.mfa]),
);
const ps = await get('/config/personas');
confere(
  'personas',
  portal.personas.map((p: J) => [p.letra, p.nome, p.login, p.resumo]),
  ps.linhas.map((p: J) => [p.letra, p.nome, p.login, p.resumo]),
);
for (const k of Object.keys(portal.catalogos)) {
  const c = await get(`/config/catalogo/${k}`);
  confere(
    `catálogo ${k}`,
    portal.catalogos[k],
    c.linhas.map((l: J) => [l.nome, l.uso]),
  );
  if (k === 'departamentos')
    confere(
      'pessoas por departamento',
      portal.departamentosPessoas,
      c.linhas.map((l: J) => [l.nome, l.pessoas]),
    );
}
for (const y of ['2026', '2027'])
  confere(
    `feriados nacionais ${y}`,
    portal.feriados[y],
    ferNacionais(+y).map(([d, n]) => [fmt.data(d), n]),
  );
const b = await base();
confere('alertas', portal.alertas, {
  ocioso: alertaConta(b, 'ocioso'),
  contrato: alertaConta(b, 'contrato', 30),
  saldo: alertaConta(b, 'saldo', 10),
  semProf: alertaConta(b, 'semProf', 7),
  inad: alertaConta(b, 'inad', 5),
});
const pr = await get('/config/prestadores');
confere(
  'prestadores',
  portal.prestadores,
  pr.linhas.map((l: J) => [l.nome, (l.cursos as J[]).map((c) => c.nome).join(', '), l.aulas, l.teto, l.ativo]),
);
const ts = await get('/config/telas');
confere(
  'mapa de telas',
  portal.telas.map((t: J) => [t.id, t.label, t.area, t.caminho, t.tipo, t.mostra, t.acoes, t.vai, t.sub]),
  ts.linhas
    .filter((t: J) => t.area !== 'Engenharia')
    .map((t: J) => [
      t.id,
      t.label,
      t.area,
      t.caminho,
      t.tipo,
      t.mostra,
      (t.acoes as string[]).join(' · '),
      (t.vai as string[]).join(' · '),
      (t.sub as string[]).join(' · '),
    ]),
);
const cur = await get('/config/curriculos');
confere(
  'currículos',
  portal.curriculos,
  cur.linhas.map((c: J) => [c.grupo, c.tipo, c.nome, c.conteudos, c.semLink]),
);
console.log(`${ok} conferências iguais, ${erros} diferentes`);
await app.close();
await prisma.$disconnect();
process.exit(erros ? 1 : 0);
