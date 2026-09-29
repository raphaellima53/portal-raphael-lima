'use client';

import { CalendarPlusIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Trilho } from '@/components/ds';
import { Escolha } from '@/components/escolha';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHead, CardTitle } from '@/components/ui/card';
import { Dialog, DialogBody, DialogContent, DialogFoot, DialogHead } from '@/components/ui/dialog';
import { useAgendarFlow, useCancelarFlow, useFlow } from '@/lib/flow';
import { cn } from '@/lib/utils';

const plural = (n: number, um: string, varios: string) => `${n.toLocaleString('pt-BR')} ${n === 1 ? um : varios}`;

/**
 * Community Flow: créditos de aula particular (1 a cada 5 presenças nas aulas dos níveis) e o agendamento num horário
 * livre da grade do módulo. Na Minha agenda é do próprio aluno; na ficha, a equipe agenda pelo aluno (`alunoId`).
 */
export function FlowCartao({
  alunoId,
  podeAgendar = true,
  aoAgendada,
}: {
  alunoId?: number;
  podeAgendar?: boolean;
  aoAgendada?: (r: { msg: string; k: string; data: string }) => void;
}) {
  const q = useFlow(alunoId);
  const cancelar = useCancelarFlow();
  const [abre, setAbre] = useState(false);
  const [msg, setMsg] = useState('');
  const [erroMsg, setErroMsg] = useState('');
  const d = q.data;
  if (!d?.adesao) return null;
  const pct = ((d.aCada - d.faltam) / d.aCada) * 100;
  const semHorario = !d.dias.length;
  return (
    <Card className="mb-4 min-w-0" data-flow>
      <CardHead className="flex-wrap">
        <CardTitle>{d.modulo}</CardTitle>
        <Badge tom={d.saldo ? 'green' : 'gray'}>{plural(d.saldo, 'crédito', 'créditos')}</Badge>
        <span className="flex-1" />
        {podeAgendar && (
          <Button
            size="sm"
            variant="primary"
            disabled={!d.saldo || semHorario}
            onClick={() => {
              setMsg('');
              setAbre(true);
            }}
          >
            <CalendarPlusIcon /> Agendar aula particular
          </Button>
        )}
      </CardHead>
      <div className="grid gap-3 px-5 py-4">
        <p className="text-texto-2">
          A cada {d.aCada} presenças nas aulas dos níveis, 1 crédito de aula particular para agendar num horário livre.
          Contando desde a adesão, em {d.desde}. Agendar {d.regras.agendar} e cancelar {d.regras.cancelar} da aula.
        </p>
        <div className="grid gap-1.5">
          <div className="flex flex-wrap justify-between gap-2">
            <span className="font-medium text-texto">
              {d.faltam === d.aCada && d.presencas
                ? 'Crédito novo liberado'
                : `Faltam ${plural(d.faltam, 'presença', 'presenças')} para o próximo crédito`}
            </span>
            <span className="text-apagado tabular-nums">
              {plural(d.presencas, 'presença', 'presenças')} · {plural(d.ganhos, 'crédito ganho', 'créditos ganhos')} ·{' '}
              {plural(d.usados, 'usado', 'usados')}
            </span>
          </div>
          <Trilho
            pct={pct}
            cor="var(--blue)"
            rotulo={`${d.aCada - d.faltam} de ${d.aCada} presenças para o próximo crédito`}
          />
        </div>
        {!d.saldo ? null : semHorario ? (
          <p className="text-apagado">Nenhum horário livre nos próximos {d.janela} dias. Volte mais tarde.</p>
        ) : null}
        {d.agendadas.length > 0 && (
          <div>
            <h3 className="mb-1.5 font-semibold text-texto">Aulas particulares agendadas</h3>
            <ul className="grid gap-1">
              {d.agendadas.map((a) => (
                <li key={a.k} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-texto-2">
                  <span className="min-w-0 flex-1">
                    {a.data} · {a.horario} · {a.prof}
                    <small className="block text-sm text-apagado">
                      {a.podeCancelar
                        ? `cancelar até ${a.cancelarAte}`
                        : `prazo para cancelar terminou em ${a.cancelarAte}`}
                    </small>
                  </span>
                  {alunoId == null && a.podeCancelar && (
                    <Button
                      size="sm"
                      disabled={cancelar.isPending}
                      aria-label={`Cancelar a aula de ${a.data} ${a.horario}`}
                      onClick={() =>
                        cancelar.mutate(a.k, {
                          onSuccess: (r) => {
                            setErroMsg('');
                            setMsg(r.msg);
                          },
                          onError: (e) => {
                            setMsg('');
                            setErroMsg(e.message);
                          },
                        })
                      }
                    >
                      Cancelar
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {msg && (
          <p role="status" className="font-medium text-verde">
            {msg}
          </p>
        )}
        {erroMsg && (
          <p role="alert" className="font-medium text-vermelho">
            {erroMsg}
          </p>
        )}
      </div>
      <AgendarFlow
        abre={abre}
        alunoId={alunoId}
        aoFechar={() => setAbre(false)}
        aoAgendada={(r) => {
          setAbre(false);
          setMsg(r.msg);
          aoAgendada?.(r);
        }}
      />
    </Card>
  );
}

function AgendarFlow({
  abre,
  alunoId,
  aoFechar,
  aoAgendada,
}: {
  abre: boolean;
  alunoId?: number;
  aoFechar: () => void;
  aoAgendada: (r: { msg: string; k: string; data: string }) => void;
}) {
  const q = useFlow(alunoId, abre);
  const agendar = useAgendarFlow();
  const d = q.data?.adesao ? q.data : null;
  const [dia, setDia] = useState('');
  const [hora, setHora] = useState('');
  const [erro, setErro] = useState('');

  // biome-ignore lint/correctness/useExhaustiveDependencies: reinicia ao abrir
  useEffect(() => {
    if (!abre) return;
    setDia('');
    setHora('');
    setErro('');
  }, [abre]);
  const dias = d?.dias ?? [];
  const escolhido = dias.find((x) => x.data === dia) ?? dias[0];

  const enviar = () => {
    if (!escolhido || !hora) return setErro('Escolha o dia e o horário.');
    agendar.mutate(
      { alunoId, data: escolhido.data, hora },
      { onSuccess: aoAgendada, onError: (e) => setErro(e.message) },
    );
  };

  return (
    <Dialog open={abre} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent tamanho="md">
        <DialogHead
          titulo="Agendar aula particular"
          descricao={d ? `${d.modulo} · ${plural(d.saldo, 'crédito disponível', 'créditos disponíveis')}` : undefined}
        />
        <DialogBody className="grid gap-4">
          {!d ? (
            <p className="text-apagado">Carregando os horários…</p>
          ) : !dias.length ? (
            <p className="text-apagado">Nenhum horário livre nos próximos {d.janela} dias.</p>
          ) : (
            <>
              <div className="grid gap-1.5">
                <span className="font-semibold text-texto-2">Dia</span>
                <Escolha
                  rotulo="Dia da aula"
                  destacar={false}
                  valor={escolhido?.data ?? ''}
                  aoMudar={(v) => {
                    setDia(v);
                    setHora('');
                  }}
                  opcoes={dias.map((x) => ({
                    v: x.data,
                    l: `${x.txt} · ${plural(x.horas.length, 'horário', 'horários')} com vaga`,
                  }))}
                />
              </div>
              <fieldset className="grid gap-1.5">
                <legend className="mb-1.5 font-semibold text-texto-2">Horário</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {escolhido?.horas.map((h) => (
                    <button
                      key={h.hora}
                      type="button"
                      aria-pressed={hora === h.hora}
                      className={cn(
                        'grid gap-0.5 rounded-md border border-borda bg-card px-3 py-2 text-left transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-azul',
                        hora === h.hora && 'border-azul-linha bg-azul-suave hover:bg-azul-suave',
                      )}
                      onClick={() => setHora(h.hora)}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className={cn('font-semibold tabular-nums text-texto', hora === h.hora && 'text-azul')}>
                          {h.hora}
                        </span>
                        <Badge tom={h.vagas === 1 && h.total > 1 ? 'amber' : 'green'}>
                          {plural(h.vagas, 'vaga', 'vagas')}
                        </Badge>
                      </span>
                      <span className="text-texto-2">Professor: {h.prof}</span>
                    </button>
                  ))}
                </div>
                <span className="text-apagado">
                  aula de {d.duracao} minutos; quem agendar o mesmo horário participa da mesma aula
                </span>
              </fieldset>
            </>
          )}
        </DialogBody>
        <DialogFoot>
          {erro && (
            <span role="alert" className="mr-auto font-medium text-vermelho">
              {erro}
            </span>
          )}
          <Button onClick={aoFechar}>Cancelar</Button>
          <Button variant="primary" disabled={agendar.isPending || !d?.saldo || !hora} onClick={enviar}>
            Agendar
          </Button>
        </DialogFoot>
      </DialogContent>
    </Dialog>
  );
}
