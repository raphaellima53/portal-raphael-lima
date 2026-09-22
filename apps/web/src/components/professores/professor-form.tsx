'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { ChipMulti } from '@/components/config/comum';
import { CamposEndereco, CamposPessoa } from '@/components/pessoa-campos';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFoot, DialogHead } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PESSOA_VAZIA, type PessoaExtra, useCatalogos } from '@/lib/cadastros';
import { useAcaoProf, useFormProf, useOpcoesProf } from '@/lib/professores';
import { cn } from '@/lib/utils';

const Esquema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome.'),
  email: z.union([z.literal(''), z.string().trim().email('E-mail inválido.')]),
  teto: z.string().refine((s) => Number(s) >= 1 && Number(s) <= 80, 'O teto vai de 1 a 80 aulas.'),
  cursos: z.array(z.string()),
  ativo: z.boolean(),
});
type Form = z.infer<typeof Esquema>;
const VAZIO: Form = { nome: '', email: '', teto: '24', cursos: [], ativo: true };
const cpfMascara = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return (
    [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean).join('.') + (d.length > 9 ? `-${d.slice(9)}` : '')
  );
};
const Erro = ({ t }: { t?: string }) => (t ? <span className="font-medium text-vermelho">{t}</span> : null);

/** Novo professor e Editar professor: nome, e-mail, teto semanal, cursos e situação (fmProfessor). */
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
  const op = useOpcoesProf(!!abre);
  const atual = useFormProf(id, !!abre);
  const acao = useAcaoProf();
  const f = useForm<Form>({ resolver: zodResolver(Esquema), defaultValues: VAZIO });
  const d = atual.data;
  /* adequação ao Portal Alumni: CPF, dados pessoais, endereço e skills */
  const cats = useCatalogos(['genders', 'skills'], !!abre);
  const [extra, setExtra] = useState<PessoaExtra & { cpf: string; skills: string[] }>({
    ...PESSOA_VAZIA,
    cpf: '',
    skills: [],
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: reinicia ao abrir e quando o cadastro chega
  useEffect(() => {
    if (!abre) return;
    acao.reset();
    setExtra(
      ed && d
        ? {
            cpf: d.cpf,
            skills: d.skills,
            telefone: d.telefone,
            nascimento: d.nascimento,
            genero: d.genero,
            endereco: d.endereco,
          }
        : { ...PESSOA_VAZIA, cpf: '', skills: [] },
    );
    f.reset(ed && d ? { nome: d.nome, email: d.email, teto: String(d.teto), cursos: d.cursos, ativo: d.ativo } : VAZIO);
  }, [abre, d]);

  const erros = f.formState.errors;
  const enviar = f.handleSubmit((v) =>
    acao.mutate(
      { caminho: ed ? `/${id}` : '', method: ed ? 'PUT' : 'POST', json: { ...v, ...extra, teto: Number(v.teto) } },
      {
        onSuccess: (r) => {
          aoFechar();
          aoSalvo?.(r, !ed);
        },
      },
    ),
  );

  return (
    <Dialog open={!!abre} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent tamanho="md">
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
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="pr-nome">
                    Nome completo<span className="text-vermelho">*</span>
                  </Label>
                  <Input id="pr-nome" autoFocus aria-invalid={!!erros.nome} {...f.register('nome')} />
                  <Erro t={erros.nome?.message} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="pr-email">E-mail</Label>
                  <Input id="pr-email" type="email" aria-invalid={!!erros.email} {...f.register('email')} />
                  <Erro t={erros.email?.message} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="pr-teto">Teto semanal de aulas</Label>
                  <Input
                    id="pr-teto"
                    type="number"
                    min={1}
                    max={80}
                    aria-invalid={!!erros.teto}
                    {...f.register('teto')}
                  />
                  <span className="text-apagado">a lista e a ficha marcam quando a grade passa deste número</span>
                  <Erro t={erros.teto?.message} />
                </div>
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
                <div className="grid gap-1.5">
                  <Label htmlFor="pr-cpf">CPF</Label>
                  <Input
                    id="pr-cpf"
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    value={cpfMascara(extra.cpf)}
                    onChange={(e) => setExtra({ ...extra, cpf: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                  />
                </div>
                <CamposPessoa
                  prefixo="pr"
                  valor={extra}
                  aoMudar={(p) => setExtra({ ...extra, ...p })}
                  generos={cats.data?.genders ?? []}
                />
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
                  <span className="text-apagado">
                    as skills vêm do catálogo Skills dos professores, em Configurações
                  </span>
                </fieldset>
                <fieldset className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
                  <legend className="mb-1.5 font-semibold text-texto-2">Endereço</legend>
                  <CamposEndereco
                    prefixo="pr-end"
                    valor={extra.endereco}
                    aoMudar={(e) => setExtra({ ...extra, endereco: e })}
                  />
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
