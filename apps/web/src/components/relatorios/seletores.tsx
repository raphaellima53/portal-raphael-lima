'use client';

import { CheckIcon } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Segmento } from '@/components/alunos/abas-aluno';
import { Aviso, PageHead } from '@/components/ds';
import { Escolha } from '@/components/escolha';
import { Card } from '@/components/ui/card';
import { baixaCsv, useSeletores } from '@/lib/relatorios';
import { cn } from '@/lib/utils';
import { useColunas } from '@/stores/relatorios';
import { Barra, BotaoCsv, TabelaRel } from './comum';

/** Relatórios › Seletores: alunos, professores ou cursos, com as colunas que a pessoa escolher */
export function TelaSeletores({ abas }: { abas: React.ReactNode }) {
  const sp = useSearchParams();
  const caminho = usePathname();
  const router = useRouter();
  const p = { pers: sp.get('pers') ?? '', qual: sp.get('qual') ?? '', prod: sp.get('prod') ?? '' };
  const q = useSeletores(p);
  const d = q.data;
  const colunas = useColunas();
  const muda = (novo: Partial<typeof p>) => {
    const n = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(novo)) {
      if (v) n.set(k, v);
      else n.delete(k);
    }
    router.replace(`${caminho}${n.size ? `?${n}` : ''}`, { scroll: false });
  };
  const pers = d?.filtro.pers ?? '';
  const escolhidas = d ? (colunas.por[pers] ?? d.padrao) : [];
  const vis = d ? d.campos.filter((c) => escolhidas.includes(c.k)) : [];

  return (
    <>
      <PageHead
        titulo="Relatório por seletores"
        acoes={
          <BotaoCsv
            disabled={!d}
            aoClicar={() =>
              baixaCsv(
                `relatorio-${pers}`,
                vis,
                (d?.linhas ?? []).map((l) => l.v),
              )
            }
          />
        }
      />
      {abas}
      {q.isError && (
        <Aviso tom="red" icone="alerta">
          {q.error.message}
        </Aviso>
      )}
      {d && (
        <>
          <Barra>
            {d.perspectivas.length > 1 && (
              <Segmento
                rotulo="Perspectiva"
                valor={pers}
                aoMudar={(v) => muda({ pers: v, qual: '', prod: '' })}
                opcoes={d.perspectivas.map((x) => [x.v, x.l])}
              />
            )}
            <span className="flex-1" />
            <Escolha
              rotulo={`Qualidade nos últimos ${d.dias} dias`}
              todos="qualidade: todos"
              valor={d.filtro.qual}
              aoMudar={(v) => muda({ qual: v })}
              opcoes={d.qualidade}
              className="w-[270px]"
            />
            {d.produtos && (
              <Escolha
                rotulo="Produto"
                todos="todos os produtos"
                valor={d.filtro.prod}
                aoMudar={(v) => muda({ prod: v })}
                opcoes={d.produtos.map((x) => ({ v: x, l: x }))}
                className="w-[230px]"
              />
            )}
          </Barra>
          <Card className="mb-4 px-5 py-4">
            <h2 id="rel-campos" className="mb-2.5 text-apagado">
              Informações no relatório — clique para incluir ou tirar
            </h2>
            <div role="group" aria-labelledby="rel-campos" className="flex flex-wrap gap-2">
              {d.campos.map((c) => {
                const on = escolhidas.includes(c.k);
                const ultima = on && escolhidas.length === 1;
                return (
                  <button
                    key={c.k}
                    type="button"
                    aria-pressed={on}
                    aria-disabled={ultima}
                    onClick={() => !ultima && colunas.alterna(pers, d.padrao, c.k)}
                    className={cn(
                      'inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-[#eceff5] px-3.5 text-[#4b5568] transition-shadow hover:bg-card hover:shadow-el-2 dark:bg-hover dark:text-texto-2',
                      on && 'bg-azul-suave font-semibold text-azul shadow-[inset_0_0_0_1px_#cfdcfa]',
                      ultima && 'cursor-not-allowed',
                    )}
                  >
                    {on && <CheckIcon className="size-4" aria-hidden />}
                    {c.t}
                  </button>
                );
              })}
            </div>
          </Card>
          <TabelaRel
            key={JSON.stringify(d.filtro)}
            rotulo={`Relatório de ${d.perspectivas.find((x) => x.v === pers)?.l.toLowerCase() ?? ''}`}
            cols={vis}
            linhas={d.linhas}
            vazio="nada com esse filtro"
          />
        </>
      )}
    </>
  );
}
