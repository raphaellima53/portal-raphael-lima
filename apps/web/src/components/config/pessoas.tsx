'use client';

import { PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { PageHead } from '@/components/ds';
import { Escolha } from '@/components/escolha';
import { usePaginacao } from '@/components/paginacao';
import { ProfessorFormDialog } from '@/components/professores/professor-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TBody, Td, THead, Th, Tr } from '@/components/ui/table';
import { type Catalogo, type Colaboradores, type Prestadores, useAcaoCfg, useCfg } from '@/lib/config';
import { AvisoMsg, Barra, Busca, Campo, Chave, ErroQ, FormDialog, type Msg, normaliza, Vazio } from './comum';

const SITUACOES = ['Ativos', 'Inativos', 'Todos'];
const passaSit = (sit: string, ativo: boolean) => sit === 'Todos' || (sit === 'Ativos') === ativo;
const Situacao = ({
  valor,
  aoMudar,
  rotulo = 'Status',
}: {
  valor: string;
  aoMudar: (v: string) => void;
  rotulo?: string;
}) => (
  <Escolha
    rotulo={rotulo}
    destacar={valor !== 'Ativos'}
    valor={valor}
    aoMudar={aoMudar}
    opcoes={SITUACOES.map((s) => ({ v: s, l: s }))}
    className="w-[150px]"
  />
);
const StatusBadge = ({ ativo, fem }: { ativo: boolean; fem?: boolean }) => (
  <Badge tom={ativo ? 'green' : 'gray'}>{ativo ? (fem ? 'Ativa' : 'Ativo') : fem ? 'Inativa' : 'Inativo'}</Badge>
);
const Novo = ({ rotulo, aoClicar }: { rotulo: string; aoClicar: () => void }) => (
  <Button variant="primary" onClick={aoClicar}>
    <PlusIcon /> {rotulo}
  </Button>
);

export { Novo, passaSit, Situacao, StatusBadge };

/* ================= Colaboradores ================= */
export function TelaColaboradores({ abas }: { abas: React.ReactNode }) {
  const q = useCfg<Colaboradores>('/colaboradores');
  const acao = useAcaoCfg();
  const [msg, setMsg] = useState<Msg>(null);
  const [busca, setBusca] = useState('');
  const [cargo, setCargo] = useState('');
  const [sit, setSit] = useState('Ativos');
  const [form, setForm] = useState<{
    id: number | null;
    nome: string;
    email: string;
    cargo: string;
    ativo: boolean;
  } | null>(null);
  const [erro, setErro] = useState('');
  const d = q.data;
  const lista = useMemo(() => {
    const n = normaliza(busca);
    return (d?.linhas ?? []).filter(
      (c) =>
        passaSit(sit, c.ativo) &&
        (!cargo || c.cargo === cargo) &&
        (!n || normaliza(`${c.nome} ${c.email}`).includes(n)),
    );
  }, [d, busca, cargo, sit]);
  const { fatia, rodape, setPag } = usePaginacao(lista);
  const salvar = () =>
    form &&
    acao.mutate(
      {
        caminho: form.id ? `/colaboradores/${form.id}` : '/colaboradores',
        method: form.id ? 'PUT' : 'POST',
        json: form,
      },
      {
        onSuccess: (r) => {
          setForm(null);
          setMsg({ txt: r.msg });
        },
        onError: (e) => setErro(e.message),
      },
    );
  const abre = (c?: Colaboradores['linhas'][number]) => {
    setErro('');
    setForm(
      c
        ? { id: c.id, nome: c.nome, email: c.email, cargo: c.cargo === '—' ? '' : c.cargo, ativo: c.ativo }
        : { id: null, nome: '', email: '', cargo: '', ativo: true },
    );
  };
  const dep = d?.cargos.find((c) => c.nome === form?.cargo)?.departamento;

  return (
    <>
      <PageHead titulo="Colaboradores" acoes={<Novo rotulo="Novo colaborador" aoClicar={() => abre()} />} />
      {abas}
      <AvisoMsg msg={msg} />
      <ErroQ e={q.error} />
      {d && (
        <>
          <Barra>
            <Busca
              rotulo="Buscar por nome ou e-mail"
              valor={busca}
              aoMudar={(v) => {
                setBusca(v);
                setPag(1);
              }}
            />
            <span className="flex-1" />
            <Escolha
              rotulo="Cargo"
              todos="Todos os cargos"
              valor={cargo}
              aoMudar={(v) => {
                setCargo(v);
                setPag(1);
              }}
              opcoes={[...new Set(d.linhas.map((c) => c.cargo))].map((c) => ({ v: c, l: c }))}
              className="w-[230px]"
            />
            <Situacao
              valor={sit}
              aoMudar={(v) => {
                setSit(v);
                setPag(1);
              }}
            />
          </Barra>
          <Card className="overflow-hidden">
            <Table aria-label="Colaboradores">
              <THead>
                <Tr>
                  <Th>Nome</Th>
                  <Th>E-mail</Th>
                  <Th>Departamento</Th>
                  <Th>Cargo</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Ações</Th>
                </Tr>
              </THead>
              <TBody>
                {fatia.length ? (
                  fatia.map((c) => (
                    <Tr key={c.id}>
                      <Td className="font-medium text-texto">{c.nome}</Td>
                      <Td>{c.email}</Td>
                      <Td>{c.departamento}</Td>
                      <Td>{c.cargo}</Td>
                      <Td>
                        <StatusBadge ativo={c.ativo} />
                      </Td>
                      <Td className="text-right">
                        <Button size="sm" aria-label={`Editar ${c.nome}`} onClick={() => abre(c)}>
                          Editar
                        </Button>
                      </Td>
                    </Tr>
                  ))
                ) : (
                  <Vazio cols={6} txt="nenhum colaborador com esses filtros" />
                )}
              </TBody>
            </Table>
            {rodape}
          </Card>
        </>
      )}
      <FormDialog
        aberto={!!form}
        aoFechar={() => setForm(null)}
        titulo={form?.id ? 'Editar colaborador' : 'Novo colaborador'}
        erro={erro}
        ocupado={acao.isPending}
        rotuloOk={form?.id ? 'Salvar' : 'Cadastrar'}
        aoSalvar={salvar}
      >
        {form && (
          <>
            <Campo id="co-nome" rotulo="Nome completo" req className="sm:col-span-2">
              <Input
                id="co-nome"
                autoFocus
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
              />
            </Campo>
            <Campo id="co-email" rotulo="E-mail" req>
              <Input
                id="co-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Campo>
            <Campo rotulo="Cargo" ajuda={dep ? `departamento: ${dep}` : 'o departamento vem do cargo escolhido'}>
              <Escolha
                rotulo="Cargo"
                todos="Selecione…"
                destacar={false}
                valor={form.cargo}
                aoMudar={(v) => setForm({ ...form, cargo: v })}
                opcoes={(d?.cargos ?? []).map((c) => ({ v: c.nome, l: c.nome }))}
              />
            </Campo>
            <Chave
              id="co-ativo"
              className="sm:col-span-2"
              on={form.ativo}
              aoMudar={(v) => setForm({ ...form, ativo: v })}
              rotulo="Colaborador ativo"
            />
          </>
        )}
      </FormDialog>
    </>
  );
}

/* ================= Prestadores ================= */
export function TelaPrestadores({ abas }: { abas: React.ReactNode }) {
  const q = useCfg<Prestadores>('/prestadores');
  const [msg, setMsg] = useState<Msg>(null);
  const [busca, setBusca] = useState('');
  const [sit, setSit] = useState('Ativos');
  const [form, setForm] = useState<{ id: string | null } | null>(null);
  const d = q.data;
  const lista = useMemo(() => {
    const n = normaliza(busca);
    return (d?.linhas ?? []).filter(
      (t) => passaSit(sit, t.ativo) && (!n || normaliza(`${t.nome} ${t.email}`).includes(n)),
    );
  }, [d, busca, sit]);
  const { fatia, rodape, setPag } = usePaginacao(lista);
  return (
    <>
      <PageHead titulo="Prestadores" acoes={<Novo rotulo="Novo prestador" aoClicar={() => setForm({ id: null })} />} />
      {abas}
      <AvisoMsg msg={msg} />
      <ErroQ e={q.error} />
      {d && (
        <>
          <Barra>
            <Busca
              rotulo="Buscar por nome ou e-mail"
              valor={busca}
              aoMudar={(v) => {
                setBusca(v);
                setPag(1);
              }}
            />
            <span className="flex-1" />
            <Situacao
              rotulo="Situação"
              valor={sit}
              aoMudar={(v) => {
                setSit(v);
                setPag(1);
              }}
            />
          </Barra>
          <Card className="overflow-hidden">
            <Table aria-label="Prestadores">
              <THead>
                <Tr>
                  <Th>Prestador</Th>
                  <Th>E-mail</Th>
                  <Th>Cursos habilitados</Th>
                  <Th className="text-right">Aulas/sem na grade</Th>
                  <Th className="text-right">Teto semanal</Th>
                  <Th>Situação</Th>
                </Tr>
              </THead>
              <TBody>
                {fatia.length ? (
                  fatia.map((t) => (
                    <Tr key={t.id}>
                      <Td className="font-medium whitespace-nowrap">
                        <Link href={t.href} className="text-azul hover:underline">
                          {t.nome}
                        </Link>
                      </Td>
                      <Td>{t.email}</Td>
                      <Td>
                        <div className="flex flex-wrap gap-1">
                          {t.cursos.length ? (
                            t.cursos.map((c) => (
                              <span
                                key={c.nome}
                                className="rounded-full px-2.5 py-0.5 font-medium"
                                style={{ background: `${c.cor}1a`, color: c.cor }}
                              >
                                {c.nome}
                              </span>
                            ))
                          ) : (
                            <span className="text-apagado-2">—</span>
                          )}
                        </div>
                      </Td>
                      <Td className="text-right tabular-nums">{t.aulas}</Td>
                      <Td className="text-right tabular-nums">{t.teto}</Td>
                      <Td>
                        <StatusBadge ativo={t.ativo} />
                      </Td>
                    </Tr>
                  ))
                ) : (
                  <Vazio cols={6} txt="nenhum prestador neste filtro" />
                )}
              </TBody>
            </Table>
            {rodape}
          </Card>
        </>
      )}
      <ProfessorFormDialog abre={form} aoFechar={() => setForm(null)} aoSalvo={(r) => setMsg({ txt: r.msg })} />
    </>
  );
}

/* ================= Departamentos, Cargos e Catálogos ================= */
type ItemForm = {
  id: number | null;
  nome: string;
  descricao: string;
  departamento: string;
  formato: string;
  ativo: boolean;
  uso: number;
};
export function TelaCatalogo({ k, abas }: { k: string; abas: React.ReactNode }) {
  const q = useCfg<Catalogo>(`/catalogo/${k}`);
  const acao = useAcaoCfg();
  const [msg, setMsg] = useState<Msg>(null);
  const [busca, setBusca] = useState('');
  const [sit, setSit] = useState('Ativos');
  const [form, setForm] = useState<ItemForm | null>(null);
  const [erro, setErro] = useState('');
  const d = q.data;
  const lista = useMemo(() => {
    const n = normaliza(busca);
    return (d?.linhas ?? []).filter(
      (x) => passaSit(sit, x.ativo) && (!n || normaliza(`${x.nome} ${x.departamento} ${x.descricao}`).includes(n)),
    );
  }, [d, busca, sit]);
  const { fatia, rodape, setPag } = usePaginacao(lista);
  const comDesc = k === 'departamentos' || k === 'cargos';
  const faz = (caminho: string, method: 'POST' | 'PUT' | 'DELETE', json?: unknown) =>
    acao.mutate(
      { caminho, method, json },
      {
        onSuccess: (r) => {
          setForm(null);
          setMsg({ txt: r.msg });
        },
        onError: (e) => setErro(e.message),
      },
    );
  const abre = (x?: Catalogo['linhas'][number]) => {
    setErro('');
    setForm(
      x
        ? {
            id: x.id,
            nome: x.nome,
            descricao: x.descricao,
            departamento: x.departamento,
            formato: x.formato || 'Grupo',
            ativo: x.ativo,
            uso: x.uso,
          }
        : { id: null, nome: '', descricao: '', departamento: '', formato: 'Grupo', ativo: true, uso: 0 },
    );
  };
  const cols = k === 'departamentos' ? 5 : k === 'cargos' ? 6 : 4;

  return (
    <>
      <PageHead titulo={d?.t ?? ''} acoes={d && <Novo rotulo={d.novo} aoClicar={() => abre()} />} />
      {abas}
      <AvisoMsg msg={msg} />
      <ErroQ e={q.error} />
      {d && (
        <>
          <Barra>
            <Busca
              rotulo={`Buscar ${d.um}`}
              valor={busca}
              aoMudar={(v) => {
                setBusca(v);
                setPag(1);
              }}
            />
            <span className="flex-1" />
            <Situacao
              valor={sit}
              aoMudar={(v) => {
                setSit(v);
                setPag(1);
              }}
            />
          </Barra>
          <Card className="overflow-hidden">
            <Table aria-label={d.t}>
              <THead>
                <Tr>
                  <Th>Nome</Th>
                  {k === 'cargos' && <Th>Departamento</Th>}
                  {comDesc && <Th>Descrição</Th>}
                  {comDesc ? <Th className="text-right">Pessoas</Th> : <Th className="text-right">Em uso</Th>}
                  <Th>Status</Th>
                  <Th className="text-right">Ações</Th>
                </Tr>
              </THead>
              <TBody>
                {fatia.length ? (
                  fatia.map((x) => (
                    <Tr key={x.id}>
                      <Td className="font-medium text-texto">{x.nome}</Td>
                      {k === 'cargos' && <Td>{x.departamento || '—'}</Td>}
                      {comDesc && <Td>{x.descricao || '—'}</Td>}
                      <Td className="text-right tabular-nums">
                        {k === 'departamentos' ? x.pessoas : x.uso || (comDesc ? 0 : '—')}
                      </Td>
                      <Td>
                        <StatusBadge ativo={x.ativo} />
                      </Td>
                      <Td className="text-right">
                        <Button size="sm" aria-label={`Editar ${x.nome}`} onClick={() => abre(x)}>
                          Editar
                        </Button>
                      </Td>
                    </Tr>
                  ))
                ) : (
                  <Vazio cols={cols} txt={`nenhum ${d.um} com esses filtros`} />
                )}
              </TBody>
            </Table>
            {rodape}
          </Card>
          <FormDialog
            aberto={!!form}
            aoFechar={() => setForm(null)}
            titulo={form?.id ? `Editar ${d.um}` : d.novo}
            descricao={
              form?.id
                ? form.uso
                  ? `Em uso por ${form.uso} ${form.uso === 1 ? 'registro' : 'registros'}: dá para inativar, não para excluir.`
                  : 'Sem uso: dá para excluir.'
                : d.t
            }
            erro={erro}
            ocupado={acao.isPending}
            rotuloOk="Salvar"
            aoSalvar={() =>
              form && faz(form.id ? `/catalogo/${k}/${form.id}` : `/catalogo/${k}`, form.id ? 'PUT' : 'POST', form)
            }
            extra={
              form?.id && !form.uso ? (
                <Button
                  type="button"
                  variant="perigo"
                  className="mr-auto"
                  disabled={acao.isPending}
                  onClick={() => faz(`/catalogo/${k}/${form.id}`, 'DELETE')}
                >
                  Excluir {d.um}
                </Button>
              ) : null
            }
          >
            {form && (
              <>
                <Campo id="cat-nome" rotulo="Nome" req className="sm:col-span-2">
                  <Input
                    id="cat-nome"
                    autoFocus
                    placeholder={`Nome do ${d.um}`}
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  />
                </Campo>
                {comDesc && (
                  <Campo id="cat-desc" rotulo="Descrição" className="sm:col-span-2">
                    <Input
                      id="cat-desc"
                      placeholder="Para que serve"
                      value={form.descricao}
                      onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                    />
                  </Campo>
                )}
                {k === 'cargos' && (
                  <Campo rotulo="Departamento" req className="sm:col-span-2">
                    <Escolha
                      rotulo="Departamento"
                      todos="escolha o departamento"
                      destacar={false}
                      valor={form.departamento}
                      aoMudar={(v) => setForm({ ...form, departamento: v })}
                      opcoes={d.departamentos.map((x) => ({ v: x, l: x }))}
                    />
                  </Campo>
                )}
                {k === 'tiposcurso' && (
                  <Campo rotulo="Formato">
                    <Escolha
                      rotulo="Formato"
                      destacar={false}
                      valor={form.formato}
                      aoMudar={(v) => setForm({ ...form, formato: v })}
                      opcoes={d.formatos.map((x) => ({ v: x, l: x }))}
                    />
                  </Campo>
                )}
                <Chave
                  id="cat-ativo"
                  className="sm:col-span-2"
                  on={form.ativo}
                  aoMudar={(v) => setForm({ ...form, ativo: v })}
                  rotulo="Ativo"
                  ajuda="inativo sai do filtro Ativos; quem já usa continua com ele"
                />
              </>
            )}
          </FormDialog>
        </>
      )}
    </>
  );
}
