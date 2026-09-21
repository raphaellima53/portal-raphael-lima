'use client';

import Link from 'next/link';
import { Stat, Trilho } from '@/components/ds';
import { Button } from '@/components/ui/button';
import { Card, CardHead, CardTitle } from '@/components/ui/card';
import { Table, TBody, Td, THead, Th, Tr } from '@/components/ui/table';
import { corLegivel } from '@/lib/cor';
import type { MinhaArea } from '@/lib/tipos';

/** A área do aluno (antes a tela Minha área): matrículas, saldo de aulas e as próximas aulas. Mora no Meu perfil. */
export function AreaDoAluno({ d, visaoAluno = false }: { d: MinhaArea; visaoAluno?: boolean }) {
  const q = visaoAluno ? '?visao=aluno' : '';
  return (
    <>
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Stat
          valor={d.matriculas.length}
          rotulo={d.matriculas.length === 1 ? 'matrícula ativa' : 'matrículas ativas'}
        />
        <Stat valor={d.restam} rotulo="aulas restantes" />
        <Stat valor={d.totalProximas} rotulo="aulas nos próximos 14 dias" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {d.matriculas.map((e) => {
          const pct = e.total ? Math.round((e.usadas / e.total) * 100) : 0;
          return (
            <Card key={e.id} className="overflow-hidden">
              <CardHead>
                <CardTitle>{e.curso}</CardTitle>
                <span className="text-apagado">{e.modulo ?? 'sem módulo'}</span>
              </CardHead>
              <div className="grid gap-2.5 px-[18px] py-4">
                <div className="flex justify-between">
                  <span className="text-apagado">Modalidade</span>
                  <b>{e.modalidade}</b>
                </div>
                <div className="flex justify-between">
                  <span className="text-apagado">Aulas usadas</span>
                  <b>
                    {e.usadas} de {e.total}
                  </b>
                </div>
                <Trilho pct={pct} cor={e.cor} rotulo={`${e.curso}: ${pct}% do pacote usado`} />
              </div>
              <div className="border-t border-borda-suave bg-[#fafbfd] px-[18px] py-3 dark:bg-hover">
                <Link href={`/historico-de-aulas${q}`} className="text-azul hover:underline">
                  ver histórico de aulas
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
      <Card className="mt-4 overflow-hidden">
        <CardHead>
          <CardTitle>Próximas aulas</CardTitle>
          <span className="flex-1" />
          <Button asChild size="sm">
            <Link href="/minha-agenda">abrir minha agenda</Link>
          </Button>
        </CardHead>
        <Table>
          <THead>
            <Tr>
              <Th>Quando</Th>
              <Th>Aula</Th>
              <Th>Professor</Th>
              <Th>Sala</Th>
            </Tr>
          </THead>
          <TBody>
            {d.proximas.length ? (
              d.proximas.map((x, i) => (
                <Tr key={i}>
                  <Td>{x.quando}</Td>
                  <Td>
                    <b style={{ color: corLegivel(x.cor) }}>{x.rotulo}</b>
                  </Td>
                  <Td>{x.prof}</Td>
                  <Td>{x.sala}</Td>
                </Tr>
              ))
            ) : (
              <Tr>
                <Td colSpan={4}>Nenhuma aula nos próximos 14 dias.</Td>
              </Tr>
            )}
          </TBody>
        </Table>
      </Card>
    </>
  );
}
