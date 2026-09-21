'use client';

import { useQueryClient } from '@tanstack/react-query';
import { KeyRoundIcon, LockIcon, MailIcon, PencilIcon, PlusIcon, UnlockIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Aviso } from '@/components/ds';
import { usePaginacao } from '@/components/paginacao';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHead, CardTitle } from '@/components/ui/card';
import { Table, TBody, Td, THead, Th, Tr } from '@/components/ui/table';
import { useAcaoCfg } from '@/lib/config';
import type { Tom } from '@/lib/tipos';

/** a conta de acesso de uma pessoa (GET /config/acesso ou a aba Acesso da ficha) */
export type AcessoPessoa = {
  pessoa: { tipo: 'Aluno' | 'Professor' | 'Colaborador'; nome: string; email: string };
  usuario: {
    id: number;
    codigo: string;
    email: string;
    perfil: string;
    hierarquia: string;
    resumo: string;
    status: string;
    statusTom: Tom;
    mfa: boolean;
    ultimo: string;
    eu: boolean;
  } | null;
  sessoes: { id: string; dispositivo: string; origem: string; ultima: string; estaSessao: boolean }[];
  historico: { id: number; quando: string; evento: string; resultado: string; tom: Tom; detalhe: string }[];
  criar: string | null;
};

/**
 * A gestão de acessos dentro de cada pessoa: a conta, o que ela libera, as sessões ativas e o histórico,
 * com criar, editar, bloquear, reativar, reenviar convite e encerrar sessão. Serve às fichas e ao cadastro do colaborador.
 */
