'use client';

import { DownloadIcon, PlusIcon, ShieldIcon } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { PageHead } from '@/components/ds';
import { Escolha } from '@/components/escolha';
import { usePaginacao } from '@/components/paginacao';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Table, TBody, Td, THead, Th, Tr } from '@/components/ui/table';
import { type Usuarios, useAcaoCfg, useCfg } from '@/lib/config';
import { baixaCsv } from '@/lib/relatorios';
import { AvisoMsg, Barra, Busca, ErroQ, type Msg, normaliza, Painel, Stats, Vazio } from './comum';

const Gate = ({ tom, k, children }: { tom: 'ok' | 'mid' | 'crit' | ''; k: string; children: React.ReactNode }) => (
  <div className="flex gap-3 border-b border-borda-suave py-3 last:border-b-0">
    <span
      aria-hidden
      className={
        'mt-1.5 size-2.5 shrink-0 rounded-full ' +
        (tom === 'ok' ? 'bg-verde' : tom === 'mid' ? 'bg-ambar' : tom === 'crit' ? 'bg-vermelho' : 'bg-azul')
      }
    />
    <div>
      <div className="font-semibold text-texto">{k}</div>
      <div className="text-texto-2">{children}</div>
    </div>
  </div>
);

export { Gate };

/** Configurações › Usuários: quem acessa o portal, com perfil, hierarquia e setores */
export function TelaUsuarios({ abas, msgInicial }: { abas: React.ReactNode; msgInicial: string }) {
  const q = useCfg<Usuarios>('/usuarios');
  const acao = useAcaoCfg();
  const [msg, setMsg] = useState<Msg>(msgInicial ? { txt: msgInicial } : null);
  const [busca, setBusca] = useState('');
  const [perfil, setPerfil] = useState('');
  const [status, setStatus] = useState('');
  const [mfa, setMfa] = useState('');
  const [sem30, setSem30] = useState(false);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const d = q.data;
  const lista = useMemo(() => {
    const n = normaliza(busca);
    return (d?.linhas ?? []).filter(
      (u) =>
        (!n || normaliza(`${u.nome} ${u.email}`).includes(n)) &&
        (!perfil || u.perfil === perfil) &&
        (!status || u.status === status) &&
        (!mfa || (mfa === 'sim') === u.mfa) &&
        (!sem30 || u.sem30),
    );
  }, [d, busca, perfil, status, mfa, sem30]);
  const { fatia, rodape, setPag } = usePaginacao(lista);
  const filtra =
    <T,>(f: (v: T) => void) =>
    (v: T) => {
      f(v);
      setPag(1);
    };
  const marcados = lista.filter((u) => sel.has(u.id));
  const todos = lista.length > 0 && marcados.length === lista.length;
  const massa = (a: string) =>
    acao.mutate(
      { caminho: '/usuarios/massa', json: { acao: a, ids: marcados.map((u) => u.id) } },
      {
        onSuccess: (r) => {
          setMsg({ txt: r.msg });
          setSel(new Set());
        },
        onError: (e) => setMsg({ txt: e.message, erro: true }),
      },
    );

  return (
    <>
      <PageHead
        titulo="Usuários"
        acoes={
          <>
            <Button
              disabled={!lista.length}
              onClick={() =>
                baixaCsv(
                  'usuarios',
                  [
                    { k: 'nome', t: 'Usuário' },
                    { k: 'email', t: 'E-mail' },
                    { k: 'perfil', t: 'Perfil' },
                    { k: 'resumo', t: 'Nível e setores' },
                    { k: 'mfa', t: 'MFA' },
                    { k: 'ultimo', t: 'Último acesso' },
                    { k: 'status', t: 'Status' },
                  ],
                  lista.map((u) => ({
                    nome: u.nome,
                    email: u.email,
                    perfil: u.perfil,
                    resumo: u.resumo,
                    mfa: u.mfa ? 'sim' : 'não',
                    ultimo: u.ultimo,
                    status: u.status,
                  })),
                )
              }
            >
              <DownloadIcon /> Exportar
            </Button>
            <Button asChild variant="primary">
              <Link href="/configuracoes/usuarios/novo">
                <PlusIcon /> Novo usuário
              </Link>
            </Button>
          </>
        }
      />
      {abas}
      <AvisoMsg msg={msg} />
      <ErroQ e={q.error} />
      {d && (
        <>
          <Stats itens={d.stats} />
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-borda bg-card px-4 py-3 text-texto-2 shadow-el-1">
            <ShieldIcon className="mt-0.5 size-4 shrink-0 text-azul" />
            <span>
              A hierarquia diz o que a pessoa pode fazer; <b>os setores dizem onde</b> — a hierarquia não dá acesso à
              empresa inteira.
            </span>
          </div>
          <Barra>
            <Busca rotulo="Buscar por nome ou e-mail" valor={busca} aoMudar={filtra(setBusca)} />
            <Escolha
              rotulo="Perfil"
              todos="Todos os perfis"
              valor={perfil}
              aoMudar={filtra(setPerfil)}
              opcoes={d.perfis.map((p) => ({ v: p, l: p }))}
              className="w-[260px]"
            />
            <Escolha
              rotulo="Status"
              todos="Todos os status"
              valor={status}
              aoMudar={filtra(setStatus)}
              opcoes={d.status.map((p) => ({ v: p, l: p }))}
              className="w-[190px]"
            />
            <Escolha
              rotulo="MFA"
              todos="Todos · MFA"
              valor={mfa}
              aoMudar={filtra(setMfa)}
              opcoes={[
                { v: 'sim', l: 'Com MFA' },
                { v: 'nao', l: 'Sem MFA' },
              ]}
              className="w-[160px]"
            />
            <span className="flex-1" />
            <div className="flex items-center gap-2">
              <Checkbox id="usu-sem30" checked={sem30} onCheckedChange={(v) => filtra(setSem30)(v === true)} />
              <Label htmlFor="usu-sem30" className="font-normal">
                só sem acesso há 30 dias
              </Label>
            </div>
          </Barra>
          {marcados.length > 0 && (
            <div
              role="region"
              aria-label="Ações em massa"
              className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-azul-linha bg-azul-suave px-4 py-2.5"
            >
              <span className="mr-1 text-texto-2">
                {marcados.length} {marcados.length === 1 ? 'selecionado' : 'selecionados'}
              </span>
              {[
                ['convite', 'Reenviar convite'],
                ['mfa', 'Exigir MFA'],
                ['bloquear', 'Bloquear'],
                ['ativar', 'Reativar'],
              ].map(([k, l]) => (
                <Button key={k} size="sm" disabled={acao.isPending} onClick={() => massa(k)}>
                  {l}
                </Button>
              ))}
            </div>
          )}
          <Card className="overflow-hidden">
            <Table aria-label="Usuários">
              <THead>
                <Tr>
                  <Th className="w-12">
                    <Checkbox
                      aria-label="Selecionar todos"
                      checked={todos}
                      onCheckedChange={(v) => setSel(v === true ? new Set(lista.map((u) => u.id)) : new Set())}
                    />
                  </Th>
                  <Th>Usuário</Th>
                  <Th>Perfil</Th>
                  <Th>Nível e setores</Th>
                  <Th className="text-center">MFA</Th>
                  <Th>Último acesso</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Ações</Th>
                </Tr>
              </THead>
              <TBody>
                {fatia.length ? (
                  fatia.map((u) => (
                    <Tr key={u.id}>
                      <Td>
                        <Checkbox
                          aria-label={`Selecionar ${u.nome}`}
                          checked={sel.has(u.id)}
                          onCheckedChange={(v) => {
                            const n = new Set(sel);
                            if (v === true) n.add(u.id);
                            else n.delete(u.id);
                            setSel(n);
                          }}
                        />
                      </Td>
                      <Td>
                        <div className="font-medium text-texto">{u.nome}</div>
                        <div className="text-apagado">{u.email}</div>
                      </Td>
                      <Td>
                        <Badge tom={u.perfilTom}>{u.perfil}</Badge>
                      </Td>
                      <Td className="min-w-[220px]">{u.resumo}</Td>
                      <Td className="text-center">
                        <Badge tom={u.mfa ? 'green' : 'amber'}>{u.mfa ? 'sim' : 'não'}</Badge>
                      </Td>
                      <Td className={u.nunca ? 'whitespace-nowrap text-ambar' : 'whitespace-nowrap'}>{u.ultimo}</Td>
                      <Td>
                        <Badge tom={u.statusTom}>{u.status}</Badge>
                      </Td>
                      <Td className="text-right">
                        <Button asChild size="sm">
                          <Link href={`/configuracoes/usuarios/${u.id}`} aria-label={`Editar ${u.nome}`}>
                            Editar
                          </Link>
                        </Button>
                      </Td>
                    </Tr>
                  ))
                ) : (
                  <Vazio cols={8} txt="nenhum usuário com esses filtros" />
                )}
              </TBody>
            </Table>
            {rodape}
          </Card>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Painel titulo="Ciclo de vida do usuário" sub="o que acontece em cada transição">
              <div className="px-5 py-2">
                <Gate tom="" k="Convite enviado">
                  O admin cria o usuário a partir de uma pessoa existente e escolhe o cargo, a hierarquia e os setores.
                  O sistema envia link de definição de senha com validade de 48h —{' '}
                  <b>o admin nunca digita a senha de outra pessoa</b>.
                </Gate>
                <Gate tom="ok" k="Ativo">
                  Acesso liberado conforme o nível e os setores. Primeiro login exige definir senha e, nos perfis com
                  alçada financeira ou de regra, ativar MFA.
                </Gate>
                <Gate tom="mid" k="Bloqueado">
                  Sessões encerradas na hora e login recusado. O histórico e a autoria dos registros permanecem —
                  bloquear não apaga o que a pessoa fez.
                </Gate>
                <Gate tom="crit" k="Desligamento">
                  Bloqueio + remoção de escopo. O usuário some do seletor de responsável, mas continua nomeado nos
                  registros antigos, senão a auditoria perde o rastro. Nenhuma transição exclui o usuário: a exclusão
                  física quebraria a cadeia de autoria.
                </Gate>
              </div>
            </Painel>
            <Painel titulo="Usuário × Colaborador × Pessoa" sub="três coisas diferentes que costumam virar uma só">
              <Table>
                <THead>
                  <Tr>
                    <Th>Entidade</Th>
                    <Th>O que é</Th>
                    <Th>Onde mora</Th>
                  </Tr>
                </THead>
                <TBody>
                  {[
                    [
                      'Pessoa',
                      'A ficha única: nome, documento, contato. Serve aluno, professor, colaborador e contato de empresa.',
                      'Alunos, Professores e Colaboradores',
                      '',
                    ],
                    [
                      'Colaborador',
                      'O vínculo de trabalho: departamento, cargo, data de entrada.',
                      'Colaboradores',
                      '/configuracoes/colaboradores',
                    ],
                    ['Usuário', 'A credencial de acesso: perfil, nível, setores, MFA, sessões.', 'esta tela', ''],
                  ].map(([k, o, m, href]) => (
                    <Tr key={k}>
                      <Td className="font-bold text-texto">{k}</Td>
                      <Td>{o}</Td>
                      <Td>
                        {href ? (
                          <Link href={href} className="text-azul hover:underline">
                            {m}
                          </Link>
                        ) : (
                          m
                        )}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </Painel>
          </div>
        </>
      )}
    </>
  );
}
