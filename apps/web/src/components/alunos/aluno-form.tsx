'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ExternalLinkIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { CampoData } from '@/components/campos-data';
import { Escolha } from '@/components/escolha';
import { mascaraCpf } from '@/components/mascaras';
import { CamposEndereco, CamposPessoa } from '@/components/pessoa-campos';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFoot, DialogHead } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAcaoAluno, useFormAluno, useOpcoesAluno } from '@/lib/alunos';
import { PESSOA_VAZIA, type PessoaExtra, useCatalogos } from '@/lib/cadastros';
import { ItemBadge } from './comum';

/*
 * Novo aluno (24/09/2026): Dados (nome, CPF, e-mail primário, contato obrigatórios; e-mail secundário, nascimento,
 * gênero e endereço), Matrícula (oferta ↗, contrato e pagamento: vira a matrícula e o pedido) e Nivelamento
 * (CEFR e concluído em). Situação, empresa, responsável financeiro e origem ficam em Mais dados.
 */
const Esquema = z
  .object({
    nome: z.string().trim().min(2, 'Informe o nome.'),
    cpf: z.string(),
    status: z.string(),
    email: z.union([z.literal(''), z.string().trim().email('E-mail inválido.')]),
    empresa: z.string(),
    contrato: z.string(),
    modalidades: z.record(z.string(), z.string()),
    ofertaId: z.string(),
    item: z.string(),
    modalidade: z.string(),
    contratoId: z.string(),
    forma: z.string(),
    parcelas: z.string(),
    cefr: z.string(),
    concluidoEm: z.string(),
    novo: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const erro = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
    const cpf = v.cpf.replace(/\D/g, '').length;
    if (cpf && cpf !== 11) erro('cpf', 'O CPF precisa de 11 dígitos.');
    if (v.novo && !cpf) erro('cpf', 'Informe o CPF.');
    if (v.novo && !v.email) erro('email', 'Informe o e-mail primário.');
    if (v.cefr && !v.ofertaId) erro('cefr', 'O nivelamento fica na matrícula: escolha a oferta.');
  });
type Form = z.infer<typeof Esquema>;
const VAZIO: Form = {
  nome: '',
  cpf: '',
  status: 'Ativo',
  email: '',
  empresa: '',
  contrato: '',
  modalidades: {},
  ofertaId: '',
  item: '',
  modalidade: 'Online',
  contratoId: '',
  forma: '1',
  parcelas: '1',
  cefr: '',
  concluidoEm: '',
  novo: true,
};

const Erro = ({ t }: { t?: string }) => (t ? <span className="font-medium text-vermelho">{t}</span> : null);
const Req = () => <span className="text-vermelho">*</span>;
const Secao = ({ titulo, link, children }: { titulo: string; link?: React.ReactNode; children: React.ReactNode }) => (
  <fieldset className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
    <legend className="mb-3 flex items-center gap-1.5 text-md font-bold text-texto">
      {titulo}
      {link}
    </legend>
    {children}
  </fieldset>
);
const Vai = ({ href, rotulo }: { href: string; rotulo: string }) => (
  <Link href={href} target="_blank" className="inline-flex text-azul" aria-label={rotulo} title={rotulo}>
    <ExternalLinkIcon className="size-3.5" />
  </Link>
);

