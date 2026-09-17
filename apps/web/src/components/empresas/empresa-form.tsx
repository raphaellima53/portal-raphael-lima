'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { CampoData } from '@/components/campos-data';
import { Escolha } from '@/components/escolha';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFoot, DialogHead } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { type EmpresaForm, type FichaEmpresa, useAcaoEmpresa, useOpcoesEmpresa } from '@/lib/empresas';
import { cn } from '@/lib/utils';

const isoHoje = (dias = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const cnpjMascara = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 14);
  let o = d.slice(0, 2);
  if (d.length > 2) o += `.${d.slice(2, 5)}`;
  if (d.length > 5) o += `.${d.slice(5, 8)}`;
  if (d.length > 8) o += `/${d.slice(8, 12)}`;
  if (d.length > 12) o += `-${d.slice(12)}`;
  return o;
};
const num = z.string().refine((s) => /^\d*$/.test(s), 'Use só números.');
const Esquema = z
  .object({
    nome: z.string().trim().min(1, 'Dê o nome da empresa.'),
    cnpj: z.string(),
    segmento: z.string(),
    modelo: z.enum(['B2B', 'B2B2C']),
    gerente: z.string().min(1, 'Escolha o gerente da conta.'),
    inicio: z.string().min(1, 'Preencha início e fim do contrato.'),
    fim: z.string().min(1, 'Preencha início e fim do contrato.'),
    licencas: num,
    aulas: num,
    valor: num,
    subsidio: num,
    desconto: num,
    cursos: z.array(z.string()),
    renovaAuto: z.boolean(),
    rhNome: z.string(),
    rhEmail: z.union([
      z.literal(''),
      z
        .string()
        .trim()
        .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, 'O e-mail do RH não parece válido.'),
    ]),
  })
  .superRefine((v, ctx) => {
    if (v.inicio && v.fim && v.fim <= v.inicio)
      ctx.addIssue({ code: 'custom', path: ['fim'], message: 'O fim do contrato precisa ser depois do início.' });
    for (const k of ['subsidio', 'desconto'] as const)
      if (Number(v[k]) > 100) ctx.addIssue({ code: 'custom', path: [k], message: 'Até 100%.' });
  });
type Form = z.infer<typeof Esquema>;

const Erro = ({ t }: { t?: string }) => (t ? <span className="font-medium text-vermelho">{t}</span> : null);
const Secao = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <fieldset className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
    <legend className="mb-3 text-md font-bold text-texto">{titulo}</legend>
    {children}
  </fieldset>
);

