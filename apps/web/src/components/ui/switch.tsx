'use client';

import { Switch as SwitchPrimitive } from 'radix-ui';
import type * as React from 'react';
import { cn } from '@/lib/utils';

/** toggle do DS */
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer inline-flex h-[26px] w-[44px] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-borda-forte transition-colors focus-visible:outline-2 focus-visible:outline-azul focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-azul',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-[22px] rounded-full bg-white shadow-el-1 transition-transform data-[state=checked]:translate-x-[18px] data-[state=unchecked]:translate-x-0" />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
