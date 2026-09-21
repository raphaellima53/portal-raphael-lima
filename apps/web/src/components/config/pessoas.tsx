'use client';

import { PlusIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHead } from '@/components/ds';
import { Escolha } from '@/components/escolha';
import { usePaginacao } from '@/components/paginacao';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TBody, Td, THead, Th, Tr } from '@/components/ui/table';
import { type Catalogo, type Colaboradores, useAcaoCfg, useCfg } from '@/lib/config';
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

/* ================= Colaboradores (a lista mora em Usuários › Equipe, junto dos professores) ================= */
export type ColabLinha = Colaboradores['linhas'][number];

/** Cadastro e edição de colaborador: abre com a linha (editar) ou com null (novo). */
export function ColaboradorFormDialog({
  abre,
  cargos,
  aoFechar,
  aoSalvo,
}: {
  abre: { linha: ColabLinha | null } | null;
  cargos: Colaboradores['cargos'];
  aoFechar: () => void;
  aoSalvo: (msg: string) => void;
}) {
  const acao = useAcaoCfg();
  const [form, setForm] = useState<{
    id: number | null;
    nome: string;
    email: string;
    cargo: string;
    ativo: boolean;
  } | null>(null);
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState<typeof abre>(null);
  if (abre !== aberto) {
    setAberto(abre);
    setErro('');
    const c = abre?.linha;
    setForm(
      !abre
        ? null
        : c
          ? { id: c.id, nome: c.nome, email: c.email, cargo: c.cargo === '—' ? '' : c.cargo, ativo: c.ativo }
          : { id: null, nome: '', email: '', cargo: '', ativo: true },
    );
  }
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
          aoFechar();
          aoSalvo(r.msg);
        },
        onError: (e) => setErro(e.message),
      },
    );
  const dep = cargos.find((c) => c.nome === form?.cargo)?.departamento;

  return (
    <FormDialog
      aberto={!!form}
      aoFechar={aoFechar}
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
              opcoes={cargos.map((c) => ({ v: c.nome, l: c.nome }))}
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
