// Sprite artwork (32×32, sticker style: warm dark outline, flat fills, one highlight). Consumed by gen-sprites.ts.
// Group icons stand for the plan's food types; food icons illustrate items. No gradients: external <use> safe.

const O = 'stroke="#3b2a1e" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"';
const HL = 'fill="#ffffff" opacity=".55"';

export const groups: Record<string, string> = {
  // Tortillas: a warm stack, toasted spots.
  carb_sg: `
    <ellipse cx="16" cy="20.5" rx="13" ry="6.5" fill="#d9a85a" ${O}/>
    <ellipse cx="16" cy="17.5" rx="13" ry="6.5" fill="#e8bd6e" ${O}/>
    <ellipse cx="16" cy="14.5" rx="13" ry="6.5" fill="#f6d89a" ${O}/>
    <ellipse cx="10.5" cy="13.5" rx="1.6" ry="1" fill="#c98b45"/>
    <ellipse cx="18.5" cy="12" rx="1.2" ry=".8" fill="#c98b45"/>
    <ellipse cx="21.5" cy="16" rx="1.8" ry="1" fill="#c98b45"/>
    <ellipse cx="14" cy="17" rx="1" ry=".7" fill="#c98b45"/>
    <path d="M7 12.5c2-2.2 5-3.2 8-3.4" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".7"/>`,
  // Croissant ("cuernito"): carbs with fat.
  carb_cg: `
    <path d="M4 21c1.5-7 6.5-12 12-12s10.5 5 12 12c-2 1.5-4.5 1-6-.5-1.5 2-4 3-6 3s-4.5-1-6-3c-1.5 1.5-4 2-6 .5z" fill="#e9a648" ${O}/>
    <path d="M10.5 11.5c1 3 1.2 6.5.3 10M16 9v14.5M21.5 11.5c-1 3-1.2 6.5-.3 10" fill="none" stroke="#a8641f" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M8 15c1.5-2.5 3.5-4 6-4.7" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".6"/>`,
  // Drumstick: meat top-left, bone and knobs bottom-right.
  protein_poa: `
    <g transform="rotate(45 16 16)">
      <path d="M18.5 14.2h8v3.6h-8z" fill="#fbf3e4" ${O}/>
      <circle cx="27.6" cy="13.9" r="2.4" fill="#fbf3e4" ${O}/>
      <circle cx="27.6" cy="18.1" r="2.4" fill="#fbf3e4" ${O}/>
      <path d="M26 14.9v2.2" stroke="#fbf3e4" stroke-width="2.6"/>
      <path d="M20.5 13.2C16.5 12.3 14.5 8.6 9.6 8.6 5.5 8.6 2.6 11.9 2.6 16s2.9 7.4 7 7.4c4.9 0 6.9-3.7 10.9-4.6z" fill="#c8733a" ${O}/>
      <path d="M6 12.6c1.2-1.4 2.8-2.1 4.5-2.1" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".6"/>
      <ellipse cx="12" cy="17.5" rx="2.4" ry="1.3" fill="#a85a28"/>
    </g>`,
  // Three beans.
  legume: `
    <path d="M5.5 15c0-3.3 2.6-5.5 5.6-5.2 2.4.2 3.4 2 5.2 2.3 2.3.4 4.3-.8 4.6 1.8.4 3.6-3.3 6.4-7.4 6.6-4.4.2-8-1.9-8-5.5z" fill="#a8452f" ${O}/>
    <path d="M12 23c0-3 2.4-5 5.1-4.7 2.2.2 3.1 1.8 4.8 2.1 2.1.4 3.9-.7 4.2 1.6.3 3.3-3 5.8-6.8 6-4 .2-7.3-1.7-7.3-5z" fill="#8f3a26" ${O}/>
    <path d="M17.5 9.5c0-2.6 2-4.3 4.4-4.1 1.9.2 2.7 1.6 4.1 1.8 1.8.3 3.4-.6 3.6 1.4.3 2.8-2.6 5-5.8 5.2-3.4.2-6.3-1.5-6.3-4.3z" fill="#b8553a" ${O}/>
    <path d="M8.5 13c.7-1.1 1.9-1.6 3-1.5M15 21c.6-1 1.6-1.4 2.6-1.3M20.5 8c.5-.8 1.4-1.2 2.3-1.1" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".6"/>`,
  // Glass of milk.
  dairy: `
    <path d="M8 5.5h16l-1.8 21.2c-.1 1-1 1.8-2 1.8h-8.4c-1 0-1.9-.8-2-1.8z" fill="#dff1fb" ${O}/>
    <path d="M8.9 11h14.2l-1.4 15.6c-.1.7-.6 1.2-1.3 1.2h-8.8c-.7 0-1.2-.5-1.3-1.2z" fill="#ffffff"/>
    <path d="M8.9 11c2.4 1 4.7 1 7.1 0s4.7-1 7.1 0" fill="none" stroke="#9fd0ee" stroke-width="1.2"/>
    <path d="M8 5.5h16l-1.8 21.2c-.1 1-1 1.8-2 1.8h-8.4c-1 0-1.9-.8-2-1.8z" fill="none" ${O}/>
    <path d="M11.5 14.5l.9 9.5" stroke="#bfe3f7" stroke-width="1.6" stroke-linecap="round"/>`,
  // Apple.
  fruit: `
    <path d="M16 9.5c-2.2-1.6-5.6-2.1-8 .3-2.8 2.8-2.6 8.4.4 12.6 2 2.8 4.4 4.6 6.2 4.1.8-.2 1-.5 1.4-.5s.6.3 1.4.5c1.8.5 4.2-1.3 6.2-4.1 3-4.2 3.2-9.8.4-12.6-2.4-2.4-5.8-1.9-8-.3z" fill="#ef4d55" ${O}/>
    <path d="M16 9.5c.2-2.2 1.2-4.2 2.8-5.4" fill="none" stroke="#3b2a1e" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M18 6.5c1.5-2.4 4.4-3.1 6.6-2.2-.8 2.4-3.6 3.6-6.6 2.2z" fill="#5bbf5f" ${O}/>
    <path d="M9.5 13c.5-1.8 1.8-2.8 3.4-3" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".7"/>`,
  // Broccoli.
  veg: `
    <path d="M13.5 18.5l-1.5 9h8l-1.5-9z" fill="#a7d67a" ${O}/>
    <circle cx="10" cy="14" r="5.2" fill="#2fa65a" ${O}/>
    <circle cx="22" cy="14" r="5.2" fill="#2fa65a" ${O}/>
    <circle cx="16" cy="10" r="6.2" fill="#3cb96a" ${O}/>
    <circle cx="16" cy="17" r="4.6" fill="#36ad63" ${O}/>
    <circle cx="13.5" cy="8.5" r="1.2" ${HL}/><circle cx="8.5" cy="12.5" r="1" ${HL}/><circle cx="20.5" cy="12.3" r="1" ${HL}/>
    <circle cx="18" cy="9.5" r=".9" fill="#1f7a40"/><circle cx="12" cy="15.5" r=".8" fill="#1f7a40"/><circle cx="23.5" cy="15.5" r=".8" fill="#1f7a40"/>`,
  // Wrapped candy.
  sugar_sg: `
    <path d="M9.5 16L3.5 10.5l1 11z" fill="#f7a8d0" ${O}/>
    <path d="M22.5 16l6-5.5-1 11z" fill="#f7a8d0" ${O}/>
    <circle cx="16" cy="16" r="7.5" fill="#c08cf5" ${O}/>
    <path d="M10.5 13.5c2.5 1.2 4.5 3.3 5.5 9.7M14 9c1.7 2.4 4.3 4 8.9 4.7" fill="none" stroke="#fff" stroke-width="1.5" opacity=".75"/>
    <circle cx="12.5" cy="12.5" r="1.3" ${HL}/>`,
  // Chocolate bar with foil.
  sugar_cg: `
    <rect x="6" y="4.5" width="17" height="23" rx="2.5" fill="#7a4a2a" ${O}/>
    <path d="M6.5 12h16M6.5 19.5h16M14.5 5v22" stroke="#5a341c" stroke-width="1.3"/>
    <path d="M9 7.5h3M17 7.5h3M9 15h3" stroke="#a46a40" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M14 27.5l9-11 4 6.5-5 6.5z" fill="#d9dde3" ${O}/>
    <path d="M18.5 22l3.5-3.5" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>`,
  // Avocado half.
  fat_sp: `
    <path d="M16 3.5c-3.5 0-5.3 3.4-6.6 7.4C7.8 15.4 5.5 17.4 5.5 21c0 4.3 4.7 7.5 10.5 7.5S26.5 25.3 26.5 21c0-3.6-2.3-5.6-3.9-10.1C21.3 6.9 19.5 3.5 16 3.5z" fill="#3f7f2a" ${O}/>
    <path d="M16 6.3c-2.4 0-3.8 2.6-4.9 5.9-1.3 3.9-3.3 5.5-3.3 8.8 0 3.1 3.7 5.4 8.2 5.4s8.2-2.3 8.2-5.4c0-3.3-2-4.9-3.3-8.8-1.1-3.3-2.5-5.9-4.9-5.9z" fill="#cfe58a"/>
    <circle cx="16" cy="19.5" r="4.6" fill="#9a5b2e" ${O}/>
    <circle cx="14.5" cy="18" r="1.4" ${HL}/>`,
  // Peanut.
  fat_cp: `
    <path d="M12 4.5c-3.6 0-6 2.6-6 6 0 2.3 1.4 3.6 1.7 5.3.3 1.6-.9 3-.9 5.4 0 3.8 3 6.3 6.8 6.3s6.8-2.7 6.8-6.3c0-2.2-1.4-3.6-1.4-5.2s1.5-3.3 1.5-5.6c0-3.4-2.5-5.9-6-5.9z" fill="#dcaa6e" transform="rotate(-28 13 16)" ${O}/>
    <path d="M9 9.5l1.4 1.6M12.5 7.5l.6 1.8M8.5 20l1.6 1M12 23l.8 1.6M15 19l1.5.8" stroke="#a87642" stroke-width="1.2" stroke-linecap="round" transform="rotate(-28 13 16)"/>
    <path d="M8.5 8.5c.8-1.4 2-2.2 3.4-2.4" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".6" transform="rotate(-28 13 16)"/>`,
};

