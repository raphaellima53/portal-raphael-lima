import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * Logo alumni by Better (Figma Raphael Figma, Page 3, 21/09/2026): vetor azul-marinho #003080 com a barra vermelha
 * #D70C0C; no menu escuro, a mesma arte com as letras em branco. Minimizado, fica o "a" com a barra.
 */
export function Logo({ mini, escuro = true, href = '/inicio' }: { mini?: boolean; escuro?: boolean; href?: string }) {
  if (mini)
    return (
      <Link
        href={href}
        aria-label="Alumni by Better: ir para o início"
        className={cn(
          'relative inline-block pb-[5px] text-[26px] leading-none font-extrabold tracking-[-1px] hover:opacity-90',
          escuro ? 'text-white' : 'text-[#003080]',
        )}
      >
        a
        <i className="absolute bottom-0 left-0 h-[3px] w-4 rounded-[2px] bg-[#D70C0C]" />
      </Link>
    );
  return (
    <Link href={href} aria-label="Alumni by Better: ir para o início" className="inline-block hover:opacity-90">
      <Image
        unoptimized
        priority
        src={escuro ? '/marca/alumni-branco.svg' : '/marca/alumni-azul.svg'}
        alt="alumni by Better"
        width={110}
        height={48}
        /* no menu lateral o logo tem mais espaço; na barra do celular fica menor */
        className={cn('block w-auto', escuro ? 'h-[54px]' : 'h-10')}
      />
    </Link>
  );
}
