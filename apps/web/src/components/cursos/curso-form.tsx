'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ExternalLinkIcon, PlusIcon, XIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { type Control, Controller, type UseFormRegister, useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { GradeModulo } from '@/components/cursos/grade-modulo';
import { Escolha } from '@/components/escolha';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFoot, DialogHead } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { type CursoForm as Form, type OpcoesCurso, useOpcoesCurso, useSalvarCurso } from '@/lib/cursos';

/*
 * Novo curso (24/09/2026): Nome, Cor, Idioma e Tipo de curso obrigatórios; o tipo abre o cadastro próprio:
 * Grupo Open-Entry → módulos (CEFR, vagas por aula, regras de agenda e grade); Grupo Regular → turmas
 * (CEFR e vagas por turma); Particular → alocações (responsável e vagas). O resto fica em Mais dados.
 */
const TIPOS = [
  { v: 'modulos', l: 'Grupo Open-Entry' },
  { v: 'turmas', l: 'Grupo Regular' },
  { v: 'nenhuma', l: 'Particular' },
] as const;
const Tempo = z.object({ valor: z.number().int().min(0), unidade: z.enum(['min', 'h']) }).nullable();

const Esquema = z
  .object({
    nome: z.string().trim().min(1, 'Informe o nome do curso.'),
    descricao: z.string(),
    idioma: z.string().min(1, 'Escolha o idioma.'),
    tipo: z.string(),
    estrutura: z.enum(['modulos', 'turmas', 'nenhuma']),
    cor: z.string(),
    itens: z.array(
      z.object({
        nome: z.string(),
        cor: z.string(),
        sigla: z.string(),
        descricao: z.string(),
        vagas: z.number().int().min(1, 'Vagas: pelo menos 1.').nullable(),
        cefr: z.string(),
        agendamento: Tempo,
        cancelamento: Tempo,
        horarios: z.array(z.object({ dia: z.number(), hora: z.string(), professorId: z.string() })),
      }),
    ),
    alocacoes: z.array(z.object({ responsavel: z.string(), vagas: z.number().int().min(1) })),
    autoAgenda: z.boolean(),
    ativo: z.boolean(),
    sigla: z.string().max(20, 'Sigla com até 20 letras.'),
    natureza: z.enum(['Curso', 'Serviço', 'Assinatura']),
    visibilidadeOferta: z.string(),
    tipoSala: z.string(),
  })
  .superRefine((v, ctx) => {
    const erro = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
    if (v.estrutura === 'nenhuma') return;
    const qual = v.estrutura === 'modulos' ? 'módulo' : 'turma';
    v.itens.forEach((it, k) => {
      if (!it.nome.trim()) erro(['itens', k, 'nome'], `Informe o nome da ${qual}.`);
      if (!it.cefr) erro(['itens', k, 'cefr'], 'Escolha o CEFR.');
      if (!it.vagas) erro(['itens', k, 'vagas'], 'Informe as vagas.');
      if (v.estrutura === 'modulos') {
        if (!it.agendamento) erro(['itens', k, 'agendamento'], 'Informe a regra de agendamento.');
        if (!it.cancelamento) erro(['itens', k, 'cancelamento'], 'Informe a regra de cancelamento.');
        it.horarios.forEach((h, j) => {
          if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(h.hora)) erro(['itens', k, 'horarios', j, 'hora'], 'Horário HH:MM.');
        });
      }
    });
  });

const VAZIO: Form = {
  nome: '',
  descricao: '',
  idioma: '',
  tipo: '',
  estrutura: 'modulos',
  cor: '#003FB0',
  itens: [],
  alocacoes: [],
  autoAgenda: false,
  ativo: true,
  sigla: '',
  natureza: 'Curso',
  visibilidadeOferta: '',
  tipoSala: '',
};
const novoItem = (cor: string): Form['itens'][number] => ({
  nome: '',
  cor,
  sigla: '',
  descricao: '',
  vagas: null,
  cefr: '',
  agendamento: null,
  cancelamento: null,
  horarios: [],
});

