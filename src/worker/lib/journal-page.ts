// The nutritionist's journal as one self-contained page: no scripts, days as swipeable cards (CSS scroll snap),
// alimentos y horarios only. Escapes everything it prints.
import { journalCopy as t } from '../../client/copy/more';
import { fill, shortDate } from '../../shared/domain/format';
import type { Journal, JournalEntry } from '../../shared/domain/journal';

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

function offset(n: number | null): string {
  if (n === null) return '';
  if (Math.abs(n) < 15) return t.onTime;
  return fill(n > 0 ? t.late : t.early, { n: Math.abs(n) });
}

function entry(e: JournalEntry): string {
  if (e.kind !== 'meal') {
    return `<li class="entry ${e.kind}"><div class="when"><span class="plan">${esc(e.planTime ?? '')}</span></div><div><p class="slot">${esc(e.label)}</p><p class="none">${esc(e.kind === 'skip' ? t.skipped : t.missing)}</p></div></li>`;
  }
  const dishes = e.dishes
    .map((d) => {
      const items = d.items
        .map((i) => `<li>${esc(i.label)}${i.approx ? ` <span class="approx">${esc(t.approx)}</span>` : ''}</li>`)
        .join('');
      return d.name && d.items.length > 1
        ? `<li class="dish"><p class="dish-name">${esc(d.name)}</p><ul>${items}</ul></li>`
        : items;
    })
    .join('');
  const off = offset(e.offset);
  return `<li class="entry"><div class="when"><span class="time">${esc(e.time ?? e.planTime ?? '')}</span>${
    e.planTime ? `<span class="plan">${esc(fill(t.planTime, { time: e.planTime }))}</span>` : ''
  }${off ? `<span class="off">${esc(off)}</span>` : ''}</div><div><p class="slot">${esc(e.label)}</p><p class="title">${esc(
    e.title,
  )}</p>${dishes ? `<ul class="items">${dishes}</ul>` : ''}</div></li>`;
}

const STYLE = `@font-face{font-family:Fr;src:url(/fonts/fraunces-display.woff2) format("woff2");font-weight:600 900;font-display:swap}
:root{color-scheme:light dark;--bg:#f3eee1;--card:#fffdf6;--ink:#18271d;--ink2:#4b584d;--line:#e6decb;--edge:#ddd2ba;--accent:#11683b;--soft:#ddefd8;--clay:#9c4421}
@media (prefers-color-scheme:dark){:root{--bg:#0e1611;--card:#16211a;--ink:#eef2e6;--ink2:#afbba9;--line:#243329;--edge:#2a3b30;--accent:#7edda5;--soft:#1b3a27;--clay:#f0a07c}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.45 ui-rounded,"SF Pro Rounded",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:1180px;margin:0 auto}header{padding:30px 20px 6px}.kicker{margin:0;font-size:12px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--ink2)}
h1,h2{font-family:Fr,Georgia,serif;font-weight:820;margin:4px 0 0;letter-spacing:-.01em}h1{font-size:34px;line-height:1.1}h2{font-size:21px}
.sub{margin:6px 0 0;color:var(--ink2)}.glance{margin:18px 20px 0;padding:16px;border-radius:22px;background:var(--card);box-shadow:0 0 0 1.5px var(--edge),0 4px 0 1.5px var(--edge)}
.glance p{margin:4px 0 0}.pat{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px;margin-top:12px;padding:0;list-style:none}
.pat li{padding:10px 12px;border-radius:16px;background:var(--bg)}.pat b{display:block}.muted{color:var(--ink2);font-size:14px}
nav{display:flex;gap:8px;overflow-x:auto;padding:16px 20px 4px;scrollbar-width:none}nav a{flex:none;padding:7px 13px;border-radius:999px;background:var(--card);box-shadow:inset 0 0 0 2px var(--edge);color:var(--ink);font-weight:750;font-size:14px;text-decoration:none}
.hint{padding:6px 20px 0;color:var(--ink2);font-size:13px}
.days{display:grid;grid-auto-flow:column;grid-auto-columns:min(86vw,360px);gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;padding:10px 20px 34px;scroll-padding:0 20px;list-style:none;margin:0}
.day{scroll-snap-align:start;align-self:start;padding:16px 16px 6px;border-radius:24px;background:var(--card);box-shadow:0 0 0 1.5px var(--edge),0 4px 0 1.5px var(--edge)}
.day h3{font-family:Fr,Georgia,serif;font-size:22px;font-weight:800;margin:0 0 4px}.day>ul{list-style:none;margin:0;padding:0}
.entry{display:grid;grid-template-columns:76px 1fr;gap:10px;padding:11px 0;border-top:1.5px dashed var(--line)}
.when{display:flex;flex-direction:column;gap:1px}.time{font-weight:850}.plan,.off{font-size:12px;color:var(--ink2)}.off{font-weight:750}
.slot{margin:0;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--accent)}
.title{margin:2px 0 0;font-weight:750}.items{margin:4px 0 0;padding-left:18px;color:var(--ink2);font-size:15px}.items ul{padding-left:16px}
.dish{list-style:none;margin-left:-18px}.dish-name{margin:4px 0 0;color:var(--ink);font-weight:700;font-size:15px}
.approx{font-size:11px;font-weight:800;padding:1px 6px;border-radius:999px;background:var(--bg)}
.none{margin:2px 0 0;color:var(--ink2);font-style:italic}.skip .none{color:var(--clay)}
.empty{padding:22px;color:var(--ink2)}footer{padding:0 20px 40px;color:var(--ink2);font-size:13px}
@media (min-width:900px){.days{grid-auto-columns:340px}}`;

