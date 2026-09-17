import Link from 'next/link';
import { cn } from '@/lib/utils';

/** alumni BY BETTER, com o traço vermelho embaixo */
export function Logo({ mini, escuro = true, href = '/inicio' }: { mini?: boolean; escuro?: boolean; href?: string }) {
  return (
    <Link
      href={href}
      aria-label="Alumni — ir para o início"
      className={cn(
        'relative inline-block pb-[5px] text-[26px] leading-none font-extrabold tracking-[-1px] hover:opacity-90',
        escuro ? 'text-white' : 'text-texto',
      )}
    >
      {mini ? 'a' : 'alumni'}
      {!mini && (
        <small className="ml-1.5 align-baseline text-sm font-semibold tracking-[.2px] opacity-75">BY BETTER</small>
      )}
      <i className={cn('absolute bottom-0 left-0 h-[3px] rounded-[2px] bg-[#e02b3b]', mini ? 'w-4' : 'w-[74px]')} />
    </Link>
  );
}
