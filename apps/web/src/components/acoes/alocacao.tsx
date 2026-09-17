'use client';

import { SearchIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Chips } from '@/components/alunos/abas-aluno';
import { Aviso, PageHead } from '@/components/ds';
import { Escolha } from '@/components/escolha';
import { usePaginacao } from '@/components/paginacao';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TBody, Td, THead, Th, Tr } from '@/components/ui/table';
import { useAlocacao } from '@/lib/acoes';

export const normaliza = (s: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

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

/** Pedagógico › Alocação: pendências da grade, lidas na hora — o que se resolve na ficha some daqui */
export function TelaAlocacao({ abas }: { abas: React.ReactNode }) {
  const q = useAlocacao();
  const router = useRouter();
  const [tipo, setTipo] = useState('');
  const [curso, setCurso] = useState('');
  const [busca, setBusca] = useState('');
  const d = q.data;
  const doCurso = (d?.itens ?? []).filter((x) => !curso || x.curso.split(', ').includes(curso));
  const lista = useMemo(
    () =>
      doCurso.filter(
        (x) =>
          (!tipo || x.tipo === tipo) &&
          (!busca || normaliza([x.quem, x.oque, x.det, x.curso].join(' ')).includes(normaliza(busca))),
      ),
    [doCurso, tipo, busca],
  );
  const { fatia, rodape, setPag } = usePaginacao(lista);
  const tipoDe = (k: string) => d?.tipos.find((t) => t.k === k);

  return (
    <>
      <PageHead titulo="Alocação" />
      {abas}
      {q.isError && (
        <Aviso tom="red" icone="alerta">
          {q.error.message}
        </Aviso>
      )}
      {tipo && <p className="mb-3 text-apagado">{tipoDe(tipo)?.d}</p>}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Chips
          rotulo="Tipo de pendência"
          valor={tipo}
          aoMudar={(v) => {
            setTipo(v);
            setPag(1);
          }}
          opcoes={[
            { k: '', l: 'Todas', n: doCurso.length },
            ...(d?.tipos ?? []).map((t) => ({ k: t.k, l: t.t, n: doCurso.filter((x) => x.tipo === t.k).length })),
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Busca
            rotulo="Buscar aluno, professor ou curso"
            valor={busca}
            aoMudar={(v) => {
              setBusca(v);
              setPag(1);
            }}
          />
          <Escolha
            rotulo="Curso"
            todos="Todos os cursos"
            valor={curso}
            aoMudar={(v) => {
              setCurso(v);
              setPag(1);
            }}
            opcoes={(d?.cursos ?? []).map((c) => ({ v: c, l: c }))}
            className="w-[220px]"
          />
        </div>
      </div>
      <Card className="overflow-hidden">
        <Table>
          <THead>
            <Tr>
              <Th>Pendência</Th>
              <Th>Quem</Th>
              <Th>Curso · módulo ou turma</Th>
              <Th>Dias e horário</Th>
              <Th>Detalhe</Th>
              <Th>
                <span className="sr-only">Resolver</span>
              </Th>
            </Tr>
          </THead>
          <TBody>
            {fatia.length ? (
              fatia.map((x, i) => {
                const t = tipoDe(x.tipo);
                return (
                  <Tr
                    key={`${x.tipo}-${x.quem}-${i}`}
                    onClick={() => router.push(x.href)}
                    className="cursor-pointer transition-colors hover:bg-hover"
                  >
                    <Td>{t && <Badge tom={t.tom}>{t.t}</Badge>}</Td>
                    <Td className="font-medium text-texto">{x.quem}</Td>
                    <Td>{x.oque}</Td>
                    <Td>{x.quando}</Td>
                    <Td>{x.det}</Td>
                    <Td className="text-right">
                      <Link
                        href={x.href}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium whitespace-nowrap text-azul hover:underline"
                      >
                        {x.rotIr}
                      </Link>
                    </Td>
                  </Tr>
                );
              })
            ) : (
              <Tr>
                <Td colSpan={6} className="py-10 text-center text-apagado-2">
                  {q.isPending ? 'Carregando…' : 'nenhuma pendência de alocação neste filtro'}
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
