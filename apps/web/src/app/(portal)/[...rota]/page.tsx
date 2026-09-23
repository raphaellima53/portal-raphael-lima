'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TELA_CADASTRO, TelaCadastro } from '@/components/cadastro/cadastro';
import { TelaOfertas, TelaPresets } from '@/components/deal/financeiro';
import { Aviso, PageHead } from '@/components/ds';
import { SecaoAbas } from '@/components/secao-abas';
import { inicioDe, itemDoCaminho } from '@/components/shell/sidebar';
import { Button } from '@/components/ui/button';
import { useMe } from '@/lib/consultas';

/**
 * Telas que ainda não foram replicadas. A réplica entra por menu (base primeiro, depois Agenda, Cursos, Alunos…);
 * enquanto isso, a tela diz em que etapa está — e quem não tem acesso vê o aviso de Sem acesso, como no portal.
 */
export default function TelaPendente() {
  const caminho = usePathname();
  const me = useMe();
  if (!me.data) return null;
  const item = itemDoCaminho(me.data.nav, caminho);
  const tela = caminho.split('/')[2];
  const folha = item?.secoes?.flatMap((s) => s.telas).find((t) => t.tela === tela);

  if (!item || (item.secoes && tela && !folha)) {
    const inicio = inicioDe(me.data.usuario);
    return (
      <>
        <PageHead
          titulo="Sem acesso a esta tela"
          acoes={
            <Button asChild>
              <Link href={inicio}>Voltar ao início</Link>
            </Button>
          }
        />
        <Aviso icone="trava">
          {me.data.usuario.nome} não tem acesso a esta tela. O acesso vem da hierarquia e dos setores do cadastro do
          usuário, em Usuários.
        </Aviso>
      </>
    );
  }

  /* Produtos e serviços › Ofertas (Deal, 23/09/2026) */
  if (folha && (folha.tela === 'dlOfertas' || folha.tela === 'dlPresets')) {
    const Tela = folha.tela === 'dlOfertas' ? TelaOfertas : TelaPresets;
    return <Tela abas={item.secoes ? <SecaoAbas item={item} tela={folha.tela} /> : null} />;
  }

  if (folha && TELA_CADASTRO[folha.tela])
    return (
      <TelaCadastro
        key={folha.tela}
        tela={folha.tela}
        titulo={folha.label}
        abas={item.secoes ? <SecaoAbas item={item} tela={folha.tela} /> : null}
      />
    );

  return (
    <>
      <PageHead titulo={folha?.label ?? item.label} />
      {item.secoes ? <SecaoAbas item={item} tela={folha?.tela ?? item.tela} /> : null}
      {tela === 'servicos' ? (
        <Aviso tom="blue" icone="info">
          Os serviços (atendimento, acompanhamento e consultoria) ainda não têm cadastro. Eles entram aqui, ao lado dos
          cursos, quando o cadastro de serviços for definido.
        </Aviso>
      ) : (
        <Aviso tom="blue" icone="info">
          <b>{item.label}</b> entra na próxima etapa da réplica do portal. A base (login, personas, acessos, menu,
          Dashboard e alertas) já está pronta.
        </Aviso>
      )}
    </>
  );
}
