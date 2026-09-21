'use client';

import {
  ChevronDownIcon,
  EllipsisIcon,
  EyeIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  UserCheckIcon,
  UserXIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ItemBadge } from '@/components/alunos/comum';
import { type ColabLinha, ColaboradorFormDialog } from '@/components/config/pessoas';
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
import { type Colaboradores, useCfg } from '@/lib/config';
import { useMe } from '@/lib/consultas';
import { type PodeProfLista, type ProfLinha, useAcaoProf, useProfessores } from '@/lib/professores';
import { ProfessorFormDialog } from './professor-form';

type Msg = { txt: string; erro?: boolean } | null;
const norm = (s: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

/** uma pessoa da equipe: professor (prestador) ou colaborador */
type Pessoa =
  | { k: string; tipo: 'Professor'; nome: string; email: string; ativo: boolean; prof: ProfLinha }
  | { k: string; tipo: 'Colaborador'; nome: string; email: string; ativo: boolean; colab: ColabLinha };

/**
 * Equipe: professores e colaboradores numa lista só, em ordem alfabética (pedido de 21/09/2026).
 * Professor abre a ficha; colaborador abre o cadastro. Colaboradores só aparecem para quem tem Configurações.
 */
export function ListaEquipe() {
  const q = useProfessores();
  const me = useMe();
  const veColab = !!me.data?.chaves.includes('cfg');
  const qc = useCfg<Colaboradores>('/colaboradores', veColab);
  const router = useRouter();
  const acao = useAcaoProf();
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState('');
  const [curso, setCurso] = useState('');
  const [sit, setSit] = useState('Ativos');
  const [msg, setMsg] = useState<Msg>(null);
  const [form, setForm] = useState<{ id: string | null } | null>(null);
  const [colab, setColab] = useState<{ linha: ColabLinha | null } | null>(null);

  useEffect(() => {
    document.title = 'Equipe · Portal Raphael Lima';
  }, []);

  const todos = useMemo<Pessoa[]>(
    () =>
      [
        ...(q.data?.professores ?? []).map(
          (t): Pessoa => ({ k: `p${t.id}`, tipo: 'Professor', nome: t.nome, email: t.email, ativo: t.ativo, prof: t }),
        ),
        ...(veColab ? (qc.data?.linhas ?? []) : []).map(
          (c): Pessoa => ({
            k: `c${c.id}`,
            tipo: 'Colaborador',
            nome: c.nome,
            email: c.email,
            ativo: c.ativo,
            colab: c,
          }),
        ),
      ].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })),
    [q.data, qc.data, veColab],
  );
  const lista = useMemo(() => {
    const n = norm(busca);
    return todos.filter(
      (p) =>
        (sit === 'Todos' || (sit === 'Ativos') === p.ativo) &&
        (!tipo || p.tipo === tipo) &&
        (!curso || (p.tipo === 'Professor' && p.prof.cursos.some((c) => c.nome === curso))) &&
        (!n || norm(`${p.nome} ${p.email}`).includes(n)),
    );
  }, [todos, busca, tipo, curso, sit]);
  const { fatia, rodape, setPag } = usePaginacao(lista);
  const pode = q.data?.pode;
  const filtro = (set: (v: string) => void) => (v: string) => {
    set(v);
    setPag(1);
  };

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

  const novo =
    pode?.criar && veColab ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="primary">
            <PlusIcon /> Novo <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setForm({ id: null })}>Professor</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setColab({ linha: null })}>Colaborador</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ) : pode?.criar ? (
      <Button variant="primary" onClick={() => setForm({ id: null })}>
        <PlusIcon /> Novo professor
      </Button>
    ) : veColab ? (
      <Button variant="primary" onClick={() => setColab({ linha: null })}>
        <PlusIcon /> Novo colaborador
      </Button>
    ) : null;

  const abre = (p: Pessoa) => {
    if (p.tipo === 'Colaborador') setColab({ linha: p.colab });
    else if (pode?.ficha) router.push(`/professores/${p.prof.id}/perfil`);
  };

  return (
    <>
      <PageHead titulo="Equipe" acoes={novo} />
      <AbasDoMenu />
      {(q.isError || qc.isError) && (
        <Aviso tom="red" icone="alerta">
          {(q.error ?? qc.error)?.message}
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
              aria-label="Buscar na equipe"
              placeholder="Buscar por nome ou e-mail…"
              className="pl-9"
              value={busca}
              onChange={(e) => filtro(setBusca)(e.target.value)}
            />
          </div>
          <span className="text-apagado" aria-live="polite">
            {lista.length} {lista.length === 1 ? 'pessoa' : 'pessoas'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {veColab && (
            <Escolha
              rotulo="Tipo"
              todos="Todos os tipos"
              valor={tipo}
              aoMudar={filtro(setTipo)}
              opcoes={[
                { v: 'Professor', l: 'Professores' },
                { v: 'Colaborador', l: 'Colaboradores' },
              ]}
              className="w-[190px]"
            />
          )}
          <Escolha
            rotulo="Curso"
            todos="Todos os cursos"
            valor={curso}
            aoMudar={filtro(setCurso)}
            opcoes={(q.data?.cursos ?? []).map((c) => ({ v: c, l: c }))}
            className="w-[220px]"
          />
          <Escolha
            rotulo="Situação"
            destacar={false}
            valor={sit}
            aoMudar={filtro(setSit)}
            opcoes={['Ativos', 'Inativos', 'Todos'].map((x) => ({ v: x, l: x }))}
            className="w-[150px]"
          />
        </div>
      </div>
      <Card className="overflow-hidden">
        <Table aria-label="Equipe">
          <THead>
            <Tr>
              <Th>Nome</Th>
              <Th>E-mail</Th>
              <Th>Tipo</Th>
              <Th>Cursos ou cargo</Th>
              <Th className="text-right">Aulas/sem · teto</Th>
              <Th>Situação</Th>
              <Th className="text-right">Ações</Th>
            </Tr>
          </THead>
          <TBody>
            {fatia.length ? (
              fatia.map((p) => {
                const clica = p.tipo === 'Colaborador' || !!pode?.ficha;
                return (
                  <Tr
                    key={p.k}
                    onClick={() => abre(p)}
                    className={clica ? 'cursor-pointer transition-colors hover:bg-hover' : undefined}
                  >
                    <Td className="font-medium whitespace-nowrap text-texto">
                      {p.tipo === 'Professor' && pode?.ficha ? (
                        <Link
                          href={`/professores/${p.prof.id}/perfil`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:text-azul hover:underline"
                        >
                          {p.nome}
                        </Link>
                      ) : (
                        p.nome
                      )}
                    </Td>
                    <Td>{p.email}</Td>
                    <Td>
                      <Badge tom={p.tipo === 'Professor' ? 'blue' : 'gray'}>{p.tipo}</Badge>
                    </Td>
                    <Td>
                      {p.tipo === 'Colaborador' ? (
                        <>
                          {p.colab.cargo}
                          {p.colab.departamento && p.colab.departamento !== '—' && (
                            <div className="text-apagado">{p.colab.departamento}</div>
                          )}
                        </>
                      ) : p.prof.cursos.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {p.prof.cursos.map((c) => (
                            <ItemBadge key={c.nome} item={c} />
                          ))}
                        </div>
                      ) : (
                        <span className="text-apagado">nenhum curso</span>
                      )}
                    </Td>
                    <Td className="text-right whitespace-nowrap tabular-nums">
                      {p.tipo === 'Professor' ? (
                        <>
                          {p.prof.acimaTeto && (
                            <Badge tom="amber" className="mr-2">
                              acima do teto
                            </Badge>
                          )}
                          {p.prof.aulas} de {p.prof.teto}
                        </>
                      ) : (
                        <span className="text-apagado">—</span>
                      )}
                    </Td>
                    <Td>
                      <Badge tom={p.ativo ? 'green' : 'gray'}>{p.ativo ? 'Ativo' : 'Inativo'}</Badge>
                    </Td>
                    <Td className="text-right" onClick={(e) => e.stopPropagation()}>
                      {p.tipo === 'Colaborador' ? (
                        <Button size="sm" aria-label={`Editar ${p.nome}`} onClick={() => abre(p)}>
                          Editar
                        </Button>
                      ) : (
                        pode && (
                          <MenuProf
                            t={p.prof}
                            pode={pode}
                            editar={() => setForm({ id: p.prof.id })}
                            como={() => executa(`/${p.prof.id}/acessar-como`, { volta: '/equipe' })}
                            ativo={() => executa(`/${p.prof.id}/${p.ativo ? 'desativar' : 'reativar'}`)}
                          />
                        )
                      )}
                    </Td>
                  </Tr>
                );
              })
            ) : (
              <Tr>
                <Td colSpan={7} className="py-10 text-center text-apagado-2">
                  {q.isPending ? 'Carregando…' : 'ninguém neste filtro'}
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
      {veColab && (
        <ColaboradorFormDialog
          abre={colab}
          cargos={qc.data?.cargos ?? []}
          aoFechar={() => setColab(null)}
          aoSalvo={(txt) => setMsg({ txt })}
        />
      )}
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
