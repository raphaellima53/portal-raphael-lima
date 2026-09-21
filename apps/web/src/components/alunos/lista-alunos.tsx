'use client';

import {
  DownloadIcon,
  EllipsisIcon,
  EyeIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  UserCheckIcon,
  UserXIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Confirma } from '@/components/cursos/curriculo-forms';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Table, TBody, Td, THead, Th, Tr } from '@/components/ui/table';
import { type AlunoLinha, useAcaoAluno, useAlunos } from '@/lib/alunos';
import { ErroApi } from '@/lib/api';
import { useMe } from '@/lib/consultas';
import { idCadastro } from '@/lib/ids';
import { AlunoFormDialog } from './aluno-form';
import { ItemBadge, Modalidade, type Msg } from './comum';

const norm = (s: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

/** CSV com ; e BOM, que o Excel em pt-BR abre certo */
function exporta(lista: AlunoLinha[]) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const linhas = [
    ['Aluno', 'E-mail', 'CPF', 'Produto', 'Módulo / turma', 'Modalidade', 'Aulas usadas/total', 'Saldo', 'Situação'],
    ...lista.map((a) => [
      a.nome,
      a.email,
      a.cpf,
      a.matriculas.map((e) => e.curso).join(' | '),
      a.matriculas.map((e) => e.item?.nome ?? '—').join(' | '),
      a.matriculas.map((e) => e.modalidade).join(' | '),
      a.matriculas.map((e) => `${e.usadas}/${e.total}`).join(' | '),
      a.matriculas.length ? a.saldo : '—',
      a.sit,
    ]),
  ];
  const blob = new Blob([`\ufeff${linhas.map((l) => l.map(esc).join(';')).join('\r\n')}`], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const el = document.createElement('a');
  el.href = url;
  el.download = `alunos-${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`;
  el.click();
  URL.revokeObjectURL(url);
}

/** Alunos: cada aluno com as matrículas — curso, módulo ou turma, modalidade e quanto do pacote já consumiu. */
export function ListaAlunos() {
  const q = useAlunos();
  const me = useMe();
  const router = useRouter();
  const acao = useAcaoAluno();
  const [busca, setBusca] = useState('');
  const [prod, setProd] = useState('');
  const [mod, setMod] = useState('');
  const [sit, setSit] = useState('');
  const [msg, setMsg] = useState<Msg>(null);
  const [form, setForm] = useState<{ id: number | null } | null>(null);
  const [excluir, setExcluir] = useState<AlunoLinha | null>(null);

  useEffect(() => {
    document.title = 'Alunos · Portal Raphael Lima';
  }, []);

  const todos = q.data?.alunos ?? [];
  const lista = useMemo(() => {
    const n = norm(busca);
    const d = n.replace(/\D/g, '');
    return todos.filter(
      (a) =>
        (!n ||
          norm(a.nome).includes(n) ||
          (!!d && idCadastro(a.id).includes(d)) ||
          norm(a.email).includes(n) ||
          (!!d && a.cpf.replace(/\D/g, '').includes(d))) &&
        (!sit || a.sit === sit) &&
        (!prod || a.matriculas.some((e) => e.curso === prod)) &&
        (!mod || a.matriculas.some((e) => e.modalidade === mod)),
    );
  }, [todos, busca, prod, mod, sit]);
  const { fatia, rodape, setPag } = usePaginacao(lista);
  const pode = q.data?.pode;
  const filtro = (f: (v: string) => void) => (v: string) => {
    f(v);
    setPag(1);
  };

  const executa = (caminho: string, method: 'POST' | 'DELETE' = 'POST', json?: unknown, depois?: () => void) =>
    acao.mutate(
      { caminho, method, json },
      {
        onSuccess: (r) => {
          depois?.();
          if (r.ir) {
            me.refetch().then(() => router.push(r.ir!));
            return;
          }
          setMsg({ txt: r.msg });
        },
        onError: (e) => {
          depois?.();
          setMsg({ txt: e.message, erro: true });
        },
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
        titulo="Alunos"
        acoes={
          <>
            <Button onClick={() => exporta(lista)} disabled={!lista.length}>
              <DownloadIcon /> Exportar
            </Button>
            {pode?.criar && (
              <Button variant="primary" onClick={() => setForm({ id: null })}>
                <PlusIcon /> Novo aluno
              </Button>
            )}
          </>
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
        <div className="relative w-full max-w-[340px]">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-apagado" />
          <Input
            type="search"
            aria-label="Buscar por nome, e-mail ou CPF"
            placeholder="Buscar por nome, e-mail ou CPF…"
            className="pl-9"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPag(1);
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Escolha
            rotulo="Produto"
            todos="Todos os produtos"
            valor={prod}
            aoMudar={filtro(setProd)}
            opcoes={(q.data?.produtos ?? []).map((x) => ({ v: x, l: x }))}
            className="w-[210px]"
          />
          <Escolha
            rotulo="Modalidade"
            todos="Todas as modalidades"
            valor={mod}
            aoMudar={filtro(setMod)}
            opcoes={['Online', 'Presencial'].map((x) => ({ v: x, l: x }))}
            className="w-[200px]"
          />
          <Escolha
            rotulo="Situação"
            todos="Todas as situações"
            valor={sit}
            aoMudar={filtro(setSit)}
            opcoes={(q.data?.situacoes ?? []).map((x) => ({ v: x, l: x }))}
            className="w-[190px]"
          />
        </div>
      </div>
      <Card className="overflow-hidden">
        <Table>
          <THead>
            <Tr>
              <Th>ID</Th>
              <Th>Aluno</Th>
              <Th>Produto</Th>
              <Th>Módulo / turma</Th>
              <Th>Modalidade</Th>
              <Th className="text-right">Aulas · usadas/total</Th>
              <Th className="text-right">Saldo</Th>
              <Th>Situação</Th>
              <Th className="text-right">Ações</Th>
            </Tr>
          </THead>
          <TBody>
            {fatia.length ? (
              fatia.map((a) => {
                const ms = a.matriculas;
                const abre = () => pode?.ficha && router.push(`/alunos/${a.id}/perfil`);
                return (
                  <Tr
                    key={a.id}
                    onClick={abre}
                    className={pode?.ficha ? 'cursor-pointer transition-colors hover:bg-hover' : undefined}
                  >
                    <Td className="whitespace-nowrap text-apagado tabular-nums">{idCadastro(a.id)}</Td>
                    <Td className="font-medium text-texto">
                      {pode?.ficha ? (
                        <Link
                          href={`/alunos/${a.id}/perfil`}
                          className="hover:text-azul hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {a.nome}
                        </Link>
                      ) : (
                        a.nome
                      )}
                    </Td>
                    {ms.length ? (
                      <>
                        <Td>
                          <div className="flex flex-col gap-1.5">
                            {ms.map((e, i) => (
                              <span key={`${e.curso}-${i}`} className="leading-[26px] text-azul">
                                {e.curso}
                              </span>
                            ))}
                          </div>
                        </Td>
                        <Td>
                          <div className="flex flex-col items-start gap-1.5">
                            {ms.map((e, i) => (
                              <ItemBadge key={`${e.curso}-${i}`} item={e.item} />
                            ))}
                          </div>
                        </Td>
                        <Td>
                          <div className="flex flex-col items-start gap-1.5">
                            {ms.map((e, i) => (
                              <Modalidade key={`${e.curso}-${i}`} m={e.modalidade} />
                            ))}
                          </div>
                        </Td>
                        <Td className="text-right tabular-nums">
                          <div className="flex flex-col gap-1.5">
                            {ms.map((e, i) => (
                              <span key={`${e.curso}-${i}`} className="leading-[26px]">
                                {e.usadas}/{e.total}
                              </span>
                            ))}
                          </div>
                        </Td>
                        <Td className="text-right tabular-nums">{a.saldo.toLocaleString('pt-BR')}</Td>
                      </>
                    ) : (
                      <>
                        <Td className="text-vermelho">sem matrícula ativa</Td>
                        <Td className="text-apagado">—</Td>
                        <Td className="text-apagado">—</Td>
                        <Td className="text-right text-apagado">—</Td>
                        <Td className="text-right text-apagado">—</Td>
                      </>
                    )}
                    <Td>
                      <Badge tom={a.sitTom}>{a.sit}</Badge>
                    </Td>
                    <Td className="text-right" onClick={(e) => e.stopPropagation()}>
                      <MenuLinha
                        a={a}
                        pode={pode!}
                        editar={() => setForm({ id: a.id })}
                        como={() => executa(`/${a.id}/acessar-como`, 'POST', { volta: '/alunos' })}
                        desativar={() => executa(`/${a.id}/${a.sit === 'Inativo' ? 'reativar' : 'desativar'}`)}
                        excluir={() => setExcluir(a)}
                      />
                    </Td>
                  </Tr>
                );
              })
            ) : (
              <Tr>
                <Td colSpan={9} className="py-10 text-center text-apagado-2">
                  {q.isPending
                    ? 'Carregando…'
                    : todos.length
                      ? 'nenhum aluno bate com o filtro'
                      : 'nenhum aluno cadastrado ainda — comece por Novo aluno'}
                </Td>
              </Tr>
            )}
          </TBody>
        </Table>
        {rodape}
      </Card>

      <AlunoFormDialog
        abre={form}
        aoFechar={() => setForm(null)}
        aoSalvo={(r, novo) => (novo && r.id ? router.push(`/alunos/${r.id}/cursos`) : setMsg({ txt: r.msg }))}
      />
      <Confirma
        aberto={!!excluir}
        titulo="Excluir aluno"
        descricao={excluir?.nome}
        rotulo="Excluir"
        ocupado={acao.isPending}
        texto={
          <>
            O aluno sai da base com{' '}
            {excluir?.matriculas.length
              ? `${excluir.matriculas.length} ${excluir.matriculas.length === 1 ? 'matrícula ativa' : 'matrículas ativas'}`
              : 'o cadastro'}
            , a disponibilidade e o log. Não dá para desfazer. Se a ideia é só tirar da operação, use Desativar: dá para
            reativar depois.
          </>
        }
        aoFechar={() => setExcluir(null)}
        aoConfirmar={() => excluir && executa(`/${excluir.id}`, 'DELETE', undefined, () => setExcluir(null))}
      />
    </>
  );
}

function MenuLinha({
  a,
  pode,
  editar,
  como,
  desativar,
  excluir,
}: {
  a: AlunoLinha;
  pode: NonNullable<ReturnType<typeof useAlunos>['data']>['pode'];
  editar: () => void;
  como: () => void;
  desativar: () => void;
  excluir: () => void;
}) {
  const inativo = a.sit === 'Inativo';
  if (!pode.editar && !pode.como && !pode.desativar && !pode.excluir) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${a.nome}`}>
          <EllipsisIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="px-3 pt-1.5 pb-1 font-semibold text-texto">{a.nome}</DropdownMenuLabel>
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
          <DropdownMenuItem onSelect={desativar}>
            {inativo ? <UserCheckIcon /> : <UserXIcon />} {inativo ? 'Reativar' : 'Desativar'}
          </DropdownMenuItem>
        )}
        {pode.excluir && !a.persona && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem perigo onSelect={excluir}>
              <Trash2Icon /> Excluir
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
