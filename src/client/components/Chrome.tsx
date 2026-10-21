// App chrome: the tab bar with the central "+" (log anything, from anywhere).
import { ChartLine, CookingPot, Flower2, Plus, Sun } from 'lucide-preact';
import { labels } from '../copy/es-MX';
import { kitchenSlot, navigate, route } from '../state/ui';

const TABS = [
  { path: '/', label: labels.tabs.today, Icon: Sun },
  { path: '/cocina', label: labels.tabs.kitchen, Icon: CookingPot },
  null,
  { path: '/jardin', label: labels.tabs.garden, Icon: Flower2 },
  { path: '/progreso', label: labels.tabs.progress, Icon: ChartLine },
] as const;

export function TabBar({ onAdd }: { onAdd: () => void }) {
  const current = route.value;
  return (
    <nav
      class="fixed inset-x-0 bottom-0 z-30 border-line border-t"
      style="padding-bottom: var(--safe-bottom); background: color-mix(in srgb, var(--surface) 90%, transparent); backdrop-filter: saturate(1.6) blur(18px); -webkit-backdrop-filter: saturate(1.6) blur(18px)"
      aria-label="Fichas"
    >
      <div class="mx-auto grid max-w-[560px] grid-cols-5" style="height: var(--tabbar-h)">
        {TABS.map((t) => {
          if (!t)
            return (
              <div key="add" class="grid place-items-center">
                <button
                  type="button"
                  class="press -mt-5 grid h-[58px] w-[58px] place-items-center rounded-full text-[color:var(--on-accent)]"
                  style="background: var(--accent); box-shadow: 0 8px 22px color-mix(in srgb, var(--accent) 42%, transparent), 0 0 0 5px var(--bg)"
                  aria-label={labels.tabs.add}
                  data-testid="describe-open"
                  onClick={onAdd}
                >
                  <Plus size={30} strokeWidth={2.6} aria-hidden="true" />
                </button>
              </div>
            );
          const { path, label, Icon } = t;
          const active = path === '/' ? current === '/' : current.startsWith(path);
          return (
            <button
              key={path}
              type="button"
              class={`press flex flex-col items-center justify-center gap-1 text-[11px] font-bold tracking-wide ${active ? 'text-accent-ink' : 'text-ink-2'}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => {
                if (path === '/cocina') kitchenSlot.value = null;
                navigate(path);
              }}
            >
              <span
                class="grid h-7 w-12 place-items-center rounded-full transition-colors"
                style={active ? 'background: var(--accent-soft)' : ''}
              >
                <Icon size={22} aria-hidden="true" strokeWidth={active ? 2.4 : 2} />
              </span>
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
