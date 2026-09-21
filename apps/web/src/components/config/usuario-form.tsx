'use client';

import { ChevronLeftIcon, LockIcon, PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { CampoData } from '@/components/campos-data';
import { Aviso, PageHead } from '@/components/ds';
import { Escolha } from '@/components/escolha';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type Setores, type UsuarioForm, useAcaoCfg, useCfg, usePrevia } from '@/lib/config';
import { cn } from '@/lib/utils';
import { Campo, textareaCls } from './comum';

/** seção numerada do formulário (fsec) */
export function Secao({ n, t, d, children }: { n: number; t: string; d: string; children: React.ReactNode }) {
  return (
    <Card className="mb-4 overflow-hidden">
      <div className="flex flex-wrap items-baseline gap-2.5 border-b border-borda-suave px-5 py-3.5">
        <span className="grid size-6 place-items-center self-center rounded-full bg-azul-suave font-bold text-azul">
          {n}
        </span>
        <h2 className="font-bold text-texto">{t}</h2>
        <span className="text-apagado">{d}</span>
      </div>
      <div className="px-5 py-4">{children}</div>
    </Card>
  );
}

const VAZIO = {
  nome: '',
  email: '',
  pessoa: '',
  colaborador: '',
  alunoId: null as number | null,
  professor: '',
  telefone: '',
  perfilId: null as number | null,
  validoAte: '',
  responsavel: '',
  justificativa: '',
  nivel: 0,
  setores: {} as Setores,
  seguranca: {} as Record<string, boolean>,
  observacoes: '',
};

