'use client';

import { Badge } from '@/components/ui/badge';
import type { AgendaResp, AulaItem, EventoItem } from '@/lib/agenda';
import { cn } from '@/lib/utils';

type Item = { q: string; ev?: EventoItem; aula?: AulaItem };
type Abre = { aula: (k: string) => void; evento: (id: string) => void; dia: (iso: string) => void };
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;
const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const tecla = (f: () => void) => (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    e.stopPropagation();
    f();
  }
};

const NumeroDia = ({ n, hoje }: { n: number; hoje: boolean }) => (
  <span className={cn('inline-grid min-w-7 place-items-center', hoje && 'size-8 rounded-full bg-azul text-white')}>
    {n}
  </span>
);

/* ---------- Mensal ---------- */
export function Mensal({ d, abre }: { d: AgendaResp; abre: Abre }) {
  const dias = d.dias ?? [];
  const antes = dias[0]?.dow ?? 0;
  const cel: ((typeof dias)[number] | null)[] = [...Array(antes).fill(null), ...dias];
  while (cel.length % 7) cel.push(null);
  const mesDoHoje = d.hoje.slice(0, 7) === d.ref.slice(0, 7);
  const dowHoje = new Date(`${d.hoje}T12:00:00`).getDay();
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[860px] grid-cols-[repeat(7,minmax(122px,1fr))]">
        {DOW.map((x, k) => (
          <div
            key={x}
            className={cn(
              'border-b border-borda py-2.5 text-center text-apagado',
              k && 'border-l border-borda-suave',
              mesDoHoje && k === dowHoje && 'text-azul',
            )}
          >
            {x}
          </div>
        ))}
        {cel.map((dia, i) => {
          if (!dia)
            return (
              <div
                key={`f${i}`}
                className={cn(
                  'min-h-[122px] border-b border-borda-suave bg-[#fafbfd] dark:bg-hover',
                  i % 7 && 'border-l',
                )}
              />
            );
          const itens: Item[] = [
            ...(d.eventos ?? []).filter((e) => e.iso === dia.iso).map((e) => ({ ev: e, q: e.ini })),
            ...(d.aulas ?? []).filter((a) => a.iso === dia.iso).map((a) => ({ aula: a, q: hh(a.hora) })),
          ];
          /* no mês cabem 3 itens por dia: eventos e reuniões vêm antes das aulas */
          itens.sort((x, y) => (y.ev ? 1 : 0) - (x.ev ? 1 : 0) || x.q.localeCompare(y.q));
          return (
            <div
              key={dia.iso}
              role="button"
              tabIndex={0}
              aria-label={`Abrir ${dia.dia} na visão diária`}
              onClick={() => abre.dia(dia.iso)}
              onKeyDown={tecla(() => abre.dia(dia.iso))}
              className={cn(
                'flex min-h-[122px] cursor-pointer flex-col gap-1 border-b border-borda-suave p-1.5 transition-colors hover:bg-hover',
                i % 7 && 'border-l',
                dia.hoje && 'bg-azul-suave/40',
              )}
            >
              <div className="text-center">
                <NumeroDia n={dia.dia} hoje={dia.hoje} />
              </div>
              {itens.slice(0, 3).map((x) =>
                x.ev ? (
                  <ChipEvento key={x.ev.id} e={x.ev} abre={abre} />
                ) : (
                  <button
                    key={x.aula!.k}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      abre.aula(x.aula!.k);
                    }}
                    className="flex min-w-0 cursor-pointer items-center gap-1.5 rounded-[6px] px-2 py-0.5 text-left text-white hover:brightness-110"
                    style={{ background: x.aula!.cor }}
                  >
                    <span className="shrink-0">{hh(x.aula!.hora)}</span>
                    <span className="truncate">{x.aula!.rotulo}</span>
                  </button>
                ),
              )}
              {itens.length > 3 && <span className="px-1.5 text-apagado">+{itens.length - 3} na agenda do dia</span>}
              {!itens.length && (dia.feriado || dia.dow) ? (
                <span className="mt-auto px-1.5 text-apagado">{dia.feriado ? 'feriado' : 'sem aula'}</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChipEvento({ e, abre }: { e: EventoItem; abre: Abre }) {
  return (
    <button
      type="button"
      onClick={(ev) => {
        ev.stopPropagation();
        abre.evento(e.id);
      }}
      className="flex min-w-0 cursor-pointer items-center gap-1.5 rounded-[6px] border border-borda-forte bg-card px-2 py-0.5 text-left text-texto shadow-el-1 hover:shadow-el-2"
    >
      <i className="size-2 shrink-0 rounded-[2px] bg-texto" />
      <span className="shrink-0">{e.ini}</span>
      <span className="truncate">{e.titulo}</span>
    </button>
  );
}

/* ---------- Semanal ---------- */
const AG_SEM_MAX = 4;
export function Semanal({ d, abre }: { d: AgendaResp; abre: Abre }) {
  const dias = d.dias ?? [];
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[800px] grid-cols-[56px_repeat(7,minmax(104px,1fr))]">
        <div className="grid place-items-center border-b border-borda text-apagado">hora</div>
        {dias.map((dia) => (
          <div
            key={dia.iso}
            className={cn(
              'border-b border-l border-borda border-l-borda-suave py-2 text-center',
              dia.hoje ? 'text-azul' : 'text-apagado',
            )}
          >
            <div>{dia.rot}</div>
            <span className="text-texto">
              <NumeroDia n={dia.dia} hoje={dia.hoje} />
            </span>
            {dia.feriado && <small className="block text-sm">feriado</small>}
          </div>
        ))}
        {(d.regua ?? []).map((h) => (
          <Linha key={h} h={h} dias={dias} d={d} abre={abre} />
        ))}
      </div>
    </div>
  );
}

function Linha({ h, dias, d, abre }: { h: number; dias: NonNullable<AgendaResp['dias']>; d: AgendaResp; abre: Abre }) {
  return (
    <>
      <div className="border-b border-borda-suave px-1 pt-2 text-center text-apagado">{hh(h)}</div>
      {dias.map((dia) => {
        const itens: Item[] = [
          ...(d.aulas ?? []).filter((a) => a.iso === dia.iso && a.hora === h).map((a) => ({ q: hh(a.hora), aula: a })),
          ...(d.eventos ?? []).filter((e) => e.iso === dia.iso && e.hora === h).map((e) => ({ q: e.ini, ev: e })),
        ].sort((x, y) => x.q.localeCompare(y.q));
        const fora = !dia.dow || dia.feriado;
        return (
          <div
            key={dia.iso}
            className={cn(
              'flex min-h-[152px] min-w-0 flex-col gap-1 border-b border-l border-borda-suave p-1',
              dia.hoje && 'bg-azul-suave/40',
              fora && 'bg-[#fafbfd] dark:bg-hover',
            )}
          >
            {itens.slice(0, AG_SEM_MAX).map((x) =>
              x.aula ? (
                <BlocoAula key={x.aula.k} a={x.aula} abre={abre} mini />
              ) : (
                <button
                  key={x.ev!.id}
                  type="button"
                  onClick={() => abre.evento(x.ev!.id)}
                  className="min-w-0 cursor-pointer rounded-[6px] border border-borda-forte bg-card px-2 py-1 text-left shadow-el-1 hover:shadow-el-2"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <i className="size-2 shrink-0 rounded-[2px] bg-texto" />
                    <span className="truncate">{x.ev!.titulo}</span>
                  </span>
                  <span className="block truncate text-apagado">
                    {x.ev!.ini}–{x.ev!.fim} · {x.ev!.nPart} {x.ev!.nPart === 1 ? 'pessoa' : 'pessoas'}
                  </span>
                </button>
              ),
            )}
            {itens.length > AG_SEM_MAX && (
              <button
                type="button"
                onClick={() => abre.dia(dia.iso)}
                className="cursor-pointer px-1 text-left text-azul hover:underline"
              >
                +{itens.length - AG_SEM_MAX} na visão diária
              </button>
            )}
          </div>
        );
      })}
    </>
  );
}

function BlocoAula({ a, abre, mini }: { a: AulaItem; abre: Abre; mini?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => abre.aula(a.k)}
      className={cn(
        'min-w-0 cursor-pointer rounded-[6px] text-left text-white hover:brightness-110',
        mini ? 'px-2 py-1' : 'flex-[1_1_300px] rounded-md px-3 py-2',
      )}
      style={{ background: a.cor }}
    >
      {mini ? (
        <>
          <span className="block truncate">{a.rotulo}</span>
          <span className="block truncate opacity-90">
            {a.quem} · {a.n}/{a.vagas}
          </span>
        </>
      ) : (
        <>
          <span className="block">{a.rotulo}</span>
          <span className="block opacity-90">
            {hh(a.hora)} · {a.quem} ·{' '}
            {a.prof === '—' ? <span className="opacity-80">professor a definir</span> : a.prof}
          </span>
          <span className="block opacity-90">
            {a.sala} · {a.n}/{a.vagas} {a.vagas === 1 ? 'aluno' : 'alunos'}
          </span>
        </>
      )}
    </button>
  );
}

/* ---------- Diária ---------- */
export function Diaria({ d, abre }: { d: AgendaResp; abre: Abre }) {
  const dia = d.dias?.[0];
  if (!dia) return null;
  const aulas = d.aulas ?? [];
  const evs = d.eventos ?? [];
  return (
    <div className="grid grid-cols-[70px_minmax(0,1fr)]">
      <div className="grid place-items-center border-b border-borda text-apagado">hora</div>
      <div
        className={cn(
          'border-b border-l border-borda border-l-borda-suave py-2 text-center',
          dia.hoje ? 'text-azul' : 'text-apagado',
        )}
      >
        <div>{d.diaSemana}</div>
        <NumeroDia n={dia.dia} hoje={dia.hoje} />
        <small className="block text-sm text-apagado">
          {[
            aulas.length ? `${aulas.length}${aulas.length === 1 ? ' aula' : ' aulas'}` : '',
            evs.length ? `${evs.length}${evs.length === 1 ? ' evento' : ' eventos'}` : '',
          ]
            .filter(Boolean)
            .join(' · ')}
        </small>
      </div>
      {(d.regua ?? []).map((h) => (
        <div key={h} className="contents">
          <div className="border-b border-borda-suave px-2 pt-3 text-right text-apagado">{hh(h)}</div>
          <div
            className={cn(
              'flex min-h-[62px] flex-wrap gap-1.5 border-b border-l border-borda-suave p-1.5',
              dia.hoje && h === d.horaAgora && 'bg-azul-suave/50',
            )}
          >
            {evs
              .filter((e) => e.hora === h)
              .map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => abre.evento(e.id)}
                  className="min-w-0 flex-[1_1_300px] cursor-pointer rounded-md border border-borda-forte bg-card px-3 py-2 text-left shadow-el-1 hover:shadow-el-2"
                >
                  <span>{e.titulo}</span> <Badge tom={e.tipo === 'Reunião' ? 'blue' : 'purple'}>{e.tipo}</Badge>
                  <span className="block text-apagado">
                    {e.ini}–{e.fim} · {e.pessoas}
                  </span>
                  <span className="block text-apagado">{e.local}</span>
                </button>
              ))}
            {aulas
              .filter((a) => a.hora === h)
              .map((a) => (
                <BlocoAula key={a.k} a={a} abre={abre} />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Kanban ---------- */
export function Kanban({ d, abre }: { d: AgendaResp; abre: Abre }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {(d.colunas ?? []).map((c) => (
        <section
          key={c.k}
          aria-label={c.rot}
          className="flex w-[184px] shrink-0 flex-col gap-2 rounded-lg bg-[#e6eaf2] p-2.5 dark:bg-hover"
        >
          <div className="flex items-start gap-2 text-texto">
            <i className="mt-[7px] size-2 shrink-0 rounded-full" style={{ background: c.cor }} />
            <span className="flex-1">{c.rot}</span>
            <span className="rounded-full bg-card px-2 text-sm text-texto-2">{c.aulas.length}</span>
          </div>
          <p className="leading-[1.4] text-apagado">{c.desc}</p>
          {c.aulas.length ? (
            c.aulas.map((a) => (
              <button
                key={a.k}
                type="button"
                onClick={() => abre.aula(a.k)}
                className="cursor-pointer rounded-md border border-borda bg-card p-2.5 text-left shadow-el-1 transition-shadow hover:shadow-el-3"
              >
                <div className="flex gap-1.5 text-texto-2">
                  <i className="mt-[7px] size-2 shrink-0 rounded-full" style={{ background: a.cor }} />
                  <span>{a.quando}</span>
                </div>
                <span className="block text-texto">{a.rotulo}</span>
                <span className="block text-apagado">
                  {a.mod && !/^Turma /.test(a.mod) ? `${a.prod} · ` : ''}
                  {a.quem}
                </span>
                <span className="block text-apagado">
                  {a.prof === '—' ? 'professor a definir' : a.sub ? `${a.prof} no lugar de ${a.sub}` : a.prof}
                </span>
                <span className="block text-apagado">{a.sala}</span>
                <Badge className="mt-1.5">
                  {a.n}/{a.vagas}
                  {a.vagas === 1 ? ' aluno' : ' alunos'}
                </Badge>
              </button>
            ))
          ) : (
            <div className="py-3 text-center text-apagado">nenhuma aula no período</div>
          )}
        </section>
      ))}
    </div>
  );
}
