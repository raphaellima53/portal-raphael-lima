'use client';

import { SearchIcon } from 'lucide-react';
import { useState } from 'react';
import { Aviso, Stat } from '@/components/ds';
import { Button } from '@/components/ui/button';
import { Card, CardHead, CardTitle } from '@/components/ui/card';
import { Dialog, DialogBody, DialogContent, DialogFoot, DialogHead } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { Stat as StatT } from '@/lib/config';
import { cn } from '@/lib/utils';

export type Msg = { txt: string; erro?: boolean } | null;

export const normaliza = (s: string) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

/** o aviso do que acabou de acontecer, logo abaixo das abas */
export function AvisoMsg({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <Aviso tom={msg.erro ? 'red' : 'blue'} icone={msg.erro ? 'alerta' : 'ok'}>
      {msg.txt}
    </Aviso>
  );
}
export const ErroQ = ({ e }: { e: Error | null }) =>
  e ? (
    <Aviso tom="red" icone="alerta">
      {e.message}
    </Aviso>
  ) : null;

export const Barra = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('mb-4 flex flex-wrap items-center gap-3', className)}>{children}</div>
);

export function Busca({ valor, aoMudar, rotulo }: { valor: string; aoMudar: (v: string) => void; rotulo: string }) {
  return (
    <div className="relative w-[300px] max-w-full">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-apagado" />
      <Input
        type="search"
        aria-label={rotulo}
        placeholder={`${rotulo}…`}
        className="pl-9"
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
      />
    </div>
  );
}

export function Stats({ itens }: { itens: StatT[] }) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {itens.map((s) => (
        <Stat key={s.t} valor={s.v} rotulo={s.t} tom={s.tom} />
      ))}
    </div>
  );
}

export const Painel = ({
  titulo,
  sub,
  acoes,
  children,
  className,
}: {
  titulo: string;
  sub?: string;
  acoes?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) => (
  <Card className={cn('overflow-hidden', className)}>
    <CardHead className="flex-wrap">
      <CardTitle>{titulo}</CardTitle>
      {sub && <span className="text-apagado-2">{sub}</span>}
      {acoes && <div className="ml-auto flex flex-wrap items-center gap-2">{acoes}</div>}
    </CardHead>
    {children}
  </Card>
);

export const Vazio = ({ cols, txt }: { cols: number; txt: string }) => (
  <tr>
    <td colSpan={cols} className="px-5 py-8 text-center text-apagado">
      {txt}
    </td>
  </tr>
);

export function Campo({
  id,
  rotulo,
  req,
  ajuda,
  className,
  children,
}: {
  id?: string;
  rotulo: string;
  req?: boolean;
  ajuda?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('grid content-start gap-1.5', className)}>
      <Label htmlFor={id}>
        {rotulo}
        {req && <span className="text-vermelho">*</span>}
      </Label>
      {children}
      {ajuda && <span className="text-apagado">{ajuda}</span>}
    </div>
  );
}

export function Chave({
  id,
  on,
  aoMudar,
  rotulo,
  ajuda,
  className,
}: {
  id: string;
  on: boolean;
  aoMudar: (v: boolean) => void;
  rotulo: string;
  ajuda?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <Switch id={id} checked={on} onCheckedChange={aoMudar} />
      <Label htmlFor={id} className="grid gap-0.5 font-normal">
        <span className="font-semibold text-texto-2">{rotulo}</span>
        {ajuda && <span className="text-apagado">{ajuda}</span>}
      </Label>
    </div>
  );
}

export const ErroForm = ({ t }: { t: string }) =>
  t ? (
    <span role="alert" className="mr-auto font-medium text-vermelho">
      {t}
    </span>
  ) : null;

/** popup de formulário com título, corpo em grade, erro no rodapé e Cancelar/Salvar */
export function FormDialog({
  aberto,
  aoFechar,
  titulo,
  descricao,
  erro,
  ocupado,
  rotuloOk,
  aoSalvar,
  extra,
  children,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: string;
  erro: string;
  ocupado?: boolean;
  rotuloOk: string;
  aoSalvar: () => void;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent tamanho="md">
        <form
          noValidate
          className="flex min-h-0 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            aoSalvar();
          }}
        >
          <DialogHead titulo={titulo} descricao={descricao} />
          <DialogBody className="grid gap-4 sm:grid-cols-2">{children}</DialogBody>
          <DialogFoot>
            <ErroForm t={erro} />
            {extra}
            <Button type="button" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={ocupado}>
              {rotuloOk}
            </Button>
          </DialogFoot>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** pede a justificativa antes de salvar uma regra (cfgSalvarPede) */
export function JustificativaDialog({
  aberto,
  muda,
  aoFechar,
  aoSalvar,
  ocupado,
  erro,
}: {
  aberto: boolean;
  muda: number;
  aoFechar: () => void;
  aoSalvar: (just: string) => void;
  ocupado?: boolean;
  erro: string;
}) {
  const [just, setJust] = useState('');
  const [local, setLocal] = useState('');
  return (
    <FormDialog
      aberto={aberto}
      aoFechar={() => {
        setJust('');
        setLocal('');
        aoFechar();
      }}
      titulo="Salvar alterações"
      descricao={`${muda} ${muda === 1 ? 'campo alterado' : 'campos alterados'}`}
      erro={local || erro}
      ocupado={ocupado}
      rotuloOk="Salvar"
      aoSalvar={() => {
        if (just.trim().length < 5) return setLocal('Escreva a justificativa (pelo menos 5 letras).');
        setLocal('');
        aoSalvar(just.trim());
      }}
    >
      <Campo
        id="cfg-just"
        rotulo="Justificativa"
        req
        ajuda="toda alteração de regra entra na Auditoria com autor e justificativa"
        className="sm:col-span-2"
      >
        <textarea
          id="cfg-just"
          rows={3}
          value={just}
          onChange={(e) => setJust(e.target.value)}
          placeholder="Por que muda? Ex.: decisão da diretoria de 16/09"
          className="w-full rounded-md border border-borda-forte bg-card px-3 py-2 text-sm text-texto focus:border-azul focus:shadow-anel focus-visible:outline-none"
        />
      </Campo>
    </FormDialog>
  );
}

/** chip de escolha múltipla (inclui ou tira) */
export function ChipMulti({
  on,
  aoClicar,
  children,
}: {
  on: boolean;
  aoClicar: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={aoClicar}
      className={cn(
        'h-9 cursor-pointer rounded-full bg-[#eceff5] px-3.5 text-[#4b5568] dark:bg-hover dark:text-texto-2',
        on && 'bg-azul-suave font-semibold text-azul shadow-[inset_0_0_0_1px_#cfdcfa]',
      )}
    >
      {children}
    </button>
  );
}

export const textareaCls =
  'w-full rounded-md border border-borda-forte bg-card px-3 py-2 text-sm text-texto focus:border-azul focus:shadow-anel focus-visible:outline-none';
