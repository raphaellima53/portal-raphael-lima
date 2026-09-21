'use client';

import {
  BookOpenIcon,
  ChevronRightIcon,
  GraduationCapIcon,
  LayersIcon,
  PlusIcon,
  SearchIcon,
  UserIcon,
  UsersIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CursoFormDialog } from '@/components/cursos/curso-form';
import { Aviso, PageHead } from '@/components/ds';
import { AbasDoMenu } from '@/components/secao-abas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { corLegivel } from '@/lib/cor';
import { useCatalogo } from '@/lib/cursos';

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** Cursos › Catálogo: os cursos disponíveis; o cartão abre o curso. */
export default function Catalogo() {
  const q = useCatalogo();
  const [busca, setBusca] = useState('');
  const [novo, setNovo] = useState(false);
  useEffect(() => {
    document.title = 'Cursos · Portal Raphael Lima';
  }, []);
  const n = norm(busca.trim());
  const cursos = (q.data?.cursos ?? []).filter(
    (c) => !n || norm([c.nome, c.idioma, c.tipo, ...c.itens].join(' ')).includes(n),
  );

  return (
    <>
      <PageHead
        titulo="Cursos"
        acoes={
          q.data?.podeCriar ? (
            <Button variant="primary" onClick={() => setNovo(true)}>
              <PlusIcon /> Novo curso
            </Button>
          ) : null
        }
      />
      <AbasDoMenu />
      {q.isError && (
        <Aviso tom="red" icone="alerta">
          {q.error.message}
        </Aviso>
      )}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-[420px]">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-apagado" />
          <Input
            type="search"
            data-busca
            aria-label="Buscar curso, módulo ou turma"
            placeholder="Buscar curso, módulo ou turma…"
            className="pl-9"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        {q.data && (
          <Badge tom="blue">
            {q.data.cursos.length} {q.data.cursos.length === 1 ? 'curso' : 'cursos'}
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(460px,100%),1fr))] gap-4">
        {cursos.map((c) => {
          const turmas = c.estrutura === 'turmas';
          return (
            <Link
              key={c.id}
              href={`/cursos/${c.id}/geral`}
              className="group flex flex-col gap-3 rounded-lg border border-borda bg-card p-[18px] shadow-el-1 transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-el-3"
            >
              <div className="flex items-start gap-3">
                <span
                  className="grid size-8 shrink-0 place-items-center rounded-md"
                  style={{ background: `${corLegivel(c.cor)}1f`, color: corLegivel(c.cor) }}
                >
                  <BookOpenIcon className="size-4" />
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <em className="font-semibold text-apagado not-italic">{c.n}.</em>
                  <b className="text-md" style={{ color: corLegivel(c.cor) }}>
                    {c.nome}
                  </b>
                  {[c.idioma, c.tipo]
                    .filter((x) => x && x !== '—')
                    .map((t) => (
                      <span
                        key={t}
                        className="inline-flex h-[26px] items-center rounded-full border border-borda-forte px-2.5 text-texto-2"
                      >
                        {t}
                      </span>
                    ))}
                  {!c.ativo && <Badge>inativo</Badge>}
                </div>
              </div>
              <div className="pl-11 text-apagado">
                {c.descricao && <div>{c.descricao}</div>}
                <div>{c.autoAgenda ? 'Aluno pode auto-agendar' : 'Somente a secretaria agenda'}</div>
              </div>
              {c.itens.length > 0 && (
                <div className="pl-11">
                  <div className="mb-1.5 font-semibold text-texto-2">{turmas ? 'Turmas' : 'Módulos'}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {c.itens.map((x, k) => (
                      <span
                        key={x}
                        className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-borda bg-bg px-2 text-texto-2"
                      >
                        <em className="text-apagado not-italic">
                          {c.n}.{turmas ? '1.' : ''}
                          {k + 1}
                        </em>
                        {x}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-borda-suave pt-3 text-apagado">
                <span className="inline-flex items-center gap-1.5">
                  {turmas ? <UsersIcon className="size-4" /> : <LayersIcon className="size-4" />}
                  {c.itens.length
                    ? `${c.itens.length} ${turmas ? (c.itens.length === 1 ? 'turma' : 'turmas') : c.itens.length === 1 ? 'módulo' : 'módulos'}`
                    : 'sem subdivisão'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <GraduationCapIcon className="size-4" />
                  {c.profs} {c.profs === 1 ? 'professor' : 'professores'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <UserIcon className="size-4" />
                  {c.alunos} {c.alunos === 1 ? 'aluno' : 'alunos'}
                </span>
                <span className="ml-auto inline-flex items-center gap-1 font-semibold text-azul">
                  abrir <ChevronRightIcon className="size-4" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
      {q.data && !cursos.length && <Aviso icone="info">Nenhum curso encontrado para essa busca.</Aviso>}
      <CursoFormDialog aberto={novo} aoFechar={() => setNovo(false)} id={null} />
    </>
  );
}
