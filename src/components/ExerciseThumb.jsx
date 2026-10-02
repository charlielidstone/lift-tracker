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
    // Fixed dark tile so the white line-art illustrations always read, regardless
    // of the app's (currently light) theme.
    'flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-zinc-000',
    dim,
    className,
  );

  if (!url || failed) {
    return (
      <span className={box} aria-hidden="true">
        <Dumbbell className="size-1/2 text-zinc-700" />
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
        style={{ filter: 'invert(1)'}}
        onError={() => setFailed(true)}
      />
    </span>
  );
}
