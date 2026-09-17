'use client';

import { PlusIcon, SearchIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Aviso, PageHead } from '@/components/ds';
import { Escolha } from '@/components/escolha';
import { usePaginacao } from '@/components/paginacao';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TBody, Td, THead, Th, Tr } from '@/components/ui/table';
import { ErroApi } from '@/lib/api';
import { useEmpresas } from '@/lib/empresas';
import { EmpresaFormDialog } from './empresa-form';

const norm = (s: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

/** Empresas: contas B2B e B2B2C, das que vencem antes. O Gerente B2B abre já em Minhas contas. */
export function ListaEmpresas() {
  const q = useEmpresas();
  const router = useRouter();
  const [busca, setBusca] = useState('');
  const [modelo, setModelo] = useState('');
  const [sit, setSit] = useState('');
  const [ger, setGer] = useState<string | null>(null);
  const [nova, setNova] = useState<{ form: null } | null>(null);

  useEffect(() => {
    document.title = 'Empresas · Portal Raphael Lima';
  }, []);
  /* o Gerente B2B entra filtrado nas próprias contas */
  useEffect(() => {
    if (q.data && ger == null) setGer(q.data.eu);
  }, [q.data, ger]);

  const todas = q.data?.empresas ?? [];
  const g = ger ?? '';
  const lista = useMemo(
    () =>
      todas.filter(
        (e) =>
          (!modelo || e.modelo === modelo) &&
          (!sit || e.sit === sit) &&
          (!g || e.gerente === g) &&
          (!busca || norm(`${e.nome} ${e.cnpj} ${e.segmento}`).includes(norm(busca))),
      ),
    [todas, modelo, sit, g, busca],
  );
  const renov = todas.filter((e) => (!g || e.gerente === g) && e.sit === 'Renovação');
  const { fatia, rodape, setPag } = usePaginacao(lista);
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
      <PageHead
        titulo="Empresas"
        acoes={
          q.data?.podeGerir ? (
            <Button variant="primary" onClick={() => setNova({ form: null })}>
              <PlusIcon /> Nova empresa
            </Button>
          ) : null
        }
      />
      {q.isError && (
        <Aviso tom="red" icone="alerta">
          {q.error.message}
        </Aviso>
      )}
      {renov.length > 0 && sit !== 'Renovação' && (
        <Aviso icone="info">
          <div className="flex flex-wrap items-center gap-3">
            <span className="min-w-0 flex-1">
              <b>
                {renov.length} {renov.length === 1 ? 'contrato vence' : 'contratos vencem'} em até 60 dias:
              </b>{' '}
              {renov.map((e) => e.nome).join(', ')}.
            </span>
            <Button size="sm" onClick={() => filtro(setSit)('Renovação')}>
              Ver renovações
            </Button>
          </div>
        </Aviso>
      )}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-[320px]">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-apagado" />
          <Input
            type="search"
            aria-label="Buscar empresa"
            placeholder="Buscar empresa, CNPJ ou segmento…"
            className="pl-9"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPag(1);
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Escolha
            rotulo="Modelo"
            todos="Todos os modelos"
            valor={modelo}
            aoMudar={filtro(setModelo)}
            opcoes={['B2B', 'B2B2C'].map((x) => ({ v: x, l: x }))}
            className="w-[180px]"
          />
          <Escolha
            rotulo="Situação"
            todos="Todas as situações"
            valor={sit}
            aoMudar={filtro(setSit)}
            opcoes={['Ativo', 'Renovação', 'Encerrado'].map((x) => ({ v: x, l: x }))}
            className="w-[190px]"
          />
          <Escolha
            rotulo="Gerente da conta"
            todos="Todos os gerentes"
            valor={g}
            aoMudar={filtro((v) => setGer(v))}
            opcoes={(q.data?.gerentes ?? []).map((n) => ({ v: n, l: n === q.data?.eu ? 'Minhas contas' : n }))}
            className="w-[230px]"
          />
        </div>
      </div>
      <Card className="overflow-hidden">
        <Table>
          <THead>
            <Tr>
              <Th>Empresa</Th>
              <Th>Gerente da conta</Th>
              <Th className="text-right">Licenças</Th>
              <Th className="text-right">Aulas consumidas</Th>
              <Th className="text-right">Presença</Th>
              <Th>Contrato até</Th>
              <Th>Alertas</Th>
            </Tr>
          </THead>
          <TBody>
            {fatia.length ? (
              fatia.map((e) => (
                <Tr
                  key={e.id}
                  onClick={() => router.push(`/empresas/${e.id}/geral`)}
                  className="cursor-pointer transition-colors hover:bg-hover"
                >
                  <Td className="min-w-[250px]">
                    <Link
                      href={`/empresas/${e.id}/geral`}
                      onClick={(x) => x.stopPropagation()}
                      className="font-semibold whitespace-nowrap text-azul hover:underline"
                    >
                      {e.nome}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge tom={e.modelo === 'B2B' ? 'blue' : 'purple'}>{e.modelo}</Badge>
                      {e.turmaDedicada && <Badge>turma dedicada</Badge>}
                      <span className="text-apagado">{e.segmento}</span>
                    </div>
                  </Td>
                  <Td>{e.gerente}</Td>
                  <Td className="text-right whitespace-nowrap tabular-nums">{e.licencas}</Td>
                  <Td className="text-right whitespace-nowrap tabular-nums">{e.consumo}</Td>
                  <Td className="text-right tabular-nums">{e.presenca}</Td>
                  <Td>
                    <Badge tom={e.sitTom}>{e.fim}</Badge>
                  </Td>
                  <Td>
                    {e.alertas.length ? (
                      <div className="flex min-w-[220px] flex-wrap gap-1.5">
                        {e.alertas.map((a) => (
                          <Badge key={a.t} tom={a.tom} className="h-auto min-h-[26px] py-1 whitespace-normal">
                            {a.t}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-apagado">—</span>
                    )}
                  </Td>
                </Tr>
              ))
            ) : (
              <Tr>
                <Td colSpan={7} className="py-10 text-center text-apagado-2">
                  {q.isPending ? 'Carregando…' : 'nenhuma empresa neste filtro'}
                </Td>
              </Tr>
            )}
          </TBody>
        </Table>
        {rodape}
      </Card>
      <EmpresaFormDialog
        abre={nova}
        eu={q.data?.eu ?? ''}
        aoFechar={() => setNova(null)}
        aoSalvo={(r) => r.id && router.push(`/empresas/${r.id}/alunos?msg=${encodeURIComponent(r.msg)}`)}
      />
    </>
  );
}
