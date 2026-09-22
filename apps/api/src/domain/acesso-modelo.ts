/**
 * Modelo de acesso salvo pelo Admin (Configurações › Perfis e hierarquias).
 * Fica na Configuracao "acessoModelo"; sem ela vale o padrão de acesso.ts.
 * Como a base, é relido a cada 15 s: cada instância da função na Vercel acompanha a edição.
 */
import { prisma } from '../db.ts';
import { aplicaModelo, MODELO_PADRAO, type ModeloAcesso, modeloAtual } from './acesso.ts';

const CHAVE = 'acessoModelo';
let validoAte = 0;

export async function carregaModelo(forca = false) {
  if (!forca && validoAte > Date.now()) return;
  const c = await prisma.configuracao.findUnique({ where: { chave: CHAVE } });
  aplicaModelo((c?.valor as ModeloAcesso | undefined) ?? MODELO_PADRAO);
  validoAte = Date.now() + 15_000;
}

/** muda o modelo atual e grava; devolve o modelo salvo */
export async function salvaModelo(muda: (m: ModeloAcesso) => void, por: string) {
  await carregaModelo(true);
  const m = modeloAtual();
  muda(m);
  await prisma.configuracao.upsert({
    where: { chave: CHAVE },
    create: { chave: CHAVE, valor: m as object, por },
    update: { valor: m as object, por },
  });
  aplicaModelo(m);
  validoAte = Date.now() + 15_000;
  return m;
}

/** volta ao padrão do portal: apaga o modelo salvo */
export async function restauraModelo() {
  await prisma.configuracao.deleteMany({ where: { chave: CHAVE } });
  await carregaModelo(true);
}
