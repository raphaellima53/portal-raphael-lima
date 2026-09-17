'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { CampoData } from '@/components/campos-data';
import { Escolha } from '@/components/escolha';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFoot, DialogHead } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAcaoAluno, useFormAluno, useOpcoesAluno } from '@/lib/alunos';
import { ItemBadge } from './comum';

const cpfMascara = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return (
    [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean).join('.') + (d.length > 9 ? `-${d.slice(9)}` : '')
  );
};

const Esquema = z
  .object({
    nome: z.string().trim().min(2, 'Informe o nome.'),
    cpf: z.string().refine((s) => [0, 11].includes(s.replace(/\D/g, '').length), 'O CPF precisa de 11 dígitos.'),
    status: z.string(),
    email: z.union([z.literal(''), z.string().trim().email('E-mail inválido.')]),
    empresa: z.string(),
    contrato: z.string(),
    modalidades: z.record(z.string(), z.string()),
    novaCurso: z.string(),
    novaItem: z.string(),
    novaModalidade: z.string(),
    novaTotal: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.novaCurso && !(Number(v.novaTotal) > 0))
      ctx.addIssue({ code: 'custom', path: ['novaTotal'], message: 'Informe o pacote de aulas da nova matrícula.' });
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
  novaCurso: '',
  novaItem: '',
  novaModalidade: 'Online',
  novaTotal: '',
};

const Erro = ({ t }: { t?: string }) => (t ? <span className="font-medium text-vermelho">{t}</span> : null);
const Secao = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <fieldset className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
    <legend className="mb-3 text-md font-bold text-texto">{titulo}</legend>
    {children}
  </fieldset>
);

