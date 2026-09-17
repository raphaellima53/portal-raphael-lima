/** Pessoa com o acesso resolvido a partir do login de uma persona (para as conferências) */
import { prisma } from '../src/db.ts';
import { type Areas, PERFIS, type TipoPerfil } from '../src/domain/acesso.ts';

export async function usuarioDeTeste(login: string) {
  const u = await prisma.usuario.findUniqueOrThrow({ where: { email: login } });
  const tipoPerfil = (PERFIS.find((x) => x.id === u.perfilId)?.perfil ?? null) as TipoPerfil | null;
  return {
    nivel: u.nivel,
    areas: u.areas as Areas,
    tipoPerfil,
    ehAluno: tipoPerfil === 'Aluno',
    agendaPresa: (u.agendaPresa as Record<string, string> | null) ?? null,
  };
}
