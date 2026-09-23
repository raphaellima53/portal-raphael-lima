'use client';

import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { TelaAlocacao } from '@/components/acoes/alocacao';
import { TelaAtendimentos } from '@/components/acoes/atendimentos';
import { TelaFechamento } from '@/components/acoes/fechamento';
import { TelaFluxo } from '@/components/acoes/fluxo';
import { TelaFunil } from '@/components/acoes/funil';
import { TelaCatalogo } from '@/components/atividades/catalogo';
import { TelaDashAtividades } from '@/components/atividades/dash';
import { TelaQuadro } from '@/components/atividades/quadro';
import { TELA_CADASTRO, TelaCadastro } from '@/components/cadastro/cadastro';
import {
  TelaBolsas,
  TelaDescontos,
  TelaImportar,
  TelaPainel,
  TelaPedidos,
  TelaRenovacoes,
  TelaVendedores,
} from '@/components/deal/vendas';
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

/**
 * Atividades (23/09/2026): Dashboard (visão geral, catálogo, relatórios) · Comercial e Operações (quadro de cartões
 * e as telas dos setores). Cada tela abre só para quem tem o setor. O antigo painel Setores leva ao Dashboard.
 */
export default function AcoesPage() {
  const { tela } = useParams<{ tela: string }>();
  const caminho = usePathname();
  const me = useMe();
  const router = useRouter();
  const item = itemDoCaminho(me.data?.nav ?? [], caminho);
  const folha = item?.secoes?.flatMap((s) => s.telas).find((t) => t.tela === tela);
  useEffect(() => {
    if (tela === 'atividades') router.replace('/acoes/atvDash');
  }, [tela, router]);
  useEffect(() => {
    if (folha) document.title = `${folha.label} · Portal Raphael Lima`;
  }, [folha]);
  if (!me.data || tela === 'atividades') return null;

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
      {tela === 'atvDash' && <TelaDashAtividades abas={abas} />}
      {tela === 'atvCatalogo' && <TelaCatalogo abas={abas} />}
      {tela === 'atvComercial' && <TelaQuadro frente="Comercial" abas={abas} />}
      {tela === 'atvOperacoes' && <TelaQuadro frente="Operações" abas={abas} />}
      {tela === 'dlPainel' && <TelaPainel abas={abas} />}
      {tela === 'dlPedidos' && <TelaPedidos abas={abas} />}
      {tela === 'dlRenovacoes' && <TelaRenovacoes abas={abas} />}
      {tela === 'dlImportar' && <TelaImportar abas={abas} />}
      {tela === 'dlVendedores' && <TelaVendedores abas={abas} />}
      {tela === 'dlDescontos' && <TelaDescontos abas={abas} />}
      {tela === 'dlBolsas' && <TelaBolsas abas={abas} />}
      {tela === 'acAlocacao' && <TelaAlocacao abas={abas} />}
      {tela === 'acFechamento' && <TelaFechamento abas={abas} />}
      {tela === 'acFunil' && <TelaFunil abas={abas} />}
      {tela === 'acAtendimentos' && <TelaAtendimentos abas={abas} />}
      {FLUXOS.includes(tela) && <TelaFluxo key={tela} chave={tela} abas={abas} />}
      {TELA_CADASTRO[tela] && <TelaCadastro key={tela} tela={tela} titulo={folha.label} abas={abas} />}
    </Suspense>
  );
}
