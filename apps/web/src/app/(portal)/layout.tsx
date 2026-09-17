import type * as React from 'react';
import { Shell } from '@/components/shell/shell';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}
