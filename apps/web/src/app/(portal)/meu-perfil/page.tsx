'use client';

import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { AreaDoAluno } from '@/components/aluno/area-aluno';
import { AbaPerfil } from '@/components/alunos/abas-aluno';
import { Aviso, PageHead } from '@/components/ds';
import type { Perfil } from '@/lib/alunos';
import { api } from '@/lib/api';
import type { MinhaArea } from '@/lib/tipos';

type MeuPerfilResp = {
  nome: string;
  papel: 'aluno' | 'professor' | 'equipe';
  blocos: Perfil['blocos'];
  aluno: MinhaArea | null;
};

export default function MeuPerfilPage() {
  return (
    <Suspense>
      <MeuPerfil />
    </Suspense>
  );
}

/**
 * Meu perfil (Painel, pirâmides de 21/09/2026): a conta de quem está logado e, conforme o papel,
 * a área do aluno (matrículas, saldo e próximas aulas) ou o resumo do professor (o mesmo da ficha).
 */
function MeuPerfil() {
  const visaoAluno = useSearchParams().get('visao') === 'aluno';
  const q = useQuery({
    queryKey: ['meu-perfil', visaoAluno],
    queryFn: () => api<MeuPerfilResp>(`/meu-perfil${visaoAluno ? '?visao=aluno' : ''}`),
  });
  useEffect(() => {
    document.title = 'Meu perfil · Portal Raphael Lima';
  }, []);

  if (q.isError)
    return (
      <>
        <PageHead titulo="Meu perfil" />
        <Aviso tom="red" icone="alerta">
          {q.error.message}
        </Aviso>
      </>
    );
  if (!q.data) return <p className="text-apagado">Carregando…</p>;
  const d = q.data;
  return (
    <>
      <PageHead titulo="Meu perfil" />
      {d.aluno && (
        <div className="mb-6">
          <AreaDoAluno d={d.aluno} visaoAluno={visaoAluno} />
        </div>
      )}
      <AbaPerfil d={{ blocos: d.blocos }} />
    </>
  );
}
