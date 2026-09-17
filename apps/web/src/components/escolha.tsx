'use client';

import { CheckIcon, ChevronDownIcon } from 'lucide-react';
import { useId, useMemo, useRef, useState } from 'react';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

/** `off`: opção visível mas indisponível (ex.: turma lotada) */
export type Opcao = { v: string; l: string; off?: boolean };
export type Grupo = { rot: string; opcoes: Opcao[] };

const TODOS = '__todos__';
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

/**
 * Seleção do design system: até 11 opções é um select; com 12 ou mais vira text-select (lista com busca).
 * `todos` é o rótulo da opção vazia ("Todos os alunos"); com valor escolhido, o campo fica azul (filtro ativo).
 */
export function Escolha({
  valor,
  aoMudar,
  todos,
  opcoes,
  grupos,
  rotulo,
  className,
  destacar = true,
  disabled,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  todos?: string;
  opcoes?: Opcao[];
  grupos?: Grupo[];
  rotulo: string;
  className?: string;
  destacar?: boolean;
  disabled?: boolean;
}) {
  const gs: Grupo[] = grupos ?? [{ rot: '', opcoes: opcoes ?? [] }];
  const total = gs.reduce((s, g) => s + g.opcoes.length, 0);
  const ativo = destacar && !!valor;
  if (total >= 12) return <Combo {...{ valor, aoMudar, todos, grupos: gs, rotulo, className, ativo, disabled }} />;
  return (
    <Select
      value={valor || (todos != null ? TODOS : undefined)}
      /* o Radix manda '' quando o valor chega antes das opções (o <select> nativo ainda não tem a opção): ignorar */
      onValueChange={(v) => v !== '' && aoMudar(v === TODOS ? '' : v)}
      disabled={disabled}
    >
      <SelectTrigger aria-label={rotulo} ativo={ativo} className={className}>
        <SelectValue placeholder={todos ?? rotulo} />
      </SelectTrigger>
      <SelectContent>
        {todos != null && <SelectItem value={TODOS}>{todos}</SelectItem>}
        {gs.map((g) =>
          g.rot ? (
            <SelectGroup key={g.rot}>
              <SelectLabel>{g.rot}</SelectLabel>
              {g.opcoes.map((o) => (
                <SelectItem key={o.v} value={o.v} disabled={o.off}>
                  {o.l}
                </SelectItem>
              ))}
            </SelectGroup>
          ) : (
            g.opcoes.map((o) => (
              <SelectItem key={o.v} value={o.v} disabled={o.off}>
                {o.l}
              </SelectItem>
            ))
          ),
        )}
      </SelectContent>
    </Select>
  );
}

function Combo({
  valor,
  aoMudar,
  todos,
  grupos,
  rotulo,
  className,
  ativo,
  disabled,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  todos?: string;
  grupos: Grupo[];
  rotulo: string;
  className?: string;
  ativo: boolean;
  disabled?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [q, setQ] = useState('');
  const [foco, setFoco] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const lista = useId();
  const atual = grupos.flatMap((g) => g.opcoes).find((o) => o.v === valor);
  const filtrados = useMemo(() => {
    const n = norm(q);
    return grupos
      .map((g) => ({ ...g, opcoes: g.opcoes.filter((o) => !n || norm(o.l).includes(n)) }))
      .filter((g) => g.opcoes.length);
  }, [grupos, q]);
  const planos: Opcao[] = [
    ...(todos != null && !q ? [{ v: '', l: todos }] : []),
    ...filtrados.flatMap((g) => g.opcoes),
  ];
  const escolhe = (v: string) => {
    aoMudar(v);
    setAberto(false);
    setQ('');
    input.current?.blur();
  };
  const abre = () => {
    if (disabled) return;
    setAberto(true);
    setFoco(
      Math.max(
        0,
        planos.findIndex((o) => o.v === valor),
      ),
    );
  };
  let idx = todos != null && !q ? 1 : 0;

  return (
    <Popover
      open={aberto}
      onOpenChange={(v) => {
        if (v) abre();
        else {
          setAberto(false);
          setQ('');
        }
      }}
    >
      <PopoverAnchor asChild>
        <div className={cn('relative min-w-[180px]', className)}>
          <input
            ref={input}
            role="combobox"
            aria-label={rotulo}
            aria-expanded={aberto}
            aria-controls={lista}
            aria-autocomplete="list"
            aria-activedescendant={aberto ? `${lista}-${foco}` : undefined}
            disabled={disabled}
            value={aberto ? q : (atual?.l ?? todos ?? '')}
            placeholder={atual?.l ?? todos ?? rotulo}
            onFocus={abre}
            onClick={abre}
            onChange={(e) => {
              setQ(e.target.value);
              setFoco(0);
              setAberto(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (!aberto) abre();
                else setFoco((f) => Math.min(planos.length - 1, f + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setFoco((f) => Math.max(0, f - 1));
              } else if (e.key === 'Enter' && aberto) {
                e.preventDefault();
                if (planos[foco] && !planos[foco].off) escolhe(planos[foco].v);
              } else if (e.key === 'Escape') {
                setAberto(false);
                setQ('');
              }
            }}
            className={cn(
              'h-10 w-full cursor-pointer truncate rounded-md border border-borda-forte bg-card pr-9 pl-3 text-sm text-texto transition-[border-color,box-shadow] duration-150 placeholder:text-apagado-2 hover:border-[#b7c1d1] focus:cursor-text focus:border-azul focus:shadow-anel focus-visible:outline-none disabled:opacity-50',
              ativo && !aberto && 'border-azul-linha bg-azul-suave font-semibold text-azul',
            )}
          />
          <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-apagado" />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="max-h-[360px] w-[var(--radix-popover-trigger-width)] min-w-[240px] overflow-auto p-1.5"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div role="listbox" id={lista} aria-label={rotulo}>
          {todos != null && !q && (
            <Item id={`${lista}-0`} on={!valor} ativo={foco === 0} onClick={() => escolhe('')}>
              {todos}
            </Item>
          )}
          {filtrados.map((g) => (
            <div key={g.rot || 'g'} role="group" aria-label={g.rot || undefined}>
              {g.rot && <div className="px-3 pt-2.5 pb-1 font-bold text-apagado">{g.rot}</div>}
              {g.opcoes.map((o) => {
                const i = idx++;
                return (
                  <Item
                    key={o.v}
                    id={`${lista}-${i}`}
                    on={o.v === valor}
                    ativo={foco === i}
                    off={o.off}
                    onClick={() => !o.off && escolhe(o.v)}
                  >
                    {o.l}
                  </Item>
                );
              })}
            </div>
          ))}
          {!planos.length && <div className="p-3 text-apagado">nada encontrado</div>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Item({
  id,
  on,
  ativo,
  off,
  onClick,
  children,
}: {
  id: string;
  on: boolean;
  ativo: boolean;
  off?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={on}
      aria-disabled={off || undefined}
      tabIndex={-1}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      onKeyDown={() => {}}
      className={cn(
        'flex min-h-9 cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-texto-2',
        ativo && 'bg-azul-suave text-azul',
        on && 'font-semibold text-texto',
        off && 'cursor-not-allowed opacity-50',
      )}
    >
      <span className="flex-1">{children}</span>
      {on && <CheckIcon className="size-4 text-azul" />}
    </div>
  );
}
