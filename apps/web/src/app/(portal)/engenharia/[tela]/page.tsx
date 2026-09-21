'use client';

import { useParams, usePathname } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { SemAcesso } from '@/app/(portal)/configuracoes/[tela]/page';
import { TelaIA } from '@/components/engenharia/ia';
import { TelaRepos } from '@/components/engenharia/repos';
import { SecaoAbas } from '@/components/secao-abas';
import { itemDoCaminho } from '@/components/shell/sidebar';
import { useMe } from '@/lib/consultas';

/** Engenharia: GitHub › Repositórios e IA › Provedores (menu criado para este app, só Admin) */
function Tela() {
  const { tela } = useParams<{ tela: string }>();
  const caminho = usePathname();
  const me = useMe();
  const item = itemDoCaminho(me.data?.nav ?? [], caminho);
  const folha = item?.secoes?.flatMap((s) => s.telas).find((t) => t.tela === tela);
  useEffect(() => {
    if (folha) document.title = `${folha.label} · Portal Raphael Lima`;
  }, [folha]);
  if (!me.data) return null;
  if (!item || !folha) return <SemAcesso nome={me.data.usuario.nome} />;
  const abas = <SecaoAbas item={item} tela={tela} />;
  if (tela === 'engRepos') return <TelaRepos abas={abas} />;
  if (tela === 'engIA') return <TelaIA abas={abas} />;
  return <SemAcesso nome={me.data.usuario.nome} />;
}

export default function EngenhariaPage() {
  return (
    <Suspense>
      <Tela />
    </Suspense>
  );
}
