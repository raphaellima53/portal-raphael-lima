'use client';

import { useParams } from 'next/navigation';
import { FormUsuario } from '@/components/config/usuario-form';
import { useMe } from '@/lib/consultas';
import { SemAcesso } from '../page';

/** Configurações › Usuários › Novo usuário (/configuracoes/usuarios/novo) e Editar usuário (/configuracoes/usuarios/:id) */
export default function UsuarioPage() {
  const { tela, id } = useParams<{ tela: string; id: string }>();
  const me = useMe();
  if (!me.data) return null;
  const pode = me.data.chaves.includes('cfg');
  if (tela !== 'usuarios' || !pode || (id !== 'novo' && !/^\d+$/.test(id)))
    return <SemAcesso nome={me.data.usuario.nome} />;
  return <FormUsuario key={id} id={id === 'novo' ? null : Number(id)} />;
}
