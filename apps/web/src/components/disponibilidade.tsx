'use client';

import { cn } from '@/lib/utils';

export type GradeDisp = {
  dias: { k: string; rotulo: string }[];
  linhas: {
    k: string;
    rotulo: string;
    celulas: { k: string; estado: 'aula' | 'conflito' | 'livre' | 'fechada'; texto: string; rotulo: string }[];
  }[];
};

const ESTADO = {
  livre: { cls: 'bg-azul-suave text-azul shadow-[inset_0_0_0_1.5px_#9db8f5]', txt: 'disponível' },
  aula: { cls: 'bg-verde-suave font-semibold text-verde', txt: 'com aula, dentro da disponibilidade' },
  conflito: { cls: 'bg-vermelho-suave font-semibold text-vermelho', txt: 'com aula, fora da disponibilidade' },
  fechada: { cls: 'bg-[#f3f5f9] text-apagado dark:bg-hover', txt: 'indisponível' },
} as const;

/**
 * Grade de disponibilidade dia × hora (dispGrade): clique numa hora marca ou desmarca; no dia ou na hora do
 * cabeçalho, a coluna ou a linha inteira. Serve para aluno e professor.
 */
export function GradeDisponibilidade({
  g,
  troca,
  ocupado,
  soLeitura,
}: {
  g: GradeDisp;
  troca: (k: string) => void;
  ocupado?: boolean;
  soLeitura?: boolean;
}) {
  const bloqueado = soLeitura || ocupado;
  return (
    <div className="px-5 pb-5">
      <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-2 text-texto-2" aria-label="Cores da grade">
        {(['livre', 'aula', 'conflito', 'fechada'] as const).map((k) => (
          <li key={k} className="flex items-center gap-2">
            <i className={cn('inline-block size-4 rounded-[5px]', ESTADO[k].cls)} aria-hidden />
            {ESTADO[k].txt}
          </li>
        ))}
      </ul>
      <div className="relative overflow-x-auto">
        <table
          className="w-full min-w-[640px] table-fixed border-separate border-spacing-1 text-sm"
          aria-busy={ocupado}
        >
          <colgroup>
            <col className="w-16" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="w-16">
                <span className="sr-only">Hora</span>
              </th>
              {g.dias.map((d) => (
                <th key={d.k} scope="col" className="font-semibold text-texto-2">
                  <button
                    type="button"
                    disabled={bloqueado}
                    onClick={() => troca(d.k)}
                    aria-label={`Marcar ou desmarcar ${d.rotulo} inteira`}
                    className="h-9 w-full cursor-pointer rounded-md hover:bg-hover disabled:cursor-default disabled:hover:bg-transparent"
                  >
                    {d.rotulo}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {g.linhas.map((l) => (
              <tr key={l.k}>
                <th scope="row" className="font-medium whitespace-nowrap text-apagado">
                  <button
                    type="button"
                    disabled={bloqueado}
                    onClick={() => troca(l.k)}
                    aria-label={`Marcar ou desmarcar ${l.rotulo} em todos os dias`}
                    className="h-9 w-full cursor-pointer rounded-md px-1 hover:bg-hover disabled:cursor-default disabled:hover:bg-transparent"
                  >
                    {l.rotulo}
                  </button>
                </th>
                {l.celulas.map((c) => (
                  <td key={c.k} className="p-0">
                    <button
                      type="button"
                      disabled={bloqueado}
                      onClick={() => troca(c.k)}
                      aria-label={`${c.rotulo}: ${ESTADO[c.estado].txt}${c.texto ? ` · ${c.texto}` : ''}`}
                      aria-pressed={c.estado === 'livre' || c.estado === 'aula'}
                      className={cn(
                        'h-9 w-full cursor-pointer truncate rounded-md px-1.5 transition-shadow hover:shadow-el-2 disabled:cursor-default disabled:hover:shadow-none',
                        ESTADO[c.estado].cls,
                      )}
                    >
                      {c.texto}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