/** Novo aluno e Editar aluno: dados pessoais, matrículas, vínculos e contato (fmAluno). */
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: reinicia ao abrir e quando o cadastro chega
  useEffect(() => {
    if (!abre) return;
    acao.reset();
    f.reset(
      ed && d
        ? {
            ...VAZIO,
            nome: d.nome,
            cpf: cpfMascara(d.cpf),
            status: d.status,
            email: d.email,
            empresa: d.empresa,
            contrato: d.contrato,
            modalidades: Object.fromEntries(d.matriculas.map((m) => [String(m.id), m.modalidade])),
          }
        : VAZIO,
    );
  }, [abre, d]);

  const cursoNovo = op.data?.cursos.find((c) => c.nome === f.watch('novaCurso'));
  const ms = ed ? (d?.matriculas ?? []) : [];

  const enviar = f.handleSubmit((v) =>
    acao.mutate(
      {
        caminho: ed ? `/${id}` : '',
        method: ed ? 'PUT' : 'POST',
        json: {
          nome: v.nome,
          cpf: v.cpf,
          status: v.status,
          email: v.email,
          empresa: v.empresa,
          contrato: v.contrato,
          modalidades: v.modalidades,
          nova: v.novaCurso
            ? {
                curso: v.novaCurso,
                item: v.novaItem || null,
                modalidade: v.novaModalidade,
                total: Number(v.novaTotal),
              }
            : null,
        },
      },
      {
        onSuccess: (r) => {
          aoFechar();
          aoSalvo?.(r, !ed);
        },
      },
    ),
  );
  const erros = f.formState.errors;

  return (
    <Dialog open={!!abre} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent tamanho="lg">
        <form onSubmit={enviar} noValidate className="flex min-h-0 flex-col">
          <DialogHead
            titulo={ed ? 'Editar aluno' : 'Novo aluno'}
            descricao={ed ? d?.email || d?.nome : 'Cadastre o aluno e a matrícula dele.'}
          />
          <DialogBody className="grid gap-6 sm:grid-cols-2">
            {ed && !d ? (
              <p className="text-apagado sm:col-span-2">Carregando o cadastro…</p>
            ) : (
              <>
                <Secao titulo="Dados pessoais">
                  <div className="grid gap-1.5 sm:col-span-2">
                    <Label htmlFor="al-nome">
                      Nome completo<span className="text-vermelho">*</span>
                    </Label>
                    <Input id="al-nome" autoFocus aria-invalid={!!erros.nome} {...f.register('nome')} />
                    <Erro t={erros.nome?.message} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="al-cpf">CPF</Label>
                    <Controller
                      control={f.control}
                      name="cpf"
                      render={({ field }) => (
                        <Input
                          id="al-cpf"
                          inputMode="numeric"
                          placeholder="000.000.000-00"
                          aria-invalid={!!erros.cpf}
                          value={field.value}
                          onChange={(e) => field.onChange(cpfMascara(e.target.value))}
                          onBlur={field.onBlur}
                        />
                      )}
                    />
                    <Erro t={erros.cpf?.message} />
                  </div>
                  <div className="grid gap-1.5">
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
                </Secao>

                <Secao titulo="Matrículas">
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
                      <span className="text-apagado">
                        online ou presencial vale para a matrícula — o mesmo aluno pode ter uma de cada
                      </span>
                    </div>
                  )}
                  <div className="grid gap-1.5">
                    <Label>{ms.length ? 'Nova matrícula · produto' : 'Produto'}</Label>
                    <Controller
                      control={f.control}
                      name="novaCurso"
                      render={({ field }) => (
                        <Escolha
                          rotulo="Produto da nova matrícula"
                          todos={ms.length ? 'nenhuma nova matrícula' : 'sem matrícula por enquanto'}
                          destacar={false}
                          valor={field.value}
                          aoMudar={(v) => {
                            field.onChange(v);
                            const c = op.data?.cursos.find((x) => x.nome === v);
                            f.setValue('novaItem', c?.itens[0] ?? '');
                            f.setValue('novaModalidade', c?.modalidades[0] ?? 'Online');
                            f.setValue('novaTotal', c ? String(c.pacote) : '');
                          }}
                          opcoes={(op.data?.cursos ?? []).map((c) => ({ v: c.nome, l: c.nome }))}
                        />
                      )}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>{cursoNovo?.estrutura === 'turmas' ? 'Turma' : 'Módulo ou turma'}</Label>
                    <Controller
                      control={f.control}
                      name="novaItem"
                      render={({ field }) => (
                        <Escolha
                          rotulo="Módulo ou turma da nova matrícula"
                          todos={
                            cursoNovo
                              ? cursoNovo.itens.length
                                ? undefined
                                : 'sem módulo nem turma'
                              : 'escolha o produto'
                          }
                          destacar={false}
                          disabled={!cursoNovo?.itens.length}
                          valor={field.value}
                          aoMudar={field.onChange}
                          opcoes={(cursoNovo?.itens ?? []).map((x) => ({ v: x, l: x }))}
                        />
                      )}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Modalidade</Label>
                    <Controller
                      control={f.control}
                      name="novaModalidade"
                      render={({ field }) => (
                        <Escolha
                          rotulo="Modalidade da nova matrícula"
                          destacar={false}
                          disabled={!cursoNovo}
                          valor={field.value}
                          aoMudar={field.onChange}
                          opcoes={(cursoNovo?.modalidades ?? ['Online', 'Presencial']).map((x) => ({ v: x, l: x }))}
                        />
                      )}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="al-pacote">Pacote de aulas</Label>
                    <Input
                      id="al-pacote"
                      type="number"
                      min={1}
                      placeholder="ex.: 40"
                      disabled={!cursoNovo}
                      aria-invalid={!!erros.novaTotal}
                      {...f.register('novaTotal')}
                    />
                    <Erro t={erros.novaTotal?.message} />
                  </div>
                </Secao>

                <Secao titulo="Vínculos">
                  <div className="grid gap-1.5">
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
                          ].map((x) => ({
                            v: x,
                            l: x,
                          }))}
                        />
                      )}
                    />
                  </div>
                  <div className="grid gap-1.5">
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
                </Secao>

                <Secao titulo="Contato">
                  <div className="grid gap-1.5 sm:col-span-2">
                    <Label htmlFor="al-email">E-mail</Label>
                    <Input id="al-email" type="email" aria-invalid={!!erros.email} {...f.register('email')} />
                    <Erro t={erros.email?.message} />
                  </div>
                </Secao>
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
              {ed ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFoot>
        </form>
      </DialogContent>
    </Dialog>
  );
}
