'use client';

import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CampoData } from '@/components/campos-data';
import {
  AvisoMsg,
  Barra,
  Busca,
  Campo,
  Chave,
  ErroQ,
  FormDialog,
  type Msg,
  normaliza,
  textareaCls,
  Vazio,
} from '@/components/config/comum';
import { PageHead } from '@/components/ds';
import { Escolha } from '@/components/escolha';
import { usePaginacao } from '@/components/paginacao';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TBody, Td, THead, Th, Tr } from '@/components/ui/table';
import { type CampoCad, type LinhaCad, type TelaCad, useAcaoCadastro, useCadastro } from '@/lib/cadastros';
import { cn } from '@/lib/utils';

type Valores = Record<string, string | boolean>;

/* máscaras dos campos formatados pelo contexto (regras de UI: formatos pt-BR) */
const soDig = (v: string, n: number) => v.replace(/\D/g, '').slice(0, n);
const MASCARA: Partial<Record<CampoCad['tipo'], (v: string) => string>> = {
  telefone: (v) => {
    const d = soDig(v, 11);
    if (d.length <= 2) return d;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
  },
  cep: (v) => {
    const d = soDig(v, 8);
    return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  },
  uf: (v) =>
    v
      .replace(/[^a-z]/gi, '')
      .slice(0, 2)
      .toUpperCase(),
  dinheiro: (v) => v.replace(/[^\d,.]/g, ''),
  numero: (v) => v.replace(/\D/g, '').slice(0, 7),
};
const PH: Partial<Record<CampoCad['tipo'], string>> = {
  telefone: '(00) 00000-0000',
  cep: '00000-000',
  uf: 'SP',
  dinheiro: '0,00',
  mes: 'AAAA-MM',
  email: 'nome@empresa.com',
  url: 'https://',
};

