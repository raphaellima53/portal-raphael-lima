'use client';

import { EllipsisIcon, EyeIcon, PencilIcon, PlusIcon, SearchIcon, UserCheckIcon, UserXIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ItemBadge } from '@/components/alunos/comum';
import { Aviso, PageHead } from '@/components/ds';
import { Escolha } from '@/components/escolha';
import { usePaginacao } from '@/components/paginacao';
import { AbasDoMenu } from '@/components/secao-abas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Table, TBody, Td, THead, Th, Tr } from '@/components/ui/table';
import { ErroApi } from '@/lib/api';
import { useMe } from '@/lib/consultas';
import { type PodeProfLista, type ProfLinha, useAcaoProf, useProfessores } from '@/lib/professores';
import { ProfessorFormDialog } from './professor-form';

type Msg = { txt: string; erro?: boolean } | null;
const norm = (s: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

/** Professores: cursos habilitados, aulas na grade e situação. A linha abre a ficha. */
export function ListaProfessores() {
  const q = useProfessores();
  const me = useMe();
  const router = useRouter();
  const acao = useAcaoProf();
  const [busca, setBusca] = useState('');
  const [curso, setCurso] = useState('');
  const [sit, setSit] = useState('Ativos');
  const [msg, setMsg] = useState<Msg>(null);
  const [form, setForm] = useState<{ id: string | null } | null>(null);

  useEffect(() => {
    document.title = 'Professores · Portal Raphael Lima';
  }, []);

  const todos = q.data?.professores ?? [];
  const lista = useMemo(() => {
    const n = norm(busca);
    return todos.filter(
      (t) =>
        (sit === 'Todos' || (sit === 'Ativos') === t.ativo) &&
        (!curso || t.cursos.some((c) => c.nome === curso)) &&
        (!n || norm(`${t.nome} ${t.email}`).includes(n)),
    );
  }, [todos, busca, curso, sit]);
  const { fatia, rodape, setPag } = usePaginacao(lista);
  const pode = q.data?.pode;

  const executa = (caminho: string, json?: unknown) =>
    acao.mutate(
      { caminho, json },
      {
        onSuccess: (r) => {
          if (r.ir) {
            me.refetch().then(() => router.push(r.ir!));
            return;
          }
          setMsg({ txt: r.msg });
        },
        onError: (e) => setMsg({ txt: e.message, erro: true }),
      },
    );

  if (q.error instanceof ErroApi && q.error.status === 403)
    return (
      <>
        <PageHead titulo="Sem acesso a esta tela" />
        <Aviso icone="trava">{q.error.message}</Aviso>
      </>
    );

  return (
    <>
      <PageHead
        titulo="Professores"
        acoes={
          pode?.criar ? (
            <Button variant="primary" onClick={() => setForm({ id: null })}>
              <PlusIcon /> Novo professor
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
      {msg && (
        <Aviso tom={msg.erro ? 'red' : 'blue'} icone={msg.erro ? 'alerta' : 'ok'}>
          {msg.txt}
        </Aviso>
      )}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-[320px] max-w-full">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-apagado" />
            <Input
              type="search"
              aria-label="Buscar professor"
              placeholder="Buscar por nome ou e-mail…"
              className="pl-9"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPag(1);
              }}
            />
          </div>
          <span className="text-apagado" aria-live="polite">
            {lista.length} {lista.length === 1 ? 'professor' : 'professores'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Escolha
            rotulo="Curso"
            todos="Todos os cursos"
            valor={curso}
            aoMudar={(v) => {
              setCurso(v);
              setPag(1);
            }}
            opcoes={(q.data?.cursos ?? []).map((c) => ({ v: c, l: c }))}
            className="w-[220px]"
          />
          <Escolha
            rotulo="Situação"
            destacar={false}
            valor={sit}
            aoMudar={(v) => {
              setSit(v);
              setPag(1);
            }}
            opcoes={['Ativos', 'Inativos', 'Todos'].map((x) => ({ v: x, l: x }))}
            className="w-[150px]"
          />
        </div>
      </div>
      <Card className="overflow-hidden">
        <Table>
          <THead>
            <Tr>
              <Th>Nome</Th>
              <Th>E-mail</Th>
              <Th>Cursos habilitados</Th>
              <Th className="text-right">Aulas/sem na grade</Th>
              <Th className="text-right">Teto semanal</Th>
              <Th>Situação</Th>
              <Th className="text-right">Ações</Th>
            </Tr>
          </THead>
          <TBody>
            {fatia.length ? (
              fatia.map((t) => (
                <Tr
                  key={t.id}
                  onClick={() => pode?.ficha && router.push(`/professores/${t.id}/perfil`)}
                  className={pode?.ficha ? 'cursor-pointer transition-colors hover:bg-hover' : undefined}
                >
                  <Td className="font-medium whitespace-nowrap text-texto">
                    {pode?.ficha ? (
                      <Link
                        href={`/professores/${t.id}/perfil`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:text-azul hover:underline"
                      >
                        {t.nome}
                      </Link>
                    ) : (
                      t.nome
                    )}
                  </Td>
                  <Td>{t.email}</Td>
                  <Td>
                    {t.cursos.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {t.cursos.map((c) => (
                          <ItemBadge key={c.nome} item={c} />
                        ))}
                      </div>
                    ) : (
                      <span className="text-apagado">nenhum</span>
                    )}
                  </Td>
                  <Td className="text-right whitespace-nowrap tabular-nums">
                    {t.acimaTeto && (
                      <Badge tom="amber" className="mr-2">
                        acima do teto
                      </Badge>
                    )}
                    {t.aulas}
                  </Td>
                  <Td className="text-right tabular-nums">{t.teto}</Td>
                  <Td>
                    <Badge tom={t.ativo ? 'green' : 'gray'}>{t.ativo ? 'Ativo' : 'Inativo'}</Badge>
                  </Td>
                  <Td className="text-right" onClick={(e) => e.stopPropagation()}>
                    {pode && (
                      <MenuProf
                        t={t}
                        pode={pode}
                        editar={() => setForm({ id: t.id })}
                        como={() => executa(`/${t.id}/acessar-como`, { volta: '/professores' })}
                        ativo={() => executa(`/${t.id}/${t.ativo ? 'desativar' : 'reativar'}`)}
                      />
                    )}
                  </Td>
                </Tr>
              ))
            ) : (
              <Tr>
                <Td colSpan={7} className="py-10 text-center text-apagado-2">
                  {q.isPending ? 'Carregando…' : 'nenhum professor neste filtro'}
                </Td>
              </Tr>
            )}
          </TBody>
        </Table>
        {rodape}
      </Card>
      <ProfessorFormDialog
        abre={form}
        aoFechar={() => setForm(null)}
        aoSalvo={(r, novo) => (novo && r.id ? router.push(`/professores/${r.id}/cursos`) : setMsg({ txt: r.msg }))}
      />
    </>
  );
}

function MenuProf({
  t,
  pode,
  editar,
  como,
  ativo,
}: {
  t: ProfLinha;
  pode: PodeProfLista;
  editar: () => void;
  como: () => void;
  ativo: () => void;
}) {
  if (!pode.editar && !pode.como && !pode.desativar) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${t.nome}`}>
          <EllipsisIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="px-3 pt-1.5 pb-1 font-semibold text-texto">{t.nome}</DropdownMenuLabel>
        {pode.editar && (
          <DropdownMenuItem onSelect={editar}>
            <PencilIcon /> Editar
          </DropdownMenuItem>
        )}
        {pode.como && (
          <DropdownMenuItem onSelect={como}>
            <EyeIcon /> Acessar como
          </DropdownMenuItem>
        )}
        {pode.desativar && (
          <DropdownMenuItem onSelect={ativo}>
            {t.ativo ? <UserXIcon /> : <UserCheckIcon />} {t.ativo ? 'Desativar' : 'Reativar'}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
