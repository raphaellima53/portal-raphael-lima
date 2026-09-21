'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { TelaAlocacao } from '@/components/acoes/alocacao';
import { TelaAtendimentos } from '@/components/acoes/atendimentos';
import { TelaFechamento } from '@/components/acoes/fechamento';
import { TelaFluxo } from '@/components/acoes/fluxo';
import { TelaFunil } from '@/components/acoes/funil';
import { Aviso, PageHead } from '@/components/ds';
import { SecaoAbas } from '@/components/secao-abas';
import { itemDoCaminho } from '@/components/shell/sidebar';
import { Button } from '@/components/ui/button';
import { useMe } from '@/lib/consultas';

const FLUXOS = [
  'acSubstituicao',
  'acNivel',
  'acReposicao',
  'acAdmissao',
  'acCobranca',
  'acRenovacao',
  'acCampanhas',
  'acRetencao',
];

/** Ações: uma aba por departamento; cada tela abre só para quem tem o setor */
export default function AcoesPage() {
  const { tela } = useParams<{ tela: string }>();
  const caminho = usePathname();
  const me = useMe();
  const item = itemDoCaminho(me.data?.nav ?? [], caminho);
  const folha = item?.secoes?.flatMap((s) => s.telas).find((t) => t.tela === tela);
  useEffect(() => {
    if (folha) document.title = `${folha.label} · Portal Raphael Lima`;
  }, [folha]);
  if (!me.data) return null;

  if (!item || !folha)
    return (
      <>
        <PageHead
          titulo="Sem acesso a esta tela"
          acoes={
            <Button asChild>
              <Link href="/inicio">Voltar ao início</Link>
            </Button>
          }
        />
        <Aviso icone="trava">
          {me.data.usuario.nome} não tem acesso a esta tela. O acesso vem da hierarquia e dos setores do cadastro do
          usuário, em Usuários.
        </Aviso>
      </>
    );

  const abas = <SecaoAbas item={item} tela={tela} />;
  return (
    <Suspense>
      {tela === 'acAlocacao' && <TelaAlocacao abas={abas} />}
      {tela === 'acFechamento' && <TelaFechamento abas={abas} />}
      {tela === 'acFunil' && <TelaFunil abas={abas} />}
      {tela === 'acAtendimentos' && <TelaAtendimentos abas={abas} />}
      {FLUXOS.includes(tela) && <TelaFluxo key={tela} chave={tela} abas={abas} />}
    </Suspense>
  );
}