/** Nova empresa e Editar empresa: dados, contrato (licenças, valor, subsídio, cursos) e RH. */
export function EmpresaFormDialog({
  abre,
  eu,
  aoFechar,
  aoSalvo,
}: {
  abre: { id?: string; form: EmpresaForm | null } | null;
  eu: string;
  aoFechar: () => void;
  aoSalvo?: (r: { id?: string; msg: string }) => void;
}) {
  const op = useOpcoesEmpresa(!!abre);
  const acao = useAcaoEmpresa();
  const ed = !!abre?.form;
  const turma = !!abre?.form?.turmaCurso;
  const f = useForm<Form>({
    resolver: zodResolver(Esquema),
    defaultValues: {
      nome: '',
      cnpj: '',
      segmento: '',
      modelo: 'B2B',
      gerente: '',
      inicio: '',
      fim: '',
      licencas: '5',
      aulas: '240',
      valor: '400',
      subsidio: '100',
      desconto: '0',
      cursos: [],
      renovaAuto: true,
      rhNome: '',
      rhEmail: '',
    },
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: reinicia ao abrir e quando os gerentes chegam
  useEffect(() => {
    if (!abre) return;
    acao.reset();
    const x = abre.form;
    f.reset({
      nome: x?.nome ?? '',
      cnpj: x?.cnpj ?? '',
      segmento: x?.segmento ?? '',
      modelo: x?.modelo ?? 'B2B',
      gerente: x?.gerente ?? (eu || op.data?.gerentes[0] || ''),
      inicio: x?.inicio ?? isoHoje(0),
      fim: x?.fim ?? isoHoje(365),
      licencas: String(x?.licencas ?? 5),
      aulas: String(x?.aulas ?? 240),
      valor: String(x?.valor ?? 400),
      subsidio: String(x?.subsidio ?? 100),
      desconto: String(x?.desconto ?? 0),
      cursos: x?.cursos ?? [],
      renovaAuto: x?.renovaAuto ?? true,
      rhNome: x?.rhNome ?? '',
      rhEmail: x?.rhEmail ?? '',
    });
  }, [abre, op.data?.gerentes]);

  const b2b2c = f.watch('modelo') === 'B2B2C';
  const erros = f.formState.errors;
  const enviar = f.handleSubmit((v) =>
    acao.mutate(
      {
        caminho: ed ? `/${abre?.id}` : '',
        method: ed ? 'PUT' : 'POST',
        json: {
          ...v,
          licencas: Number(v.licencas || 0),
          aulas: Number(v.aulas || 0),
          valor: Number(v.valor || 0),
          subsidio: Number(v.subsidio || 0),
          desconto: Number(v.desconto || 0),
        },
      },
      {
        onSuccess: (r) => {
          aoFechar();
          aoSalvo?.(r);
        },
      },
    ),
  );
  const campoNum = (
    k: 'licencas' | 'aulas' | 'valor' | 'subsidio' | 'desconto',
    rot: string,
    ajuda?: string,
    req?: boolean,
  ) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`emp-${k}`}>
        {rot}
        {req && <span className="text-vermelho">*</span>}
      </Label>
      <Input id={`emp-${k}`} type="number" min={0} aria-invalid={!!erros[k]} {...f.register(k)} />
      {ajuda && <span className="text-apagado">{ajuda}</span>}
      <Erro t={erros[k]?.message} />
    </div>
  );

  return (
    <Dialog open={!!abre} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent tamanho="lg">
        <form onSubmit={enviar} noValidate className="flex min-h-0 flex-col">
          <DialogHead
            titulo={ed ? 'Editar empresa' : 'Nova empresa'}
            descricao={ed ? abre?.form?.nome : 'conta B2B ou B2B2C'}
          />
          <DialogBody className="grid gap-6 sm:grid-cols-2">
            <Secao titulo="Empresa">
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="emp-nome">
                  Nome<span className="text-vermelho">*</span>
                </Label>
                <Input
                  id="emp-nome"
                  autoFocus
                  placeholder="Razão social ou nome fantasia"
                  aria-invalid={!!erros.nome}
                  {...f.register('nome')}
                />
                <Erro t={erros.nome?.message} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="emp-cnpj">CNPJ</Label>
                <Controller
                  control={f.control}
                  name="cnpj"
                  render={({ field }) => (
                    <Input
                      id="emp-cnpj"
                      inputMode="numeric"
                      placeholder="00.000.000/0000-00"
                      value={field.value}
                      onChange={(e) => field.onChange(cnpjMascara(e.target.value))}
                    />
                  )}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="emp-segmento">Segmento</Label>
                <Input
                  id="emp-segmento"
                  placeholder="Ex.: Tecnologia"
                  list="emp-segmentos"
                  {...f.register('segmento')}
                />
                <datalist id="emp-segmentos">
                  {(op.data?.segmentos ?? []).map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
            </Secao>

            <Secao titulo="Contrato">
              <div className="grid gap-1.5">
                <Label>
                  Modelo<span className="text-vermelho">*</span>
                </Label>
                <Controller
                  control={f.control}
                  name="modelo"
                  render={({ field }) => (
                    <Escolha
                      rotulo="Modelo"
                      destacar={false}
                      valor={field.value}
                      aoMudar={field.onChange}
                      opcoes={[
                        { v: 'B2B', l: 'B2B — a empresa paga' },
                        { v: 'B2B2C', l: 'B2B2C — benefício, o colaborador paga parte' },
                      ]}
                    />
                  )}
                />
                <span className="text-apagado">no B2B a empresa paga 100%</span>
              </div>
              <div className="grid gap-1.5">
                <Label>
                  Gerente da conta<span className="text-vermelho">*</span>
                </Label>
                <Controller
                  control={f.control}
                  name="gerente"
                  render={({ field }) => (
                    <Escolha
                      rotulo="Gerente da conta"
                      destacar={false}
                      valor={field.value}
                      aoMudar={field.onChange}
                      opcoes={[...new Set([...(op.data?.gerentes ?? []), ...(field.value ? [field.value] : [])])].map(
                        (n) => ({ v: n, l: n }),
                      )}
                    />
                  )}
                />
                <Erro t={erros.gerente?.message} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="emp-inicio">
                  Início<span className="text-vermelho">*</span>
                </Label>
                <Controller
                  control={f.control}
                  name="inicio"
                  render={({ field }) => (
                    <CampoData id="emp-inicio" rotulo="Início" valor={field.value} aoMudar={field.onChange} />
                  )}
                />
                <Erro t={erros.inicio?.message} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="emp-fim">
                  Fim<span className="text-vermelho">*</span>
                </Label>
                <Controller
                  control={f.control}
                  name="fim"
                  render={({ field }) => (
                    <CampoData id="emp-fim" rotulo="Fim" valor={field.value} aoMudar={field.onChange} />
                  )}
                />
                <Erro t={erros.fim?.message} />
              </div>
              {!turma && (
                <>
                  {campoNum('licencas', 'Licenças', 'colaboradores que podem estudar ao mesmo tempo', true)}
                  {campoNum('aulas', 'Aulas contratadas')}
                  {campoNum('valor', 'Valor por licença ao mês (R$)')}
                  {b2b2c &&
                    campoNum(
                      'subsidio',
                      'Subsídio da empresa (%)',
                      'quanto a empresa paga; o colaborador paga o resto',
                    )}
                  {b2b2c &&
                    campoNum('desconto', 'Desconto ao colaborador (%)', 'desconto sobre a parte do colaborador')}
                  <Controller
                    control={f.control}
                    name="cursos"
                    render={({ field }) => (
                      <fieldset className="grid gap-2 sm:col-span-2">
                        <legend className="mb-1.5 font-semibold text-texto-2">Cursos liberados</legend>
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
                      </fieldset>
                    )}
                  />
                </>
              )}
              <Controller
                control={f.control}
                name="renovaAuto"
                render={({ field }) => (
                  <div className="flex items-start gap-3 sm:col-span-2">
                    <Switch id="emp-renova" checked={field.value} onCheckedChange={field.onChange} />
                    <Label htmlFor="emp-renova" className="grid gap-0.5 font-normal">
                      <span className="font-semibold text-texto-2">Renovação automática</span>
                      <span className="text-apagado">renova por 12 meses no fim da vigência</span>
                    </Label>
                  </div>
                )}
              />
            </Secao>

            <Secao titulo="RH da empresa">
              <div className="grid gap-1.5">
                <Label htmlFor="emp-rh">Contato</Label>
                <Input id="emp-rh" placeholder="Nome de quem recebe o relatório" {...f.register('rhNome')} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="emp-rh-email">E-mail do RH</Label>
                <Input
                  id="emp-rh-email"
                  type="email"
                  placeholder="rh@empresa.teste"
                  aria-invalid={!!erros.rhEmail}
                  {...f.register('rhEmail')}
                />
                <Erro t={erros.rhEmail?.message} />
              </div>
            </Secao>
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
            <Button type="submit" variant="primary" disabled={acao.isPending}>
              {ed ? 'Salvar empresa' : 'Criar empresa'}
            </Button>
          </DialogFoot>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Renovar contrato: novo fim e, fora das turmas dedicadas, licenças, aulas a somar e valor. */
export function RenovarDialog({
  e,
  aoFechar,
  aoSalvo,
}: {
  e: FichaEmpresa | null;
  aoFechar: () => void;
  aoSalvo: (msg: string) => void;
}) {
  const acao = useAcaoEmpresa();
  const [fim, setFim] = useState('');
  const [licencas, setLicencas] = useState('');
  const [aulas, setAulas] = useState('0');
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState('');
  useEffect(() => {
    if (!e) return;
    setFim(e.renovar.fim);
    setLicencas(String(e.renovar.licencas));
    setAulas('0');
    setValor(String(e.renovar.valor));
    setErro('');
  }, [e]);
  const enviar = () => {
    if (!e) return;
    if (!e.turma && !(Number(licencas) >= 1)) return setErro('A conta precisa de pelo menos 1 licença.');
    acao.mutate(
      {
        caminho: `/${e.id}/renovar`,
        json: { fim, licencas: Number(licencas), aulas: Number(aulas || 0), valor: Number(valor || 0) },
      },
      {
        onSuccess: (r) => {
          aoFechar();
          aoSalvo(r.msg);
        },
        onError: (x) => setErro(x.message),
      },
    );
  };
  return (
    <Dialog open={!!e} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent tamanho="md">
        <DialogHead titulo="Renovar contrato" descricao={e?.nome} />
        <DialogBody className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="ren-fim">
              Novo fim<span className="text-vermelho">*</span>
            </Label>
            <CampoData id="ren-fim" rotulo="Novo fim" valor={fim} aoMudar={setFim} />
            <span className="text-apagado">hoje o contrato vai até {e?.renovar.fimAtual}</span>
          </div>
          {e && !e.turma && (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="ren-lic">
                  Licenças<span className="text-vermelho">*</span>
                </Label>
                <Input
                  id="ren-lic"
                  type="number"
                  min={1}
                  value={licencas}
                  onChange={(x) => setLicencas(x.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ren-aulas">Aulas a somar</Label>
                <Input id="ren-aulas" type="number" min={0} value={aulas} onChange={(x) => setAulas(x.target.value)} />
                <span className="text-apagado">aulas novas somadas às contratadas</span>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ren-valor">Valor por licença ao mês (R$)</Label>
                <Input id="ren-valor" type="number" min={0} value={valor} onChange={(x) => setValor(x.target.value)} />
              </div>
            </>
          )}
        </DialogBody>
        <DialogFoot>
          {erro && (
            <span role="alert" className="mr-auto font-medium text-vermelho">
              {erro}
            </span>
          )}
          <Button onClick={aoFechar}>Cancelar</Button>
          <Button variant="primary" disabled={acao.isPending} onClick={enviar}>
            Renovar
          </Button>
        </DialogFoot>
      </DialogContent>
    </Dialog>
  );
}
