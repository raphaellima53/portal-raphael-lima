'use client';

import { ChevronDownIcon, SlidersHorizontalIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useSalvarDashboard } from '@/lib/consultas';
import type { Dashboard } from '@/lib/tipos';
import { cn } from '@/lib/utils';

/** Seletor com checkboxes: edita um rascunho; só Salvar grava (por usuário, no banco). */
export function Personalizar({
  d,
  nome,
  aoSalvar,
}: {
  d: Dashboard;
  nome: string;
  aoSalvar: (msg: { txt: string; erro?: boolean }) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [rasc, setRasc] = useState<string[]>(d.marcados);
  const salvar = useSalvarDashboard();

  const abrir = (on: boolean) => {
    if (on) setRasc(d.marcados);
    setAberto(on);
  };
  const marca = (k: string, on: boolean) => setRasc((r) => (on ? [...r, k] : r.filter((x) => x !== k)));
  const grupo = (g: string, on: boolean) => {
    const ks = d.disponiveis.filter((b) => b.g === g).map((b) => b.k);
    setRasc((r) => (on ? [...new Set([...r, ...ks])] : r.filter((x) => !ks.includes(x))));
  };
  const mudou = rasc.length !== d.marcados.length || rasc.some((k) => !d.marcados.includes(k));

  return (
    <Popover open={aberto} onOpenChange={abrir}>
      <PopoverTrigger asChild>
        <Button className={cn(aberto && 'border-azul bg-azul-suave text-azul')}>
          <SlidersHorizontalIcon /> Personalizar · {d.marcados.length} de {d.disponiveis.length} blocos
          <ChevronDownIcon className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(560px,calc(100vw-24px))] p-0"
        aria-label="Escolher os blocos do dashboard"
      >
        <div className="border-b border-borda-suave px-4 pt-3.5 pb-2.5">
          <b className="block text-texto">Blocos do dashboard</b>
          <span className="mt-0.5 block leading-[1.45] text-apagado">
            Marque o que quer ver na tela inicial e salve. A configuração vale para {nome}; só aparecem os blocos que o
            seu acesso permite.
          </span>
        </div>
        <div className="max-h-[min(58vh,520px)] overflow-y-auto px-4 pt-1 pb-2">
          {d.grupos.map((g) => (
            <fieldset key={g} className="border-b border-dashed border-borda-suave py-2 last:border-b-0">
              <legend className="sr-only">{g}</legend>
              <div className="mb-0.5 flex items-center gap-2.5 font-bold text-texto-2">
                {g}
                <span className="flex-1" />
                <button
                  type="button"
                  className="min-h-[24px] cursor-pointer font-medium text-azul hover:underline"
                  onClick={() => grupo(g, true)}
                >
                  marcar todos
                </button>
                <button
                  type="button"
                  className="min-h-[24px] cursor-pointer font-medium text-azul hover:underline"
                  onClick={() => grupo(g, false)}
                >
                  desmarcar
                </button>
              </div>
              {d.disponiveis
                .filter((b) => b.g === g)
                .map((b) => (
                  <label
                    key={b.k}
                    htmlFor={`dash-${b.k}`}
                    className="flex cursor-pointer items-start gap-2.5 rounded-sm p-1.5 hover:bg-hover"
                  >
                    <Checkbox
                      id={`dash-${b.k}`}
                      className="mt-0.5"
                      checked={rasc.includes(b.k)}
                      onCheckedChange={(v) => marca(b.k, v === true)}
                    />
                    <span>
                      <b className="block font-semibold text-texto">{b.t}</b>
                      <small className="block text-sm leading-[1.4] text-apagado">{b.d}</small>
                    </span>
                  </label>
                ))}
            </fieldset>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-borda-suave px-4 py-3">
          <span className="basis-full text-apagado" aria-live="polite">
            {!rasc.length ? (
              <span className="text-vermelho">marque ao menos um bloco para salvar</span>
            ) : (
              <>
                {rasc.length} de {d.disponiveis.length} marcados ·{' '}
                {mudou ? <b>alterações não salvas</b> : 'igual à configuração atual'}
              </>
            )}
          </span>
          <Button size="sm" className="ml-auto" onClick={() => setRasc(d.padrao)}>
            Restaurar padrão
          </Button>
          <Button size="sm" onClick={() => abrir(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={!rasc.length || salvar.isPending}
            onClick={() =>
              salvar.mutate(rasc, {
                onSuccess: (r) => {
                  setAberto(false);
                  aoSalvar({
                    txt: `Configuração salva: ${r.blocos.length} ${r.blocos.length === 1 ? 'bloco' : 'blocos'}. O dashboard abre assim da próxima vez que ${nome} entrar.`,
                  });
                },
                onError: (e) => aoSalvar({ txt: e.message, erro: true }),
              })
            }
          >
            Salvar configuração
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
