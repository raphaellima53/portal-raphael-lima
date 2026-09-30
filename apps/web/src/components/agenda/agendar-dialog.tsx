'use client';

import { ClockIcon, UsersIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Aviso } from '@/components/ds';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFoot, DialogHead } from '@/components/ui/dialog';
import { type AutoAgenda, type SlotAgendar, useAgendarAula, useAutoAgenda } from '@/lib/agenda';
import { fundoCor } from '@/lib/cor';
import { useAgendarFlow } from '@/lib/flow';
import { cn } from '@/lib/utils';
import { iniciais } from './aula-comum';

export type AbreAgendar = { dia: string; hora?: number } | null;
const plural = (n: number, um: string, varios: string) => `${n.toLocaleString('pt-BR')} ${n === 1 ? um : varios}`;

/**
 * Agendar aula (25/09/2026): o aluno clica num dia (ou dia e hora) da Minha agenda e vê as aulas dos cursos
 * Open-Entry em que tem matrícula, por curso e módulo, com créditos, tópico, horário, professor e ocupação.
 * Os horários do Community Flow vêm num grupo próprio. A hora clicada fica destacada.
 */
export function AgendarDialog({
  abre,
  aoFechar,
  aoAgendada,
}: {
  abre: AbreAgendar;
  aoFechar: () => void;
  aoAgendada?: (k: string) => void;
}) {
  const q = useAutoAgenda(abre?.dia ?? null);
  const [msg, setMsg] = useState<{ txt: string; erro?: boolean } | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: outro dia começa sem mensagem
  useEffect(() => setMsg(null), [abre?.dia, abre?.hora]);
  const d = q.data;
  return (
    <Dialog open={!!abre} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent tamanho="md">
        <DialogHead titulo={`Agendar aula — ${d?.titulo ?? '…'}`} />
        <DialogBody className="grid gap-5">
          {msg && (
            <Aviso tom={msg.erro ? 'red' : 'blue'} icone={msg.erro ? 'alerta' : 'ok'}>
              {msg.txt}
            </Aviso>
          )}
          {q.isError ? (
            <Aviso tom="red" icone="alerta">
              {q.error.message}
            </Aviso>
          ) : !d ? (
            <p className="text-apagado">Carregando as aulas do dia…</p>
          ) : d.passado ? (
            <p className="text-apagado">Este dia já passou. Escolha um dia a partir de hoje.</p>
          ) : !d.grupos.length ? (
            <p className="text-apagado">Você não tem matrícula em curso com agendamento pelo aluno.</p>
          ) : (
            d.grupos.map((g) => (
              <Grupo
                key={`${g.curso}|${g.mod}`}
                g={g}
                dia={d.data}
                hora={abre?.hora}
                aoMsg={setMsg}
                aoAgendada={aoAgendada}
              />
            ))
          )}
        </DialogBody>
        <DialogFoot>
          <Button onClick={aoFechar}>Fechar</Button>
        </DialogFoot>
      </DialogContent>
    </Dialog>
  );
}

function Grupo({
  g,
  dia,
  hora,
  aoMsg,
  aoAgendada,
}: {
  g: AutoAgenda['grupos'][number];
  dia: string;
  hora?: number;
  aoMsg: (m: { txt: string; erro?: boolean }) => void;
  aoAgendada?: (k: string) => void;
}) {
  const aula = useAgendarAula();
  const flow = useAgendarFlow();
  const ocupado = aula.isPending || flow.isPending;
  const agendar = (s: SlotAgendar) => {
    const ok = (r: { msg: string; k: string }) => {
      aoMsg({ txt: r.msg });
      aoAgendada?.(r.k);
    };
    const erro = (e: Error) => aoMsg({ txt: e.message, erro: true });
    if (g.flow) flow.mutate({ data: dia, hora: s.ini }, { onSuccess: ok, onError: erro });
    else aula.mutate(s.k, { onSuccess: ok, onError: erro });
  };
  return (
    <section aria-label={`${g.curso} · ${g.mod}`} className="grid gap-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-[6px] px-2 py-0.5 font-semibold text-white" style={fundoCor(g.corCurso)}>
          {g.curso}
        </span>
        <span className="rounded-[6px] px-2 py-0.5 font-semibold text-white" style={fundoCor(g.corMod || g.corCurso)}>
          {g.mod}
        </span>
        <Badge tom={g.creditos ? 'green' : 'gray'}>{plural(g.creditos, 'crédito', 'créditos')}</Badge>
        <span className="text-apagado">agendar {g.regra}</span>
      </div>
      {g.aulas.length ? (
        <ul className="grid gap-2">
          {g.aulas.map((s) => (
            <Slot
              key={s.k}
              s={s}
              destaque={hora != null && Number(s.ini.slice(0, 2)) === hora}
              ocupado={ocupado}
              flow={g.flow}
              aoAgendar={() => agendar(s)}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg bg-bg px-4 py-3 text-apagado">
          {g.flow ? 'Nenhum horário do Community Flow com vaga neste dia.' : 'Nenhuma aula com vaga neste dia.'}
        </p>
      )}
    </section>
  );
}

function Slot({
  s,
  destaque,
  ocupado,
  flow,
  aoAgendar,
}: {
  s: SlotAgendar;
  destaque: boolean;
  ocupado: boolean;
  flow: boolean;
  aoAgendar: () => void;
}) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (destaque) ref.current?.scrollIntoView({ block: 'nearest' });
  }, [destaque]);
  return (
    <li
      ref={ref}
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-lg bg-bg px-4 py-3',
        destaque && 'ring-2 ring-azul-linha',
      )}
    >
      <div className="grid min-w-0 flex-1 gap-1.5">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <b className="text-texto">{s.topico}</b>
          <span className="inline-flex items-center gap-1 text-texto-2 tabular-nums">
            <ClockIcon className="size-4 text-apagado" aria-hidden /> {s.ini} – {s.fim}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            aria-hidden
            className="grid size-7 shrink-0 place-items-center rounded-full bg-cinza-suave text-sm font-bold text-texto-2"
          >
            {s.prof === 'Professor a definir' ? '?' : iniciais(s.prof)}
          </span>
          <span className="text-texto-2">{s.prof}</span>
          <span
            className="inline-flex items-center gap-1 rounded-[6px] bg-card px-2 py-0.5 text-sm text-texto-2 tabular-nums"
            title={flow ? 'vagas ocupadas neste horário' : 'alunos agendados nesta aula'}
          >
            <UsersIcon className="size-3.5" aria-hidden />
            <span className="sr-only">ocupação</span> {s.n}/{s.vagas}
          </span>
        </div>
        {s.trava && <small className="text-sm text-apagado">{s.trava}</small>}
      </div>
      <Button
        variant="primary"
        disabled={ocupado || !!s.trava}
        aria-label={`Agendar ${s.topico} das ${s.ini} às ${s.fim}`}
        onClick={aoAgendar}
      >
        Agendar
      </Button>
    </li>
  );
}