const Req = () => <span className="text-vermelho">*</span>;
const Erro = ({ m }: { m?: string }) => (m ? <span className="font-medium text-vermelho">{m}</span> : null);
/** link ↗ para o cadastro de onde vêm as opções (Configurações › Catálogos) */
const Vai = ({ href, rotulo }: { href: string; rotulo: string }) => (
  <Link
    href={href}
    target="_blank"
    className="ml-1 inline-flex align-middle text-azul"
    aria-label={rotulo}
    title={rotulo}
  >
    <ExternalLinkIcon className="size-3.5" />
  </Link>
);
const numero = (v: string, max = 4) => {
  const d = v.replace(/\D/g, '').slice(0, max);
  return d ? Number(d) : null;
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
  const alocs = useFieldArray({ control: f.control, name: 'alocacoes' });
  // biome-ignore lint/correctness/useExhaustiveDependencies: reinicia ao abrir
  useEffect(() => {
    if (aberto) {
      f.reset(inicial ? { ...VAZIO, ...inicial } : VAZIO);
      salvar.reset();
    }
  }, [aberto]);
  const estrutura = f.watch('estrutura');
  const e = f.formState.errors;

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
  const op = opcoes.data;

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent tamanho="lg">
        <form onSubmit={enviar} noValidate className="flex min-h-0 flex-col">
          <DialogHead
            titulo={id == null ? 'Novo curso' : 'Editar curso'}
            descricao="cada curso é um produto com regras fechadas"
          />
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            <div className="grid content-start gap-1.5 sm:col-span-2">
              <Label htmlFor="cf-nome">
                Nome do curso
                <Req />
              </Label>
              <Input
                id="cf-nome"
                autoFocus
                placeholder="Ex.: Community live classes"
                aria-invalid={!!e.nome}
                {...f.register('nome')}
              />
              <Erro m={e.nome?.message} />
            </div>
            <div className="grid content-start gap-1.5">
              <Label htmlFor="cf-cor">
                Cor do curso
                <Req />
              </Label>
              <input
                id="cf-cor"
                type="color"
                className="h-10 w-full cursor-pointer rounded-md border border-borda-forte bg-card p-1"
                {...f.register('cor')}
              />
            </div>
            <div className="grid content-start gap-1.5">
              <Label>
                Idioma
                <Req />
                <Vai href="/configuracoes/idiomas" rotulo="Abrir o catálogo de idiomas" />
              </Label>
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
                    opcoes={(op?.idiomas ?? []).map((x) => ({ v: x, l: x }))}
                  />
                )}
              />
              <Erro m={e.idioma?.message} />
            </div>
            <div className="grid content-start gap-1.5 sm:col-span-2">
              <Label>
                Tipo de curso
                <Req />
                <Vai href="/configuracoes/tiposcurso" rotulo="Abrir o catálogo de tipos de curso" />
              </Label>
              <Controller
                control={f.control}
                name="estrutura"
                render={({ field }) => (
                  <div role="radiogroup" aria-label="Tipo de curso" className="grid gap-2 sm:grid-cols-3">
                    {TIPOS.map((t) => (
                      <button
                        key={t.v}
                        type="button"
                        role="radio"
                        aria-checked={field.value === t.v}
                        onClick={() => field.onChange(t.v)}
                        className={
                          field.value === t.v
                            ? 'h-11 rounded-md border border-azul bg-azul-suave font-semibold text-azul'
                            : 'h-11 rounded-md border border-borda-forte bg-card text-texto-2 hover:bg-hover'
                        }
                      >
                        {t.l}
                      </button>
                    ))}
                  </div>
                )}
              />
              <span className="text-apagado">
                {estrutura === 'modulos'
                  ? 'turma aberta: o aluno entra a qualquer momento nos módulos, com grade fixa'
                  : estrutura === 'turmas'
                    ? 'turmas fechadas, com começo e fim'
                    : 'aula individual: cada alocação é de um aluno'}
              </span>
            </div>

            {estrutura !== 'nenhuma' ? (
              <fieldset className="m-0 grid gap-3 border-0 p-0 sm:col-span-2">
                <legend className="mb-1 font-semibold text-texto">
                  {estrutura === 'modulos' ? 'Módulos' : 'Turmas'}
                </legend>
                {itens.fields.map((it, k) => (
                  <ItemCard
                    key={it.id}
                    k={k}
                    modulo={estrutura === 'modulos'}
                    control={f.control}
                    register={f.register}
                    op={op}
                    erros={e.itens?.[k] as Record<string, { message?: string }> | undefined}
                    remover={() => itens.remove(k)}
                  />
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  className="w-fit border border-dashed border-borda-forte"
                  onClick={() => itens.append(novoItem(f.getValues('cor') || '#003FB0'))}
                >
                  <PlusIcon /> {estrutura === 'modulos' ? 'Novo módulo' : 'Nova turma'}
                </Button>
                {estrutura === 'turmas' && (
                  <span className="text-apagado">
                    grade, professor e sala de cada turma ficam em Produtos › Cursos › Turmas
                  </span>
                )}
              </fieldset>
            ) : (
              <fieldset className="m-0 grid gap-3 border-0 p-0 sm:col-span-2">
                <legend className="mb-1 font-semibold text-texto">Alocações</legend>
                {alocs.fields.map((a, k) => (
                  <div key={a.id} className="flex flex-wrap items-end gap-2">
                    <div className="grid min-w-[220px] flex-1 gap-1.5">
                      <Label htmlFor={`cf-al-${k}`}>Nome do responsável</Label>
                      <Input
                        id={`cf-al-${k}`}
                        placeholder={`Aluno ${k + 1}`}
                        {...f.register(`alocacoes.${k}.responsavel`)}
                      />
                    </div>
                    <div className="grid w-[110px] gap-1.5">
                      <Label htmlFor={`cf-alv-${k}`}>Vagas</Label>
                      <Controller
                        control={f.control}
                        name={`alocacoes.${k}.vagas`}
                        render={({ field }) => (
                          <Input
                            id={`cf-alv-${k}`}
                            inputMode="numeric"
                            value={String(field.value ?? '')}
                            onChange={(ev) => field.onChange(numero(ev.target.value, 2) ?? 1)}
                          />
                        )}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remover alocação"
                      onClick={() => alocs.remove(k)}
                    >
                      <XIcon />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  className="w-fit border border-dashed border-borda-forte"
                  onClick={() => alocs.append({ responsavel: '', vagas: 1 })}
                >
                  <PlusIcon /> Nova alocação
                </Button>
              </fieldset>
            )}

            <details className="rounded-md border border-borda px-4 py-3 sm:col-span-2">
              <summary className="cursor-pointer font-semibold text-texto">Mais dados (opcional)</summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="grid content-start gap-1.5 sm:col-span-2">
                  <Label htmlFor="cf-desc">Descrição</Label>
                  <Input
                    id="cf-desc"
                    placeholder="Aulas ao vivo em grupo, do Confidence ao Apex"
                    {...f.register('descricao')}
                  />
                </div>
                <div className="grid content-start gap-1.5">
                  <Label htmlFor="cf-sigla">Sigla</Label>
                  <Input id="cf-sigla" placeholder="Ex.: CLC" maxLength={20} {...f.register('sigla')} />
                </div>
                <div className="grid content-start gap-1.5">
                  <Label>Formato da aula</Label>
                  <Controller
                    control={f.control}
                    name="tipo"
                    render={({ field }) => (
                      <Escolha
                        rotulo="Formato da aula"
                        todos="não definido"
                        destacar={false}
                        valor={field.value}
                        aoMudar={field.onChange}
                        opcoes={(op?.tipos ?? []).map((x) => ({ v: x, l: x }))}
                      />
                    )}
                  />
                </div>
                <div className="grid content-start gap-1.5">
                  <Label>Natureza</Label>
                  <Controller
                    control={f.control}
                    name="natureza"
                    render={({ field }) => (
                      <Escolha
                        rotulo="Natureza"
                        destacar={false}
                        valor={field.value}
                        aoMudar={field.onChange}
                        opcoes={['Curso', 'Serviço', 'Assinatura'].map((x) => ({ v: x, l: x }))}
                      />
                    )}
                  />
                </div>
                <div className="grid content-start gap-1.5">
                  <Label>Visibilidade da oferta</Label>
                  <Controller
                    control={f.control}
                    name="visibilidadeOferta"
                    render={({ field }) => (
                      <Escolha
                        rotulo="Visibilidade da oferta"
                        todos="não definida"
                        destacar={false}
                        valor={field.value}
                        aoMudar={field.onChange}
                        opcoes={(op?.visibilidades ?? []).map((x) => ({ v: x, l: x }))}
                      />
                    )}
                  />
                </div>
                <div className="grid content-start gap-1.5">
                  <Label>Tipo de sala</Label>
                  <Controller
                    control={f.control}
                    name="tipoSala"
                    render={({ field }) => (
                      <Escolha
                        rotulo="Tipo de sala"
                        todos="qualquer sala"
                        destacar={false}
                        valor={field.value}
                        aoMudar={field.onChange}
                        opcoes={(op?.tiposSala ?? []).map((x) => ({ v: x, l: x }))}
                      />
                    )}
                  />
                </div>
                <Controller
                  control={f.control}
                  name="autoAgenda"
                  render={({ field }) => (
                    // biome-ignore lint/a11y/noLabelWithoutControl: o Switch (botão) dentro do label é o controle
                    <label className="flex items-start gap-3 sm:col-span-2">
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        aria-label="Aluno pode auto-agendar"
                      />
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
              </div>
            </details>
          </DialogBody>
          <DialogFoot>
            {salvar.isError && (
              <span role="alert" className="mr-auto font-medium text-vermelho">
                {salvar.error.message}
              </span>
            )}
            {!salvar.isError && Object.keys(e).length > 0 && (
              <span role="alert" className="mr-auto font-medium text-vermelho">
                Confira os campos marcados.
              </span>
            )}
            <Button type="button" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={salvar.isPending}>
              {id == null ? 'Criar curso' : 'Salvar'}
            </Button>
          </DialogFoot>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** módulo (Open-Entry) ou turma (Regular) */
function ItemCard({
  k,
  modulo,
  control,
  register,
  op,
  erros,
  remover,
}: {
  k: number;
  modulo: boolean;
  control: Control<Form>;
  register: UseFormRegister<Form>;
  op: OpcoesCurso | undefined;
  erros?: Record<string, { message?: string }>;
  remover: () => void;
}) {
  const qual = modulo ? 'módulo' : 'turma';
  return (
    <div className="grid gap-3 rounded-md border border-borda bg-bg p-4 sm:grid-cols-2">
      <div className="flex items-center justify-between sm:col-span-2">
        <b className="text-texto">{modulo ? `Módulo ${k + 1}` : `Turma ${k + 1}`}</b>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remover ${qual} ${k + 1}`} onClick={remover}>
          <XIcon />
        </Button>
      </div>
      <div className="grid content-start gap-1.5">
        <Label htmlFor={`cf-it-nome-${k}`}>
          Nome {modulo ? 'do módulo' : 'da turma'}
          <Req />
        </Label>
        <Input id={`cf-it-nome-${k}`} {...register(`itens.${k}.nome`)} />
        <Erro m={erros?.nome?.message} />
      </div>
      <div className="grid content-start gap-1.5">
        <Label htmlFor={`cf-it-cor-${k}`}>
          Cor {modulo ? 'do módulo' : 'da turma'}
          <Req />
        </Label>
        <input
          id={`cf-it-cor-${k}`}
          type="color"
          className="h-10 w-full cursor-pointer rounded-md border border-borda-forte bg-card p-1"
          {...register(`itens.${k}.cor`)}
        />
      </div>
      <div className="grid content-start gap-1.5">
        <Label>
          CEFR
          <Req />
        </Label>
        <Controller
          control={control}
          name={`itens.${k}.cefr`}
          render={({ field }) => (
            <Escolha
              rotulo={`CEFR ${modulo ? 'do módulo' : 'da turma'} ${k + 1}`}
              todos="Selecione…"
              destacar={false}
              valor={field.value}
              aoMudar={field.onChange}
              opcoes={(op?.cefr ?? []).map((x) => ({ v: x, l: x }))}
            />
          )}
        />
        <Erro m={erros?.cefr?.message} />
      </div>
      <div className="grid content-start gap-1.5">
        <Label htmlFor={`cf-it-vagas-${k}`}>
          {modulo ? 'Vagas por aula' : 'Vagas por turma'}
          <Req />
        </Label>
        <Controller
          control={control}
          name={`itens.${k}.vagas`}
          render={({ field }) => (
            <Input
              id={`cf-it-vagas-${k}`}
              inputMode="numeric"
              value={field.value == null ? '' : String(field.value)}
              onChange={(ev) => field.onChange(numero(ev.target.value, 3))}
            />
          )}
        />
        <Erro m={erros?.vagas?.message} />
      </div>
      <div className="grid content-start gap-1.5 sm:col-span-2">
        <Label htmlFor={`cf-it-desc-${k}`}>Descrição</Label>
        <Input id={`cf-it-desc-${k}`} {...register(`itens.${k}.descricao`)} />
      </div>
      {modulo && (
        <>
          <p className="m-0 font-semibold text-texto sm:col-span-2">Regras de agenda (em minutos ou horas)</p>
          <CampoTempo
            k={k}
            nome="agendamento"
            rotulo="Agendamento"
            control={control}
            erro={erros?.agendamento?.message}
          />
          <CampoTempo
            k={k}
            nome="cancelamento"
            rotulo="Cancelamento"
            control={control}
            erro={erros?.cancelamento?.message}
          />
          <div className="grid gap-1.5 sm:col-span-2">
            <p className="m-0 font-semibold text-texto">Grade</p>
            <span className="text-apagado">
              marque o dia e a hora e escolha o professor (ou vincule depois); fora do funcionamento (Configurações ›
              Dias e horários) fica travado
            </span>
            <Controller
              control={control}
              name={`itens.${k}.horarios`}
              render={({ field }) => (
                <GradeModulo
                  valor={field.value ?? []}
                  aoMudar={field.onChange}
                  professores={op?.professores ?? []}
                  funcionamento={op?.funcionamento ?? []}
                  rotulo={`Módulo ${k + 1}`}
                />
              )}
            />
          </div>
        </>
      )}
    </div>
  );
}

/** regra de agenda do módulo: número + minutos ou horas */
function CampoTempo({
  k,
  nome,
  rotulo,
  control,
  erro,
}: {
  k: number;
  nome: 'agendamento' | 'cancelamento';
  rotulo: string;
  control: Control<Form>;
  erro?: string;
}) {
  return (
    <Controller
      control={control}
      name={`itens.${k}.${nome}`}
      render={({ field }) => (
        <div className="grid content-start gap-1.5">
          <Label htmlFor={`cf-${nome}-${k}`}>
            {rotulo}
            <Req />
          </Label>
          <div className="flex gap-2">
            <Input
              id={`cf-${nome}-${k}`}
              inputMode="numeric"
              placeholder="0"
              className="w-[90px]"
              value={field.value == null ? '' : String(field.value.valor)}
              onChange={(ev) => {
                const n = numero(ev.target.value, 5);
                field.onChange(n == null ? null : { valor: n, unidade: field.value?.unidade ?? 'h' });
              }}
            />
            <Escolha
              rotulo={`Unidade de ${rotulo.toLowerCase()}`}
              destacar={false}
              valor={field.value?.unidade ?? 'h'}
              aoMudar={(u) => field.onChange({ valor: field.value?.valor ?? 0, unidade: u as 'min' | 'h' })}
              opcoes={[
                { v: 'min', l: 'minutos' },
                { v: 'h', l: 'horas' },
              ]}
              className="w-[120px]"
            />
          </div>
          <Erro m={erro} />
        </div>
      )}
    />
  );
}
