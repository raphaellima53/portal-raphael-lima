'use client';

import { PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Msg } from '@/components/alunos/comum';
import { Aviso, PageHead } from '@/components/ds';
import { Escolha } from '@/components/escolha';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFoot, DialogHead } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type Funil, useAcao, useFunil } from '@/lib/acoes';
import { Busca, normaliza } from './alocacao';

/** Comercial › Funil de vendas: leads por etapa, com avançar, perder, reabrir e matricular */
export function TelaFunil({ abas }: { abas: React.ReactNode }) {
  const q = useFunil();
  const acao = useAcao();
  const [msg, setMsg] = useState<(NonNullable<Msg> & { alunoId?: number }) | null>(null);
  const [busca, setBusca] = useState('');
  const [consultor, setConsultor] = useState('');
  const [curso, setCurso] = useState('');
  const [origem, setOrigem] = useState('');
  const [perder, setPerder] = useState<Funil['leads'][number] | null>(null);
  const [novo, setNovo] = useState(false);
  const d = q.data;
  const ls = (d?.leads ?? []).filter(
    (l) =>
      (!consultor || l.consultor === consultor) &&
      (!curso || l.curso === curso) &&
      (!origem || l.origem === origem) &&
      (!busca || normaliza([l.nome, l.email, l.curso, l.origem, l.consultor].join(' ')).includes(normaliza(busca))),
  );
  const faz = (caminho: string, json?: unknown, depois?: () => void) =>
    acao.mutate(
      { caminho, json },
      {
        onSuccess: (r) => {
          depois?.();
          setMsg({ txt: r.msg, alunoId: r.alunoId });
        },
        onError: (e) => setMsg({ txt: e.message, erro: true }),
      },
    );
  const op = d?.podeOperar;

  return (
    <>
      <PageHead
        titulo="Funil de vendas"
        acoes={
          op ? (
            <Button variant="primary" onClick={() => setNovo(true)}>
              <PlusIcon /> Novo lead
            </Button>
          ) : null
        }
      />
      {abas}
      {msg && (
        <Aviso tom={msg.erro ? 'red' : 'blue'} icone={msg.erro ? 'alerta' : 'ok'}>
          {msg.txt}{' '}
          {msg.alunoId && (
            <Link href={`/alunos/${msg.alunoId}/cursos`} className="font-semibold text-azul hover:underline">
              Abrir a ficha
            </Link>
          )}
        </Aviso>
      )}
      {q.isError && (
        <Aviso tom="red" icone="alerta">
          {q.error.message}
        </Aviso>
      )}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Busca rotulo="Buscar lead" valor={busca} aoMudar={setBusca} />
        <div className="flex flex-wrap items-center gap-2">
          <Escolha
            rotulo="Consultor"
            todos="Todos os consultores"
            valor={consultor}
            aoMudar={setConsultor}
            opcoes={(d?.consultores ?? []).map((x) => ({ v: x, l: x }))}
            className="w-[230px]"
          />
          <Escolha
            rotulo="Curso"
            todos="Todos os cursos"
            valor={curso}
            aoMudar={setCurso}
            opcoes={(d?.cursos ?? []).map((x) => ({ v: x, l: x }))}
            className="w-[210px]"
          />
          <Escolha
            rotulo="Origem"
            todos="Todas as origens"
            valor={origem}
            aoMudar={setOrigem}
            opcoes={(d?.origens ?? []).map((x) => ({ v: x, l: x }))}
            className="w-[190px]"
          />
        </div>
      </div>
      <div className="grid auto-cols-[minmax(240px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2">
        {(d?.etapas ?? []).map((e) => {
          const cs = ls.filter((l) => l.etapa === e.k);
          return (
            <section
              key={e.k}
              aria-label={e.t}
              className="flex min-h-[160px] flex-col gap-2 rounded-lg border border-borda bg-bg p-2.5"
            >
              <div className="flex items-center gap-2 px-1">
                <i className="size-2.5 rounded-full" style={{ background: e.cor }} aria-hidden />
                <b className="text-texto">{e.t}</b>
                <span className="ml-auto tabular-nums text-apagado">{cs.length}</span>
              </div>
              {cs.length ? (
                cs.map((l) => (
                  <article
                    key={l.id}
                    className="flex flex-col gap-1 rounded-md border border-borda bg-card p-3 shadow-el-1"
                  >
                    <b className="text-texto">{l.nome}</b>
                    <span className="text-texto-2">{l.curso}</span>
                    <span className="text-apagado">
                      {l.origem} · {l.consultor}
                    </span>
                    <span className="text-apagado">{l.quando}</span>
                    {op && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {l.etapa === 'perdido' ? (
                          <Button size="sm" disabled={acao.isPending} onClick={() => faz(`/funil/${l.id}/reabrir`)}>
                            Reabrir
                          </Button>
                        ) : l.etapa === 'matriculado' ? (
                          l.alunoId ? (
                            <Button asChild size="sm">
                              <Link href={`/alunos/${l.alunoId}/cursos`}>Abrir ficha</Link>
                            </Button>
                          ) : null
                        ) : (
                          <>
                            {l.etapa === 'proposta' ? (
                              <Button
                                size="sm"
                                variant="primary"
                                disabled={acao.isPending}
                                onClick={() => faz(`/funil/${l.id}/matricular`)}
                              >
                                Matricular
                              </Button>
                            ) : (
                              <Button size="sm" disabled={acao.isPending} onClick={() => faz(`/funil/${l.id}/avancar`)}>
                                Avançar
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => setPerder(l)}>
                              Perder
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </article>
                ))
              ) : (
                <p className="py-4 text-center text-apagado-2">nenhum lead</p>
              )}
            </section>
          );
        })}
      </div>
      <PerderDialog
        lead={perder}
        motivos={d?.motivos ?? []}
        etapa={d?.etapas.find((e) => e.k === perder?.etapa)?.t ?? ''}
        aoFechar={() => setPerder(null)}
        aoConfirmar={(motivo) => faz(`/funil/${perder!.id}/perder`, { motivo }, () => setPerder(null))}
        ocupado={acao.isPending}
      />
      {d && <NovoLead d={d} aberto={novo} aoFechar={() => setNovo(false)} aoSalvo={(txt) => setMsg({ txt })} />}
    </>
  );
}

function PerderDialog({
  lead,
  motivos,
  etapa,
  aoFechar,
  aoConfirmar,
  ocupado,
}: {
  lead: Funil['leads'][number] | null;
  motivos: string[];
  etapa: string;
  aoFechar: () => void;
  aoConfirmar: (motivo: string) => void;
  ocupado: boolean;
}) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  // biome-ignore lint/correctness/useExhaustiveDependencies: reinicia ao abrir para outro lead
  useEffect(() => {
    setMotivo('');
    setErro('');
  }, [lead]);
  return (
    <Dialog open={!!lead} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent tamanho="sm">
        <DialogHead titulo="Marcar como perdido" descricao={lead ? `${lead.nome} · ${etapa}` : undefined} />
        <DialogBody className="grid gap-1.5">
          <Label>
            Motivo<span className="text-vermelho">*</span>
          </Label>
          <Escolha
            rotulo="Motivo"
            todos="escolha o motivo"
            destacar={false}
            valor={motivo}
            aoMudar={setMotivo}
            opcoes={motivos.map((m) => ({ v: m, l: m }))}
          />
        </DialogBody>
        <DialogFoot>
          {erro && (
            <span role="alert" className="mr-auto font-medium text-vermelho">
              {erro}
            </span>
          )}
          <Button onClick={aoFechar}>Cancelar</Button>
          <Button
            variant="perigo"
            disabled={ocupado}
            onClick={() => (motivo ? aoConfirmar(motivo) : setErro('Escolha o motivo.'))}
          >
            Marcar como perdido
          </Button>
        </DialogFoot>
      </DialogContent>
    </Dialog>
  );
}

function NovoLead({
  d,
  aberto,
  aoFechar,
  aoSalvo,
}: {
  d: Funil;
  aberto: boolean;
  aoFechar: () => void;
  aoSalvo: (txt: string) => void;
}) {
  const acao = useAcao();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [origem, setOrigem] = useState('Site');
  const [curso, setCurso] = useState('');
  const [consultor, setConsultor] = useState('');
  const [erro, setErro] = useState('');
  // biome-ignore lint/correctness/useExhaustiveDependencies: reinicia ao abrir
  useEffect(() => {
    if (!aberto) return;
    setNome('');
    setEmail('');
    setOrigem('Site');
    setCurso(d.cursos[0] ?? '');
    setConsultor(d.eu);
    setErro('');
  }, [aberto]);
  const enviar = () => {
    if (nome.trim().length < 2) return setErro('Informe o nome.');
    acao.mutate(
      { caminho: '/funil', json: { nome, email, origem, curso, consultor } },
      {
        onSuccess: (r) => {
          aoFechar();
          aoSalvo(r.msg);
        },
        onError: (e) => setErro(e.message),
      },
    );
  };
  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent tamanho="md">
        <DialogHead titulo="Novo lead" descricao="entra no funil como Captado" />
        <DialogBody className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="ld-nome">
              Nome<span className="text-vermelho">*</span>
            </Label>
            <Input id="ld-nome" autoFocus value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ld-email">E-mail</Label>
            <Input id="ld-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Origem</Label>
            <Escolha
              rotulo="Origem"
              destacar={false}
              valor={origem}
              aoMudar={setOrigem}
              opcoes={d.origens.map((x) => ({ v: x, l: x }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Curso de interesse</Label>
            <Escolha
              rotulo="Curso de interesse"
              destacar={false}
              valor={curso}
              aoMudar={setCurso}
              opcoes={d.cursos.map((x) => ({ v: x, l: x }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Consultor</Label>
            <Escolha
              rotulo="Consultor"
              destacar={false}
              valor={consultor}
              aoMudar={setConsultor}
              opcoes={d.consultores.map((x) => ({ v: x, l: x }))}
            />
          </div>
        </DialogBody>
        <DialogFoot>
          {erro && (
            <span role="alert" className="mr-auto font-medium text-vermelho">
              {erro}
            </span>
          )}
          <Button onClick={aoFechar}>Cancelar</Button>
          <Button variant="primary" disabled={acao.isPending} onClick={enviar}>
            Criar lead
          </Button>
        </DialogFoot>
      </DialogContent>
    </Dialog>
  );
}