/** Novo aluno e Editar aluno (fmAluno) */
export function AlunoFormDialog({
  abre,
  aoFechar,
  aoSalvo,
}: {
  abre: { id: number | null } | null;
  aoFechar: () => void;
  aoSalvo?: (r: { id?: number; msg: string }, novo: boolean) => void;
}) {
  const id = abre?.id ?? null;
  const ed = id != null;
  const op = useOpcoesAluno(!!abre);
  const atual = useFormAluno(id, !!abre);
  const acao = useAcaoAluno();
  const f = useForm<Form>({ resolver: zodResolver(Esquema), defaultValues: VAZIO });
  const d = atual.data;
  const cats = useCatalogos(['finResp'], !!abre);
  const [extra, setExtra] = useState<PessoaExtra & { responsavelFinanceiro: string; origemExterna: string }>({
    ...PESSOA_VAZIA,
    responsavelFinanceiro: '',
    origemExterna: '',
  });
  const [erroContato, setErroContato] = useState('');

  // biome-ignore lint/correctness/useExhaustiveDependencies: reinicia ao abrir e quando o cadastro chega
  useEffect(() => {
    if (!abre) return;
    acao.reset();
    setErroContato('');
    setExtra(
      ed && d
        ? {
            telefone: d.telefone,
            nascimento: d.nascimento,
            genero: d.genero,
            endereco: d.endereco,
            emailSecundario: d.emailSecundario ?? '',
            responsavelFinanceiro: d.responsavelFinanceiro,
            origemExterna: d.origemExterna,
          }
        : { ...PESSOA_VAZIA, responsavelFinanceiro: '', origemExterna: '' },
    );
    f.reset(
      ed && d
        ? {
            ...VAZIO,
            novo: false,
            nome: d.nome,
            cpf: mascaraCpf(d.cpf),
            status: d.status,
            email: d.email,
            empresa: d.empresa,
            contrato: d.contrato,
            modalidades: Object.fromEntries(d.matriculas.map((m) => [String(m.id), m.modalidade])),
          }
        : VAZIO,
    );
  }, [abre, d]);

  const oferta = op.data?.ofertas.find((o) => String(o.id) === f.watch('ofertaId'));
  const curso = op.data?.cursos.find((c) => c.nome === oferta?.curso);
  const ms = ed ? (d?.matriculas ?? []) : [];

  const enviar = f.handleSubmit((v) => {
    if (!ed && !extra.telefone) return setErroContato('Informe o contato.');
    setErroContato('');
    acao.mutate(
      {
        caminho: ed ? `/${id}` : '',
        method: ed ? 'PUT' : 'POST',
        json: {
          ...extra,
          nome: v.nome,
          cpf: v.cpf,
          status: v.status,
          email: v.email,
          empresa: v.empresa,
          contrato: v.contrato,
          modalidades: v.modalidades,
          matricula: v.ofertaId
            ? {
                ofertaId: Number(v.ofertaId),
                item: v.item || null,
                modalidade: v.modalidade,
                contratoId: v.contratoId ? Number(v.contratoId) : null,
                forma: Number(v.forma),
                parcelas: Number(v.parcelas),
              }
            : null,
          nivelamento: v.cefr ? { cefr: v.cefr, concluidoEm: v.concluidoEm } : null,
        },
      },
      {
        onSuccess: (r) => {
          aoFechar();
          aoSalvo?.(r, !ed);
        },
      },
    );
  });
  const erros = f.formState.errors;
  const novo = !ed;

  return (
    <Dialog open={!!abre} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent tamanho="lg">
        <form onSubmit={enviar} noValidate className="flex min-h-0 flex-col">
          <DialogHead
            titulo={ed ? 'Editar aluno' : 'Novo aluno'}
            descricao={ed ? d?.email || d?.nome : 'dados, matrícula e nivelamento'}
          />
          <DialogBody className="grid gap-6 sm:grid-cols-2">
            {ed && !d ? (
              <p className="text-apagado sm:col-span-2">Carregando o cadastro…</p>
            ) : (
              <>
                <Secao titulo="Dados">
                  <div className="grid content-start gap-1.5 sm:col-span-2">
                    <Label htmlFor="al-nome">
                      Nome
                      <Req />
                    </Label>
                    <Input id="al-nome" autoFocus aria-invalid={!!erros.nome} {...f.register('nome')} />
                    <Erro t={erros.nome?.message} />
                  </div>
                  <div className="grid content-start gap-1.5">
                    <Label htmlFor="al-cpf">
                      CPF
                      {novo && <Req />}
                    </Label>
                    <Controller
                      control={f.control}
                      name="cpf"
                      render={({ field }) => (
                        <Input
                          id="al-cpf"
                          inputMode="numeric"
                          placeholder="xxx.xxx.xxx-xx"
                          aria-invalid={!!erros.cpf}
                          value={field.value}
                          onChange={(e) => field.onChange(mascaraCpf(e.target.value))}
                          onBlur={field.onBlur}
                        />
                      )}
                    />
                    <Erro t={erros.cpf?.message} />
                  </div>
                  <div className="grid content-start gap-1.5">
                    <Label htmlFor="al-email">
                      E-mail primário
                      {novo && <Req />}
                    </Label>
                    <Input
                      id="al-email"
                      type="email"
                      placeholder="xxxxxx@xxxx.com"
                      aria-invalid={!!erros.email}
                      {...f.register('email')}
                    />
                    <Erro t={erros.email?.message} />
                  </div>
                  <div className="grid content-start gap-1.5">
                    <Label htmlFor="al-email2">E-mail secundário</Label>
                    <Input
                      id="al-email2"
                      type="email"
                      placeholder="xxxxxx@xxxx.com"
                      value={extra.emailSecundario}
                      onChange={(e) => setExtra({ ...extra, emailSecundario: e.target.value })}
                    />
                  </div>
                  <CamposPessoa
                    prefixo="al"
                    obrigatorio={novo}
                    valor={extra}
                    aoMudar={(p) => setExtra({ ...extra, ...p })}
                  />
                  {erroContato && <span className="font-medium text-vermelho sm:col-span-2">{erroContato}</span>}
                  <p className="m-0 font-semibold text-texto-2 sm:col-span-2">Endereço</p>
                  <CamposEndereco
                    prefixo="al-end"
                    valor={extra.endereco}
                    aoMudar={(e) => setExtra({ ...extra, endereco: e })}
                  />
                </Secao>

                <Secao titulo="Matrícula">
                  {ms.length > 0 && (
                    <div className="grid gap-2 sm:col-span-2">
                      <span className="font-semibold text-texto-2">Matrículas ativas</span>
                      {ms.map((m) => (
                        <div
                          key={m.id}
                          className="flex flex-wrap items-center gap-2.5 rounded-md border border-borda-suave px-3 py-2"
                        >
                          {m.item && <ItemBadge item={{ nome: m.item, cor: '' }} />}
                          <b className="text-texto">{m.curso}</b>
                          <span className="text-apagado">
                            · {m.usadas}/{m.total} aulas
                          </span>
                          <span className="flex-1" />
                          <Controller
                            control={f.control}
                            name={`modalidades.${m.id}`}
                            render={({ field }) => (
                              <Escolha
                                rotulo={`Modalidade da matrícula em ${m.curso}`}
                                destacar={false}
                                valor={field.value ?? m.modalidade}
                                aoMudar={field.onChange}
                                opcoes={['Online', 'Presencial'].map((x) => ({ v: x, l: x }))}
                                className="w-[150px]"
                              />
                            )}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="grid content-start gap-1.5 sm:col-span-2">
                    <Label className="flex items-center gap-1.5">
                      {ms.length ? 'Nova matrícula · oferta' : 'Oferta'}
                      <Vai href="/produtos/dlOfertas" rotulo="Abrir as ofertas" />
                    </Label>
                    <Controller
                      control={f.control}
                      name="ofertaId"
                      render={({ field }) => (
                        <Escolha
                          rotulo="Oferta"
                          todos={ms.length ? 'nenhuma nova matrícula' : 'sem matrícula por enquanto'}
                          destacar={false}
                          valor={field.value}
                          aoMudar={(v) => {
                            field.onChange(v);
                            const o = op.data?.ofertas.find((x) => String(x.id) === v);
                            const c = op.data?.cursos.find((x) => x.nome === o?.curso);
                            f.setValue('item', c?.itens[0] ?? '');
                            f.setValue('modalidade', c?.modalidades[0] ?? 'Online');
                            f.setValue('parcelas', '1');
                          }}
                          opcoes={(op.data?.ofertas ?? []).map((o) => ({ v: String(o.id), l: o.nome }))}
                        />
                      )}
                    />
                  </div>
                  {oferta && (
                    <>
                      {!!curso?.itens.length && (
                        <div className="grid content-start gap-1.5">
                          <Label>{curso.estrutura === 'turmas' ? 'Turma' : 'Módulo'}</Label>
                          <Controller
                            control={f.control}
                            name="item"
                            render={({ field }) => (
                              <Escolha
                                rotulo="Módulo ou turma"
                                destacar={false}
                                valor={field.value}
                                aoMudar={field.onChange}
                                opcoes={curso.itens.map((x) => ({ v: x, l: x }))}
                              />
                            )}
                          />
                        </div>
                      )}
                      <div className="grid content-start gap-1.5">
                        <Label>Modalidade</Label>
                        <Controller
                          control={f.control}
                          name="modalidade"
                          render={({ field }) => (
                            <Escolha
                              rotulo="Modalidade"
                              destacar={false}
                              valor={field.value}
                              aoMudar={field.onChange}
                              opcoes={(curso?.modalidades ?? ['Online', 'Presencial']).map((x) => ({ v: x, l: x }))}
                            />
                          )}
                        />
                      </div>
                      <div className="grid content-start gap-1.5">
                        <Label>Contrato</Label>
                        <Controller
                          control={f.control}
                          name="contratoId"
                          render={({ field }) => (
                            <Escolha
                              rotulo="Contrato"
                              todos="Sem contrato empresarial (B2C)"
                              destacar={false}
                              valor={field.value}
                              aoMudar={field.onChange}
                              opcoes={(op.data?.contratos ?? []).map((c) => ({ v: String(c.id), l: c.nome }))}
                            />
                          )}
                        />
                      </div>
                      <div className="grid content-start gap-1.5">
                        <Label>Pagamento</Label>
                        <div className="flex gap-2">
                          <Controller
                            control={f.control}
                            name="forma"
                            render={({ field }) => (
                              <Escolha
                                rotulo="Forma de pagamento"
                                destacar={false}
                                valor={field.value}
                                aoMudar={field.onChange}
                                opcoes={(op.data?.formas ?? []).map((x) => ({ v: String(x.id), l: x.nome }))}
                                className="flex-1"
                              />
                            )}
                          />
                          <Controller
                            control={f.control}
                            name="parcelas"
                            render={({ field }) => (
                              <Escolha
                                rotulo="Parcelas"
                                destacar={false}
                                valor={field.value}
                                aoMudar={field.onChange}
                                opcoes={Array.from({ length: oferta.parcelasMax }, (_, i) => ({
                                  v: String(i + 1),
                                  l: `${i + 1}x`,
                                }))}
                                className="w-[90px]"
                              />
                            )}
                          />
                        </div>
                      </div>
                      <p className="m-0 text-apagado sm:col-span-2">
                        {oferta.aulas} aulas de {oferta.curso}. Ao salvar, a matrícula e o pedido (com as parcelas) são
                        criados.
                      </p>
                    </>
                  )}
                </Secao>

                <Secao titulo="Nivelamento">
                  <div className="grid content-start gap-1.5">
                    <Label>CEFR</Label>
                    <Controller
                      control={f.control}
                      name="cefr"
                      render={({ field }) => (
                        <Escolha
                          rotulo="CEFR"
                          todos="sem nivelamento"
                          destacar={false}
                          valor={field.value}
                          aoMudar={field.onChange}
                          opcoes={(op.data?.cefr ?? []).map((x) => ({ v: x, l: x }))}
                        />
                      )}
                    />
                    <Erro t={erros.cefr?.message} />
                  </div>
                  <div className="grid content-start gap-1.5">
                    <Label htmlFor="al-niv">Concluído em</Label>
                    <Controller
                      control={f.control}
                      name="concluidoEm"
                      render={({ field }) => (
                        <CampoData
                          id="al-niv"
                          rotulo="Nivelamento concluído em"
                          valor={field.value}
                          aoMudar={field.onChange}
                        />
                      )}
                    />
                  </div>
                  {ed && (
                    <p className="m-0 flex items-center gap-1.5 text-apagado sm:col-span-2">
                      o nivelamento de cada matrícula também fica na ficha, em Matrícula › Nivelamento
                      <Vai href={`/alunos/${id}/nivelamento`} rotulo="Abrir o nivelamento do aluno" />
                    </p>
                  )}
                </Secao>

                <details className="rounded-md border border-borda px-4 py-3 sm:col-span-2">
                  <summary className="cursor-pointer font-semibold text-texto">Mais dados (opcional)</summary>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="grid content-start gap-1.5">
                      <Label>Situação</Label>
                      <Controller
                        control={f.control}
                        name="status"
                        render={({ field }) => (
                          <Escolha
                            rotulo="Situação"
                            destacar={false}
                            valor={field.value}
                            aoMudar={field.onChange}
                            opcoes={(op.data?.situacoes ?? [field.value]).map((x) => ({ v: x, l: x }))}
                          />
                        )}
                      />
                    </div>
                    <div className="grid content-start gap-1.5">
                      <Label>Empresa</Label>
                      <Controller
                        control={f.control}
                        name="empresa"
                        render={({ field }) => (
                          <Escolha
                            rotulo="Empresa"
                            todos="Sem empresa — aluno B2C"
                            destacar={false}
                            valor={field.value}
                            aoMudar={field.onChange}
                            opcoes={[
                              ...new Set([...(op.data?.empresas ?? []), ...(field.value ? [field.value] : [])]),
                            ].map((x) => ({ v: x, l: x }))}
                          />
                        )}
                      />
                    </div>
                    <div className="grid content-start gap-1.5">
                      <Label htmlFor="al-contrato">Contrato até</Label>
                      <Controller
                        control={f.control}
                        name="contrato"
                        render={({ field }) => (
                          <CampoData
                            id="al-contrato"
                            rotulo="Contrato até"
                            valor={field.value}
                            aoMudar={field.onChange}
                          />
                        )}
                      />
                    </div>
                    <div className="grid content-start gap-1.5">
                      <Label>Responsável financeiro</Label>
                      <Escolha
                        rotulo="Responsável financeiro"
                        todos="não informado"
                        destacar={false}
                        valor={extra.responsavelFinanceiro}
                        aoMudar={(v) => setExtra({ ...extra, responsavelFinanceiro: v })}
                        opcoes={[
                          ...new Set([
                            ...(cats.data?.finResp ?? []),
                            ...(extra.responsavelFinanceiro ? [extra.responsavelFinanceiro] : []),
                          ]),
                        ].map((x) => ({ v: x, l: x }))}
                      />
                    </div>
                    <div className="grid content-start gap-1.5 sm:col-span-2">
                      <Label htmlFor="al-origem">Origem do cadastro</Label>
                      <Input
                        id="al-origem"
                        placeholder="ex.: importação, site, indicação"
                        value={extra.origemExterna}
                        onChange={(e) => setExtra({ ...extra, origemExterna: e.target.value })}
                      />
                    </div>
                  </div>
                </details>
              </>
            )}
          </DialogBody>
          <DialogFoot>
            {acao.isError && (
              <span role="alert" className="mr-auto font-medium text-vermelho">
                {acao.error.message}
              </span>
            )}
            <Button type="button" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={acao.isPending || (ed && !d)}>
              {ed ? 'Salvar' : 'Cadastrar aluno'}
            </Button>
          </DialogFoot>
        </form>
      </DialogContent>
    </Dialog>
  );
}
