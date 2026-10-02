// ExerciseThumb — square illustration for an exercise, or a dumbbell placeholder
// when we have no image. White line-art reads on the card's dark surface.

import { useState } from 'react';
import { Dumbbell } from 'lucide-react';
import { cn } from 'cn';
import { exerciseImageUrl } from '@/lib/exerciseImages';

export function ExerciseThumb({ name, size = 'md', className }) {
  const [failed, setFailed] = useState(false);
  const url = exerciseImageUrl(name);
  const dim = size === 'sm' ? 'size-9' : size === 'lg' ? 'size-16' : 'size-12';

  const box = cn(
    'flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted',
    dim,
    className,
  );

  if (!url || failed) {
    return (
      <span className={box} aria-hidden="true">
        <Dumbbell className="size-1/2 text-muted-foreground" />
      </span>
    );
  }

  return (
    <span className={box}>
      <img
        src={url}
        alt=""
        loading="lazy"
        className="size-full object-contain"
        onError={() => setFailed(true)}
      />
    </span>
  );
}
