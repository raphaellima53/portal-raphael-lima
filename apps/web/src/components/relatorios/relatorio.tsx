'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Segmento } from '@/components/alunos/abas-aluno';
import { Aviso, PageHead } from '@/components/ds';
import { Escolha } from '@/components/escolha';
import { baixaCsv, useRelatorio } from '@/lib/relatorios';
import { Barra, BotaoCsv, Recorte, Resumo, TabelaRel } from './comum';

/** Alunos, Professores e Cursos: um relatório por tela, com curso, período, qualidade e CSV das mesmas linhas */
export function TelaRelatorio({ tela, titulo, abas }: { tela: string; titulo: string; abas: React.ReactNode }) {
  const sp = useSearchParams();
  const caminho = usePathname();
  const router = useRouter();
  const p = {
    dias: sp.get('dias') ?? '',
    curso: sp.get('curso') ?? '',
    grupo: sp.get('grupo') ?? '',
    qual: sp.get('qual') ?? '',
  };
  const q = useRelatorio(tela, p);
  const d = q.data;
  const muda = (k: keyof typeof p, v: string) => {
    const n = new URLSearchParams(sp.toString());
    if (v) n.set(k, v);
    else n.delete(k);
    router.replace(`${caminho}${n.size ? `?${n}` : ''}`, { scroll: false });
  };

  return (
    <>
      <PageHead
        titulo={d?.t ?? titulo}
        acoes={
          <BotaoCsv
            disabled={!d}
            aoClicar={() =>
              d &&
              baixaCsv(
                d.arquivo,
                d.cols,
                d.linhas.map((l) => l.v),
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
            <Escolha
              rotulo="Curso"
              todos="todos os cursos"
              valor={d.filtro.curso}
              aoMudar={(v) => muda('curso', v)}
              opcoes={d.cursos.map((c) => ({ v: c, l: c }))}
              className="w-[230px]"
            />
            {d.periodo && (
              <Escolha
                rotulo="Período"
                destacar={false}
                valor={String(d.filtro.dias)}
                aoMudar={(v) => muda('dias', v === '30' ? '' : v)}
                opcoes={d.periodos}
                className="w-[190px]"
              />
            )}
            {d.agrupa && (
              <Segmento
                rotulo="Agrupar"
                valor={d.filtro.grupo}
                aoMudar={(v) => muda('grupo', v === 'curso' ? '' : v)}
                opcoes={[
                  ['curso', 'por curso'],
                  ['item', 'por módulo ou turma'],
                ]}
              />
            )}
            <Escolha
              rotulo="Qualidade"
              todos="qualidade: todos"
              valor={d.filtro.qual}
              aoMudar={(v) => muda('qual', v)}
              opcoes={d.qualidade}
              className="w-[270px]"
            />
            <Recorte>{d.recorte}</Recorte>
          </Barra>
          <Resumo itens={d.resumo} />
          <TabelaRel
            key={JSON.stringify(d.filtro)}
            rotulo={d.t}
            cols={d.cols}
            linhas={d.linhas}
            vazio={d.filtro.qual ? 'nada neste recorte com esse filtro de qualidade' : 'nada neste recorte'}
          />
        </>
      )}
    </>
  );
}
