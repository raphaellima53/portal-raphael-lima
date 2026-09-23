'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { CampoData } from '@/components/campos-data';
import { ChipMulti } from '@/components/config/comum';
import { mascaraCnpj, mascaraCpf } from '@/components/mascaras';
import { CamposEndereco, CamposPessoa } from '@/components/pessoa-campos';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFoot, DialogHead } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PESSOA_VAZIA, type PessoaExtra, useCatalogos } from '@/lib/cadastros';
import { useAcaoProf, useFormProf, useOpcoesProf } from '@/lib/professores';
import { cn } from '@/lib/utils';

/*
 * Novo professor (24/09/2026): Nome, CPF, CNPJ, e-mail primário, contato e admissão obrigatórios;
 * e-mail secundário, nascimento e endereço opcionais. Cursos, teto, skills e situação ficam em Habilitação.
 */
const Esquema = z
  .object({
    nome: z.string().trim().min(2, 'Informe o nome.'),
    email: z.union([z.literal(''), z.string().trim().email('E-mail inválido.')]),
    teto: z.string().refine((s) => Number(s) >= 1 && Number(s) <= 80, 'O teto vai de 1 a 80 aulas.'),
    cursos: z.array(z.string()),
    ativo: z.boolean(),
    cpf: z.string(),
    cnpj: z.string(),
    admissao: z.string(),
    novo: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const erro = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
    const cpf = v.cpf.replace(/\D/g, '').length;
    const cnpj = v.cnpj.replace(/\D/g, '').length;
    if (cpf && cpf !== 11) erro('cpf', 'O CPF precisa de 11 dígitos.');
    if (cnpj && cnpj !== 14) erro('cnpj', 'O CNPJ precisa de 14 dígitos.');
    if (!v.novo) return;
    if (!cpf) erro('cpf', 'Informe o CPF.');
    if (!cnpj) erro('cnpj', 'Informe o CNPJ.');
    if (!v.email) erro('email', 'Informe o e-mail primário.');
    if (!v.admissao) erro('admissao', 'Informe a admissão.');
  });
type Form = z.infer<typeof Esquema>;
const VAZIO: Form = {
  nome: '',
  email: '',
  teto: '24',
  cursos: [],
  ativo: true,
  cpf: '',
  cnpj: '',
  admissao: '',
  novo: true,
};
const Erro = ({ t }: { t?: string }) => (t ? <span className="font-medium text-vermelho">{t}</span> : null);
const Req = ({ on }: { on: boolean }) => (on ? <span className="text-vermelho">*</span> : null);

