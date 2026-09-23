'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { OpcoesCurso } from '@/lib/cursos';
import { cn } from '@/lib/utils';

export type HorarioModulo = { dia: number; hora: string; professorId: string };
type Funcionamento = OpcoesCurso['funcionamento'][number];

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const HORAS = Array.from({ length: 17 }, (_, i) => 6 + i);
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;
/** Débora Esteves → Débora E. */
export const nomeCurto = (n: string) => {
  const p = n.trim().split(/\s+/);
  return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0];
};

/**
 * Grade do módulo Open-Entry (24/09/2026): dia × hora, das 06h às 22h. Cada célula aberta no funcionamento
 * (Configurações › Dias e horários) é marcável: marcar escolhe o professor daquele horário; a célula marcada
 * mostra o professor e troca ou remove. Fora do funcionamento a célula fica apagada e travada.
 */
export function GradeModulo({
  valor,
  aoMudar,
  professores,
  funcionamento,
  rotulo,
}: {
  valor: HorarioModulo[];
  aoMudar: (v: HorarioModulo[]) => void;
  professores: { v: string; l: string }[];
  funcionamento: Funcionamento[];
  rotulo: string;
}) {
  const aberto = (d: number) => funcionamento.find((f) => f.dia === d);
  /* domingo só entra se a escola abrir */
  const dias = [1, 2, 3, 4, 5, 6, ...(aberto(0)?.aberto ? [0] : [])];
  const livre = (d: number, h: number) => {
    const f = aberto(d);
    return !!f?.aberto && hh(h) >= f.inicio && hh(h) < f.fim;
  };
  const nomeDe = (id: string) => professores.find((p) => p.v === id)?.l ?? '—';
  const naCelula = (d: number, h: number) =>
    valor.map((x, i) => ({ ...x, i })).filter((x) => x.dia === d && Number.parseInt(x.hora, 10) === h);
  const poe = (d: number, h: number, professorId: string, i?: number) =>
    aoMudar(
      i == null
        ? [...valor, { dia: d, hora: hh(h), professorId }]
        : valor.map((x, j) => (j === i ? { ...x, professorId } : x)),
    );
  const tira = (i: number) => aoMudar(valor.filter((_, j) => j !== i));

  return (
    <div className="overflow-x-auto rounded-md border border-borda bg-card">
      <table className="w-full min-w-[560px] table-fixed border-collapse text-sm" aria-label={`Grade de ${rotulo}`}>
        <colgroup>
          <col className="w-14" />
        </colgroup>
        <thead>
          <tr className="border-b border-borda">
            <th scope="col">
              <span className="sr-only">Hora</span>
            </th>
            {dias.map((d) => (
              <th key={d} scope="col" className="py-2.5 font-semibold text-texto">
                {DIAS[d]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {HORAS.map((h) => (
            <tr key={h} className="border-b border-borda-suave last:border-0">
              <th scope="row" className="px-3 text-left font-medium text-texto-2">
                {String(h).padStart(2, '0')}h
              </th>
              {dias.map((d) => {
                const aqui = naCelula(d, h);
                const pode = livre(d, h);
                return (
                  <td key={d} className="h-9 px-1 text-center align-middle">
                    <div className="flex flex-wrap items-center justify-center gap-1">
                      {aqui.map((x) => (
                        <Celula
                          key={x.i}
                          rotulo={`${DIAS[d]} ${x.hora}: ${nomeDe(x.professorId)}`}
                          professores={professores}
                          atual={x.professorId}
                          escolhe={(p) => poe(d, h, p, x.i)}
                          remove={() => tira(x.i)}
                        >
                          <span className="inline-flex h-6 max-w-full items-center truncate rounded-[5px] bg-azul px-1.5 text-xs font-semibold text-white">
                            {x.hora.endsWith(':00') ? '' : `${x.hora} · `}
                            {nomeCurto(nomeDe(x.professorId))}
                          </span>
                        </Celula>
                      ))}
                      {!aqui.length &&
                        (pode ? (
                          <Celula
                            rotulo={`${DIAS[d]} ${hh(h)}: livre, marcar e escolher o professor`}
                            professores={professores}
                            escolhe={(p) => poe(d, h, p)}
                          >
                            <span className="inline-block size-5 rounded-[5px] border border-borda-forte bg-card transition-colors group-hover:border-azul" />
                          </Celula>
                        ) : (
                          <span
                            className="inline-block size-5 rounded-[5px] bg-[#f3f5f9] dark:bg-hover"
                            role="img"
                            aria-label={`${DIAS[d]} ${hh(h)}: fora do horário de funcionamento`}
                            title="fora do horário de funcionamento"
                          />
                        ))}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** célula clicável: abre a lista de professores (e Remover, quando já marcada) */
function Celula({
  rotulo,
  professores,
  atual,
  escolhe,
  remove,
  children,
}: {
  rotulo: string;
  professores: { v: string; l: string }[];
  atual?: string;
  escolhe: (p: string) => void;
  remove?: () => void;
  children: React.ReactNode;
}) {
  const [aberta, setAberta] = useState(false);
  const [busca, setBusca] = useState('');
  const lista = professores.filter((p) => p.l.toLowerCase().includes(busca.trim().toLowerCase()));
  const fecha = () => {
    setAberta(false);
    setBusca('');
  };
  return (
    <Popover open={aberta} onOpenChange={(v) => (v ? setAberta(true) : fecha())}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={rotulo}
          title={rotulo}
          className="group inline-flex max-w-full cursor-pointer items-center justify-center rounded-[5px] p-0.5 focus-visible:outline-2 focus-visible:outline-azul"
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="center">
        <p className="m-0 px-2 pt-1 pb-2 font-semibold text-texto">{rotulo.split(':')[0]}</p>
        {professores.length > 8 && (
          <Input
            aria-label="Buscar professor"
            placeholder="Buscar professor"
            className="mb-2"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        )}
        <ul className="m-0 max-h-60 list-none overflow-y-auto p-0" aria-label="Professores">
          {lista.map((p) => (
            <li key={p.v}>
              <button
                type="button"
                aria-current={p.v === atual || undefined}
                onClick={() => {
                  escolhe(p.v);
                  fecha();
                }}
                className={cn(
                  'w-full cursor-pointer rounded-md px-2 py-1.5 text-left hover:bg-hover',
                  p.v === atual && 'bg-azul-suave font-semibold text-azul',
                )}
              >
                {p.l}
              </button>
            </li>
          ))}
          {!lista.length && <li className="px-2 py-1.5 text-apagado">nenhum professor</li>}
        </ul>
        {remove && (
          <button
            type="button"
            onClick={() => {
              remove();
              fecha();
            }}
            className="mt-1 w-full cursor-pointer rounded-md border-t border-borda px-2 pt-2 pb-1 text-left text-vermelho hover:bg-hover"
          >
            Remover horário
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
