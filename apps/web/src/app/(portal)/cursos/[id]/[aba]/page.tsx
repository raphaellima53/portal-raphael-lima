'use client';

import { CalendarIcon, PencilIcon, PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Abas } from '@/components/abas';
import { AbaCurriculo, AbaGeral, AbaGrade, AbaRegras } from '@/components/cursos/abas-curso';
import { CurriculoFormDialog } from '@/components/cursos/curriculo-forms';
import { CursoFormDialog } from '@/components/cursos/curso-form';
import { Aviso, PageHead } from '@/components/ds';
import { Button } from '@/components/ui/button';
import { corLegivel } from '@/lib/cor';
import { type CurriculoAba, type Geral, type Grade, type Regras, useCurso } from '@/lib/cursos';

const ROTULOS = { geral: 'Visão geral', regras: 'Regras', curriculo: 'Currículo', grade: 'Grade semanal' };

/** Cursos › curso: Visão geral · Regras · Currículo · Grade semanal */
export default function CursoPage() {
  const { id, aba } = useParams<{ id: string; aba: string }>();
  const router = useRouter();
  const q = useCurso(Number(id), aba);
  const [editar, setEditar] = useState(false);
  const [novo, setNovo] = useState(false);
  const [novoCur, setNovoCur] = useState(false);
  const [msg, setMsg] = useState('');
  const c = q.data;

  useEffect(() => {
    if (c) document.title = `${c.nome} · Portal Raphael Lima`;
    /* aba sem acesso: abre a primeira que a pessoa pode ver */
    if (c && c.aba !== aba) router.replace(`/cursos/${c.id}/${c.aba}`);
  }, [c, aba, router]);

  if (q.isError) {
    return (
      <>
        <PageHead
          titulo={q.error.message.startsWith('Sem acesso') ? 'Sem acesso a esta tela' : 'Curso não encontrado'}
          acoes={
            <Button asChild>
              <Link href="/cursos">Voltar aos cursos</Link>
            </Button>
          }
        />
        <Aviso icone="trava">{q.error.message}</Aviso>
      </>
    );
  }
  if (!c) return <p className="text-apagado">Carregando…</p>;

  return (
    <>
      <PageHead
        titulo={<span style={{ color: corLegivel(c.cor) }}>{c.nome}</span>}
        acoes={
          <>
            {c.pode.agenda && (
              <Button asChild>
                <Link href={`/agenda?vista=semanal&prod=${encodeURIComponent(c.nome)}`}>
                  <CalendarIcon /> Ver na agenda
                </Link>
              </Button>
            )}
            {c.pode.editar && (
              <Button onClick={() => setEditar(true)}>
                <PencilIcon /> Editar curso
              </Button>
            )}
            {c.pode.criar && (
              <Button variant="primary" onClick={() => setNovo(true)}>
                <PlusIcon /> Novo curso
              </Button>
            )}
          </>
        }
      />
      <Abas
        rotulo="Abas do curso"
        itens={c.abas.map((a) => ({ href: `/cursos/${c.id}/${a}`, rotulo: ROTULOS[a], ativa: a === c.aba }))}
      />
      {msg && (
        <Aviso tom="blue" icone="ok">
          {msg}
        </Aviso>
      )}
      {c.aba === 'geral' && <AbaGeral c={c} g={c.dados as Geral} editar={() => setEditar(true)} />}
      {c.aba === 'regras' && <AbaRegras key={JSON.stringify(c.dados)} c={c} r={c.dados as Regras} />}
      {c.aba === 'curriculo' && <AbaCurriculo c={c} d={c.dados as CurriculoAba} novo={() => setNovoCur(true)} />}
      {c.aba === 'grade' && <AbaGrade d={c.dados as Grade} />}
      <CursoFormDialog aberto={editar} aoFechar={() => setEditar(false)} id={c.id} inicial={c.form} aoSalvo={setMsg} />
      <CursoFormDialog aberto={novo} aoFechar={() => setNovo(false)} id={null} />
      <CurriculoFormDialog abre={novoCur ? { grupo: c.nome } : null} aoFechar={() => setNovoCur(false)} />
    </>
  );
}
