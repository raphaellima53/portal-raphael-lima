'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLogin, useMe, usePersonas } from '@/lib/consultas';
import type { Persona } from '@/lib/tipos';

const Form = z.object({
  login: z.string().trim().min(1, 'Preencha login e senha.'),
  senha: z.string().min(1, 'Preencha login e senha.'),
});
type Form = z.infer<typeof Form>;

/** Tela de login com as personas de teste ao lado (ambiente de teste: a senha fica à mostra). */
export function TelaLogin() {
  const router = useRouter();
  const volta = useSearchParams().get('volta');
  const me = useMe();
  const personas = usePersonas();
  const login = useLogin();
  const f = useForm<Form>({ resolver: zodResolver(Form), defaultValues: { login: '', senha: '' } });
  const loginRef = useRef<HTMLInputElement | null>(null);

  const destino = (ehAluno: boolean) =>
    volta?.startsWith('/') && !volta.startsWith('//') ? volta : ehAluno ? '/minha-agenda' : '/inicio';

  // biome-ignore lint/correctness/useExhaustiveDependencies: redireciona só quando a sessão aparece
  useEffect(() => {
    if (me.data) router.replace(destino(me.data.usuario.ehAluno));
  }, [me.data]);

  useEffect(() => loginRef.current?.focus(), []);

  const entrar = (d: Form) =>
    login.mutate(
      { login: d.login.toLowerCase(), senha: d.senha },
      { onSuccess: (r) => router.replace(destino(r.ehAluno)) },
    );
  const usar = (p: Persona) => {
    f.setValue('login', p.login);
    f.setValue('senha', p.senha);
    entrar({ login: p.login, senha: p.senha });
  };

  const erro = f.formState.errors.login?.message || f.formState.errors.senha?.message || login.error?.message;
  const { ref: rLogin, ...campoLogin } = f.register('login');

  return (
    <div className="min-h-dvh bg-[#041c4a] px-4 py-8 sm:px-8">
      <div className="mx-auto grid max-w-[1224px] items-start gap-6 lg:grid-cols-[380px_1fr]">
        <div className="rounded-[18px] bg-white p-7 text-[#0f172a] shadow-el-4">
          {/* logo da marca (Figma, Page 3) */}
          <Image
            unoptimized
            priority
            src="/marca/alumni-azul.svg"
            alt="alumni by Better"
            width={137}
            height={60}
            className="block h-[60px] w-auto"
          />
          <h1 className="mt-[18px] mb-1 text-[20px]">Entrar no portal</h1>
          <p className="text-[#566174]">
            Ambiente de teste. Clique em usar numa persona da lista para entrar direto, ou digite login e senha.
          </p>
          <form onSubmit={f.handleSubmit(entrar)} noValidate className="mt-3 grid gap-1.5">
            <Label htmlFor="lgLogin" className="mt-2">
              Login
            </Label>
            <Input
              id="lgLogin"
              autoComplete="username"
              placeholder="persona.a@alumni.teste"
              aria-invalid={!!erro}
              {...campoLogin}
              ref={(el) => {
                rLogin(el);
                loginRef.current = el;
              }}
            />
            <Label htmlFor="lgSenha" className="mt-2">
              Senha
            </Label>
            <Input
              id="lgSenha"
              type="password"
              autoComplete="current-password"
              placeholder="senha"
              aria-invalid={!!erro}
              {...f.register('senha')}
            />
            <div role="alert" className="min-h-6 pt-1 font-medium text-[#c42835]">
              {erro}
            </div>
            <Button type="submit" variant="primary" className="mt-1" disabled={login.isPending}>
              {login.isPending ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>
        </div>

        <section
          aria-labelledby="lg-personas"
          className="min-w-0 overflow-hidden rounded-[18px] border border-white/8 bg-[#111a36] p-4 text-[#c9d1e2]"
        >
          <div className="flex flex-wrap items-baseline gap-x-2.5 px-1 pt-1 pb-3">
            <b id="lg-personas" className="text-white">
              Personas de teste
            </b>
            <span className="text-[#8b96ae]">
              {personas.data ? `${personas.data.length} contas · ` : ''}senha à mostra porque é ambiente de teste
            </span>
          </div>
          {/* relative: o sr-only do cabeçalho não escapa da rolagem da tabela e alarga a página no celular */}
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="bg-white/95 text-left text-[#566174]">
                  {['Persona', 'Tipo', 'Curso · módulo', 'Login', 'Senha', ''].map((t, i) => (
                    <th key={i} scope="col" className="h-9 px-2 font-semibold">
                      {t || <span className="sr-only">Entrar</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {personas.isError && (
                  <tr>
                    <td colSpan={6} className="px-2 py-4 text-[#8b96ae]">
                      Não foi possível carregar as personas. A API está rodando?
                    </td>
                  </tr>
                )}
                {(personas.data ?? []).map((p) => (
                  <tr key={p.login} className="border-b border-white/7 align-top last:border-0">
                    <td className="px-2 py-2.5 font-bold text-white">{p.letra}</td>
                    <td className="px-2 py-2.5 text-white">
                      {p.tipo}
                      <small className="block text-sm text-[#8b96ae]">
                        {p.nome} · {p.hierarquia}
                      </small>
                    </td>
                    <td className="px-2 py-2.5 text-white">
                      {p.cursos.length ? (
                        <>
                          {p.cursos.join(' + ')}
                          <small className="block text-sm text-[#8b96ae]">{p.modulos.join(' · ')}</small>
                        </>
                      ) : (
                        <small className="text-sm text-[#8b96ae]">—</small>
                      )}
                    </td>
                    <td className="px-2 py-2.5">
                      <code className="text-white">{p.login}</code>
                    </td>
                    <td className="px-2 py-2.5">
                      <code className="text-white">{p.senha}</code>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => usar(p)}
                        aria-label={`Entrar como ${p.nome}`}
                        className="h-8 cursor-pointer rounded-md border border-white/15 bg-white/5 px-3 font-semibold text-white hover:bg-[#003FB0]"
                      >
                        usar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
