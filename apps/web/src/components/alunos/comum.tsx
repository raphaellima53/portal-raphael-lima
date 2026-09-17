'use client';

import { Badge } from '@/components/ui/badge';
import type { Item } from '@/lib/alunos';

/** módulo ou turma pintado pela cor dele; sem cor válida cai no neutro (alBadge) */
export function ItemBadge({ item }: { item: Item }) {
  if (!item) return <span className="text-apagado">—</span>;
  return /^#[0-9a-f]{6}$/i.test(item.cor) ? (
    <span
      className="inline-flex h-[26px] items-center rounded-full px-2.5 text-sm leading-none font-semibold whitespace-nowrap"
      style={{ background: `${item.cor}1f`, color: item.cor }}
    >
      {item.nome}
    </span>
  ) : (
    <Badge>{item.nome}</Badge>
  );
}

export const Modalidade = ({ m }: { m: string }) => (
  <Badge tom={m === 'Presencial' ? 'purple' : 'gray'}>{m || 'Online'}</Badge>
);

/** mensagem de uma ação: aparece no topo da tela depois de salvar */
export type Msg = { txt: string; erro?: boolean } | null;
