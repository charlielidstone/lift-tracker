// DotLoader — the app's standard loading indicator: a dot-matrix animation
// (from the @dotmatrix registry) with optional label text. The dots inherit
// `currentColor`, so the wrapper's text colour drives them. Swap the underlying
// loader by changing the single import below — every loading state updates.

import { cn } from 'cn';
import { DotmSquare3 } from '@/components/ui/dotm-square-3';

export function DotLoader({ label, size = 32, className }) {
  return (
    <div className={cn('flex items-center gap-2.5 text-muted-foreground', className)}>
      <DotmSquare3 size={size} ariaLabel={label || 'Loading'} />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}