/** Novo usuário e Editar usuário: identidade, cargo, hierarquia, setores e segurança (P.usuarioForm) */
export function FormUsuario({ id }: { id: number | null }) {
  const router = useRouter();
  const q = useCfg<UsuarioForm>(`/usuarios/form${id ? `?id=${id}` : ''}`);
  const acao = useAcaoCfg();
  const [v, setV] = useState(VAZIO);
  const [aviso, setAviso] = useState('');
  const avisoRef = useRef<HTMLDivElement>(null);
  const d = q.data;
  const u = d?.usuario;
  const ed = id != null;

  useEffect(() => {
    if (!d) return;
    if (u)
      setV({
        nome: u.nome,
        email: u.email,
        pessoa: u.pessoa,
        colaborador: u.colaborador,
        alunoId: u.alunoId,
        professor: u.professor,
        telefone: u.telefone,
        perfilId: u.perfilId,
        validoAte: u.validoAte,
        responsavel: u.responsavel,
        justificativa: u.justificativa,
        nivel: u.nivel,
        setores: u.setores,
        seguranca: u.seguranca,
        observacoes: u.observacoes,
      });
    else setV({ ...VAZIO, responsavel: d.responsaveis[0] ?? '' });
  }, [d, u]);
  useEffect(() => {
    document.title = `${ed ? 'Editar usuário' : 'Novo usuário'} · Portal Raphael Lima`;
  }, [ed]);

  const perfil = d?.perfis.find((p) => p.id === v.perfilId) ?? null;
  const previa = usePrevia({ perfilId: v.perfilId, nivel: v.nivel, setores: v.setores }, !!d);
  const pv = previa.data;
  const set = <K extends keyof typeof VAZIO>(k: K, x: (typeof VAZIO)[K]) => setV((s) => ({ ...s, [k]: x }));
  const seg = (k: string) => (k in v.seguranca ? v.seguranca[k] : !!d?.seguranca.find((s) => s.k === k)?.padrao);
  const pessoaSel = d?.pessoas.find((p) => p.nome === v.pessoa);
  const jaTem = !ed && pessoaSel?.usuario ? pessoaSel : null;
  const nv = d?.niveis.find((n) => n.n === v.nivel);

  const salvar = (convite: boolean) =>
    acao.mutate(
      {
        caminho: ed ? `/usuarios/${id}` : '/usuarios',
        method: ed ? 'PUT' : 'POST',
        json: { ...v, convite, seguranca: Object.fromEntries((d?.seguranca ?? []).map((s) => [s.k, seg(s.k)])) },
      },
      {
        onSuccess: (r) => router.push(`/configuracoes/usuarios?msg=${encodeURIComponent(r.msg)}`),
        onError: (e) => {
          setAviso(e.message);
          setTimeout(() => avisoRef.current?.scrollIntoView({ block: 'center' }), 0);
        },
      },
    );
  const botaoOk = (
    <Button variant="primary" disabled={acao.isPending || !d} onClick={() => salvar(true)}>
      {!ed && <PlusIcon />} {ed ? 'Salvar' : 'Criar e enviar convite'}
    </Button>
  );

  return (
    <>
      <PageHead
        titulo={ed ? 'Editar usuário' : 'Novo usuário'}
        acoes={
          <>
            <Button asChild>
              <Link href="/configuracoes/usuarios">
                <ChevronLeftIcon /> Usuários
              </Link>
            </Button>
            {botaoOk}
          </>
        }
      />
      <div ref={avisoRef}>
        {(aviso || jaTem) && (
          <Aviso tom={aviso ? 'red' : 'amber'} icone="alerta">
            {aviso || `${jaTem!.nome} já tem usuário (${jaTem!.usuario}). Edite o existente em vez de criar outro.`}
          </Aviso>
        )}
      </div>
      {q.error && (
        <Aviso tom="red" icone="alerta">
          {q.error.message}
        </Aviso>
      )}
      {d && (
        <>
          <Secao n={1} t="Identidade" d="a pessoa por trás do acesso">
            <div className="grid gap-4 md:grid-cols-2">
              <Campo
                rotulo="Pessoa"
                req
                ajuda="o usuário sempre nasce de uma Pessoa — evita cadastro duplicado"
                className="md:col-span-2"
              >
                <Escolha
                  rotulo="Pessoa"
                  todos="buscar por nome na ficha única"
                  destacar={false}
                  valor={v.pessoa}
                  aoMudar={(nome) => {
                    const x = d.pessoas.find((p) => p.nome === nome);
                    setAviso('');
                    setV((s) => ({
                      ...s,
                      pessoa: nome,
                      ...(x && !ed ? { nome: x.nome, email: x.email } : {}),
                      ...(x?.tipo === 'Colaborador' ? { colaborador: x.nome } : {}),
                    }));
                  }}
                  opcoes={d.pessoas.map((p) => ({
                    v: p.nome,
                    l: `${p.nome} · ${p.tipo}${p.email ? ` · ${p.email}` : ''}`,
                  }))}
                />
              </Campo>
              <Campo id="nu-nome" rotulo="Nome de exibição" req>
                <Input
                  id="nu-nome"
                  placeholder="como aparece nos registros"
                  value={v.nome}
                  onChange={(e) => set('nome', e.target.value)}
                />
              </Campo>
              <Campo id="nu-email" rotulo="E-mail de acesso" req ajuda="recebe o convite e as notificações">
                <Input
                  id="nu-email"
                  type="email"
                  placeholder="nome@betteredu.teste"
                  value={v.email}
                  readOnly={ed}
                  onChange={(e) => set('email', e.target.value)}
                />
              </Campo>
              <Campo rotulo="Vincular a colaborador">
                <Escolha
                  rotulo="Vincular a colaborador"
                  todos="— nenhum —"
                  destacar={false}
                  valor={v.colaborador}
                  aoMudar={(x) => set('colaborador', x)}
                  opcoes={d.colaboradores.map((c) => ({ v: c, l: c }))}
                />
              </Campo>
              {perfil?.tipo !== 'Aluno' && (
                <Campo
                  rotulo="Vincular a aluno"
                  ajuda="quem também estuda ganha o botão Aluno no menu, para gerir as próprias aulas"
                >
                  <Escolha
                    rotulo="Vincular a aluno"
                    todos="— nenhum —"
                    destacar={false}
                    valor={v.alunoId == null ? '' : String(v.alunoId)}
                    aoMudar={(x) => set('alunoId', x ? Number(x) : null)}
                    opcoes={d.alunos.map((a) => ({
                      v: String(a.id),
                      l: a.usuario ? `${a.nome} (já vinculado a ${a.usuario})` : a.nome,
                    }))}
                  />
                </Campo>
              )}
              {perfil?.tipo === 'Prestador' && (
                <Campo rotulo="Vincular a professor" ajuda="a agenda do professor fica presa nas aulas dele">
                  <Escolha
                    rotulo="Vincular a professor"
                    todos="— nenhum —"
                    destacar={false}
                    valor={v.professor}
                    aoMudar={(x) => set('professor', x)}
                    opcoes={d.professores.map((t) => ({ v: t, l: t }))}
                  />
                </Campo>
              )}
              <Campo id="nu-tel" rotulo="Telefone">
                <Input
                  id="nu-tel"
                  inputMode="tel"
                  placeholder="(11) 90000-0000"
                  value={v.telefone}
                  onChange={(e) => set('telefone', e.target.value)}
                />
              </Campo>
            </div>
          </Secao>

          <Secao n={2} t="Cargo" d="tipo de perfil, cargo e setor do cargo">
            <div className="grid gap-4 md:grid-cols-2">
              <Campo
                rotulo="Cargo"
                req
                ajuda="o cargo sugere o nível e os setores; nenhum dos dois vem travado"
                className="md:col-span-2"
              >
                <Escolha
                  rotulo="Cargo"
                  todos="— escolher —"
                  destacar={false}
                  valor={v.perfilId == null ? '' : String(v.perfilId)}
                  aoMudar={(x) => {
                    const p = d.perfis.find((y) => String(y.id) === x) ?? null;
                    setV((s) => ({
                      ...s,
                      perfilId: p?.id ?? null,
                      ...(p?.sugestao ? { nivel: p.sugestao.nivel, setores: p.sugestao.setores } : {}),
                    }));
                  }}
                  opcoes={d.perfis.map((p) => ({ v: String(p.id), l: p.nome }))}
                />
              </Campo>
              <Campo id="nu-area" rotulo="Setor do cargo" ajuda="vem do perfil">
                <Input id="nu-area" readOnly value={perfil?.area ?? ''} />
              </Campo>
              <Campo id="nu-hier" rotulo="Hierarquia sugerida" ajuda="vem do perfil">
                <Input id="nu-hier" readOnly value={perfil?.hierarquia ?? ''} />
              </Campo>
              <Campo rotulo="Válido até" ajuda="deixe vazio para acesso sem prazo">
                <CampoData rotulo="Válido até" valor={v.validoAte} aoMudar={(x) => set('validoAte', x)} />
              </Campo>
              <Campo rotulo="Responsável pelo acesso" ajuda="quem responde pela concessão na auditoria">
                <Escolha
                  rotulo="Responsável pelo acesso"
                  destacar={false}
                  valor={v.responsavel}
                  aoMudar={(x) => set('responsavel', x)}
                  opcoes={[...new Set([...d.responsaveis, v.responsavel].filter(Boolean))].map((r) => ({ v: r, l: r }))}
                />
              </Campo>
              <Campo id="nu-just" rotulo="Justificativa da concessão" req={!ed} className="md:col-span-2">
                <Input
                  id="nu-just"
                  placeholder="ex.: contratação · substituição de Fulano"
                  value={v.justificativa}
                  onChange={(e) => set('justificativa', e.target.value)}
                />
              </Campo>
            </div>
          </Secao>

          <Secao n={3} t="Hierarquia" d="o que a pessoa pode fazer">
            <Campo
              rotulo="Hierarquia"
              req
              ajuda={
                perfil?.sugestao
                  ? `${perfil.cargo || perfil.tipo} sugere ${perfil.sugestao.nivel} — ${d.niveis.find((n) => n.n === perfil.sugestao!.nivel)?.nome}. O nível é da pessoa: dá para mudar.`
                  : 'escolha o perfil para ver o nível sugerido do cargo'
              }
              className="max-w-[520px]"
            >
              <Escolha
                rotulo="Hierarquia"
                todos="— escolher —"
                destacar={false}
                valor={v.nivel ? String(v.nivel) : ''}
                aoMudar={(x) => set('nivel', Number(x) || 0)}
                opcoes={d.niveis.map((n) => ({
                  v: String(n.n),
                  l: `${n.n} — ${n.nome}${n.n === perfil?.sugestao?.nivel ? ' · sugerido para o cargo' : ''}`,
                }))}
              />
            </Campo>
            <ul aria-label="O que a hierarquia permite" className="mt-3 flex flex-wrap gap-2">
              {d.acoes.map((a, i) => {
                const x = nv ? nv.acoes[i] : null;
                return (
                  <li
                    key={a}
                    className={cn(
                      'rounded-full px-3 py-1',
                      x === 1
                        ? 'bg-verde-suave text-verde'
                        : x === 0
                          ? 'bg-vermelho-suave text-vermelho'
                          : 'bg-bg text-apagado',
                    )}
                  >
                    {x === 1 ? '✓' : x === 0 ? '✕' : '—'} {a}
                    <span className="sr-only">
                      {x === 1 ? ': permitido' : x === 0 ? ': não permitido' : ': não se aplica'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Secao>

          <Secao
            n={4}
            t="Setores"
            d="onde a pessoa pode atuar — Total libera o setor inteiro; Restrito, só o recorte do cargo"
          >
            {pv?.aluno ? (
              <p className="text-texto-2">
                Aluno não atua nos setores do portal da equipe: entra na área do aluno e vê só os próprios dados, a
                própria agenda e os próprios conteúdos.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      {(pv?.setores ?? []).map((s) => (
                        <tr key={s.id} className="border-b border-borda-suave align-top last:border-b-0">
                          <th scope="row" className="w-[170px] py-3 pr-3 text-left font-semibold text-texto">
                            {s.nome}
                          </th>
                          <td className="w-[180px] py-2 pr-4">
                            <Escolha
                              rotulo={`Acesso ao setor ${s.nome}`}
                              todos="— sem acesso"
                              valor={v.setores[s.id] ?? ''}
                              aoMudar={(x) => {
                                const n = { ...v.setores };
                                if (x === 'total' || x === 'restrito') n[s.id] = x;
                                else delete n[s.id];
                                set('setores', n);
                              }}
                              opcoes={[
                                { v: 'total', l: 'Total' },
                                { v: 'restrito', l: 'Restrito' },
                              ]}
                            />
                          </td>
                          <td className="py-3 text-texto-2">
                            {s.total ? (
                              s.total
                            ) : s.recorte ? (
                              <>
                                <b>{s.recorte.nome}</b> — {s.recorte.desc}
                                <small className="mt-1 block text-sm text-apagado">
                                  {s.recorte.telas.join(' · ') || 'nenhuma tela'}
                                </small>
                              </>
                            ) : (
                              <span className="text-apagado">o setor não libera nenhuma tela</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      <tr className="align-top">
                        <th scope="row" className="py-3 pr-3 text-left font-semibold text-texto">
                          Configurações
                        </th>
                        <td className="py-3 pr-4">
                          <Badge tom={pv?.configuracoes ? 'blue' : 'gray'}>
                            {pv?.configuracoes ? 'liberado' : 'bloqueado'}
                          </Badge>
                        </td>
                        <td className="py-3 text-texto-2">
                          {pv?.configuracoes ? (
                            'Pessoas e acessos, regras de negócio, alertas e documentação'
                          ) : (
                            <span className="text-apagado">só o tipo de perfil Admin abre Configurações</span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p role="status" className="mt-3 rounded-md bg-bg px-4 py-3 text-texto-2">
                  {pv?.telas != null ? (
                    <>
                      <b>{pv.telas}</b> telas no menu desta pessoa · {pv.resumo}
                    </>
                  ) : (
                    'escolha a hierarquia para ver quantas telas entram no menu'
                  )}
                </p>
              </>
            )}
          </Secao>

          <Secao n={5} t="Segurança" d="como esta conta se protege">
            <div className="grid gap-3">
              {d.seguranca.map((s) => (
                <div key={s.k} className="flex items-center gap-2.5">
                  <Checkbox
                    id={`nu-seg-${s.k}`}
                    checked={seg(s.k)}
                    onCheckedChange={(x) => set('seguranca', { ...v.seguranca, [s.k]: x === true })}
                  />
                  <Label htmlFor={`nu-seg-${s.k}`} className="font-normal">
                    {s.t}
                  </Label>
                </div>
              ))}
              <Campo id="nu-obs" rotulo="Observações" className="mt-2">
                <textarea
                  id="nu-obs"
                  rows={3}
                  className={textareaCls}
                  placeholder="contexto da concessão, prazo combinado, área solicitante…"
                  value={v.observacoes}
                  onChange={(e) => set('observacoes', e.target.value)}
                />
              </Campo>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-borda-suave pt-4">
              {botaoOk}
              {!ed && (
                <Button disabled={acao.isPending} onClick={() => salvar(false)}>
                  Criar sem convite (acesso suspenso)
                </Button>
              )}
              <Button asChild>
                <Link href="/configuracoes/usuarios">Cancelar</Link>
              </Button>
            </div>
          </Secao>
          <div className="flex items-start gap-2.5 rounded-lg border border-azul-linha bg-azul-suave px-4 py-3 text-texto-2">
            <LockIcon className="mt-0.5 size-4 shrink-0 text-azul" />
            <span>
              Esta tela não exibe nem armazena senha em texto: o administrador não define senha de terceiros — o próprio
              usuário cria a dele pelo link. O que fica guardado é o <i>hash</i> gerado no momento em que a pessoa
              define a própria senha; o reset é sempre por link com prazo.
            </span>
          </div>
        </>
      )}
    </>
  );
}
