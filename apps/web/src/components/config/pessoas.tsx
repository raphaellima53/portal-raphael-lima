'use client';

import { PlusIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AcessoDaPessoa, type AcessoPessoa } from '@/components/acesso-pessoa';
import { CampoData } from '@/components/campos-data';
import { PageHead } from '@/components/ds';
import { Escolha } from '@/components/escolha';
import { mascaraCnpj, mascaraCpf } from '@/components/mascaras';
import { usePaginacao } from '@/components/paginacao';
import { CamposEndereco, CamposPessoa } from '@/components/pessoa-campos';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TBody, Td, THead, Th, Tr } from '@/components/ui/table';
import { PESSOA_VAZIA, type PessoaExtra } from '@/lib/cadastros';
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

/**
 * Novo colaborador e Novo prestador (24/09/2026): Nome, CPF, e-mail primário, contato e admissão obrigatórios
 * (o prestador também com CNPJ); e-mail secundário, nascimento e endereço opcionais; cargo e situação por último.
 * Abre com a linha (editar) ou com null (novo) e o vínculo.
 */
export function ColaboradorFormDialog({
  abre,
  cargos,
  aoFechar,
  aoSalvo,
}: {
  abre: { linha: ColabLinha | null; vinculo?: 'Colaborador' | 'Prestador' } | null;
  cargos: Colaboradores['cargos'];
  aoFechar: () => void;
  aoSalvo: (msg: string) => void;
}) {
  const acao = useAcaoCfg();
  type F = {
    id: number | null;
    nome: string;
    email: string;
    cargo: string;
    ativo: boolean;
    cpf: string;
    cnpj: string;
    admissao: string;
    vinculo: 'Colaborador' | 'Prestador';
  } & PessoaExtra;
  const [form, setForm] = useState<F | null>(null);
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
          ? {
              id: c.id,
              nome: c.nome,
              email: c.email,
              cargo: c.cargo === '—' ? '' : c.cargo,
              ativo: c.ativo,
              cpf: c.cpf,
              cnpj: c.cnpj ?? '',
              admissao: c.admissao,
              vinculo: c.vinculo ?? 'Colaborador',
              telefone: c.telefone,
              nascimento: c.nascimento,
              genero: c.genero,
              endereco: c.endereco,
              emailSecundario: c.emailSecundario ?? '',
            }
          : {
              id: null,
              nome: '',
              email: '',
              cargo: '',
              ativo: true,
              cpf: '',
              cnpj: '',
              admissao: '',
              vinculo: abre.vinculo ?? 'Colaborador',
              ...PESSOA_VAZIA,
            },
    );
  }
  const novo = !form?.id;
  const prest = form?.vinculo === 'Prestador';
  const salvar = () => {
    if (!form) return;
    if (novo) {
      const falta =
        (!form.nome.trim() && 'Informe o nome.') ||
        (form.cpf.length !== 11 && 'Informe o CPF (11 dígitos).') ||
        (prest && form.cnpj.length !== 14 && 'Informe o CNPJ (14 dígitos).') ||
        (!form.email && 'Informe o e-mail primário.') ||
        (!form.telefone && 'Informe o contato.') ||
        (!form.admissao && 'Informe a admissão.');
      if (falta) return setErro(falta);
    }
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
  };
  const dep = cargos.find((c) => c.nome === form?.cargo)?.departamento;
  const quem = prest ? 'prestador' : 'colaborador';

  return (
    <FormDialog
      aberto={!!form}
      aoFechar={aoFechar}
      titulo={form?.id ? `Editar ${quem}` : `Novo ${quem}`}
      erro={erro}
      ocupado={acao.isPending}
      rotuloOk={form?.id ? 'Salvar' : `Cadastrar ${quem}`}
      aoSalvar={salvar}
    >
      {form && (
        <>
          <Campo id="co-nome" rotulo="Nome" req className="sm:col-span-2">
            <Input
              id="co-nome"
              autoFocus
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
            />
          </Campo>
          <Campo id="co-cpf" rotulo="CPF" req={novo}>
            <Input
              id="co-cpf"
              inputMode="numeric"
              placeholder="xxx.xxx.xxx-xx"
              value={mascaraCpf(form.cpf)}
              onChange={(e) => setForm({ ...form, cpf: e.target.value.replace(/\D/g, '').slice(0, 11) })}
            />
          </Campo>
          {prest && (
            <Campo id="co-cnpj" rotulo="CNPJ" req={novo}>
              <Input
                id="co-cnpj"
                inputMode="numeric"
                placeholder="xx.xxx.xxx/xxxx-xx"
                value={mascaraCnpj(form.cnpj)}
                onChange={(e) => setForm({ ...form, cnpj: e.target.value.replace(/\D/g, '').slice(0, 14) })}
              />
            </Campo>
          )}
          <Campo id="co-email" rotulo="E-mail primário" req>
            <Input
              id="co-email"
              type="email"
              placeholder="xxxxxx@xxxx.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Campo>
          <Campo id="co-email2" rotulo="E-mail secundário">
            <Input
              id="co-email2"
              type="email"
              placeholder="xxxxxx@xxxx.com"
              value={form.emailSecundario}
              onChange={(e) => setForm({ ...form, emailSecundario: e.target.value })}
            />
          </Campo>
          <Campo id="co-adm" rotulo="Admissão" req={novo}>
            <CampoData
              id="co-adm"
              rotulo="Admissão"
              valor={form.admissao}
              aoMudar={(v) => setForm({ ...form, admissao: v })}
            />
          </Campo>
          <CamposPessoa
            prefixo="co"
            obrigatorio={novo}
            semGenero
            valor={form}
            aoMudar={(p) => setForm({ ...form, ...p })}
          />
          <h3 className="mt-2 font-bold text-texto sm:col-span-2">Endereço</h3>
          <CamposEndereco prefixo="co-end" valor={form.endereco} aoMudar={(e) => setForm({ ...form, endereco: e })} />
          <h3 className="mt-2 font-bold text-texto sm:col-span-2">No time</h3>
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
            rotulo={prest ? 'Prestador ativo' : 'Colaborador ativo'}
          />
          {form.id != null && <AcessoColaborador id={form.id} />}
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
  dados: Record<string, string | boolean>;
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
            dados: x.dados ?? {},
          }
        : {
            id: null,
            nome: '',
            descricao: '',
            departamento: '',
            formato: 'Grupo',
            ativo: true,
            uso: 0,
            /* tipo de curso novo nasce permitindo módulos, como antes */
            dados: k === 'tiposcurso' ? { allowsModules: true } : {},
          },
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
                  <Campo
                    rotulo="Departamento"
                    className="sm:col-span-2"
                    ajuda="opcional — o colaborador com este cargo entra no departamento"
                  >
                    <Escolha
                      rotulo="Departamento"
                      todos="sem departamento"
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
                {d.extras.map((e) =>
                  e.tipo === 'sim' ? (
                    <Chave
                      key={e.k}
                      id={`cat-${e.k}`}
                      className="sm:col-span-2"
                      on={form.dados[e.k] === true}
                      aoMudar={(v) => setForm({ ...form, dados: { ...form.dados, [e.k]: v } })}
                      rotulo={e.rotulo}
                      ajuda={e.ajuda}
                    />
                  ) : e.tipo === 'escolha' ? (
                    <Campo key={e.k} rotulo={e.rotulo}>
                      <Escolha
                        rotulo={e.rotulo}
                        todos="não informado"
                        destacar={false}
                        valor={String(form.dados[e.k] ?? '')}
                        aoMudar={(v) => setForm({ ...form, dados: { ...form.dados, [e.k]: v } })}
                        opcoes={(e.opcoes ?? []).map((o) => ({ v: o, l: o }))}
                      />
                    </Campo>
                  ) : (
                    <Campo key={e.k} id={`cat-${e.k}`} rotulo={e.rotulo}>
                      <Input
                        id={`cat-${e.k}`}
                        value={String(form.dados[e.k] ?? '')}
                        onChange={(x) => setForm({ ...form, dados: { ...form.dados, [e.k]: x.target.value } })}
                      />
                    </Campo>
                  ),
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

/** a gestão de acesso do colaborador mora no cadastro dele (ele não tem ficha) */
function AcessoColaborador({ id }: { id: number }) {
  const q = useCfg<AcessoPessoa>(`/acesso?colab=${id}`);
  return (
    <div className="sm:col-span-2">
      <h3 className="mt-2 mb-3 text-md font-bold text-texto">Acesso ao portal</h3>
      {q.data ? <AcessoDaPessoa d={q.data} compacto /> : <p className="text-apagado">Carregando…</p>}
    </div>
  );
}
