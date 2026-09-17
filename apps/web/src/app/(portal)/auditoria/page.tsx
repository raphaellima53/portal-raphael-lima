'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Busca, normaliza } from '@/components/acoes/alocacao';
import { Aviso, PageHead } from '@/components/ds';
import { Escolha } from '@/components/escolha';
import { usePaginacao } from '@/components/paginacao';
import { Badge } from '@/components/ui/badge';
import { Card, CardHead, CardTitle } from '@/components/ui/card';
import { Table, TBody, Td, THead, Th, Tr } from '@/components/ui/table';
import { ErroApi } from '@/lib/api';
import { useAuditoria } from '@/lib/auditoria';

/** Auditoria: o que se muda no portal junto com o histórico da base; a linha de aluno ou professor abre o log da ficha */
export default function AuditoriaPage() {
  const q = useAuditoria();
  const router = useRouter();
  const [busca, setBusca] = useState('');
  const [ent, setEnt] = useState('');
  const [quem, setQuem] = useState('');
  useEffect(() => {
    document.title = 'Auditoria · Portal Raphael Lima';
  }, []);
  const d = q.data;
  const ls = (d?.linhas ?? []).filter(
    (x) =>
      (!ent || x.ent === ent) &&
      (!quem || x.quem === quem) &&
      (!busca || normaliza([x.quem, x.ent, x.acao, x.reg, x.det].join(' ')).includes(normaliza(busca))),
  );
  const { fatia, rodape, setPag } = usePaginacao(ls, 25);
  const filtro = (f: (v: string) => void) => (v: string) => {
    f(v);
    setPag(1);
  };

  if (q.error instanceof ErroApi && q.error.status === 403)
    return (
      <>
        <PageHead titulo="Sem acesso a esta tela" />
        <Aviso icone="trava">{q.error.message}</Aviso>
      </>
    );

  return (
    <>
      <PageHead titulo="Auditoria" />
      {q.isError && (
        <Aviso tom="red" icone="alerta">
          {q.error.message}
        </Aviso>
      )}
      {d?.limite && (
        <Aviso icone="info">
          Mostrando as {d.limite.toLocaleString('pt-BR')} alterações mais recentes de {d.total.toLocaleString('pt-BR')}.
        </Aviso>
      )}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Busca rotulo="Buscar na auditoria" valor={busca} aoMudar={filtro(setBusca)} />
        <div className="flex flex-wrap items-center gap-2">
          <Escolha
            rotulo="Entidade"
            todos="Todas as entidades"
            valor={ent}
            aoMudar={filtro(setEnt)}
            opcoes={(d?.entidades ?? []).map((x) => ({ v: x, l: x }))}
            className="w-[210px]"
          />
          <Escolha
            rotulo="Autor"
            todos="Todos os autores"
            valor={quem}
            aoMudar={filtro(setQuem)}
            opcoes={(d?.autores ?? []).map((x) => ({ v: x, l: x }))}
            className="w-[230px]"
          />
        </div>
      </div>
      <Card className="overflow-hidden">
        <CardHead className="flex-wrap">
          <CardTitle>Alterações</CardTitle>
          <Badge tom="blue">
            {ls.length} {ls.length === 1 ? 'registro' : 'registros'}
          </Badge>
          <span className="flex-1" />
          {d && (
            <span className="flex items-center gap-2 text-apagado">
              <Badge tom="blue">Portal</Badge> {d.vivos} {d.vivos === 1 ? 'feita no portal' : 'feitas no portal'} ·{' '}
              <Badge>Base</Badge> vindas da base
            </span>
          )}
        </CardHead>
        <Table>
          <THead>
            <Tr>
              <Th>Quando</Th>
              <Th>Quem</Th>
              <Th>Entidade</Th>
              <Th>O que mudou</Th>
              <Th>Registro</Th>
              <Th>Detalhe</Th>
            </Tr>
          </THead>
          <TBody>
            {fatia.length ? (
              fatia.map((x, i) => (
                <Tr
                  key={`${x.quando}-${i}`}
                  onClick={() => x.href && router.push(x.href)}
                  className={x.href ? 'cursor-pointer transition-colors hover:bg-hover' : undefined}
                >
                  <Td className="font-medium whitespace-nowrap text-texto">{x.quando}</Td>
                  <Td className="whitespace-nowrap">{x.quem}</Td>
                  <Td>
                    <Badge tom={x.vivo ? 'blue' : 'gray'}>{x.ent}</Badge>
                  </Td>
                  <Td className="font-semibold text-texto">{x.acao}</Td>
                  <Td>
                    {x.href ? (
                      <Link href={x.href} onClick={(e) => e.stopPropagation()} className="text-azul hover:underline">
                        {x.reg}
                      </Link>
                    ) : (
                      x.reg
                    )}
                  </Td>
                  <Td className="min-w-[200px]">{x.det || <span className="text-apagado">—</span>}</Td>
                </Tr>
              ))
            ) : (
              <Tr>
                <Td colSpan={6} className="py-10 text-center text-apagado-2">
                  {q.isPending ? 'Carregando…' : 'nenhum registro neste filtro'}
                </Td>
              </Tr>
            )}
          </TBody>
        </Table>
        {rodape}
      </Card>
    </>
  );
}
