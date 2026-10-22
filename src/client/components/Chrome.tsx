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
    <nav class="tabbar fixed inset-x-0 bottom-0 z-30" aria-label="Fichas">
      <div class="mx-auto grid max-w-[560px] grid-cols-5" style="height: var(--tabbar-h)">
        {TABS.map((t) => {
          if (!t)
            return (
              <div key="add" class="grid place-items-center">
                <button
                  type="button"
                  class="tab-add -mt-6 grid h-[60px] w-[60px] place-items-center rounded-full"
                  aria-label={labels.tabs.add}
                  data-testid="describe-open"
                  onClick={onAdd}
                >
                  <Plus size={32} strokeWidth={3} aria-hidden="true" />
                </button>
              </div>
            );
          const { path, label, Icon } = t;
          const active = path === '/' ? current === '/' : current.startsWith(path);
          return (
            <button
              key={path}
              type="button"
              class={`press flex flex-col items-center justify-center gap-1 text-[11px] font-extrabold tracking-wide ${active ? 'text-accent-ink' : 'text-ink-2'}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => {
                if (path === '/cocina') kitchenSlot.value = null;
                navigate(path);
              }}
            >
              <span class={`tab-pill grid h-8 w-14 place-items-center rounded-full ${active ? 'on' : ''}`}>
                <Icon size={22} aria-hidden="true" strokeWidth={active ? 2.6 : 2.1} />
              </span>
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
