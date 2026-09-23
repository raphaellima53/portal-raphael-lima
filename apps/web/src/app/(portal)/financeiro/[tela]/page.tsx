'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import {
  TelaCobrancas,
  TelaConciliacao,
  TelaConferencia,
  TelaContas,
  TelaFechamento,
  TelaLiquidacao,
  TelaNotas,
  TelaOrdens,
  TelaPosicao,
} from '@/components/deal/financeiro';
import { Aviso, PageHead } from '@/components/ds';
import { SecaoAbas } from '@/components/secao-abas';
import { itemDoCaminho } from '@/components/shell/sidebar';
import { Button } from '@/components/ui/button';
import { useMe } from '@/lib/consultas';

const TELAS: Record<string, (p: { abas: React.ReactNode }) => React.ReactNode> = {
  dlOrdens: TelaOrdens,
  dlFechamento: TelaFechamento,
  dlNotas: TelaNotas,
  dlCobrancas: TelaCobrancas,
  dlLiquidacao: TelaLiquidacao,
  dlConciliacao: TelaConciliacao,
  dlPosicao: TelaPosicao,
  dlContas: TelaContas,
  dlConferencia: TelaConferencia,
};

/** Financeiro (Deal, 23/09/2026): Faturamento · Recebimento · Posição */
export default function FinanceiroPage() {
  const { tela } = useParams<{ tela: string }>();
  const caminho = usePathname();
  const me = useMe();
  const item = itemDoCaminho(me.data?.nav ?? [], caminho);
  const folha = item?.secoes?.flatMap((s) => s.telas).find((t) => t.tela === tela);
  useEffect(() => {
    if (folha) document.title = `${folha.label} · Portal Raphael Lima`;
  }, [folha]);
  if (!me.data) return null;
  const Tela = TELAS[tela];
  if (!item || !folha || !Tela)
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
  return <Tela abas={<SecaoAbas item={item} tela={tela} />} />;
}
