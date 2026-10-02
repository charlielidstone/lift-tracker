// SettingsView — the Settings tab. Account, preferences (weight unit), data
// export, and about/attribution. Weight is always stored in lb; the unit toggle
// only changes display + stepping across the app.

import { useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { DataExport } from '@/components/DataExport';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/SettingsProvider';
import { UNITS, unitLabel } from '@/lib/units';

function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-2 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <h2 className="text-sm font-medium text-foreground">{title}</h2>
      {children}
    </section>
  );
}

// A small segmented control (two+ options, one selected).
function Segmented({ options, value, onChange, labelFor }) {
  return (
    <div className="inline-flex rounded-lg border border-border p-0.5">
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            aria-pressed={active}
            className={cn(
              'min-w-16 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {labelFor ? labelFor(opt) : opt}
          </button>
        );
      })}
    </div>
  );
}

export function SettingsView() {
  const { user, signOut } = useAuth();
  const { unit, setUnit } = useSettings();
  const [savedFlash, setSavedFlash] = useState(false);

  const changeUnit = (next) => {
    setUnit(next);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1200);
  };

  return (
    <div className="flex flex-col gap-5">
      <Section title="Units">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-sm text-foreground">Weight unit</span>
            <span className="text-xs text-muted-foreground">
              Display only — your lifts are always stored in lb.
            </span>
          </div>
          <Segmented options={UNITS} value={unit} onChange={changeUnit} labelFor={unitLabel} />
        </div>
        {savedFlash && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Check className="size-3.5" /> Saved
          </span>
        )}
      </Section>

      <Section title="Account">
        <p className="text-sm text-muted-foreground">{user?.email ?? 'Not signed in'}</p>
        {user && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => signOut()}
          >
            Sign out
          </Button>
        )}
      </Section>

      <Section title="Your data">
        <DataExport />
      </Section>

      <Section title="About">
        <p className="text-xs text-muted-foreground">
          Exercise illustrations by Bryl Lim, adapted from Everkinetic, licensed under{' '}
          <a
            href="https://creativecommons.org/licenses/by-sa/4.0/"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            CC BY-SA 4.0
          </a>
          .
        </p>
      </Section>
    </div>
  );
}