export function journalPage(j: Journal, title: string): string {
  const range = j.from === j.to ? shortDate(j.from) : `${shortDate(j.from)} – ${shortDate(j.to)}`;
  const total = j.days.length;
  const patterns = j.patterns
    .map((p) => {
      const bits = [
        p.avgTime ? fill(t.avgTime, { time: p.avgTime }) : null,
        fill(t.planTime, { time: p.planTime }),
        p.avgOffset !== null ? offset(p.avgOffset) : null,
        p.skipped ? fill(t.skippedN, { n: p.skipped }) : null,
        p.missing ? fill(t.missingN, { n: p.missing }) : null,
      ].filter(Boolean);
      return `<li><b>${esc(p.label)}</b><span class="muted">${esc(bits.join(' · '))}</span></li>`;
    })
    .join('');
  const days = j.days
    .map(
      (d) =>
        `<li class="day" id="d-${d.day}"><h3>${esc(d.label)}</h3>${
          d.entries.length ? `<ul>${d.entries.map(entry).join('')}</ul>` : `<p class="empty">${esc(t.missing)}</p>`
        }</li>`,
    )
    .join('');
  return `<!doctype html><html lang="es-MX"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><title>${esc(
    `${title} · ${range}`,
  )}</title><link rel="icon" href="/icon.svg" type="image/svg+xml"><style>${STYLE}</style></head><body><div class="wrap"><header><p class="kicker">${esc(
    t.kicker,
  )}</p><h1>${esc(range)}</h1><p class="sub">${esc(t.sub)}</p></header>${
    total
      ? `<section class="glance"><h2>${esc(t.glance)}</h2><p>${esc(
          fill(t.daysLogged, { n: j.daysLogged, total }),
        )}</p><ul class="pat">${patterns}</ul></section><nav aria-label="Días">${j.days
          .map((d) => `<a href="#d-${d.day}">${esc(d.label)}</a>`)
          .join('')}</nav><p class="hint">${esc(t.swipe)} →</p><ul class="days">${days}</ul>`
      : `<p class="empty">${esc(t.noDays)}</p>`
  }<footer>${esc(t.footer)}</footer></div></body></html>`;
}

export function gonePage(): string {
  return `<!doctype html><html lang="es-MX"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${esc(
    t.kicker,
  )}</title><style>${STYLE}</style></head><body><div class="wrap"><header><p class="kicker">${esc(t.kicker)}</p><h1>${esc(
    t.gone,
  )}</h1><p class="sub">${esc(t.goneSub)}</p></header></div></body></html>`;
}
