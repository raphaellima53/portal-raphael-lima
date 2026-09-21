/**
 * A gestão de acessos mora dentro de cada pessoa (21/09/2026): a aba Acesso das fichas do aluno e do professor
 * e o cadastro do colaborador mostram a conta de acesso, as sessões ativas e o histórico daquela pessoa,
 * com os atalhos para criar ou editar o acesso. Só o Admin vê (a mesma regra de Configurações).
 */
import { prisma } from '../db.ts';
import { fmt } from '../lib/fmt.ts';
import { type Areas, acessoResumo, NIVEIS, PERFIS, perfilNome } from './acesso.ts';
import type { Base } from './base.ts';
import { dispositivo, ipCurto, USU_STATUS } from './configuracoes.ts';
import { codigoUsuario } from './vinculos.ts';

export type DeQuem = { alunoId: number } | { profId: string } | { colabId: number };

const relativo = (d: Date, agora = new Date()) => {
  const min = Math.max(0, Math.round((+agora - +d) / 6e4));
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  return fmt.dataHora(d);
};
const TOM: Record<string, string> = { sucesso: 'green', recusado: 'red', executado: 'amber', encerrada: 'gray' };

export async function acessoDaPessoa(b: Base, de: DeQuem, eu: { id: number; sessaoId: string }) {
  /* a pessoa do cadastro */
  let pessoa: { tipo: 'Aluno' | 'Professor' | 'Colaborador'; nome: string; email: string } | null = null;
  if ('alunoId' in de) {
    const a = b.alunos.find((x) => x.id === de.alunoId);
    if (a) pessoa = { tipo: 'Aluno', nome: a.name, email: a.email };
  } else if ('profId' in de) {
    const t = b.professores.find((x) => x.id === de.profId);
    if (t) pessoa = { tipo: 'Professor', nome: t.name, email: t.email };
  } else {
    const c = await prisma.colaborador.findUnique({ where: { id: de.colabId } });
    if (c) pessoa = { tipo: 'Colaborador', nome: c.nome, email: c.email };
  }
  if (!pessoa) return null;

  /* a conta de acesso vinculada (o mesmo critério dos vínculos da ficha) */
  const email = pessoa.email.toLowerCase();
  const u =
    'alunoId' in de
      ? await prisma.usuario.findFirst({ where: { alunoId: de.alunoId } })
      : 'profId' in de
        ? await prisma.usuario.findFirst({
            where: { OR: [{ agendaPresa: { path: ['prof'], equals: pessoa.nome } }, { email }] },
            orderBy: { id: 'asc' },
          })
        : await prisma.usuario.findFirst({
            where: { OR: [{ colaborador: pessoa.nome }, { email }] },
            orderBy: { id: 'asc' },
          });

  /* sem conta: o atalho abre o Novo usuário já com a pessoa e o vínculo */
  const q = new URLSearchParams({ pessoa: pessoa.nome, email: pessoa.email });
  if ('alunoId' in de) q.set('aluno', String(de.alunoId));
  if ('profId' in de) q.set('professor', pessoa.nome);
  if ('colabId' in de) q.set('colaborador', pessoa.nome);
  if (!u) return { pessoa, usuario: null, sessoes: [], historico: [], criar: `/configuracoes/usuarios/novo?${q}` };

  const [ss, hist] = await Promise.all([
    prisma.sessao.findMany({
      where: { usuarioId: u.id, encerradaEm: null, expiraEm: { gt: new Date() } },
      orderBy: { vistaEm: 'desc' },
    }),
    prisma.acessoLog.findMany({ where: { quem: u.nome }, orderBy: [{ quando: 'desc' }, { id: 'desc' }], take: 50 }),
  ]);
  const p = PERFIS.find((x) => x.id === u.perfilId) ?? null;
  const ultimoOk = hist.find((h) => h.evento === 'login' && h.resultado === 'sucesso');
  return {
    pessoa,
    usuario: {
      id: u.id,
      codigo: codigoUsuario(u.id),
      email: u.email,
      perfil: p ? perfilNome(p) : (u.perfilLegado ?? '—'),
      hierarquia: NIVEIS.find((n) => n.n === u.nivel)?.nome ?? '—',
      resumo: p ? acessoResumo({ nivel: u.nivel, areas: u.areas as Areas }, p) : (u.escopoLegado ?? '—'),
      status: u.status,
      statusTom: USU_STATUS[u.status] ?? 'gray',
      mfa: u.mfa,
      ultimo: ultimoOk ? fmt.dataHora(ultimoOk.quando) : (u.ultimoAcesso ?? 'nunca acessou'),
      eu: u.id === eu.id,
    },
    sessoes: ss.map((s) => ({
      id: s.id,
      dispositivo: dispositivo(s.userAgent),
      origem: ipCurto(s.ip),
      ultima: relativo(s.vistaEm),
      estaSessao: s.id === eu.sessaoId,
    })),
    historico: hist.map((h) => ({
      id: h.id,
      quando: fmt.dataHora(h.quando, true),
      evento: h.evento,
      resultado: h.resultado,
      tom: TOM[h.resultado] ?? 'gray',
      detalhe: h.detalhe,
    })),
    criar: null,
  };
}
