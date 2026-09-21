'use client';

import { ChevronLeftIcon, PencilIcon } from 'lucide-react';
import Link from 'next/link';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Abas } from '@/components/abas';
import { AcessoDaPessoa, type AcessoPessoa } from '@/components/acesso-pessoa';
import { AbaLog, AbaPerfil } from '@/components/alunos/abas-aluno';
import type { Msg } from '@/components/alunos/comum';
import { Aviso, PageHead } from '@/components/ds';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { DispAba, LogAba, Perfil } from '@/lib/alunos';
import { type AgendaProf, type FeedbacksProf, type HabCurso, useFichaProf } from '@/lib/professores';
import { cn } from '@/lib/utils';
import { AbaAgendaProf, AbaDispProf, AbaFeedbacksProf, AbaHabilitacao } from './abas-professor';
import { ProfessorFormDialog } from './professor-form';

/** Professores › ficha: Dados (Perfil · Log) · Acessos (Cursos · Disponibilidade) · Histórico (Agenda · Feedbacks) */
export function FichaProfessor() {
  const { id, aba } = useParams<{ id: string; aba: string }>();
  const sp = useSearchParams();
  const caminho = usePathname();
  const router = useRouter();
  const q = useFichaProf(id, {
    aba,
    quando: sp.get('quando') ?? '',
    dias: sp.get('dias') ?? '',
    hist: sp.get('hist') ?? '',
  });
  const [msg, setMsg] = useState<Msg>(null);
  const [editar, setEditar] = useState<{ id: string } | null>(null);
  const f = q.data;

  useEffect(() => {
    if (f) document.title = `${f.nome} · Portal Raphael Lima`;
    if (f && f.aba !== aba)
      router.replace(
        `/professores/${f.id}/${f.aba}${f.aba === 'agenda' && f.quando === 'passadas' ? '?quando=passadas' : ''}`,
      );
  }, [f, aba, router]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: limpa a mensagem ao trocar de aba
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
          titulo={q.error.message.startsWith('Sem acesso') ? 'Sem acesso a esta tela' : 'Professor não encontrado'}
          acoes={
            <Button asChild>
              <Link href="/equipe">
                <ChevronLeftIcon /> Equipe
              </Link>
            </Button>
          }
        />
        <Aviso icone="trava">{q.error.message}</Aviso>
      </>
    );
  if (!f) return <p className="text-apagado">Carregando…</p>;

  const grupo = f.grupos.find((g) => g.abas.some((a) => a.k === f.aba)) ?? f.grupos[0];
  const r = f.resumo;
  const numeros: [string, string, boolean][] = [
    [String(r.horarios), 'horários na grade', false],
    [String(r.aulas), `aulas por semana · teto de ${r.teto}`, r.aulas > r.teto],
    [String(r.alunos), 'alunos na grade', false],
    [String(r.fora), 'aulas fora da disponibilidade', r.fora > 0],
  ];

  return (
    <>
      <PageHead
        titulo={
          <span className="inline-flex flex-wrap items-center gap-3">
            {f.nome} <Badge tom={f.ativo ? 'green' : 'gray'}>{f.ativo ? 'Ativo' : 'Inativo'}</Badge>
          </span>
        }
        acoes={
          <>
            <Button asChild>
              <Link href="/equipe">
                <ChevronLeftIcon /> Equipe
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
          {numeros.map(([v, l, alerta]) => (
            <div key={l} className="flex items-baseline gap-2">
              <dt className="sr-only">{l}</dt>
              <dd className={cn('text-xl font-extrabold tracking-[-0.5px] text-texto', alerta && 'text-ambar')}>{v}</dd>
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
          href: `/professores/${f.id}/${g.abas[0].k}`,
          rotulo: g.rotulo,
          ativa: g.k === grupo.k,
        }))}
      />
      <Abas
        rotulo={grupo.rotulo}
        className="border-borda-suave"
        itens={grupo.abas.map((a) => ({ href: `/professores/${f.id}/${a.k}`, rotulo: a.rotulo, ativa: a.k === f.aba }))}
      />
      {msg && (
        <Aviso tom={msg.erro ? 'red' : 'blue'} icone={msg.erro ? 'alerta' : 'ok'}>
          {msg.txt}
        </Aviso>
      )}
      <div aria-busy={q.isFetching}>
        {f.aba === 'perfil' && <AbaPerfil d={f.dados as Perfil} />}
        {f.aba === 'log' && <AbaLog d={f.dados as LogAba} />}
        {f.aba === 'cursos' && (
          <AbaHabilitacao f={f} cursos={(f.dados as { cursos: HabCurso[] }).cursos} setMsg={setMsg} />
        )}
        {f.aba === 'disponibilidade' && <AbaDispProf f={f} d={f.dados as DispAba} setMsg={setMsg} />}
        {f.aba === 'agenda' && <AbaAgendaProf f={f} d={f.dados as AgendaProf} vai={vai} />}
        {f.aba === 'feedbacks' && <AbaFeedbacksProf f={f} d={f.dados as FeedbacksProf} vai={vai} setMsg={setMsg} />}
        {f.aba === 'acesso' && <AcessoDaPessoa d={f.dados as AcessoPessoa} />}
      </div>
      <ProfessorFormDialog abre={editar} aoFechar={() => setEditar(null)} aoSalvo={(res) => setMsg({ txt: res.msg })} />
    </>
  );
}
