'use client';

import { BellIcon, XIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAlertas } from '@/lib/consultas';
import { cn } from '@/lib/utils';
import { useUI } from '@/stores/ui';
import { BotaoBarra } from './botao-barra';
import { useDesktop } from './shell';

/** Sino da barra lateral: os alertas do momento, filtrados pelo acesso; cada um abre a tela onde se resolve. */
export function Alertas({ mini, ativo }: { mini: boolean; ativo: boolean }) {
  const { data: alertas = [] } = useAlertas(ativo);
  const aberto = useUI((s) => s.alertas);
  const setAberto = useUI((s) => s.setAlertas);
  const router = useRouter();
  // na gaveta (abaixo de 1024px) não cabe à direita: abre para cima, já que o sino fica no pé da barra
  const desktop = useDesktop();
  const n = alertas.length;

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <BotaoBarra
          icone={BellIcon}
          texto="Alertas"
          mini={mini}
          aria-label={n ? `Alertas: ${n} ${n === 1 ? 'aviso' : 'avisos'}` : 'Alertas: nenhum aviso'}
          extra={
            n ? (
              <span
                className={cn(
                  'rounded-full bg-[#e02b3b] text-center text-sm font-bold text-white',
                  mini
                    ? 'absolute top-0.5 left-[calc(50%+3px)] h-5 min-w-5 px-1 leading-5'
                    : 'h-[22px] min-w-6 px-1.5 leading-[22px]',
                )}
              >
                {n > 9 ? '9+' : n}
              </span>
            ) : null
          }
        />
      </PopoverTrigger>
      <PopoverContent
        side={desktop ? 'right' : 'top'}
        align={desktop ? 'end' : 'start'}
        sideOffset={desktop ? 22 : 8}
        collisionPadding={16}
        className="max-h-[min(560px,calc(100dvh-40px))] w-[360px] max-w-[calc(100vw-32px)] overflow-auto p-1.5"
      >
        <div className="mb-1 flex items-center gap-2.5 border-b border-borda-suave py-2 pr-2 pl-2.5">
          <b className="text-texto">Alertas</b>
          <span className="flex-1 text-apagado">{n ? `${n} ${n === 1 ? 'aviso' : 'avisos'}` : 'tudo em dia'}</span>
          <PopoverClose
            aria-label="Fechar alertas"
            className="grid size-7 cursor-pointer place-items-center rounded-[7px] text-apagado hover:bg-hover hover:text-texto"
          >
            <XIcon className="size-4" />
          </PopoverClose>
        </div>
        {n ? (
          alertas.map((a) => (
            <button
              key={a.k}
              type="button"
              onClick={() => {
                setAberto(false);
                router.push(a.href);
              }}
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-[9px] p-2.5 text-left text-texto-2 transition-colors hover:bg-hover focus-visible:bg-hover"
            >
              <i className={cn('size-2 shrink-0 rounded-full', a.nivel === 'red' ? 'bg-vermelho' : 'bg-ambar')} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <b className="font-semibold text-texto">{a.t}</b>
                <small className="text-sm leading-[1.35] text-apagado">{a.d}</small>
              </span>
              <Badge tom={a.nivel}>{a.n}</Badge>
            </button>
          ))
        ) : (
          <p className="px-3 py-[18px] text-apagado">Nenhum alerta para o seu acesso agora.</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
