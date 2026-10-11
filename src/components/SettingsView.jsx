// SettingsView — the Settings tab, as a master/detail list. The default view is a
// tappable list of settings; selecting one opens its own page with a back button.
// Weight is always stored in lb; the unit toggle only changes display + stepping.

import { useState } from 'react';
import {
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  Database,
  Image as ImageIcon,
  Info,
  Scale,
  User,
} from 'lucide-react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { DataExport } from '@/components/DataExport';
import { NotificationsDemo } from '@/components/NotificationsDemo';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/SettingsProvider';
import { APP_ICONS, appIconById } from '@/lib/appIcon';
import { UNITS, unitLabel } from '@/lib/units';

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

// ── Individual setting pages ──

function AppIconSetting() {
  const { appIcon, setAppIcon } = useSettings();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3">
        {APP_ICONS.map((icon) => {
          const active = icon.id === appIcon;
          return (
            <button
              key={icon.id}
              type="button"
              onClick={() => setAppIcon(icon.id)}
              aria-pressed={active}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-xl border p-2 transition-colors',
                active ? 'border-accent bg-accent/10' : 'border-border hover:border-foreground/30',
              )}
            >
              <span className="relative">
                <img
                  src={icon.src}
                  alt={`${icon.label} app icon`}
                  width={56}
                  height={56}
                  className="size-14 rounded-[13px]"
                />
                {active && (
                  <span className="absolute -right-1 -top-1 rounded-full bg-accent p-0.5 text-accent-foreground">
                    <Check className="size-3" />
                  </span>
                )}
              </span>
              <span className="text-xs text-muted-foreground">{icon.label}</span>
            </button>
          );
        })}
      </div>
      <span className="text-xs text-muted-foreground">
        Applies to the iPhone home-screen icon. Already added? Remove it and add it again from
        Safari’s Share menu to pick up the new icon.
      </span>
    </div>
  );
}

function UnitsSetting() {
  const { unit, setUnit } = useSettings();
  const [savedFlash, setSavedFlash] = useState(false);

  const changeUnit = (next) => {
    setUnit(next);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1200);
  };

  return (
    <div className="flex flex-col gap-2">
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
    </div>
  );
}

function AccountSetting() {
  const { user, signOut } = useAuth();
  return (
    <div className="flex flex-col gap-2">
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
    </div>
  );
}

function AboutSetting() {
  return (
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
  );
}

// ── The list ──

// A single tappable row in the settings list.
function SettingRow({ icon: Icon, label, subtitle, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-accent/5"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
        <Icon className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm text-foreground">{label}</span>
        {subtitle && <span className="truncate text-xs text-muted-foreground">{subtitle}</span>}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

export function SettingsView() {
  const { user } = useAuth();
  const { unit, appIcon } = useSettings();
  const [active, setActive] = useState(null);

  // Section defs: list metadata + the detail page to render. Subtitles summarise
  // the current value so the list reads at a glance.
  const sections = [
    {
      id: 'app-icon',
      label: 'App icon',
      subtitle: appIconById(appIcon).label,
      icon: ImageIcon,
      render: () => <AppIconSetting />,
    },
    {
      id: 'units',
      label: 'Units',
      subtitle: `Weight in ${unitLabel(unit)}`,
      icon: Scale,
      render: () => <UnitsSetting />,
    },
    {
      id: 'account',
      label: 'Account',
      subtitle: user?.email ?? 'Not signed in',
      icon: User,
      render: () => <AccountSetting />,
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      render: () => <NotificationsDemo />,
    },
    {
      id: 'data',
      label: 'Your data',
      subtitle: 'Export your workouts',
      icon: Database,
      render: () => <DataExport />,
    },
    { id: 'about', label: 'About', icon: Info, render: () => <AboutSetting /> },
  ];

  const current = sections.find((s) => s.id === active);

  if (current) {
    return (
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => setActive(null)}
          className="-ml-1 inline-flex items-center gap-1 self-start text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Settings
        </button>
        <h2 className="text-base font-medium text-foreground">{current.label}</h2>
        {current.render()}
      </div>
    );
  }

  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
      {sections.map((s) => (
        <SettingRow
          key={s.id}
          icon={s.icon}
          label={s.label}
          subtitle={s.subtitle}
          onClick={() => setActive(s.id)}
        />
      ))}
    </div>
  );
}
