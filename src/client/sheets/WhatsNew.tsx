// "Novedades": what changed since the last version this device saw, shown once after an update.
import {
  BellRing,
  ChartLine,
  CircleDot,
  Flower2,
  ListTree,
  Palette,
  RefreshCw,
  Search,
  Share2,
  Sparkles,
  Sun,
  TestTubes,
  Utensils,
} from 'lucide-preact';
import type { ComponentType } from 'preact';
import { type ChangeIcon, releasesSince } from '../changelog';
import { Sheet } from '../components/Sheet';
import { whatsNew } from '../copy/more';
import { closeSheet } from '../state/ui';

const ICONS: Record<ChangeIcon, ComponentType<{ size?: number; 'aria-hidden'?: 'true' }>> = {
  palette: Palette,
  tubes: TestTubes,
  ring: CircleDot,
  sun: Sun,
  list: ListTree,
  plate: Utensils,
  search: Search,
  link: Share2,
  bell: BellRing,
  flower: Flower2,
  refresh: RefreshCw,
  chart: ChartLine,
  spark: Sparkles,
};

export const SEEN_KEY = 'version:seen';

export default function WhatsNew({ since }: { since?: string | null }) {
  const releases = releasesSince(since ?? null);
  const done = () => {
    try {
      localStorage.setItem(SEEN_KEY, __APP_VERSION__);
    } catch {
      // Without storage it simply shows again next time.
    }
    closeSheet();
  };
  return (
    <Sheet
      label={whatsNew.title}
      onClose={done}
      header={<h2 class="title">{whatsNew.title}</h2>}
      footer={
        <button type="button" class="btn btn-primary w-full" data-testid="whats-new-ok" onClick={done}>
          {whatsNew.ok}
        </button>
      }
    >
      {releases.map((r) => (
        <section key={r.version} class="mb-4">
          <p class="kicker mb-2 px-1">
            {r.title} · {r.version}
          </p>
          <ul class="grid gap-2">
            {r.items.map(({ icon, text }) => {
              const Icon = ICONS[icon];
              return (
                <li key={text} class="well flex items-center gap-3 p-3">
                  <span class="row-icon">
                    <Icon size={19} aria-hidden="true" />
                  </span>
                  <span class="font-semibold leading-5">{text}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </Sheet>
  );
}
