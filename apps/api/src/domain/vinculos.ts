/**
 * Um ID de usuário, vários perfis (21/09/2026): o mesmo usuário pode estar vinculado a um aluno,
 * a um professor (prestador) e a um colaborador. As fichas mostram o ID e os vínculos com link.
 * Vínculos: aluno pelo alunoId do usuário; professor pela agenda presa ou pelo e-mail; colaborador
 * pelo campo "Vincular a colaborador" do usuário ou pelo e-mail.
 */
import { prisma } from '../db.ts';
import { PERFIS, perfilNome } from './acesso.ts';
import type { Base } from './base.ts';

export type Papel = { tipo: 'Aluno' | 'Professor' | 'Colaborador'; nome: string; href: string | null; atual: boolean };
export type Vinculos = {
  usuario: { id: number; codigo: string; email: string; perfil: string; status: string } | null;
  papeis: Papel[];
};

/** ID de usuário como aparece nas telas: 5 dígitos, #00142 */
export const codigoUsuario = (id: number) => `#${String(id).padStart(5, '0')}`;

type De = { alunoId: number } | { profId: string };

export async function vinculosDe(b: Base, de: De): Promise<Vinculos> {
  const prof = 'profId' in de ? b.professores.find((t) => t.id === de.profId) : undefined;
  const aluno = 'alunoId' in de ? b.alunos.find((a) => a.id === de.alunoId) : undefined;
  const u =
    'alunoId' in de
      ? await prisma.usuario.findFirst({ where: { alunoId: de.alunoId } })
      : prof
        ? await prisma.usuario.findFirst({
            where: {
              OR: [{ agendaPresa: { path: ['prof'], equals: prof.name } }, { email: prof.email.toLowerCase() }],
            },
            orderBy: { id: 'asc' },
          })
        : null;

  const papeis: Papel[] = [];
  const alunoDoU = u?.alunoId != null ? b.alunos.find((a) => a.id === u.alunoId) : aluno;
  if (alunoDoU)
    papeis.push({
      tipo: 'Aluno',
      nome: alunoDoU.name,
      href: `/alunos/${alunoDoU.id}/perfil`,
      atual: 'alunoId' in de && alunoDoU.id === de.alunoId,
    });
  const presa = (u?.agendaPresa as { prof?: string } | null)?.prof;
  const profDoU = u
    ? b.professores.find((t) => t.name === presa || t.email.toLowerCase() === u.email.toLowerCase())
    : prof;
  if (profDoU)
    papeis.push({
      tipo: 'Professor',
      nome: profDoU.name,
      href: `/professores/${profDoU.id}/perfil`,
      atual: 'profId' in de && profDoU.id === de.profId,
    });
  if (u) {
    const colab = await prisma.colaborador.findFirst({
      where: { OR: [...(u.colaborador ? [{ nome: u.colaborador }] : []), { email: u.email.toLowerCase() }] },
    });
    if (colab) papeis.push({ tipo: 'Colaborador', nome: colab.nome, href: '/equipe', atual: false });
  }
  return {
    usuario: u
      ? {
          id: u.id,
          codigo: codigoUsuario(u.id),
          email: u.email,
          perfil: perfilNome(PERFIS.find((p) => p.id === u.perfilId)),
          status: u.status,
        }
      : null,
    papeis,
  };
}
