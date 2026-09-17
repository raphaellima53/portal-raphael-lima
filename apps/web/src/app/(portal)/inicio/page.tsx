'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Aviso, PageHead } from '@/components/ds';
import { Bloco } from '@/components/inicio/bloco';
import { Personalizar } from '@/components/inicio/personalizar';
import { Card } from '@/components/ui/card';
import { useDashboard, useMe } from '@/lib/consultas';

const quando = (iso: string) =>
  new Date(iso)
    .toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    .replace(',', '');

/** Início: o Dashboard com os blocos escolhidos em Personalizar. */
export default function Inicio() {
  const me = useMe();
  const router = useRouter();
  const ehAluno = !!me.data?.usuario.ehAluno;
  const d = useDashboard(!!me.data && !ehAluno);
  const [msg, setMsg] = useState<{ txt: string; erro?: boolean } | null>(null);

  useEffect(() => {
    document.title = 'Dashboard · Portal Raphael Lima';
    if (ehAluno) router.replace('/minha-area');
  }, [ehAluno, router]);

  if (!me.data || ehAluno) return null;
  const nome = me.data.usuario.nome;

  return (
    <>
      <PageHead
        titulo="Dashboard"
        acoes={d.data ? <Personalizar key={d.data.marcados.join()} d={d.data} nome={nome} aoSalvar={setMsg} /> : null}
      />
      {msg ? (
        <Aviso tom={msg.erro ? 'red' : 'blue'} icone={msg.erro ? 'alerta' : 'ok'}>
          {msg.txt}
        </Aviso>
      ) : null}
      {d.isError ? (
        <Aviso tom="red" icone="alerta">
          {d.error.message}
        </Aviso>
      ) : null}
      {d.isPending ? (
        <p className="text-apagado" role="status">
          Montando o dashboard…
        </p>
      ) : null}
      {d.data ? (
        <>
          <p className="mb-4 text-apagado">
            {d.data.salvoEm
              ? `Configuração salva em ${quando(d.data.salvoEm)}`
              : 'Configuração padrão, ainda não salva'}{' '}
            · {d.data.marcados.length} de {d.data.disponiveis.length} blocos · cada linha abre a tela de origem
          </p>
          {d.data.blocos.length ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(380px,100%),1fr))] items-stretch gap-4">
              {d.data.blocos.map((b) => (
                <Bloco key={b.k} b={b} />
              ))}
            </div>
          ) : (
            <Card className="py-[18px] text-center text-apagado-2">
              nenhum bloco marcado — abra Personalizar e escolha o que ver
            </Card>
          )}
        </>
      ) : null}
    </>
  );
}
