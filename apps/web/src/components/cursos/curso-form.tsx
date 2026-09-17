'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { PlusIcon, XIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Escolha } from '@/components/escolha';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFoot, DialogHead } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { type CursoForm as Form, useOpcoesCurso, useSalvarCurso } from '@/lib/cursos';

const Esquema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome do curso.'),
  descricao: z.string(),
  idioma: z.string(),
  tipo: z.string(),
  estrutura: z.enum(['modulos', 'turmas', 'nenhuma']),
  cor: z.string(),
  itens: z.array(z.object({ nome: z.string(), cor: z.string() })),
  autoAgenda: z.boolean(),
  ativo: z.boolean(),
});

const VAZIO: Form = {
  nome: '',
  descricao: '',
  idioma: '',
  tipo: '',
  estrutura: 'modulos',
  cor: '#1a4fd6',
  itens: [],
  autoAgenda: false,
  ativo: true,
};

/** Novo curso e Editar curso: cada curso é um produto com regras fechadas. */
export function CursoFormDialog({
  aberto,
  aoFechar,
  id,
  inicial,
  aoSalvo,
}: {
  aberto: boolean;
  aoFechar: () => void;
  id: number | null;
  inicial?: Form;
  aoSalvo?: (msg: string) => void;
}) {
  const router = useRouter();
  const opcoes = useOpcoesCurso(aberto);
  const salvar = useSalvarCurso();
  const f = useForm<Form>({ resolver: zodResolver(Esquema), defaultValues: inicial ?? VAZIO });
  const itens = useFieldArray({ control: f.control, name: 'itens' });
  // biome-ignore lint/correctness/useExhaustiveDependencies: reinicia ao abrir
  useEffect(() => {
    if (aberto) {
      f.reset(inicial ?? VAZIO);
      salvar.reset();
    }
  }, [aberto]);

  const enviar = f.handleSubmit((d) =>
    salvar.mutate(
      { ...d, id },
      {
        onSuccess: (r) => {
          aoFechar();
          if (id == null) router.push(`/cursos/${r.id}/regras`);
          else aoSalvo?.(r.msg);
        },
      },
    ),
  );

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent tamanho="lg">
        <form onSubmit={enviar} noValidate className="flex min-h-0 flex-col">
          <DialogHead
            titulo={id == null ? 'Novo curso' : 'Editar curso'}
            descricao="cada curso é um produto com regras fechadas"
          />
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="cf-nome">
                Nome do curso<span className="text-vermelho">*</span>
              </Label>
              <Input
                id="cf-nome"
                autoFocus
                placeholder="Ex.: Community live classes"
                aria-invalid={!!f.formState.errors.nome}
                {...f.register('nome')}
              />
              {f.formState.errors.nome && (
                <span className="font-medium text-vermelho">{f.formState.errors.nome.message}</span>
              )}
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="cf-desc">Descrição</Label>
              <Input
                id="cf-desc"
                placeholder="Aulas ao vivo em grupo, do Confidence ao Apex"
                {...f.register('descricao')}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Idioma</Label>
              <Controller
                control={f.control}
                name="idioma"
                render={({ field }) => (
                  <Escolha
                    rotulo="Idioma"
                    todos="Selecione…"
                    destacar={false}
                    valor={field.value}
                    aoMudar={field.onChange}
                    opcoes={(opcoes.data?.idiomas ?? []).map((x) => ({ v: x, l: x }))}
                  />
                )}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Tipo do curso</Label>
              <Controller
                control={f.control}
                name="tipo"
                render={({ field }) => (
                  <Escolha
                    rotulo="Tipo do curso"
                    todos="Selecione…"
                    destacar={false}
                    valor={field.value}
                    aoMudar={field.onChange}
                    opcoes={(opcoes.data?.tipos ?? []).map((x) => ({ v: x, l: x }))}
                  />
                )}
              />
              <span className="text-apagado">o tipo define o formato da aula</span>
            </div>
            <div className="grid gap-1.5">
              <Label>Estrutura</Label>
              <Controller
                control={f.control}
                name="estrutura"
                render={({ field }) => (
                  <Escolha
                    rotulo="Estrutura"
                    destacar={false}
                    valor={field.value}
                    aoMudar={field.onChange}
                    opcoes={[
                      { v: 'modulos', l: 'Módulos — níveis do curso' },
                      { v: 'turmas', l: 'Turmas — contrato com cliente' },
                      { v: 'nenhuma', l: 'Sem subdivisão' },
                    ]}
                  />
                )}
              />
              <span className="text-apagado">é aqui que as turmas entram — não há cadastro de turma fora do curso</span>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cf-cor">Cor</Label>
              <input
                id="cf-cor"
                type="color"
                className="h-10 w-full cursor-pointer rounded-md border border-borda-forte bg-card p-1"
                {...f.register('cor')}
              />
            </div>
            <fieldset className="grid gap-2 sm:col-span-2">
              <legend className="mb-1.5 font-semibold text-texto-2">Módulos ou turmas</legend>
              <div className="grid gap-2 md:grid-cols-2">
                {itens.fields.map((it, k) => (
                  <div key={it.id} className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label="Cor do módulo"
                      className="h-10 w-11 shrink-0 cursor-pointer rounded-md border border-borda-forte bg-card p-1"
                      {...f.register(`itens.${k}.cor`)}
                    />
                    <Input
                      placeholder="Nome do módulo"
                      aria-label={`Módulo ou turma ${k + 1}`}
                      {...f.register(`itens.${k}.nome`)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remover módulo"
                      onClick={() => itens.remove(k)}
                    >
                      <XIcon />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                className="w-fit border border-dashed border-borda-forte"
                onClick={() => itens.append({ nome: '', cor: f.getValues('cor') || '#1a4fd6' })}
              >
                <PlusIcon /> Adicionar módulo ou turma
              </Button>
              <span className="text-apagado">
                na ordem do produto — cada item vira 1.1, 1.2… no cartão; deixe vazio se o curso não se divide
              </span>
            </fieldset>
            <Controller
              control={f.control}
              name="autoAgenda"
              render={({ field }) => (
                // biome-ignore lint/a11y/noLabelWithoutControl: o Switch (botão) dentro do label é o controle
                <label className="flex items-start gap-3 sm:col-span-2">
                  <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Aluno pode auto-agendar" />
                  <span>
                    Aluno pode auto-agendar
                    <small className="block text-sm text-apagado">desligado, só a secretaria agenda a aula</small>
                  </span>
                </label>
              )}
            />
            <Controller
              control={f.control}
              name="ativo"
              render={({ field }) => (
                // biome-ignore lint/a11y/noLabelWithoutControl: o Switch (botão) dentro do label é o controle
                <label className="flex items-center gap-3 sm:col-span-2">
                  <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Curso ativo" />
                  Curso ativo
                </label>
              )}
            />
          </DialogBody>
          <DialogFoot>
            {salvar.isError && (
              <span role="alert" className="mr-auto font-medium text-vermelho">
                {salvar.error.message}
              </span>
            )}
            <Button type="button" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={salvar.isPending}>
              {id == null ? 'Criar' : 'Salvar'}
            </Button>
          </DialogFoot>
        </form>
      </DialogContent>
    </Dialog>
  );
}
