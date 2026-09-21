'use client';

import Link from 'next/link';
import { useParams, usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { TelaPerfis, TelaSessoes } from '@/components/config/acessos';
import { TelaAlertas, TelaExecucoes, TelaPainel } from '@/components/config/alertas';
import { TelaDesign, TelaMapaTelas, TelaPersonas } from '@/components/config/documentacao';
import { TelaCatalogo, TelaColaboradores, TelaPrestadores } from '@/components/config/pessoas';
import { TelaCurriculos, TelaDias, TelaFeriados, TelaPoliticas, TelaSalas } from '@/components/config/regras';
import { TelaUsuarios } from '@/components/config/usuarios';
import { Aviso, PageHead } from '@/components/ds';
import { SecaoAbas } from '@/components/secao-abas';
import { itemDoCaminho } from '@/components/shell/sidebar';
import { Button } from '@/components/ui/button';
import { useMe } from '@/lib/consultas';

const CATALOGOS = ['departamentos', 'cargos', 'tiposcurso', 'tiposala', 'idiomas', 'skills', 'generos', 'responsaveis'];

/** Semacesso: Configurações é só do tipo de perfil Admin */
export function SemAcesso({ nome }: { nome: string }) {
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
        {nome} não tem acesso a esta tela. O acesso vem da hierarquia e dos setores do cadastro do usuário, em Usuários.
      </Aviso>
    </>
  );
}

function Tela() {
  const { tela } = useParams<{ tela: string }>();
  const caminho = usePathname();
  const sp = useSearchParams();
  const me = useMe();
  const item = itemDoCaminho(me.data?.nav ?? [], caminho);
  const folha = item?.secoes?.flatMap((s) => s.telas).find((t) => t.tela === tela);
  useEffect(() => {
    if (folha) document.title = `${folha.label} · Portal Raphael Lima`;
  }, [folha]);
  if (!me.data) return null;
  if (!item || !folha) return <SemAcesso nome={me.data.usuario.nome} />;

  const abas = <SecaoAbas item={item} tela={tela} />;
  if (tela === 'usuarios')
    return <TelaUsuarios key={sp.get('msg') ?? ''} abas={abas} msgInicial={sp.get('msg') ?? ''} />;
  if (tela === 'perfis') return <TelaPerfis abas={abas} />;
  if (tela === 'sessoes') return <TelaSessoes abas={abas} />;
  if (tela === 'colaboradores') return <TelaColaboradores abas={abas} />;
  if (tela === 'prestadores') return <TelaPrestadores abas={abas} />;
  if (CATALOGOS.includes(tela)) return <TelaCatalogo key={tela} k={tela} abas={abas} />;
  if (tela === 'politicas') return <TelaPoliticas abas={abas} />;
  if (tela === 'dias') return <TelaDias abas={abas} />;
  if (tela === 'feriados') return <TelaFeriados abas={abas} />;
  if (tela === 'salas') return <TelaSalas abas={abas} />;
  if (tela === 'curriculo') return <TelaCurriculos abas={abas} />;
  if (tela === 'alertas') return <TelaAlertas abas={abas} />;
  if (tela === 'admPainel') return <TelaPainel abas={abas} />;
  if (tela === 'execucoes') return <TelaExecucoes abas={abas} />;
  if (tela === 'docPersonas') return <TelaPersonas abas={abas} />;
  if (tela === 'docTelas') return <TelaMapaTelas abas={abas} />;
  if (tela === 'docDesign') return <TelaDesign abas={abas} />;
  return <SemAcesso nome={me.data.usuario.nome} />;
}

/** Configurações: Pessoas e acessos · Regras de negócio · Alertas · Documentação (só Admin) */
export default function ConfiguracoesPage() {
  return (
    <Suspense>
      <Tela />
    </Suspense>
  );
}
