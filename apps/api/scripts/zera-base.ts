/**
 * Zera a base para testar os cadastros do zero: fica só um usuário Administrador.
 * Antes de apagar, grava uma cópia de todas as tabelas em JSON (pasta `backups/`, fora do git).
 * Também desliga os dados de exemplo que nasciam na primeira leitura (feedbacks e cards de fluxo).
 *
 *   ADMIN_NOME="…" ADMIN_EMAIL="…" ADMIN_SENHA="…" ZERAR=sim tsx --env-file=.env scripts/zera-base.ts
 *
 * Sem ZERAR=sim só faz a cópia e mostra o que seria apagado.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { prisma } from '../src/db.ts';
import { MATRIZ } from '../src/domain/acesso.ts';
import { hashSenha } from '../src/lib/senha.ts';

const { ZERAR } = process.env;
const ADMIN_NOME = process.env.ADMIN_NOME ?? '';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? '';
const ADMIN_SENHA = process.env.ADMIN_SENHA ?? '';
if (!ADMIN_NOME || !ADMIN_EMAIL) throw new Error('Informe ADMIN_NOME, ADMIN_EMAIL e ADMIN_SENHA.');
if (ADMIN_SENHA.length < 8) throw new Error('A senha do Admin precisa de 8 caracteres ou mais.');

const host = new URL(process.env.DATABASE_URL!.replace(/^postgres(ql)?:/, 'http:')).host;

async function main() {
  const tabelas = (
    await prisma.$queryRawUnsafe<{ t: string }[]>(
      `SELECT tablename AS t FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' ORDER BY 1`,
    )
  ).map((x) => x.t);

  /* cópia de segurança: uma linha JSON por registro, bytea em base64 */
  const pasta = join(import.meta.dirname, '..', 'backups', new Date().toISOString().replace(/[:.]/g, '-'));
  mkdirSync(pasta, { recursive: true });
  const contagem: Record<string, number> = {};
  for (const t of tabelas) {
    const linhas = await prisma.$queryRawUnsafe<{ j: unknown }[]>(`SELECT row_to_json(x) AS j FROM "${t}" x`);
    contagem[t] = linhas.length;
    writeFileSync(join(pasta, `${t}.jsonl`), linhas.map((l) => JSON.stringify(l.j)).join('\n'));
  }
  console.log(`banco: ${host}`);
  console.log(`cópia em ${pasta}`);
  console.table(contagem);

  if (ZERAR !== 'sim') {
    console.log('ZERAR=sim não informado: nada foi apagado.');
    return;
  }

  await prisma.$executeRawUnsafe(`TRUNCATE ${tabelas.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);

  const m = MATRIZ[1];
  await prisma.usuario.create({
    data: {
      nome: ADMIN_NOME,
      email: ADMIN_EMAIL.toLowerCase(),
      senhaHash: await hashSenha(ADMIN_SENHA),
      perfilId: 1,
      nivel: m.nivel,
      areas: m.areas,
      status: 'Ativo',
      mfa: true,
      ordem: 0,
    },
  });
  await prisma.configuracao.create({ data: { chave: 'dadosDeExemplo', valor: false, por: 'zera-base' } });

  const depois: Record<string, number> = {};
  for (const t of tabelas) {
    const [{ n }] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM "${t}"`);
    if (n) depois[t] = Number(n);
  }
  console.log('base zerada; ficou:', depois);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
