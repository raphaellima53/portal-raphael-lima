'use client';

import { ChevronLeftIcon, PencilIcon } from 'lucide-react';
import Link from 'next/link';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Abas } from '@/components/abas';
import { Aviso, PageHead } from '@/components/ds';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  type AgendamentosAba,
  type CursosAba,
  type DispAba,
  type FeedbacksAba,
  type LogAba,
  type Perfil,
  useFicha,
} from '@/lib/alunos';
import { AbaAgendamentos, AbaDisponibilidade, AbaLog, AbaPerfil } from './abas-aluno';
import { AlunoFormDialog } from './aluno-form';
import type { Msg } from './comum';
import { AbaCursos } from './cursos-aluno';
import { AbaFeedbacks } from './feedbacks-aluno';

/** Alunos › ficha: Dados (Perfil · Log) · Matrículas (Cursos · Disponibilidade) · Histórico (Agendamentos · Feedbacks) */
export function FichaAluno() {
  const { id, aba } = useParams<{ id: string; aba: string }>();
  const sp = useSearchParams();
  const caminho = usePathname();
  const router = useRouter();
  const params = { aba, quando: sp.get('quando') ?? '', dias: sp.get('dias') ?? '', hist: sp.get('hist') ?? '' };
  const q = useFicha(Number(id), params);
  const [msg, setMsg] = useState<Msg>(null);
  const [editar, setEditar] = useState<{ id: number } | null>(null);
  const f = q.data;

  useEffect(() => {
    if (f) document.title = `${f.nome} · Portal Raphael Lima`;
    /* aba antiga ou sem acesso: cai na subaba que vale */
    if (f && f.aba !== aba)
      router.replace(
        `/alunos/${f.id}/${f.aba}${f.aba === 'agendamentos' && f.quando === 'passadas' ? '?quando=passadas' : ''}`,
      );
  }, [f, aba, router]);
  /* a mensagem de uma ação vale para a tela em que foi dada */
  // biome-ignore lint/correctness/useExhaustiveDependencies: limpa ao trocar de aba
  useEffect(() => setMsg(null), [aba, id]);

  const vai = (p: Record<string, string | undefined>) => {
    const n = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(p)) {
      if (v) n.set(k, v);
      else n.delete(k);
    }
    const s = n.toString();
    router.push(`${caminho}${s ? `?${s}` : ''}`, { scroll: false });
  };

  if (q.isError)
    return (
      <>
        <PageHead
          titulo={q.error.message.startsWith('Sem acesso') ? 'Sem acesso a esta tela' : 'Aluno não encontrado'}
          acoes={
            <Button asChild>
              <Link href="/alunos">
                <ChevronLeftIcon /> Alunos
              </Link>
            </Button>
          }
        />
        <Aviso icone="trava">{q.error.message}</Aviso>
      </>
    );
  if (!f) return <p className="text-apagado">Carregando…</p>;

  const grupoAtivo = f.grupos.find((g) => g.abas.some((a) => a.k === f.aba)) ?? f.grupos[0];
  const r = f.resumo;
  const numeros: [string, string][] = [
    [String(r.matriculas), r.matriculas === 1 ? 'matrícula ativa' : 'matrículas ativas'],
    [r.restantes.toLocaleString('pt-BR'), 'aulas restantes'],
    [String(r.porSemana), 'aulas por semana'],
    [r.presenca != null ? `${r.presenca}%` : '—', `de presença nos últimos ${r.dias} dias`],
  ];

  return (
    <>
      <PageHead
        titulo={
          <span className="inline-flex flex-wrap items-center gap-3">
            {f.nome} <Badge tom={f.sitTom}>{f.sit}</Badge>
          </span>
        }
        acoes={
          <>
            <Button asChild>
              <Link href="/alunos">
                <ChevronLeftIcon /> Alunos
              </Link>
            </Button>
            {f.pode.editar && (
              <Button onClick={() => setEditar({ id: f.id })}>
                <PencilIcon /> Editar dados
              </Button>
            )}
          </>
        }
      />
      <Card className="mb-5 px-5 py-4">
        <p className="mb-3 text-texto-2">{f.sub}</p>
        <dl className="flex flex-wrap gap-x-10 gap-y-3">
          {numeros.map(([v, l]) => (
            <div key={l} className="flex items-baseline gap-2">
              <dt className="sr-only">{l}</dt>
              <dd className="text-xl font-extrabold tracking-[-0.5px] text-texto">{v}</dd>
              <span className="text-apagado" aria-hidden>
                {l}
              </span>
            </div>
          ))}
        </dl>
      </Card>

      <Abas
        rotulo="Abas da ficha"
        className="mb-0"
        itens={f.grupos.map((g) => ({
          href: `/alunos/${f.id}/${g.abas[0].k}`,
          rotulo: g.rotulo,
          ativa: g.k === grupoAtivo.k,
        }))}
      />
      <Abas
        rotulo={grupoAtivo.rotulo}
        className="border-borda-suave"
        itens={grupoAtivo.abas.map((a) => ({ href: `/alunos/${f.id}/${a.k}`, rotulo: a.rotulo, ativa: a.k === f.aba }))}
      />
      {msg && (
        <Aviso tom={msg.erro ? 'red' : 'blue'} icone={msg.erro ? 'alerta' : 'ok'}>
          {msg.txt}
        </Aviso>
      )}

      <div aria-busy={q.isFetching}>
        {f.aba === 'perfil' && <AbaPerfil d={f.dados as Perfil} />}
        {f.aba === 'log' && <AbaLog d={f.dados as LogAba} />}
        {f.aba === 'cursos' && <AbaCursos f={f} d={f.dados as CursosAba} setMsg={setMsg} />}
        {f.aba === 'disponibilidade' && <AbaDisponibilidade f={f} d={f.dados as DispAba} setMsg={setMsg} />}
        {f.aba === 'agendamentos' && <AbaAgendamentos f={f} d={f.dados as AgendamentosAba} vai={vai} />}
        {f.aba === 'feedbacks' && <AbaFeedbacks f={f} d={f.dados as FeedbacksAba} vai={vai} setMsg={setMsg} />}
      </div>

      <AlunoFormDialog abre={editar} aoFechar={() => setEditar(null)} aoSalvo={(res) => setMsg({ txt: res.msg })} />
    </>
  );
}
