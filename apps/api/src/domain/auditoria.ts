/**
 * Auditoria: o que se muda no portal (LogAlteracao de origem portal) junto com o histórico da base (origem base).
 * Porte de audLinhas (auditoria.src.js).
 */
import { fmt } from '../lib/fmt.ts';
import type { Base } from './base.ts';
import { hrefAluno, hrefProf } from './rotas.ts';

const AUD_ACAO: Record<string, string> = {
  create: 'criação',
  update: 'alteração',
  import: 'importação',
  cancel: 'cancelamento',
  delete: 'exclusão',
};

export type LogLinha = {
  quando: Date;
  autor: string;
  entidade: string;
  entidadeId: string | null;
  nome: string;
  acao: string;
  detalhe: string | null;
  vezes: number;
  origem: string;
};

export function audLinhas(b: Base, logs: LogLinha[], empresas: Set<string>) {
  return [...logs]
    .sort((x, y) => +y.quando - +x.quando)
    .map((x) => {
      const vivo = x.origem !== 'base';
      if (!vivo)
        return {
          quando: fmt.dataHora(x.quando, true),
          quem: x.autor,
          ent: x.entidade,
          acao: AUD_ACAO[x.acao] ?? x.acao,
          reg: x.nome,
          href: null as string | null,
          det: x.detalhe ?? '',
          vivo,
        };
      const aluno = x.entidade === 'Aluno' ? b.alunos.find((a) => String(a.id) === x.entidadeId) : undefined;
      const prof = x.entidade === 'Professor' ? b.professores.find((t) => t.id === x.entidadeId) : undefined;
      const href = aluno
        ? hrefAluno(aluno.id, 'log')
        : prof
          ? hrefProf(prof.id, 'log')
          : x.entidade === 'Aula' && x.entidadeId
            ? `/agenda/aula?k=${encodeURIComponent(x.entidadeId)}`
            : x.entidade === 'Empresa' && x.entidadeId && empresas.has(x.entidadeId)
              ? `/empresas/${x.entidadeId}/historico`
              : null;
      return {
        quando: fmt.dataHora(x.quando, true),
        quem: x.autor,
        ent: x.entidade,
        acao: x.acao + (x.vezes > 1 ? ` · ${x.vezes} cliques` : ''),
        reg: aluno?.name ?? prof?.name ?? (x.nome || 'registro excluído'),
        href,
        det: x.detalhe ?? '',
        vivo,
      };
    });
}
