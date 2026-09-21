'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { ChevronDownIcon, KeyRoundIcon, LogOutIcon, ShieldCheckIcon, UserRoundIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Aviso } from '@/components/ds';
import { iconeDe } from '@/components/icones';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFoot, DialogHead } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { useLogout } from '@/lib/consultas';
import type { Me } from '@/lib/tipos';
import { cn } from '@/lib/utils';

/** Conta no rodapé do menu: quem está logado, meu perfil, trocar senha, as áreas do Admin (Configurações e Engenharia) e sair. */
export function Conta({ me, mini }: { me: Me; mini: boolean }) {
  const u = me.usuario;
  const router = useRouter();
  const sair = useLogout();
  const [perfil, setPerfil] = useState(false);
  const [senha, setSenha] = useState(false);
  const daConta = me.nav.filter((n) => n.lugar === 'conta');

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Opções da conta"
            className={cn(
              'group flex w-full cursor-pointer items-center gap-[11px] rounded-[12px] border border-transparent bg-sb-user text-left transition-colors hover:border-[#2a375f] hover:bg-sb-user-hover data-[state=open]:border-[#2a375f] data-[state=open]:bg-sb-user-hover',
              mini ? 'justify-center px-0 py-2.5' : 'p-3',
            )}
          >
            <span
              className="grid size-8 shrink-0 place-items-center rounded-full bg-sb-avatar text-base font-extrabold text-[#3b82f6]"
              aria-hidden
            >
              {u.nome[0]?.toLowerCase()}
            </span>
            {!mini && (
              <>
                <span className="min-w-0 flex-1">
                  <b className="block truncate font-semibold text-white">{u.nome}</b>
                  <span className="block truncate text-sb-apagado">{u.papel}</span>
                </span>
                <ChevronDownIcon className="size-3.5 shrink-0 text-sb-apagado transition-transform group-data-[state=open]:rotate-180" />
              </>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-[240px]">
          <div className="px-3 pt-2.5 pb-3">
            <b className="block leading-[1.35] font-bold text-texto">{u.nome}</b>
            <em className="block truncate text-apagado not-italic">{u.email}</em>
            <span className="mt-2 inline-flex h-7 items-center gap-1.5 rounded-full border border-borda px-2.5 text-texto-2">
              <ShieldCheckIcon className="size-3 text-apagado" />
              {u.nivelNome}
            </span>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setPerfil(true)}>
            <UserRoundIcon /> Meu perfil
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setSenha(true)}>
            <KeyRoundIcon /> Trocar senha
          </DropdownMenuItem>
          {daConta.length > 0 && <DropdownMenuSeparator />}
          {daConta.map((n) => {
            const Icone = iconeDe(n.icon);
            return (
              <DropdownMenuItem key={n.key} onSelect={() => router.push(n.href)}>
                <Icone /> {n.label}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            perigo
            onSelect={() =>
              sair.mutate(undefined, {
                onSettled: () => router.replace('/login'),
              })
            }
          >
            <LogOutIcon /> Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <MeuPerfil me={me} aberto={perfil} setAberto={setPerfil} />
      <TrocarSenha aberto={senha} setAberto={setSenha} />
    </>
  );
}

function MeuPerfil({ me, aberto, setAberto }: { me: Me; aberto: boolean; setAberto: (v: boolean) => void }) {
  const u = me.usuario;
  const linhas: [string, string][] = [
    ['Nome', u.nome],
    ['Login', u.email],
    ['Perfil', u.perfil],
    ['Hierarquia', u.nivelNome],
    ['Acesso', u.resumo],
  ];
  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogContent tamanho="sm">
        <DialogHead
          titulo="Meu perfil"
          descricao="O acesso vem da hierarquia e dos setores do seu cadastro, em Usuários."
        />
        <DialogBody>
          <dl className="grid gap-3">
            {linhas.map(([k, v]) => (
              <div
                key={k}
                className="grid grid-cols-[120px_1fr] gap-3 border-b border-borda-suave pb-3 last:border-0 last:pb-0"
              >
                <dt className="text-apagado">{k}</dt>
                <dd className="font-medium text-texto">{v}</dd>
              </div>
            ))}
          </dl>
        </DialogBody>
        <DialogFoot>
          <Button variant="primary" onClick={() => setAberto(false)}>
            Fechar
          </Button>
        </DialogFoot>
      </DialogContent>
    </Dialog>
  );
}

const SenhaForm = z
  .object({
    atual: z.string().min(1, 'Informe a senha atual.'),
    nova: z.string().min(8, 'A senha nova precisa de pelo menos 8 caracteres.'),
    confirma: z.string(),
  })
  .refine((d) => d.nova === d.confirma, { path: ['confirma'], message: 'A confirmação não bate com a senha nova.' });
type SenhaForm = z.infer<typeof SenhaForm>;

function TrocarSenha({ aberto, setAberto }: { aberto: boolean; setAberto: (v: boolean) => void }) {
  const f = useForm<SenhaForm>({
    resolver: zodResolver(SenhaForm),
    defaultValues: { atual: '', nova: '', confirma: '' },
  });
  const salvar = useMutation({
    mutationFn: (d: SenhaForm) => api('/auth/senha', { method: 'PUT', json: { atual: d.atual, nova: d.nova } }),
  });
  const fechar = (v: boolean) => {
    setAberto(v);
    if (!v) {
      f.reset();
      salvar.reset();
    }
  };
  const campo = (n: keyof SenhaForm, rotulo: string, auto: string) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`senha-${n}`}>{rotulo}</Label>
      <Input
        id={`senha-${n}`}
        type="password"
        autoComplete={auto}
        aria-invalid={!!f.formState.errors[n]}
        {...f.register(n)}
      />
      {f.formState.errors[n] && <span className="font-medium text-vermelho">{f.formState.errors[n]?.message}</span>}
    </div>
  );
  return (
    <Dialog open={aberto} onOpenChange={fechar}>
      <DialogContent tamanho="sm">
        <form onSubmit={f.handleSubmit((d) => salvar.mutate(d))} noValidate>
          <DialogHead titulo="Trocar senha" descricao="A senha nova vale a partir do próximo login." />
          <DialogBody className="grid gap-3">
            {salvar.isSuccess ? (
              <Aviso tom="blue" icone="ok">
                Senha trocada.
              </Aviso>
            ) : null}
            {salvar.isError ? (
              <Aviso tom="red" icone="alerta">
                {salvar.error.message}
              </Aviso>
            ) : null}
            {campo('atual', 'Senha atual', 'current-password')}
            {campo('nova', 'Senha nova', 'new-password')}
            {campo('confirma', 'Confirme a senha nova', 'new-password')}
          </DialogBody>
          <DialogFoot>
            <Button type="button" onClick={() => fechar(false)}>
              {salvar.isSuccess ? 'Fechar' : 'Cancelar'}
            </Button>
            {!salvar.isSuccess && (
              <Button type="submit" variant="primary" disabled={salvar.isPending}>
                Salvar senha
              </Button>
            )}
          </DialogFoot>
        </form>
      </DialogContent>
    </Dialog>
  );
}
