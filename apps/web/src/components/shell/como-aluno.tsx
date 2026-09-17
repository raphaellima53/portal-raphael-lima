'use client';

import { useQueryClient } from '@tanstack/react-query';
import { EyeIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { Me } from '@/lib/tipos';

/** Acessar como: faixa no topo enquanto a sessão mostra o portal como um aluno ou um professor, com a volta ao portal. */
export function FaixaComoAluno({ me }: { me: Me }) {
  const como = me.usuario.como;
  const qc = useQueryClient();
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  if (!como) return null;
  const volta = async () => {
    setOcupado(true);
    try {
      const r = await api<{ ir: string }>('/auth/como-voltar', { method: 'POST', json: {} });
      await qc.resetQueries();
      router.push(r.ir);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };
  return (
    <div
      role="status"
      className="sticky z-20 mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-azul-linha bg-azul-suave px-4 py-3 text-texto-2 shadow-el-2"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
    >
      <EyeIcon className="size-4 shrink-0 text-azul" />
      <span className="min-w-0 flex-1">
        Você está vendo o portal como <b className="text-texto">{me.usuario.nome}</b>. A sessão de {como.quem} continua
        aberta.
      </span>
      {erro && <span className="font-medium text-vermelho">{erro}</span>}
      <Button size="sm" variant="primary" disabled={ocupado} onClick={volta}>
        Voltar ao portal
      </Button>
    </div>
  );
}