/** Novo professor e Editar professor (fmProfessor) */
export function ProfessorFormDialog({
  abre,
  aoFechar,
  aoSalvo,
}: {
  abre: { id: string | null } | null;
  aoFechar: () => void;
  aoSalvo?: (r: { id?: string; msg: string }, novo: boolean) => void;
}) {
  const id = abre?.id ?? null;
  const ed = id != null;
  const novo = !ed;
  const op = useOpcoesProf(!!abre);
  const atual = useFormProf(id, !!abre);
  const acao = useAcaoProf();
  const f = useForm<Form>({ resolver: zodResolver(Esquema), defaultValues: VAZIO });
  const d = atual.data;
  const cats = useCatalogos(['skills'], !!abre);
  const [extra, setExtra] = useState<PessoaExtra & { skills: string[] }>({ ...PESSOA_VAZIA, skills: [] });
  const [erroContato, setErroContato] = useState('');

  // biome-ignore lint/correctness/useExhaustiveDependencies: reinicia ao abrir e quando o cadastro chega
  useEffect(() => {
    if (!abre) return;
    acao.reset();
    setErroContato('');
    setExtra(
      ed && d
        ? {
            skills: d.skills,
            telefone: d.telefone,
            nascimento: d.nascimento,
            genero: d.genero,
            endereco: d.endereco,
            emailSecundario: d.emailSecundario ?? '',
          }
        : { ...PESSOA_VAZIA, skills: [] },
    );
    f.reset(
      ed && d
        ? {
            nome: d.nome,
            email: d.email,
            teto: String(d.teto),
            cursos: d.cursos,
            ativo: d.ativo,
            cpf: mascaraCpf(d.cpf),
            cnpj: mascaraCnpj(d.cnpj ?? ''),
            admissao: d.admissao ?? '',
            novo: false,
          }
        : VAZIO,
    );
  }, [abre, d]);

  const erros = f.formState.errors;
  const enviar = f.handleSubmit(({ novo: _n, ...v }) => {
    if (novo && !extra.telefone) return setErroContato('Informe o contato.');
    setErroContato('');
    acao.mutate(
      { caminho: ed ? `/${id}` : '', method: ed ? 'PUT' : 'POST', json: { ...extra, ...v, teto: Number(v.teto) } },
      {
        onSuccess: (r) => {
          aoFechar();
          aoSalvo?.(r, !ed);
        },
      },
    );
  });

  return (
    <Dialog open={!!abre} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent tamanho="lg">
        <form onSubmit={enviar} noValidate className="flex min-h-0 flex-col">
          <DialogHead
            titulo={ed ? 'Editar professor' : 'Novo professor'}
            descricao={ed ? d?.nome : 'prestador que ministra aulas'}
          />
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            {ed && !d ? (
              <p className="text-apagado sm:col-span-2">Carregando o cadastro…</p>
            ) : (
              <>
                <div className="grid content-start gap-1.5 sm:col-span-2">
                  <Label htmlFor="pr-nome">
                    Nome
                    <Req on />
                  </Label>
                  <Input id="pr-nome" autoFocus aria-invalid={!!erros.nome} {...f.register('nome')} />
                  <Erro t={erros.nome?.message} />
                </div>
                <div className="grid content-start gap-1.5">
                  <Label htmlFor="pr-cpf">
                    CPF
                    <Req on={novo} />
                  </Label>
                  <Controller
                    control={f.control}
                    name="cpf"
                    render={({ field }) => (
                      <Input
                        id="pr-cpf"
                        inputMode="numeric"
                        placeholder="xxx.xxx.xxx-xx"
                        aria-invalid={!!erros.cpf}
                        value={field.value}
                        onChange={(e) => field.onChange(mascaraCpf(e.target.value))}
                      />
                    )}
                  />
                  <Erro t={erros.cpf?.message} />
                </div>
                <div className="grid content-start gap-1.5">
                  <Label htmlFor="pr-cnpj">
                    CNPJ
                    <Req on={novo} />
                  </Label>
                  <Controller
                    control={f.control}
                    name="cnpj"
                    render={({ field }) => (
                      <Input
                        id="pr-cnpj"
                        inputMode="numeric"
                        placeholder="xx.xxx.xxx/xxxx-xx"
                        aria-invalid={!!erros.cnpj}
                        value={field.value}
                        onChange={(e) => field.onChange(mascaraCnpj(e.target.value))}
                      />
                    )}
                  />
                  <Erro t={erros.cnpj?.message} />
                </div>
                <div className="grid content-start gap-1.5">
                  <Label htmlFor="pr-email">
                    E-mail primário
                    <Req on={novo} />
                  </Label>
                  <Input
                    id="pr-email"
                    type="email"
                    placeholder="xxxxxx@xxxx.com"
                    aria-invalid={!!erros.email}
                    {...f.register('email')}
                  />
                  <Erro t={erros.email?.message} />
                </div>
                <div className="grid content-start gap-1.5">
                  <Label htmlFor="pr-email2">E-mail secundário</Label>
                  <Input
                    id="pr-email2"
                    type="email"
                    placeholder="xxxxxx@xxxx.com"
                    value={extra.emailSecundario}
                    onChange={(e) => setExtra({ ...extra, emailSecundario: e.target.value })}
                  />
                </div>
                <div className="grid content-start gap-1.5">
                  <Label htmlFor="pr-adm">
                    Admissão
                    <Req on={novo} />
                  </Label>
                  <Controller
                    control={f.control}
                    name="admissao"
                    render={({ field }) => (
                      <CampoData id="pr-adm" rotulo="Admissão" valor={field.value} aoMudar={field.onChange} />
                    )}
                  />
                  <Erro t={erros.admissao?.message} />
                </div>
                <CamposPessoa
                  prefixo="pr"
                  obrigatorio={novo}
                  semGenero
                  valor={extra}
                  aoMudar={(p) => setExtra({ ...extra, ...p })}
                />
                {erroContato && <span className="font-medium text-vermelho sm:col-span-2">{erroContato}</span>}
                <fieldset className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
                  <legend className="mb-1.5 font-semibold text-texto-2">Endereço</legend>
                  <CamposEndereco
                    prefixo="pr-end"
                    valor={extra.endereco}
                    aoMudar={(e) => setExtra({ ...extra, endereco: e })}
                  />
                </fieldset>

                <details className="rounded-md border border-borda px-4 py-3 sm:col-span-2" open={ed}>
                  <summary className="cursor-pointer font-semibold text-texto">Habilitação</summary>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Controller
                      control={f.control}
                      name="cursos"
                      render={({ field }) => (
                        <fieldset className="grid gap-2 sm:col-span-2">
                          <legend className="mb-1.5 font-semibold text-texto-2">Cursos habilitados</legend>
                          <div className="flex flex-wrap gap-2">
                            {(op.data?.cursos ?? []).map((c) => {
                              const on = field.value.includes(c);
                              return (
                                <button
                                  key={c}
                                  type="button"
                                  aria-pressed={on}
                                  onClick={() =>
                                    field.onChange(on ? field.value.filter((x) => x !== c) : [...field.value, c])
                                  }
                                  className={cn(
                                    'h-9 cursor-pointer rounded-full bg-[#eceff5] px-3.5 text-[#4b5568] dark:bg-hover dark:text-texto-2',
                                    on && 'bg-azul-suave font-semibold text-azul shadow-[inset_0_0_0_1px_#cfdcfa]',
                                  )}
                                >
                                  {c}
                                </button>
                              );
                            })}
                          </div>
                          <span className="text-apagado">o recorte por módulo ou turma fica na ficha, em Cursos</span>
                        </fieldset>
                      )}
                    />
                    <div className="grid content-start gap-1.5">
                      <Label htmlFor="pr-teto">Teto semanal de aulas</Label>
                      <Input
                        id="pr-teto"
                        type="number"
                        min={1}
                        max={80}
                        aria-invalid={!!erros.teto}
                        {...f.register('teto')}
                      />
                      <Erro t={erros.teto?.message} />
                    </div>
                    <fieldset className="grid gap-2 sm:col-span-2">
                      <legend className="mb-1.5 font-semibold text-texto-2">Skills</legend>
                      <div className="flex flex-wrap gap-2">
                        {[...new Set([...(cats.data?.skills ?? []), ...extra.skills])].map((s) => (
                          <ChipMulti
                            key={s}
                            on={extra.skills.includes(s)}
                            aoClicar={() =>
                              setExtra({
                                ...extra,
                                skills: extra.skills.includes(s)
                                  ? extra.skills.filter((x) => x !== s)
                                  : [...extra.skills, s],
                              })
                            }
                          >
                            {s}
                          </ChipMulti>
                        ))}
                      </div>
                    </fieldset>
                    <Controller
                      control={f.control}
                      name="ativo"
                      render={({ field }) => (
                        <div className="flex items-start gap-3 sm:col-span-2">
                          <Switch id="pr-ativo" checked={field.value} onCheckedChange={field.onChange} />
                          <Label htmlFor="pr-ativo" className="grid gap-0.5 font-normal">
                            <span className="font-semibold text-texto-2">Professor ativo</span>
                            <span className="text-apagado">inativo não recebe alocação na grade</span>
                          </Label>
                        </div>
                      )}
                    />
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
              {ed ? 'Salvar' : 'Cadastrar professor'}
            </Button>
          </DialogFoot>
        </form>
      </DialogContent>
    </Dialog>
  );
}
