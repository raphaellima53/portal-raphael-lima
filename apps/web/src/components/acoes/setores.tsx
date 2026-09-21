'use client';

import { ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import { PageHead } from '@/components/ds';
import { Card, CardHead, CardTitle } from '@/components/ui/card';
import type { ItemNav } from '@/lib/tipos';

/* o que cada setor cuida (AREAS do banco); Relatórios reúne os relatórios de todos */
const DESC: Record<string, string> = {
  Administrativo: 'Gestão administrativa e suporte à operação',
  Comercial: 'Captação, negociação e vendas',
  Pedagógico: 'Gestão de professores e qualidade pedagógica',
  Acadêmico: 'Gestão de alunos, cursos e operação acadêmica',
  CX: 'Experiência e relacionamento com o aluno',
  'Financeiro/Fiscal': 'Gestão financeira, faturamento, pagamentos e obrigações fiscais',
  Marketing: 'Aquisição, comunicação, marca e performance de marketing',
  Relatórios: 'Relatórios por seletores, de alunos, professores e cursos',
};

/**
 * Atividades (Cartões, pirâmide de Operação de 21/09/2026): um cartão por setor que a pessoa vê,
 * com as atividades daquele setor. O cartão leva à tela; as abas continuam para quem já sabe onde ir.
 */
export function TelaSetores({ item, abas }: { item: ItemNav; abas: React.ReactNode }) {
  const setores = (item.secoes ?? []).filter((s) => s.etapa !== 'Setores');
  return (
    <>
      <PageHead titulo="Atividades" />
      {abas}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {setores.map((s) => (
          <Card key={s.etapa} className="flex min-w-0 flex-col">
            <CardHead className="flex-col items-start gap-1">
              <CardTitle>
                <Link href={s.telas[0].href} className="hover:text-azul hover:underline">
                  {s.etapa}
                </Link>
              </CardTitle>
              {DESC[s.etapa] && <span className="text-apagado">{DESC[s.etapa]}</span>}
            </CardHead>
            <ul className="m-0 grid list-none gap-0.5 p-2">
              {s.telas.map((t) => (
                <li key={t.id}>
                  <Link
                    href={t.href}
                    className="flex min-h-11 items-center justify-between gap-3 rounded-md px-3 text-texto transition-colors hover:bg-hover hover:text-azul"
                  >
                    <span>
                      {t.pai && <span className="text-apagado">{t.pai} › </span>}
                      {t.label}
                    </span>
                    <ChevronRightIcon className="size-4 shrink-0 text-apagado" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}