export function AcessoDaPessoa({ d, compacto = false }: { d: AcessoPessoa; compacto?: boolean }) {
  const acao = useAcaoCfg();
  const qc = useQueryClient();
  const caminho = usePathname();
  const [msg, setMsg] = useState<{ txt: string; erro?: boolean } | null>(null);
  const { fatia, rodape } = usePaginacao(d.historico);
  const u = d.usuario;
  const faz = (caminho: string, json: unknown) =>
    acao.mutate(
      { caminho, json },
      {
        onSuccess: (r) => {
          setMsg({ txt: r.msg });
          /* a ficha e a lista que mostram este acesso recarregam */
          qc.invalidateQueries();
        },
        onError: (e) => setMsg({ txt: e.message, erro: true }),
      },
    );
  const volta = `volta=${encodeURIComponent(caminho)}`;

  if (!u)
    return (
      <Card>
        <CardHead>
          <CardTitle>Conta de acesso</CardTitle>
        </CardHead>
        <div className="flex flex-wrap items-center gap-4 px-5 py-4">
          <p className="m-0 min-w-0 flex-1 text-apagado">
            {d.pessoa.nome} ainda não tem acesso ao portal. Ao criar, o usuário já nasce vinculado a este cadastro.
          </p>
          {d.criar && (
            <Button asChild variant="primary">
              <Link href={`${d.criar}&${volta}`}>
                <PlusIcon /> Criar acesso
              </Link>
            </Button>
          )}
        </div>
      </Card>
    );

  const bloqueado = u.status === 'Bloqueado';
  const linhas: [string, React.ReactNode][] = [
    [
      'ID do usuário',
      <span key="id" className="tabular-nums">
        {u.codigo}
      </span>,
    ],
    ['Login', u.email],
    ['Perfil', u.perfil],
    ['Hierarquia', u.hierarquia],
    ['Acesso', u.resumo],
    [
      'Situação',
      <Badge key="sit" tom={u.statusTom}>
        {u.status}
      </Badge>,
    ],
    ['MFA', u.mfa ? 'exigido' : 'não exigido'],
    ['Último acesso', u.ultimo],
  ];
  return (
    <div className="grid gap-4">
      {msg && (
        <Aviso tom={msg.erro ? 'red' : 'blue'} icone={msg.erro ? 'alerta' : 'ok'}>
          {msg.txt}
        </Aviso>
      )}
      <Card>
        <CardHead className="flex-wrap">
          <CardTitle>Conta de acesso</CardTitle>
          <span className="flex-1" />
          <Button asChild size="sm">
            <Link href={`/configuracoes/usuarios/${u.id}?${volta}`}>
              <PencilIcon /> Editar acesso
            </Link>
          </Button>
          {!u.eu && (
            <Button
              size="sm"
              disabled={acao.isPending}
              onClick={() => faz('/usuarios/massa', { acao: bloqueado ? 'ativar' : 'bloquear', ids: [u.id] })}
            >
              {bloqueado ? <UnlockIcon /> : <LockIcon />} {bloqueado ? 'Reativar' : 'Bloquear'}
            </Button>
          )}
          {u.status === 'Convite pendente' && (
            <Button
              size="sm"
              disabled={acao.isPending}
              onClick={() => faz('/usuarios/massa', { acao: 'convite', ids: [u.id] })}
            >
              <MailIcon /> Reenviar convite
            </Button>
          )}
          {!u.mfa && (
            <Button
              size="sm"
              disabled={acao.isPending}
              onClick={() => faz('/usuarios/massa', { acao: 'mfa', ids: [u.id] })}
            >
              <KeyRoundIcon /> Exigir MFA
            </Button>
          )}
        </CardHead>
        <dl className="grid gap-x-8 gap-y-3 px-5 py-4 md:grid-cols-2">
          {linhas.map(([k, v]) => (
            <div key={k} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
              <dt className="text-apagado">{k}</dt>
              <dd className="min-w-0 text-right font-medium break-words text-texto">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card className="overflow-hidden">
        <CardHead>
          <CardTitle>Sessões ativas</CardTitle>
          <Badge tom="blue">{d.sessoes.length}</Badge>
        </CardHead>
        {d.sessoes.length ? (
          <Table aria-label="Sessões ativas">
            <THead>
              <Tr>
                <Th>Dispositivo</Th>
                <Th>Origem</Th>
                <Th>Última atividade</Th>
                <Th className="text-right">Ações</Th>
              </Tr>
            </THead>
            <TBody>
              {d.sessoes.map((s) => (
                <Tr key={s.id}>
                  <Td>{s.dispositivo}</Td>
                  <Td className="tabular-nums">{s.origem}</Td>
                  <Td>{s.ultima}</Td>
                  <Td className="text-right">
                    {s.estaSessao ? (
                      <span className="text-apagado">esta sessão</span>
                    ) : (
                      <Button size="sm" disabled={acao.isPending} onClick={() => faz(`/sessoes/${s.id}/encerrar`, {})}>
                        Encerrar
                      </Button>
                    )}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        ) : (
          <p className="m-0 px-5 py-4 text-apagado">Nenhuma sessão aberta agora.</p>
        )}
      </Card>
      {!compacto && (
        <Card className="overflow-hidden">
          <CardHead>
            <CardTitle>Histórico de acesso</CardTitle>
            <Badge tom="blue">{d.historico.length}</Badge>
          </CardHead>
          <Table aria-label="Histórico de acesso">
            <THead>
              <Tr>
                <Th>Quando</Th>
                <Th>Evento</Th>
                <Th>Resultado</Th>
                <Th>Detalhe</Th>
              </Tr>
            </THead>
            <TBody>
              {fatia.length ? (
                fatia.map((h) => (
                  <Tr key={h.id}>
                    <Td className="whitespace-nowrap tabular-nums">{h.quando}</Td>
                    <Td>{h.evento}</Td>
                    <Td>
                      <Badge tom={h.tom}>{h.resultado}</Badge>
                    </Td>
                    <Td className="text-apagado">{h.detalhe || '—'}</Td>
                  </Tr>
                ))
              ) : (
                <Tr>
                  <Td colSpan={4} className="py-7 text-center text-apagado-2">
                    nenhum acesso registrado
                  </Td>
                </Tr>
              )}
            </TBody>
          </Table>
          {rodape}
        </Card>
      )}
    </div>
  );
}
