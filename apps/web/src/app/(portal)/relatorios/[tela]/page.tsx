'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { Aviso, PageHead } from '@/components/ds';
import { TelaFinanceiro } from '@/components/relatorios/financeiro';
import { TelaRelatorio } from '@/components/relatorios/relatorio';
import { TelaSeletores } from '@/components/relatorios/seletores';
import { SecaoAbas } from '@/components/secao-abas';
import { itemAtivo } from '@/components/shell/sidebar';
import { Button } from '@/components/ui/button';
import { useMe } from '@/lib/consultas';

const RELATORIOS = ['rpPresenca', 'rpPacote', 'rpProfessores', 'rpAvaliacao', 'rpAulas', 'rpOcupacao'];

/** Relatórios: Seletores · Alunos · Professores · Cursos · Financeiro; cada tela abre só para quem tem o acesso */
export default function RelatoriosPage() {
  const { tela } = useParams<{ tela: string }>();
  const caminho = usePathname();
  const me = useMe();
  const item = me.data?.nav.find((n) => itemAtivo(n, caminho));
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
      {tela === 'relatorio' && <TelaSeletores abas={abas} />}
      {RELATORIOS.includes(tela) && <TelaRelatorio key={tela} tela={tela} titulo={folha.label} abas={abas} />}
      {tela === 'rpFinanceiro' && <TelaFinanceiro abas={abas} />}
    </Suspense>
  );
}