function CampoForm({
  c,
  valor,
  aoMudar,
  opcoes,
}: {
  c: CampoCad;
  valor: string | boolean;
  aoMudar: (v: string | boolean) => void;
  opcoes: TelaCad['opcoes'];
}) {
  const id = `cad-${c.k}`;
  const largo = c.largo || c.tipo === 'longo' ? 'sm:col-span-2' : '';
  if (c.tipo === 'sim')
    return (
      <Chave id={id} className={largo} on={!!valor} aoMudar={aoMudar} rotulo={c.rotulo} ajuda={c.ajuda ?? undefined} />
    );
  const s = String(valor ?? '');
  let campo: React.ReactNode;
  if (c.tipo === 'escolha')
    campo = (
      <Escolha
        rotulo={c.rotulo}
        todos={c.req ? 'Selecione…' : 'não informado'}
        destacar={false}
        valor={s}
        aoMudar={aoMudar}
        opcoes={opcoes[c.k] ?? []}
      />
    );
  else if (c.tipo === 'data') campo = <CampoData id={id} rotulo={c.rotulo} valor={s} aoMudar={aoMudar} />;
  else if (c.tipo === 'longo')
    campo = <textarea id={id} rows={4} className={textareaCls} value={s} onChange={(e) => aoMudar(e.target.value)} />;
  else if (c.tipo === 'cor')
    campo = (
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${c.rotulo}: escolher`}
          value={/^#[0-9a-f]{6}$/i.test(s) ? s : '#003FB0'}
          onChange={(e) => aoMudar(e.target.value.toUpperCase())}
          className="h-9 w-12 cursor-pointer rounded-md border border-borda-forte bg-card"
        />
        <Input id={id} value={s} onChange={(e) => aoMudar(e.target.value)} placeholder="#003FB0" />
      </div>
    );
  else
    campo = (
      <Input
        id={id}
        type={c.tipo === 'email' ? 'email' : c.tipo === 'url' ? 'url' : c.tipo === 'mes' ? 'month' : 'text'}
        inputMode={['numero', 'dinheiro', 'telefone', 'cep'].includes(c.tipo) ? 'numeric' : undefined}
        placeholder={PH[c.tipo]}
        value={s}
        onChange={(e) => aoMudar(MASCARA[c.tipo]?.(e.target.value) ?? e.target.value)}
      />
    );
  return (
    <Campo id={id} rotulo={c.rotulo} req={c.req} ajuda={c.ajuda ?? undefined} className={largo}>
      {campo}
    </Campo>
  );
}

/** dinheiro vem do banco com ponto (150.50) e vai para a tela com vírgula (150,50) */
const paraTela = (c: CampoCad, v: string | boolean | undefined) =>
  c.tipo === 'dinheiro' && typeof v === 'string' ? v.replace('.', ',') : (v ?? c.padrao);

/**
 * Tela de um cadastro simples: busca, filtros em linha, tabela paginada e o popup de novo/editar.
 * `pai` é o aluno, o professor ou a conta quando o cadastro mora dentro de uma ficha.
 */
export function Cadastro({
  id,
  pai,
  comTitulo,
  acoesTopo,
}: {
  id: string;
  pai?: string | number | null;
  /** mostra título e explicação em cima (dentro de uma ficha, a aba já diz o que é) */
  comTitulo?: boolean;
  /** onde pôr o botão Novo quando a página já tem cabeçalho próprio */
  acoesTopo?: (novo: React.ReactNode) => React.ReactNode;
}) {
  const q = useCadastro(id, pai);
  const acao = useAcaoCadastro(id, pai);
  const d = q.data;
  const [busca, setBusca] = useState('');
  const [filtros, setFiltros] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<Msg>(null);
  const [form, setForm] = useState<{ rid: number | string | null; v: Valores } | null>(null);
  const [erro, setErro] = useState('');
  const [excluir, setExcluir] = useState<LinhaCad | null>(null);

  const linhas = useMemo(() => {
    if (!d) return [];
    const b = normaliza(busca.trim());
    return d.linhas.filter(
      (l) =>
        d.filtros.every((f) => !filtros[f.k] || String(l.valores[f.k]) === filtros[f.k]) &&
        (!b || normaliza(Object.values(l.txt).join(' ')).includes(b)),
    );
  }, [d, busca, filtros]);
  const { fatia, rodape, setPag } = usePaginacao(linhas);

  const abre = (l?: LinhaCad) => {
    if (!d) return;
    setErro('');
    setForm({
      rid: l?.id ?? null,
      v: Object.fromEntries(d.campos.map((c) => [c.k, paraTela(c, l?.valores[c.k])])) as Valores,
    });
  };
  const salvar = () =>
    form &&
    acao.mutate(
      { rid: form.rid ?? undefined, method: form.rid != null ? 'PUT' : 'POST', json: form.v },
      {
        onSuccess: (r) => {
          setForm(null);
          setMsg({ txt: r.msg });
        },
        onError: (e) => setErro(e.message),
      },
    );
  const novo = d?.pode.criar ? (
    <Button variant="primary" onClick={() => abre()}>
      <PlusIcon /> {d.novo}
    </Button>
  ) : null;

  return (
    <div className="grid gap-4">
      {acoesTopo?.(novo)}
      {comTitulo && d && (
        <div className="flex flex-wrap items-start gap-3">
          <p className="max-w-[720px] text-apagado">{d.sobre}</p>
          <span className="flex-1" />
          {acoesTopo ? null : novo}
        </div>
      )}
      <AvisoMsg msg={msg} />
      <ErroQ e={q.error} />
      {d && (
        <>
          <Barra className="mb-0 justify-between">
            <Busca
              rotulo={`Buscar ${d.um}`}
              valor={busca}
              aoMudar={(v) => {
                setBusca(v);
                setPag(1);
              }}
            />
            <div className="flex flex-wrap items-center gap-3">
              {d.filtros.map((f) => (
                <Escolha
                  key={f.k}
                  rotulo={f.rotulo}
                  todos={`${f.rotulo}: todos`}
                  valor={filtros[f.k] ?? ''}
                  aoMudar={(v) => {
                    setFiltros({ ...filtros, [f.k]: v });
                    setPag(1);
                  }}
                  opcoes={f.opcoes}
                  className="w-[200px]"
                />
              ))}
              {!comTitulo && novo}
            </div>
          </Barra>
          <Card className="overflow-hidden">
            <div className="relative overflow-x-auto">
              <Table aria-label={d.titulo}>
                <THead>
                  <Tr>
                    {d.colunas.map((c) => (
                      <Th key={c.k}>{c.rotulo}</Th>
                    ))}
                    {(d.pode.editar || d.pode.excluir) && <Th className="text-right">Ações</Th>}
                  </Tr>
                </THead>
                <TBody>
                  {fatia.length ? (
                    fatia.map((l) => (
                      <Tr key={l.id}>
                        {d.colunas.map((c, i) => (
                          <Td
                            key={c.k}
                            className={cn(
                              i === 0 && 'font-medium text-texto',
                              (l.txt[c.k] ?? '').length <= 28 && 'whitespace-nowrap',
                            )}
                          >
                            {l.txt[c.k] ?? '—'}
                          </Td>
                        ))}
                        {(d.pode.editar || d.pode.excluir) && (
                          <Td className="text-right whitespace-nowrap">
                            {d.pode.editar && (
                              <Button size="sm" aria-label={`Editar ${l.rotulo}`} onClick={() => abre(l)}>
                                <PencilIcon /> Editar
                              </Button>
                            )}
                            {d.pode.excluir && (
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                className="ml-1"
                                aria-label={`Excluir ${l.rotulo}`}
                                onClick={() => setExcluir(l)}
                              >
                                <Trash2Icon />
                              </Button>
                            )}
                          </Td>
                        )}
                      </Tr>
                    ))
                  ) : (
                    <Vazio
                      cols={d.colunas.length + 1}
                      txt={d.linhas.length ? `nenhum registro com esses filtros` : `nenhum registro ainda`}
                    />
                  )}
                </TBody>
              </Table>
            </div>
            {rodape}
          </Card>

          <FormDialog
            aberto={!!form}
            aoFechar={() => setForm(null)}
            titulo={form?.rid != null ? `Editar ${d.um}` : d.novo}
            descricao={d.sobre}
            erro={erro}
            ocupado={acao.isPending}
            rotuloOk={form?.rid != null ? 'Salvar' : 'Cadastrar'}
            aoSalvar={salvar}
          >
            {form &&
              d.campos.map((c) => (
                <CampoForm
                  key={c.k}
                  c={c}
                  valor={form.v[c.k]}
                  opcoes={d.opcoes}
                  aoMudar={(v) => setForm({ ...form, v: { ...form.v, [c.k]: v } })}
                />
              ))}
          </FormDialog>

          <FormDialog
            aberto={!!excluir}
            aoFechar={() => setExcluir(null)}
            titulo={`Excluir ${d.um}`}
            descricao={excluir?.rotulo}
            erro={erro}
            ocupado={acao.isPending}
            rotuloOk="Excluir"
            aoSalvar={() =>
              excluir &&
              acao.mutate(
                { rid: excluir.id, method: 'DELETE' },
                {
                  onSuccess: (r) => {
                    setExcluir(null);
                    setMsg({ txt: r.msg });
                  },
                  onError: (e) => setErro(e.message),
                },
              )
            }
          >
            <p className="text-texto-2 sm:col-span-2">
              O registro sai de vez e a exclusão fica na Auditoria. Não dá para desfazer.
            </p>
          </FormDialog>
        </>
      )}
    </div>
  );
}

/** qual cadastro cada tela de menu abre (a tela é a do mapa; o id é o de domain/cadastros.ts) */
export const TELA_CADASTRO: Record<string, string> = {
  turmas: 'turmas',
  servicos: 'servicos',
  conteudos: 'conteudos',
  ciclos: 'ciclos',
  calendarios: 'calendarios',
  ofertas: 'ofertas',
  extratos: 'extratos',
  lancamentos: 'lancamentos',
  relatoriosMatricula: 'relatorios-matricula',
};

/** tela de menu de um cadastro simples: cabeçalho com o botão Novo, abas da seção e a lista */
export function TelaCadastro({ tela, titulo, abas }: { tela: string; titulo: string; abas?: React.ReactNode }) {
  return (
    <Cadastro
      id={TELA_CADASTRO[tela]}
      comTitulo
      acoesTopo={(novo) => (
        <>
          <PageHead titulo={titulo} acoes={novo} />
          {abas}
        </>
      )}
    />
  );
}

/** aba de ficha que é um cadastro simples: a API manda { cadastro, pai } nos dados da aba */
export function AbaCadastro({ dados }: { dados: unknown }) {
  const d = dados as { cadastro?: string; pai?: string | number } | null;
  if (!d?.cadastro) return null;
  return <Cadastro id={d.cadastro} pai={d.pai} comTitulo />;
}
