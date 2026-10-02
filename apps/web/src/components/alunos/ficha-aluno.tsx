'use client';

import { ChevronLeftIcon, PencilIcon } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Abas } from '@/components/abas';
import { AcessoDaPessoa, type AcessoPessoa } from '@/components/acesso-pessoa';
import { AbaCadastro } from '@/components/cadastro/cadastro';
import { AbaContratos } from '@/components/deal/contratos';
import { Aviso, PageHead } from '@/components/ds';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  type AbaAluno,
  type AgendamentosAba,
  type CursosAba,
  type DispAba,
  type FeedbacksAba,
  type FichaResp,
  type FinanceiroAba,
  type LogAba,
  type Perfil,
  useFicha,
} from '@/lib/alunos';
import { AbaAgendamentos, AbaDisponibilidade, AbaFinanceiro, AbaLog, AbaPerfil, type Vai } from './abas-aluno';
import { AlunoFormDialog } from './aluno-form';
import type { Msg } from './comum';
import { AbaCursos } from './cursos-aluno';
import { AbaFeedbacks } from './feedbacks-aluno';

/**
 * Alunos › ficha: uma linha de abas (Dados · Matrícula · Financeiro · Contratos · Histórico · Acesso).
 * Sem subabas (02/10/2026): cada aba mostra as suas partes em blocos, um abaixo do outro.
 */
export function FichaAluno() {
  const { id, aba } = useParams<{ id: string; aba: string }>();
  const router = useRouter();
  const q = useFicha(Number(id), { aba });
  const [msg, setMsg] = useState<Msg>(null);
  const [editar, setEditar] = useState<{ id: number } | null>(null);
  const f = q.data;

  useEffect(() => {
    if (f) document.title = `${f.nome} · Portal Raphael Lima`;
    /* aba antiga ou sem acesso: cai na que vale */
    if (f && f.aba !== aba) router.replace(`/alunos/${f.id}/${f.aba}`);
  }, [f, aba, router]);
  /* link para uma parte que não é a primeira da aba (ex.: /alunos/1/log): rola até o bloco */
  const alvo = f?.aba;
  useEffect(() => {
    if (!alvo) return;
    const el = document.getElementById(`bloco-${alvo}`);
    if (el?.previousElementSibling) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [alvo]);
  /* a mensagem de uma ação vale para a tela em que foi dada */
  // biome-ignore lint/correctness/useExhaustiveDependencies: limpa ao trocar de aba
  useEffect(() => setMsg(null), [aba, id]);

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
        itens={f.grupos.map((g) => ({
          href: `/alunos/${f.id}/${g.abas[0].k}`,
          rotulo: g.rotulo,
          ativa: g.k === grupoAtivo.k,
        }))}
      />
      {msg && (
        <Aviso tom={msg.erro ? 'red' : 'blue'} icone={msg.erro ? 'alerta' : 'ok'}>
          {msg.txt}
        </Aviso>
      )}

      <div className="grid gap-10">
        {blocosDe(grupoAtivo.abas).map((b) => (
          <Bloco key={b.id} f={f} b={b} setMsg={setMsg} />
        ))}
      </div>

      <AlunoFormDialog abre={editar} aoFechar={() => setEditar(null)} aoSalvo={(res) => setMsg({ txt: res.msg })} />
    </>
  );
}

type BlocoDef = { id: string; aba: AbaAluno; titulo: string };

/** as partes de uma aba; no Histórico, Agendamentos é a lista de Aulas (passadas e próximas) */
const blocosDe = (abas: FichaResp['grupos'][number]['abas']): BlocoDef[] =>
  abas.map((a) => ({ id: a.k, aba: a.k, titulo: a.k === 'agendamentos' ? 'Aulas' : a.rotulo }));

/** um bloco da aba: título e o conteúdo da parte; os filtros (dias, hist) valem só para ele */
function Bloco({ f: topo, b, setMsg }: { f: FichaResp; b: BlocoDef; setMsg: (m: Msg) => void }) {
  const [filtros, setFiltros] = useState<Record<string, string>>({});
  const q = useFicha(topo.id, { aba: b.aba, ...filtros });
  const vai: Vai = (p) =>
    setFiltros((ant) => {
      const n = { ...ant };
      for (const [k, v] of Object.entries(p)) {
        if (v) n[k] = v;
        else delete n[k];
      }
      return n;
    });
  /* sem os dados da parte ainda (ou a API devolveu outra parte): espera */
  const f = q.data?.aba === b.aba ? q.data : null;
  return (
    <section id={`bloco-${b.id}`} aria-labelledby={`titulo-${b.id}`} className="scroll-mt-4">
      <h2 id={`titulo-${b.id}`} className="mb-3 text-lg font-bold text-texto">
        {b.titulo}
      </h2>
      {q.isError ? (
        <Aviso tom="red" icone="alerta">
          {q.error.message}
        </Aviso>
      ) : !f ? (
        <p className="text-apagado">Carregando…</p>
      ) : (
        <div aria-busy={q.isFetching}>
          {f.aba === 'perfil' && <AbaPerfil d={f.dados as Perfil} />}
          {f.aba === 'log' && <AbaLog d={f.dados as LogAba} />}
          {f.aba === 'cursos' && <AbaCursos f={f} d={f.dados as CursosAba} setMsg={setMsg} />}
          {f.aba === 'disponibilidade' && <AbaDisponibilidade f={f} d={f.dados as DispAba} setMsg={setMsg} />}
          {f.aba === 'financeiro' && <AbaFinanceiro d={f.dados as FinanceiroAba} />}
          {f.aba === 'acesso' && <AcessoDaPessoa d={f.dados as AcessoPessoa} />}
          {f.aba === 'contratos' && <AbaContratos alunoId={f.id} volta={`/alunos/${f.id}/contratos`} rot={f.nome} />}
          <AbaCadastro dados={f.dados} />
          {f.aba === 'agendamentos' && <AbaAgendamentos f={f} d={f.dados as AgendamentosAba} vai={vai} />}
          {f.aba === 'feedbacks' && <AbaFeedbacks f={f} d={f.dados as FeedbacksAba} vai={vai} setMsg={setMsg} />}
        </div>
      )}
    </section>
  );
}