const bowl = (fill: string, top: string, extra = '') => `
    <path d="M4 15.5h24c0 6.5-5.4 11.5-12 11.5S4 22 4 15.5z" fill="#f2efe8" ${O}/>
    <path d="M5 15.5c.5-3.6 5.3-6 11-6s10.5 2.4 11 6z" fill="${fill}" ${O}/>
    ${top}
    <path d="M9 20c1.4 2.4 3.6 3.7 6 4" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity=".8"/>
    ${extra}`;

export const foods: Record<string, string> = {
  tortilla: groups.carb_sg as string,
  pan: `
    <path d="M6.5 13.5C4.6 13 3.5 11.6 3.5 9.8 3.5 6.6 6.8 4.5 11 4.5h10c4.2 0 7.5 2.1 7.5 5.3 0 1.8-1.1 3.2-3 3.7v12c0 1.1-.9 2-2 2h-15c-1.1 0-2-.9-2-2z" fill="#d9944a" ${O}/>
    <path d="M8.5 13c-1.4-.4-2.2-1.4-2.2-2.7 0-2.3 2.5-3.8 5.6-3.8h8.2c3.1 0 5.6 1.5 5.6 3.8 0 1.3-.8 2.3-2.2 2.7v11.6c0 .5-.4.9-.9.9H9.4c-.5 0-.9-.4-.9-.9z" fill="#f8e6c2"/>
    <circle cx="13" cy="15" r=".8" fill="#e2c08a"/><circle cx="18.5" cy="18" r=".8" fill="#e2c08a"/><circle cx="14" cy="21" r=".8" fill="#e2c08a"/>`,
  bolillo: `
    <path d="M3.5 18.5c0-5.5 5.6-9.5 12.5-9.5s12.5 4 12.5 9.5c0 2.8-2.5 4.5-5.5 4.5H9c-3 0-5.5-1.7-5.5-4.5z" fill="#d98a3d" ${O}/>
    <path d="M10 12.5c1.2 2 1.6 4.4 1.2 7M16 11.2v8.5M22 12.5c-1.2 2-1.6 4.4-1.2 7" fill="none" stroke="#f6d9a6" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M7 15c1-1.4 2.4-2.4 4-3" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".55"/>`,
  arroz: bowl(
    '#ffffff',
    '<path d="M9 13l1.5-.6M13 11.5l1.4.3M17.5 12l1.5-.4M21.5 13.2l1.2.4M11.5 14.5l1.3-.2M16 14l1.2.3M19.5 14.5l1.3-.4" stroke="#d9d2c3" stroke-width="1.2" stroke-linecap="round"/>',
  ),
  avena: bowl(
    '#e8cfa0',
    '<circle cx="12" cy="12.5" r="1.1" fill="#c79a5a"/><circle cx="17" cy="11.8" r="1.1" fill="#c79a5a"/><circle cx="21" cy="13.2" r="1.1" fill="#c79a5a"/><circle cx="14.5" cy="14.2" r="1" fill="#c79a5a"/><path d="M18 10.5c1.5-1.6 3.6-1.8 5-.7" fill="none" stroke="#7a4a2a" stroke-width="1.2" stroke-linecap="round"/>',
  ),
  papa: `
    <path d="M6 18.5c-1.2-5 2.2-10.8 8.5-12.4 6.6-1.7 11.6 1.6 12 6.6.4 5.2-3.6 10.6-9.6 12.3-5.5 1.6-9.8-1.6-10.9-6.5z" fill="#d8a965" ${O}/>
    <circle cx="12" cy="13" r=".9" fill="#a8783c"/><circle cx="19.5" cy="11" r=".9" fill="#a8783c"/><circle cx="20" cy="18" r=".9" fill="#a8783c"/><circle cx="13" cy="20" r=".9" fill="#a8783c"/>
    <path d="M9.5 12c1-1.8 2.6-3 4.6-3.6" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity=".55"/>`,
  elote: `
    <path d="M10.5 26.5c-2.5-1-3.4-5-1.9-10.4C10.2 10.4 13.6 5 16.8 5.5c3.2.6 3.4 6.6 2.3 12.4-1 5.4-3.4 9.6-6 9.2" fill="#f5c842" ${O}/>
    <path d="M12 9.5l3 1M11 13l4.5 1M10 16.5l5.4 1M9.7 20l5.3 1M10.3 23.5l4 .8M15.6 8.5l2.3.5" stroke="#d9a21f" stroke-width="1.1" stroke-linecap="round"/>
    <path d="M10.5 26.5C7 25 4.6 21 4.5 14c3 1.6 5.2 5 6 8.4M14 27.3c3.8-.4 7.6-3.4 10-9.3-3.3.2-6.3 2.5-8.2 5.4" fill="#7cc35a" ${O}/>`,
  pasta: bowl(
    '#f3cf6b',
    '<path d="M8.5 13c2-2 4-.2 6-1.6s4-.9 6 .3 3.5-.5 3.5-.5M10 15c2.2-1.2 4.2.6 6.4-.4s4.5-.7 6.6.4" fill="none" stroke="#d9a21f" stroke-width="1.2" stroke-linecap="round"/><circle cx="18" cy="12.2" r="1.6" fill="#e2483d"/>',
  ),
  galleta: `
    <circle cx="16" cy="16" r="11.5" fill="#d99a52" ${O}/>
    <circle cx="11.5" cy="12.5" r="1.7" fill="#5a341c"/><circle cx="19" cy="11" r="1.4" fill="#5a341c"/><circle cx="20.5" cy="18.5" r="1.8" fill="#5a341c"/><circle cx="13" cy="20" r="1.4" fill="#5a341c"/><circle cx="16.5" cy="15.5" r="1" fill="#5a341c"/>
    <path d="M8.5 11.5c1-2 2.8-3.5 5-4" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity=".5"/>`,
  cereal: bowl(
    '#ffffff',
    '<circle cx="11.5" cy="12.5" r="1.7" fill="#f5a524" stroke="#b86e10" stroke-width=".8"/><circle cx="16" cy="11.5" r="1.7" fill="#f0525a" stroke="#a8323a" stroke-width=".8"/><circle cx="20.5" cy="12.8" r="1.7" fill="#7cc35a" stroke="#4a8a30" stroke-width=".8"/><circle cx="14" cy="14.3" r="1.5" fill="#c08cf5" stroke="#7d4fc2" stroke-width=".8"/>',
  ),
  huevo: `
    <path d="M4 16.5c0-5.5 4.6-9 9.2-8.6 2.4.2 3.8 1.5 6.1 1.2 3.5-.5 8.7.9 8.7 6.6 0 5.2-4.3 8.8-11.5 8.8C8.8 24.5 4 22 4 16.5z" fill="#ffffff" ${O}/>
    <circle cx="15" cy="16" r="4.6" fill="#f7b51e" ${O}/>
    <circle cx="13.6" cy="14.6" r="1.4" ${HL}/>`,
  pollo: groups.protein_poa as string,
  carne: `
    <path d="M5.5 13.5C6.5 8 11.6 5 17.4 5.6c5.6.6 9.6 4.6 9 9.8-.5 4.2-3.6 6.2-6.4 8.6-3 2.6-6 4.4-9.6 3.4-4.4-1.2-5.8-7.7-4.9-13.9z" fill="#c9524a" ${O}/>
    <path d="M9.5 12.5c3.2-3 8.6-3.3 11.8-.4 2.4 2.2 1.8 5.6-1.2 7.8-2.6 1.9-5.4 3.8-8.2 3" fill="none" stroke="#f6d5c8" stroke-width="2" stroke-linecap="round"/>
    <circle cx="24" cy="10.5" r="1.3" ${HL}/>`,
  pescado: `
    <path d="M3.5 16c3-4.8 8.4-7.5 13.5-7.5s9 3.2 9 7.5-4 7.5-9 7.5S6.5 20.8 3.5 16z" fill="#7cb7e0" ${O}/>
    <path d="M25 16l4-5v10z" fill="#5a9ccc" ${O}/>
    <circle cx="9.5" cy="14.5" r="1.4" fill="#3b2a1e"/>
    <path d="M14 11.5c1.5 3 1.5 6 0 9M18.5 11c1.2 3.3 1.2 6.7 0 10" fill="none" stroke="#4f8fbf" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M7 12.5c1.7-1.6 3.8-2.6 6-2.9" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".7"/>`,
  atun: `
    <path d="M4.5 12.5v9c0 2.5 5.1 4.5 11.5 4.5s11.5-2 11.5-4.5v-9z" fill="#c7ced6" ${O}/>
    <path d="M4.5 15h23v4h-23z" fill="#3a8fd0"/>
    <ellipse cx="16" cy="12.5" rx="11.5" ry="4.5" fill="#e3e7ec" ${O}/>
    <ellipse cx="16" cy="12.5" rx="8" ry="2.6" fill="#f0c08c"/>
    <path d="M4.5 12.5v9c0 2.5 5.1 4.5 11.5 4.5s11.5-2 11.5-4.5v-9" fill="none" ${O}/>`,
  jamon: `
    <circle cx="16" cy="16" r="11.5" fill="#f2a3a8" ${O}/>
    <circle cx="16" cy="16" r="8.2" fill="#f7c2c4"/>
    <path d="M11 13c1.2-1.4 3-2.2 5-2.3M13 21l2-1.5M19.5 18l1.5-2" fill="none" stroke="#e98d93" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M7.5 11c1.2-2 3-3.4 5.2-4.2" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity=".6"/>`,
  queso: `
    <path d="M3.5 21.5L18 7.5l10.5 7.5v8c0 1.1-.9 2-2 2h-21c-1.1 0-2-.9-2-2z" fill="#f7cd4a" ${O}/>
    <path d="M3.5 21.5l25-6.5" fill="none" ${O}/>
    <path d="M18 7.5l10.5 7.5L3.5 21.5z" fill="#fde189" ${O}/>
    <circle cx="10" cy="22.5" r="1.6" fill="#e0a92a"/><circle cx="17.5" cy="22" r="1.2" fill="#e0a92a"/><circle cx="23.5" cy="20" r="1.5" fill="#e0a92a"/><circle cx="15.5" cy="15" r="1.2" fill="#e8b93a"/>`,
  camaron: `
    <path d="M24.5 9.5c-1.8-3-6-4.4-10-3.3-5 1.4-8.8 6.4-7.6 11.8 1 4.4 5 6.9 9.2 6.6 2.4-.2 4.3-1.4 5.4-3.2" fill="none" stroke="#3b2a1e" stroke-width="7.2" stroke-linecap="round"/>
    <path d="M24.5 9.5c-1.8-3-6-4.4-10-3.3-5 1.4-8.8 6.4-7.6 11.8 1 4.4 5 6.9 9.2 6.6 2.4-.2 4.3-1.4 5.4-3.2" fill="none" stroke="#f58a5b" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M21.5 21.5l5 2.5-1-4.5z" fill="#f58a5b" ${O}/>
    <path d="M11 9.5l1.6 2.4M8.3 13.5l2.6 1M8.5 18.5l2.6-.4" stroke="#c9592e" stroke-width="1.2" stroke-linecap="round"/>
    <circle cx="23" cy="8.5" r="1" fill="#3b2a1e"/>`,
  leche: groups.dairy as string,
  yogurt: `
    <path d="M7 10.5h18l-2 15c-.2 1.3-1.3 2.3-2.6 2.3h-8.8c-1.3 0-2.4-1-2.6-2.3z" fill="#ffffff" ${O}/>
    <path d="M7.6 15h16.8l-.6 4.5H8.2z" fill="#c08cf5"/>
    <rect x="5.5" y="7" width="21" height="4" rx="1.5" fill="#e3d6f7" ${O}/>
    <path d="M7 10.5h18l-2 15c-.2 1.3-1.3 2.3-2.6 2.3h-8.8c-1.3 0-2.4-1-2.6-2.3z" fill="none" ${O}/>
    <circle cx="14" cy="17.3" r="1.2" fill="#fff"/>`,
  frijol: groups.legume as string,
  manzana: groups.fruit as string,
  platano: `
    <path d="M5 9.5c1.5 7.5 6.5 13 14.5 14.5 3.5.6 6.3-.3 8-2.2-6.5.2-12.3-3.6-15.4-9.4-1.4-2.6-2.3-4.4-4.1-5.4z" fill="#f8d548" ${O}/>
    <path d="M7.5 9c2.5 6.5 7.5 11 14 12.5" fill="none" stroke="#e0b21f" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M5 9.5l-1.5-2 2.6-.9.9 1.9z" fill="#6b4a23" ${O}/>
    <path d="M9 14c1.4 2.4 3.3 4.3 5.4 5.6" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".6"/>`,
  naranja: `
    <circle cx="16" cy="17.5" r="10.5" fill="#f79a2c" ${O}/>
    <path d="M16 7c.1-1.4.8-2.5 2-3.2" fill="none" stroke="#3b2a1e" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M17 6.5c1.6-2 4.2-2.4 6.2-1.4-1 2.1-3.6 3-6.2 1.4z" fill="#5bbf5f" ${O}/>
    <circle cx="11.5" cy="14" r="1.6" ${HL}/><circle cx="19" cy="20" r=".6" fill="#d77a10"/><circle cx="14" cy="22" r=".6" fill="#d77a10"/><circle cx="21" cy="15" r=".6" fill="#d77a10"/>`,
  fresa: `
    <path d="M16 28c-5.5-3-10-8.4-10-13.4 0-3.8 2.8-6.1 6-6.1 1.6 0 2.9.6 4 1.6 1.1-1 2.4-1.6 4-1.6 3.2 0 6 2.3 6 6.1C26 19.6 21.5 25 16 28z" fill="#ef4256" ${O}/>
    <path d="M10.5 6.5c1.8.4 3.4 1.6 5.5 1.6s3.7-1.2 5.5-1.6c-.3 2.3-2.6 4-5.5 4s-5.2-1.7-5.5-4z" fill="#5bbf5f" ${O}/>
    <circle cx="11.5" cy="15" r=".7" fill="#fde189"/><circle cx="16" cy="14" r=".7" fill="#fde189"/><circle cx="20.5" cy="15" r=".7" fill="#fde189"/><circle cx="13.5" cy="19.5" r=".7" fill="#fde189"/><circle cx="18.5" cy="19.5" r=".7" fill="#fde189"/><circle cx="16" cy="23.5" r=".7" fill="#fde189"/>
    <path d="M9 13c.4-1.3 1.2-2.2 2.4-2.6" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".6"/>`,
  uva: `
    <path d="M16 7.5c0-2 1-3.5 3-4" fill="none" stroke="#6b4a23" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="11" cy="11" r="3.6" fill="#8b5cf6" ${O}/><circle cx="18" cy="10.5" r="3.6" fill="#8b5cf6" ${O}/><circle cx="23" cy="13" r="3.2" fill="#7c4fe0" ${O}/>
    <circle cx="14.5" cy="16.5" r="3.6" fill="#7c4fe0" ${O}/><circle cx="21" cy="18.5" r="3.4" fill="#8b5cf6" ${O}/><circle cx="9" cy="17" r="3.2" fill="#8b5cf6" ${O}/>
    <circle cx="16" cy="23" r="3.4" fill="#8b5cf6" ${O}/><circle cx="11.5" cy="22.5" r="2.6" fill="#7c4fe0" ${O}/>
    <circle cx="10" cy="10" r="1" ${HL}/><circle cx="17" cy="9.5" r="1" ${HL}/><circle cx="13.5" cy="15.5" r="1" ${HL}/><circle cx="15" cy="22" r="1" ${HL}/>`,
  mango: `
    <path d="M7.5 22.5c-3.5-4.5-2.5-11.5 2.5-15 5.5-3.8 13.5-2.6 16.5 3 2.6 4.8.4 11.4-5.5 14.6-5 2.7-10.5 1.9-13.5-2.6z" fill="#fbb03b" ${O}/>
    <path d="M20 21.5c3.4-1.8 5.4-5.2 5-8.6" fill="none" stroke="#f0525a" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>
    <path d="M19 5.5c.4-1.3 1.4-2.2 2.6-2.6" fill="none" stroke="#3b2a1e" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M10.5 11.5c1.2-2 3.2-3.4 5.5-3.9" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity=".6"/>`,
  pina: `
    <path d="M16 11.5l-3.5-7 3.5 3 3.5-3zM16 11l-6-4.5 2 5.5M16 11l6-4.5-2 5.5" fill="#4caf50" ${O}/>
    <ellipse cx="16" cy="20" rx="8" ry="9" fill="#f7c843" ${O}/>
    <path d="M10 15.5l12 9M10 24.5l12-9M13 12.5l9 13M19 12.5l-9 13" fill="none" stroke="#d99a1f" stroke-width="1.2" stroke-linecap="round"/>
    <ellipse cx="16" cy="20" rx="8" ry="9" fill="none" ${O}/>`,
  papaya: `
    <path d="M16 4.5c6 0 9.5 5.3 9.5 11.5S21.3 27.5 16 27.5 6.5 22.2 6.5 16 10 4.5 16 4.5z" fill="#7cc35a" ${O}/>
    <path d="M16 7c4.6 0 7 4.4 7 9.2S19.7 25 16 25s-7-4-7-8.8S11.4 7 16 7z" fill="#fb8a4c"/>
    <path d="M16 11c2 0 3 2.2 3 5s-1.2 5-3 5-3-2.2-3-5 1-5 3-5z" fill="#3b2a1e"/>
    <circle cx="15.2" cy="13.5" r=".7" fill="#fff" opacity=".7"/>`,
  sandia: `
    <path d="M3.5 12.5h25c0 7.5-5.6 13-12.5 13S3.5 20 3.5 12.5z" fill="#3fa34d" ${O}/>
    <path d="M5.8 12.5h20.4c-.4 5.8-4.8 10.4-10.2 10.4S6.2 18.3 5.8 12.5z" fill="#ef4d55"/>
    <path d="M5.8 12.5h20.4" fill="none" ${O}/>
    <circle cx="11" cy="15.5" r=".9" fill="#3b2a1e"/><circle cx="16" cy="18.5" r=".9" fill="#3b2a1e"/><circle cx="21" cy="15.5" r=".9" fill="#3b2a1e"/><circle cx="14" cy="15" r=".9" fill="#3b2a1e"/><circle cx="18.5" cy="14.5" r=".9" fill="#3b2a1e"/>`,
  pera: `
    <path d="M16 7.5c-2.4 0-3.6 1.8-3.9 4.4-.3 2.5-2.7 4.1-3.6 7.1-1.3 4.4 2.2 8.5 7.5 8.5s8.8-4.1 7.5-8.5c-.9-3-3.3-4.6-3.6-7.1-.3-2.6-1.5-4.4-3.9-4.4z" fill="#b5d65a" ${O}/>
    <path d="M16 7.5c0-1.7.6-3 1.8-4" fill="none" stroke="#3b2a1e" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M17.5 5c1.3-1.5 3.3-1.8 4.8-1-.8 1.7-2.8 2.3-4.8 1z" fill="#5bbf5f" ${O}/>
    <path d="M11 18.5c.4-2 1.4-3.5 2.8-4.6" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity=".6"/>`,
  brocoli: groups.veg as string,
  zanahoria: `
    <path d="M7 25.5c-1-1-.8-2.6.5-4L19.5 10c1.4-1.4 3.6-1.4 5 0s1.4 3.6 0 5L13 26.9c-1.4 1.3-3 1.6-4 .6z" fill="#f78a2c" ${O}/>
    <path d="M12.5 17l2 2M15.5 14l2 2M10 20.5l1.6 1.6" stroke="#cf6a12" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M22.5 9.5c-.5-2.5.4-5 2.6-6.5.5 2.3-.4 4.6-2.6 6.5zM23.5 10.5c2-1.6 4.6-2 6.5-.8-2 1.4-4.5 1.7-6.5.8zM22 9c-1.8-1.8-2.4-4.3-1.4-6.4 1.7 1.4 2.3 3.9 1.4 6.4z" fill="#5bbf5f" ${O}/>`,
  jitomate: `
    <path d="M16 9c-6 0-10.5 3.8-10.5 9s4.6 9.5 10.5 9.5 10.5-4.3 10.5-9.5S22 9 16 9z" fill="#ef4d55" ${O}/>
    <path d="M16 9.5l-4-3 2.2 4.4-5 .6 5.4 1.3L16 11l1.4 1.8 5.4-1.3-5-.6L20 6.5z" fill="#4caf50" ${O}/>
    <path d="M9 15.5c.8-1.7 2.2-2.9 4-3.4" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".65"/>`,
  lechuga: `
    <path d="M16 27.5c-6.6 0-11.5-4-11.5-9.5 0-3.5 2-4.8 2.6-7.4.8-3.3 3.6-6.1 8.9-6.1s8.1 2.8 8.9 6.1c.6 2.6 2.6 3.9 2.6 7.4 0 5.5-4.9 9.5-11.5 9.5z" fill="#6cc04a" ${O}/>
    <path d="M16 27c-4 0-6.8-3.5-6.8-8 0-3.8 2.8-6.6 6.8-6.6s6.8 2.8 6.8 6.6c0 4.5-2.8 8-6.8 8z" fill="#a7dc6f" ${O}/>
    <path d="M16 12.5V27M16 20l-3.5-3M16 23l3.5-3" fill="none" stroke="#5aa83c" stroke-width="1.2" stroke-linecap="round"/>`,
  nopal: `
    <path d="M16 27.5c-5 0-8-3.4-8-9.2C8 11 11.4 4.5 16 4.5s8 6.5 8 13.8c0 5.8-3 9.2-8 9.2z" fill="#4caf50" ${O}/>
    <path d="M13 10.5l-1-1M19 10.5l1-1M11 16l-1.2-.4M21 16l1.2-.4M14 21.5l-1 .8M18 21.5l1 .8M16 13.5v-1.3" stroke="#3b2a1e" stroke-width="1.1" stroke-linecap="round"/>
    <circle cx="13" cy="10.5" r=".9" fill="#d7f0b0"/><circle cx="19" cy="10.5" r=".9" fill="#d7f0b0"/><circle cx="11" cy="16" r=".9" fill="#d7f0b0"/><circle cx="21" cy="16" r=".9" fill="#d7f0b0"/><circle cx="14" cy="21.5" r=".9" fill="#d7f0b0"/><circle cx="18" cy="21.5" r=".9" fill="#d7f0b0"/>`,
  calabacita: `
    <path d="M6 23.5c-1.8-1.8-.8-5 2.3-8.1l7-7c3.1-3.1 7.3-4.3 9.1-2.5s.6 6-2.5 9.1l-7 7c-3.1 3.1-7.1 3.3-8.9 1.5z" fill="#4f9d3a" ${O}/>
    <path d="M9.5 19.5l9-9M12 22l8.5-8.5" stroke="#8fcf6a" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M24.5 6l2.5-2.5" stroke="#6b8e23" stroke-width="2.6" stroke-linecap="round"/>`,
  chile: `
    <path d="M23.5 8.5C24 14 21 22.5 11.5 26.5c-3.4 1.4-6.5.6-7-1 2.5.2 5-1.2 7.2-3.6 4.8-5.3 4.8-10.6 6.6-13.4z" fill="#3fa34d" ${O}/>
    <path d="M18.5 8.5c1.5-1.6 3.6-2 5-1.2.8-1.7 2.3-2.6 3.8-2.7" fill="none" stroke="#3b2a1e" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M18.5 8.5c1.5-1.6 3.6-2 5-1.2" fill="none" stroke="#6b8e23" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M19 12c-.6 3.4-2.4 6.8-5.3 9.7" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".55"/>`,
  cebolla: `
    <path d="M16 6.5c-1 2.6-4.5 4.4-7.5 7.4-2.7 2.7-2.6 7.4.3 10 3.6 3.2 10.8 3.2 14.4 0 2.9-2.6 3-7.3.3-10-3-3-6.5-4.8-7.5-7.4z" fill="#e7c6e9" ${O}/>
    <path d="M16 9c-1.6 3.4-4 6.4-4 10.5S14 26 16 26M16 9c1.6 3.4 4 6.4 4 10.5S18 26 16 26" fill="none" stroke="#c48cc8" stroke-width="1.2"/>
    <path d="M16 6.5V3.5M14.5 4l1.5-2 1.5 2" fill="none" stroke="#5bbf5f" stroke-width="1.6" stroke-linecap="round"/>`,
  champinon: `
    <path d="M12.5 17h7l1 8c.1 1.2-.8 2.2-2 2.2h-5c-1.2 0-2.1-1-2-2.2z" fill="#f4ead8" ${O}/>
    <path d="M3.5 16.5c0-6 5.6-10.5 12.5-10.5s12.5 4.5 12.5 10.5c0 .8-.6 1.5-1.5 1.5h-22c-.9 0-1.5-.7-1.5-1.5z" fill="#b98a5e" ${O}/>
    <circle cx="11" cy="11.5" r="1.4" fill="#e3c9a8"/><circle cx="18" cy="9.5" r="1.1" fill="#e3c9a8"/><circle cx="22" cy="13" r="1.2" fill="#e3c9a8"/>`,
  aguacate: groups.fat_sp as string,
  aceite: `
    <path d="M13 3.5h6v4h-6z" fill="#3b7d3a" ${O}/>
    <path d="M13.5 7.5h5v3c3 1.6 5 4.5 5 8.2v6.3c0 1.4-1.1 2.5-2.5 2.5h-10c-1.4 0-2.5-1.1-2.5-2.5v-6.3c0-3.7 2-6.6 5-8.2z" fill="#f2d04a" ${O}/>
    <path d="M9.5 18.5h13v5h-13z" fill="#fdf3c4" stroke="#3b2a1e" stroke-width="1.2"/>
    <path d="M11 13.5c.8-1.2 1.6-1.8 2.4-2.2" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity=".7"/>
    <path d="M14 21h4" stroke="#c99a1e" stroke-width="1.4" stroke-linecap="round"/>`,
  mantequilla: `
    <path d="M4 18.5l10-6 14 3.5v6l-10 6-14-3.5z" fill="#f5d670" ${O}/>
    <path d="M4 18.5l10-6 14 3.5-10 6z" fill="#fde9a0" ${O}/>
    <path d="M18 22v6" fill="none" ${O}/>
    <path d="M9.5 17l6-3.4" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".7"/>`,
  mayonesa: `
    <rect x="7.5" y="10" width="17" height="17.5" rx="3" fill="#fbf6e6" ${O}/>
    <rect x="6.5" y="5.5" width="19" height="5.5" rx="1.8" fill="#3a8fd0" ${O}/>
    <path d="M7.5 15.5h17v6h-17z" fill="#f2d04a" stroke="#3b2a1e" stroke-width="1.2"/>
    <path d="M10 12.5v2" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>`,
  crema: `
    <path d="M8 12.5h16l-1.6 13c-.2 1.2-1.2 2-2.4 2h-8c-1.2 0-2.2-.8-2.4-2z" fill="#f3f4f6" ${O}/>
    <path d="M7 12.5c0-3 2.5-5 5-5 .8-2 2.4-3 4-3s3.2 1 4 3c2.5 0 5 2 5 5z" fill="#ffffff" ${O}/>
    <path d="M10.5 17.5h11" stroke="#9fd0ee" stroke-width="2.6" stroke-linecap="round"/>`,
  aceituna: `
    <ellipse cx="13" cy="17" rx="7" ry="8.5" fill="#556b2f" ${O} transform="rotate(-20 13 17)"/>
    <ellipse cx="21" cy="14" rx="6" ry="7.5" fill="#6b8e23" ${O} transform="rotate(25 21 14)"/>
    <circle cx="21.5" cy="13.5" r="2" fill="#e2483d" ${O}/>
    <circle cx="10.5" cy="13.5" r="1.4" ${HL}/>`,
  nuez: `
    <path d="M16 4.5c-6.5 0-10.5 5.2-10.5 11.5S9.5 27.5 16 27.5 26.5 22.3 26.5 16 22.5 4.5 16 4.5z" fill="#c99560" ${O}/>
    <path d="M16 5v22.5M9.5 9.5c2.4 2 2.4 4.4 0 6.5s-2.4 4.4 0 6.5M22.5 9.5c-2.4 2-2.4 4.4 0 6.5s2.4 4.4 0 6.5" fill="none" stroke="#8a5a2e" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M9 9c1.2-1.6 2.8-2.7 4.6-3.2" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".5"/>`,
  almendra: `
    <path d="M16 3.5c-5 4.4-8 9.8-8 14.6 0 5 3.6 9.4 8 9.4s8-4.4 8-9.4c0-4.8-3-10.2-8-14.6z" fill="#c8874a" ${O}/>
    <path d="M13 11c.8 3 .8 6.6-.4 10M16.5 9c.6 4 .6 9-.6 14M19.5 12c.3 3 0 6-1 8.5" fill="none" stroke="#a5652d" stroke-width="1.1" stroke-linecap="round"/>
    <path d="M12 12.5c.6-2 1.6-3.8 3-5.4" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".55"/>`,
  cacahuate: groups.fat_cp as string,
  azucar: `
    <path d="M4.5 14.5l7-3.5 7 3.5v8l-7 3.5-7-3.5z" fill="#ffffff" ${O}/>
    <path d="M4.5 14.5l7 3.5 7-3.5M11.5 18v8" fill="none" ${O}/>
    <path d="M14.5 8l6-3 6 3v7l-6 3-6-3z" fill="#f7f3ea" ${O}/>
    <path d="M14.5 8l6 3 6-3M20.5 11v7" fill="none" ${O}/>
    <circle cx="8" cy="18.5" r=".7" fill="#d9d2c3"/><circle cx="15" cy="20" r=".7" fill="#d9d2c3"/><circle cx="23.5" cy="12.5" r=".7" fill="#d9d2c3"/>`,
  miel: `
    <path d="M8 11.5h16v13c0 1.7-1.3 3-3 3H11c-1.7 0-3-1.3-3-3z" fill="#f5a524" ${O}/>
    <rect x="7" y="7" width="18" height="5" rx="2" fill="#c97b1a" ${O}/>
    <path d="M10.5 16.5h11v6h-11z" fill="#fdf3c4" stroke="#3b2a1e" stroke-width="1.2"/>
    <path d="M14 12v3.5c0 .8.6 1.4 1.4 1.4" fill="none" stroke="#f5a524" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M10.5 14v1" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>`,
  dulce: groups.sugar_sg as string,
  refresco: `
    <rect x="8.5" y="5.5" width="15" height="22" rx="3" fill="#e2483d" ${O}/>
    <path d="M8.5 9.5h15M8.5 23.5h15" stroke="#3b2a1e" stroke-width="1.3"/>
    <path d="M10.5 15c3-1.6 7-1.6 11 .5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
    <path d="M14 4h4" stroke="#3b2a1e" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M11 11.5v3" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".6"/>`,
  jugo: `
    <path d="M8 8.5h16l-1.8 18.2c-.1 1-1 1.8-2 1.8h-8.4c-1 0-1.9-.8-2-1.8z" fill="#fff3d9" ${O}/>
    <path d="M8.7 13h14.6l-1.3 13.5c-.1.7-.6 1.2-1.3 1.2h-9.4c-.7 0-1.2-.5-1.3-1.2z" fill="#fbb03b"/>
    <path d="M8 8.5h16l-1.8 18.2c-.1 1-1 1.8-2 1.8h-8.4c-1 0-1.9-.8-2-1.8z" fill="none" ${O}/>
    <path d="M19 3.5l-1.5 13" stroke="#ef4d55" stroke-width="2" stroke-linecap="round"/>
    <circle cx="23.5" cy="8.5" r="4" fill="#f79a2c" ${O}/><path d="M23.5 4.5v8M19.5 8.5h8" stroke="#fde189" stroke-width="1"/>`,
  chocolate: groups.sugar_cg as string,
  pandulce: `
    <path d="M4 20c0-6.6 5.4-11 12-11s12 4.4 12 11c0 2.2-1.8 3.5-4 3.5H8c-2.2 0-4-1.3-4-3.5z" fill="#e1a35a" ${O}/>
    <path d="M5.5 17.5c0-4.8 4.7-8 10.5-8s10.5 3.2 10.5 8c-3.4 1.4-7 2-10.5 2s-7.1-.6-10.5-2z" fill="#f6b8cf" ${O}/>
    <path d="M9 13.5l3 5M14 11l2 8M19.5 11.5l-1.5 7.5M24 14l-3.5 5" fill="none" stroke="#e48aae" stroke-width="1.3" stroke-linecap="round"/>`,
  helado: `
    <path d="M10 15.5l6 13 6-13z" fill="#e7b06a" ${O}/>
    <path d="M11.5 18.5l5.5 3M13 22l3 1.7M20.5 18.5L15 21.5" stroke="#b97d36" stroke-width="1.1"/>
    <circle cx="12" cy="12.5" r="4.6" fill="#f7a8d0" ${O}/>
    <circle cx="20" cy="12.5" r="4.6" fill="#fde9b0" ${O}/>
    <circle cx="16" cy="8" r="4.6" fill="#a7dc6f" ${O}/>
    <circle cx="14.5" cy="6.6" r="1.2" ${HL}/>`,
  gelatina: `
    <path d="M7 24.5c0-6 1.6-14 9-14s9 8 9 14z" fill="#f0525a" ${O}/>
    <path d="M5 24.5h22v2.5c0 .8-.7 1.5-1.5 1.5h-19c-.8 0-1.5-.7-1.5-1.5z" fill="#e3e7ec" ${O}/>
    <path d="M11.5 14.5c1-1.4 2.2-2.2 3.6-2.6" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>
    <circle cx="16" cy="9" r="2.4" fill="#ef4256" ${O}/>`,
  agua: `
    <path d="M8 6.5h16l-1.8 20.2c-.1 1-1 1.8-2 1.8h-8.4c-1 0-1.9-.8-2-1.8z" fill="#eaf6fd" ${O}/>
    <path d="M8.8 13h14.4l-1.4 13.6c-.1.7-.6 1.2-1.3 1.2h-9c-.7 0-1.2-.5-1.3-1.2z" fill="#a9daf6"/>
    <path d="M8 6.5h16l-1.8 20.2c-.1 1-1 1.8-2 1.8h-8.4c-1 0-1.9-.8-2-1.8z" fill="none" ${O}/>
    <path d="M11.5 16l.8 8.5" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`,
  cafe: `
    <path d="M6 11.5h16v9c0 3.9-3.1 7-7 7h-2c-3.9 0-7-3.1-7-7z" fill="#ffffff" ${O}/>
    <path d="M22 13.5h1.5c2 0 3.5 1.5 3.5 3.5s-1.5 3.5-3.5 3.5H22" fill="none" ${O}/>
    <ellipse cx="14" cy="11.5" rx="8" ry="2" fill="#7a4a2a" ${O}/>
    <path d="M11 3.5c-1 1.2 1 2.2 0 3.6M15 3c-1 1.2 1 2.2 0 3.6" fill="none" stroke="#b9a99a" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M9 16v4" stroke="#e3d6c6" stroke-width="1.6" stroke-linecap="round"/>`,
  salsa: `
    <path d="M5 14.5h22c0 6.6-4.9 12-11 12s-11-5.4-11-12z" fill="#d9b28a" ${O}/>
    <path d="M6.5 14.5c.4-2.4 4.6-4 9.5-4s9.1 1.6 9.5 4z" fill="#e2483d" ${O}/>
    <circle cx="12" cy="13" r=".9" fill="#5bbf5f"/><circle cx="18" cy="12.3" r=".9" fill="#5bbf5f"/><circle cx="21" cy="13.5" r=".7" fill="#fde189"/><circle cx="15" cy="13.8" r=".7" fill="#fde189"/>
    <path d="M7 19.5c1.4 2.4 3.5 3.9 6 4.4" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".55"/>`,
  taco: `
    <path d="M3.5 22c0-8.3 5.6-14.5 12.5-14.5S28.5 13.7 28.5 22z" fill="#f2cd7a" ${O}/>
    <path d="M6.5 21c.6-5.2 4.6-9 9.5-9s8.9 3.8 9.5 9" fill="none" stroke="#c98b45" stroke-width="1.2"/>
    <path d="M7.5 17.5c1-1 2.6-1 3.6 0 1-1.4 3.1-1.6 4.4-.3 1.2-1.2 3.3-1.2 4.5.2 1.2-.9 3-.6 3.9.6" fill="none" stroke="#5bbf5f" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M9.5 19.5h13" stroke="#c9524a" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M3.5 22h25" fill="none" ${O}/>`,
  sandwich: `
    <path d="M4 15.5L16 6l12 9.5z" fill="#f6d9a6" ${O}/>
    <path d="M4.5 16.5h23l-1 2.5h-21z" fill="#6cc04a" ${O}/>
    <path d="M5 19h22v2.5H5z" fill="#f2a3a8" ${O}/>
    <path d="M5 21.5h22v2.2H5z" fill="#f7cd4a" ${O}/>
    <path d="M4 23.7h24l-12 4z" fill="#f6d9a6" ${O}/>
    <path d="M9 13.5l7-5.5" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity=".7"/>`,
  plato: `
    <ellipse cx="16" cy="18" rx="13" ry="8" fill="#ffffff" ${O}/>
    <ellipse cx="16" cy="17" rx="8.5" ry="4.8" fill="#f2efe8" stroke="#d9d2c3" stroke-width="1.2"/>
    <path d="M5.5 15c1.4-2 3.6-3.4 6.4-4.2" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>`,
};
