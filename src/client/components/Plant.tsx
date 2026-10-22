// Procedural plants (docs/05-fichas-2.md §9): seven growth stages and 23 species, drawn as cartoon sprites — every
// shape outlined, petals shaded at the base, leaves with a midrib, stems with a highlight. Flat SVG, no images.
import type { JSX } from 'preact';
import { SPECIES, SPECIES_BY_ID, type Species, type Stage } from '../../shared/game/species';

const CX = 50;
const CY = 36;
const R = 23;
/** Outline width, in the 100-unit box. */
const LW = 1.3;
type El = JSX.Element;

/** The cartoon outline for a fill: the color pulled toward a deep plum-brown. */
export function ink(hex: string, t = 0.58): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#3a2a33';
  const n = Number.parseInt(m[1] ?? '0', 16);
  const mix = (c: number, to: number) => Math.round(c + (to - c) * t);
  const r = mix((n >> 16) & 255, 0x2e);
  const g = mix((n >> 8) & 255, 0x1f);
  const b = mix(n & 255, 0x2c);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** A petal pointing up from the head center, rotated by `a` degrees. */
function petalPath(shape: Species['petal'], len: number, w: number): string {
  const tip = CY - len;
  switch (shape) {
    case 'ellipse':
      return `M${CX} ${CY}C${CX + w * 1.3} ${CY - len * 0.15} ${CX + w * 1.3} ${tip + len * 0.12} ${CX} ${tip}C${CX - w * 1.3} ${tip + len * 0.12} ${CX - w * 1.3} ${CY - len * 0.15} ${CX} ${CY}Z`;
    case 'round':
      return `M${CX} ${CY}C${CX + len * 0.62} ${CY - len * 0.2} ${CX + len * 0.5} ${tip} ${CX} ${tip}C${CX - len * 0.5} ${tip} ${CX - len * 0.62} ${CY - len * 0.2} ${CX} ${CY}Z`;
    case 'notched':
      return `M${CX} ${CY}C${CX + w * 1.25} ${CY - len * 0.4} ${CX + w} ${tip} ${CX + w * 0.35} ${tip + len * 0.04}L${CX} ${tip + len * 0.16}L${CX - w * 0.35} ${tip + len * 0.04}C${CX - w} ${tip} ${CX - w * 1.25} ${CY - len * 0.4} ${CX} ${CY}Z`;
    default:
      return `M${CX} ${CY}Q${CX + w} ${CY - len * 0.5} ${CX} ${tip}Q${CX - w} ${CY - len * 0.5} ${CX} ${CY}Z`;
  }
}

function petal(
  shape: Species['petal'],
  len: number,
  w: number,
  a: number,
  fillColor: string,
  key: string,
  o: { line: string; shade?: string; vein?: boolean; width?: number },
) {
  const t = `rotate(${a} ${CX} ${CY})`;
  return (
    <g key={key} transform={t}>
      <path
        d={petalPath(shape, len, w)}
        fill={fillColor}
        stroke={o.line}
        stroke-width={o.width ?? LW}
        stroke-linejoin="round"
      />
      {o.shade && <path d={petalPath(shape, len * 0.46, w * 0.62)} fill={o.shade} opacity={0.55} />}
      {o.vein && (
        <path
          d={`M${CX} ${CY - len * 0.2}L${CX} ${CY - len * 0.72}`}
          stroke="#ffffff"
          stroke-width={0.9}
          stroke-linecap="round"
          opacity={0.45}
        />
      )}
    </g>
  );
}

const CENTER: Record<string, 'disk' | 'seeds' | 'ring' | 'dots' | 'none' | 'star' | 'small'> = {
  girasol: 'seeds',
  gerbera: 'ring',
  nochebuena: 'dots',
  cempasuchil: 'none',
  campanilla: 'star',
  dalia: 'small',
  amapola: 'small',
};

function center(sp: Species, r: number): El {
  const kind = CENTER[sp.id] ?? 'disk';
  const c = sp.colors.center;
  const line = ink(c);
  switch (kind) {
    case 'none':
      return (
        <circle cx={CX} cy={CY} r={r * 0.5} fill={sp.colors.shade} stroke={ink(sp.colors.shade)} stroke-width={LW} />
      );
    case 'seeds':
      return (
        <g>
          <circle cx={CX} cy={CY} r={r} fill={c} stroke={line} stroke-width={LW} />
          <circle cx={CX} cy={CY} r={r * 0.72} fill="none" stroke="#3b2412" stroke-width={0.8} opacity={0.5} />
          {Array.from({ length: 24 }, (_, i) => {
            const d = Math.sqrt(i / 24) * r * 0.85;
            const a = i * 2.39996;
            return <circle key={i} cx={CX + Math.cos(a) * d} cy={CY + Math.sin(a) * d} r={0.9} fill="#3b2412" />;
          })}
          <ellipse cx={CX - r * 0.35} cy={CY - r * 0.4} rx={r * 0.28} ry={r * 0.16} fill="#ffffff" opacity={0.25} />
        </g>
      );
    case 'ring':
      return (
        <g>
          <circle cx={CX} cy={CY} r={r} fill="#f7d36b" stroke={ink('#f7d36b')} stroke-width={LW} />
          <circle cx={CX} cy={CY} r={r * 0.62} fill={c} />
          <circle cx={CX - r * 0.2} cy={CY - r * 0.22} r={r * 0.16} fill="#ffffff" opacity={0.3} />
        </g>
      );
    case 'dots':
      return (
        <g>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <circle
              key={i}
              cx={CX + Math.cos(i * 1.05) * (i ? 3.2 : 0)}
              cy={CY + Math.sin(i * 1.05) * (i ? 3.2 : 0)}
              r={1.9}
              fill={c}
              stroke="#6f7f1f"
              stroke-width={0.7}
            />
          ))}
        </g>
      );
    case 'star':
      return (
        <g>
          <circle cx={CX} cy={CY} r={r * 1.6} fill="#ffffff" opacity={0.9} />
          {[0, 72, 144, 216, 288].map((a) => (
            <path
              key={a}
              d={`M${CX} ${CY}L${CX} ${CY - R * 0.95}`}
              stroke="#ffffff"
              stroke-width={1.4}
              transform={`rotate(${a} ${CX} ${CY})`}
              opacity={0.75}
            />
          ))}
          <circle cx={CX} cy={CY} r={2.2} fill="#ffd43b" stroke={ink('#ffd43b')} stroke-width={0.8} />
        </g>
      );
    case 'small':
      return (
        <g>
          <circle cx={CX} cy={CY} r={r * 0.75} fill={c} stroke={line} stroke-width={LW} />
          <circle cx={CX - r * 0.22} cy={CY - r * 0.24} r={r * 0.2} fill="#ffffff" opacity={0.35} />
        </g>
      );
    default:
      return (
        <g>
          <circle cx={CX} cy={CY} r={r} fill={c} stroke={line} stroke-width={LW} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <circle
              key={i}
              cx={CX + Math.cos(i * 1.05 + 0.5) * r * 0.55}
              cy={CY + Math.sin(i * 1.05 + 0.5) * r * 0.55}
              r={r * 0.11}
              fill={line}
              opacity={0.35}
            />
          ))}
          <circle cx={CX - r * 0.3} cy={CY - r * 0.3} r={r * 0.3} fill="#ffffff" opacity={0.4} />
        </g>
      );
  }
}

function radial(sp: Species): El {
  const out: El[] = [];
  const white = sp.colors.petal.toLowerCase() === '#ffffff';
  const line = ink(white ? '#b9ad9c' : sp.colors.shade, white ? 0.35 : 0.58);
  for (let L = 0; L < sp.layers; L++) {
    const len = R * (1 - L * (sp.layers > 2 ? 0.22 : 0.18));
    const n = sp.petals;
    const w = sp.petal === 'ellipse' ? Math.max(2.4, len * (n > 12 ? 0.15 : 0.3)) : len * (n > 10 ? 0.26 : 0.38);
    const back = sp.layers > 1 && L === 0;
    const color = back ? sp.colors.shade : sp.colors.petal;
    const rot = L * (180 / n) + (sp.layers > 2 ? L * 7 : 0);
    for (let i = 0; i < n; i++)
      out.push(
        petal(sp.petal, len, w, rot + (i * 360) / n, color, `${L}-${i}`, {
          line,
          shade: back ? undefined : sp.colors.shade,
          vein: !back && n <= 12 && len > 14,
          width: n > 14 ? 1 : LW,
        }),
      );
  }
  const r = CENTER[sp.id] === 'seeds' ? R * 0.42 : sp.petals <= 5 ? R * 0.16 : R * 0.24;
  return (
    <g>
      {out}
      {center(sp, r)}
    </g>
  );
}

function floret(sp: Species, x: number, y: number, r: number, color: string, key: number): El {
  const n = sp.petals;
  const line = ink(sp.colors.shade);
  return (
    <g key={key} transform={`translate(${x} ${y}) scale(${r / R}) translate(${-CX} ${-CY})`}>
      {Array.from({ length: n }, (_, i) =>
        petal(sp.petal, R, R * 0.42, (i * 360) / n, color, String(i), { line, width: 2.2 }),
      )}
      <circle cx={CX} cy={CY} r={R * 0.24} fill={sp.colors.center} stroke={line} stroke-width={1.6} />
    </g>
  );
}

function cluster(sp: Species): El {
  const n = sp.layers;
  const pts = Array.from({ length: n }, (_, k) => {
    if (k === 0) return [CX, CY - 2] as const;
    const a = (k / (n - 1)) * Math.PI * 2 + 0.4;
    const d = n > 6 ? 12 : 10;
    return [CX + Math.cos(a) * d, CY - 2 + Math.sin(a) * d * 0.85] as const;
  });
  const order = pts.map((p, k) => ({ p, k })).sort((a, b) => a.p[1] - b.p[1]);
  return (
    <g>
      {order.map(({ p, k }) => floret(sp, p[0], p[1], n > 6 ? 7.5 : 8.5, k % 2 ? sp.colors.shade : sp.colors.petal, k))}
    </g>
  );
}

function rose(sp: Species): El {
  const line = ink(sp.colors.shade);
  return (
    <g>
      {Array.from({ length: 5 }, (_, i) => petal('round', R, 0, i * 72, sp.colors.shade, `o${i}`, { line }))}
      {Array.from({ length: 5 }, (_, i) =>
        petal('round', R * 0.74, 0, i * 72 + 36, sp.colors.petal, `m${i}`, { line, shade: sp.colors.shade }),
      )}
      <circle cx={CX} cy={CY} r={R * 0.4} fill={sp.colors.petal} stroke={line} stroke-width={LW} />
      <path
        d={`M${CX - 6} ${CY + 2}C${CX - 6} ${CY - 6} ${CX + 6} ${CY - 7} ${CX + 6} ${CY}C${CX + 6} ${CY + 4} ${CX - 1} ${CY + 5} ${CX - 2} ${CY}C${CX - 2} ${CY - 3} ${CX + 2} ${CY - 3} ${CX + 2} ${CY}`}
        fill="none"
        stroke={line}
        stroke-width={1.6}
        stroke-linecap="round"
      />
      <ellipse cx={CX - 3} cy={CY - 5} rx={2.6} ry={1.4} fill="#ffffff" opacity={0.35} />
    </g>
  );
}

function spike(sp: Species): El {
  const out: El[] = [];
  const line = ink(sp.colors.shade);
  for (let i = 0; i < sp.petals; i++) {
    const y = 50 - i * 3;
    const s = 1 - i / (sp.petals * 1.6);
    out.push(
      <ellipse
        key={i}
        cx={CX + (i % 2 ? 3.6 : -3.6) * s}
        cy={y}
        rx={3.4 * s}
        ry={2.6 * s}
        fill={i % 3 === 0 ? sp.colors.shade : sp.colors.petal}
        stroke={line}
        stroke-width={0.8}
      />,
    );
  }
  return (
    <g>
      <path d={`M${CX} 56L${CX} 8`} stroke="var(--plant-line)" stroke-width={3.6} stroke-linecap="round" />
      <path d={`M${CX} 56L${CX} 8`} stroke="var(--leaf)" stroke-width={2.2} stroke-linecap="round" />
      {out}
    </g>
  );
}

function cup(sp: Species): El {
  const line = ink(sp.colors.shade);
  if (sp.petals <= 3)
    return (
      <g stroke={line} stroke-width={LW} stroke-linejoin="round">
        <ellipse cx={CX} cy={CY - 2} rx={12} ry={15} fill={sp.colors.shade} />
        <path d={`M${CX} 52C36 50 33 30 41 18C45 27 49 33 ${CX} 52Z`} fill={sp.colors.petal} />
        <path d={`M${CX} 52C64 50 67 30 59 18C55 27 51 33 ${CX} 52Z`} fill={sp.colors.petal} />
        <path d={`M${CX} 52C41 45 41 27 ${CX} 17C59 27 59 45 ${CX} 52Z`} fill={sp.colors.petal} />
        <path d={`M${CX} 50C46 42 46 30 ${CX} 22`} fill="none" stroke-width={1} opacity={0.5} />
        <path
          d={`M${CX - 4} 26C${CX - 6} 32 ${CX - 6} 38 ${CX - 4} 44`}
          fill="none"
          stroke="#ffffff"
          stroke-width={1.6}
          stroke-linecap="round"
          opacity={0.45}
        />
      </g>
    );
  const base = 50;
  const back = [-62, -24, 24, 62].map((a) => (
    <ellipse
      key={a}
      cx={CX}
      cy={base - 15}
      rx={8.5}
      ry={16}
      fill={sp.colors.shade}
      stroke={line}
      stroke-width={LW}
      transform={`rotate(${a} ${CX} ${base})`}
    />
  ));
  const front = [-40, 0, 40].map((a) => (
    <g key={a} transform={`rotate(${a} ${CX} ${base})`}>
      <ellipse cx={CX} cy={base - 14} rx={9} ry={15} fill={sp.colors.petal} stroke={line} stroke-width={LW} />
      <ellipse cx={CX} cy={base - 4} rx={5} ry={5} fill={sp.colors.shade} opacity={0.6} />
    </g>
  ));
  return (
    <g>
      {back}
      <ellipse
        cx={CX}
        cy={base - 18}
        rx={4}
        ry={7}
        fill={sp.colors.center}
        stroke={ink(sp.colors.center)}
        stroke-width={1}
      />
      {front}
    </g>
  );
}

function calla(sp: Species): El {
  const line = ink(sp.colors.shade, 0.45);
  return (
    <g>
      <path
        d={`M${CX} 56C40 48 35 30 43 17C51 7 66 12 65 21C62 30 57 41 ${CX} 56Z`}
        fill={sp.colors.petal}
        stroke={line}
        stroke-width={LW}
        stroke-linejoin="round"
      />
      <path d="M43 17C51 22 58 20 65 21" fill="none" stroke={line} stroke-width={1.2} />
      <path d="M46 24C44 32 45 40 48 47" fill="none" stroke={sp.colors.shade} stroke-width={2.2} opacity={0.7} />
      <ellipse
        cx={51}
        cy={33}
        rx={2.8}
        ry={11}
        fill={sp.colors.center}
        stroke={ink(sp.colors.center)}
        stroke-width={0.9}
        transform="rotate(10 51 33)"
      />
    </g>
  );
}

function orchid(sp: Species): El {
  const line = ink(sp.colors.shade);
  const sepal = (a: number) => (
    <path
      key={`s${a}`}
      d={`M${CX} ${CY}Q${CX + 6} ${CY - 10} ${CX} ${CY - 21}Q${CX - 6} ${CY - 10} ${CX} ${CY}Z`}
      fill={sp.colors.petal}
      stroke={line}
      stroke-width={LW}
      transform={`rotate(${a} ${CX} ${CY})`}
    />
  );
  return (
    <g>
      {[0, 128, 232].map(sepal)}
      {[-62, 62].map((a) => (
        <g key={a} transform={`rotate(${a} ${CX} ${CY})`}>
          <ellipse cx={CX} cy={CY - 11} rx={9} ry={12} fill={sp.colors.petal} stroke={line} stroke-width={LW} />
          <ellipse cx={CX} cy={CY - 6} rx={4.5} ry={5} fill={sp.colors.shade} opacity={0.45} />
        </g>
      ))}
      <path
        d={`M${CX} ${CY + 1}C42 ${CY + 6} 42 ${CY + 17} ${CX} ${CY + 18}C58 ${CY + 17} 58 ${CY + 6} ${CX} ${CY + 1}Z`}
        fill={sp.colors.shade}
        stroke={line}
        stroke-width={LW}
      />
      <ellipse
        cx={CX}
        cy={CY + 1}
        rx={3}
        ry={4}
        fill={sp.colors.center}
        stroke={ink(sp.colors.center)}
        stroke-width={0.8}
      />
    </g>
  );
}

function lotus(sp: Species): El {
  const base = 52;
  const line = ink(sp.colors.shade);
  const p = (a: number, len: number, color: string) => (
    <path
      key={`${a}-${len}`}
      d={`M${CX} ${base}Q${CX + 8} ${base - len * 0.5} ${CX} ${base - len}Q${CX - 8} ${base - len * 0.5} ${CX} ${base}Z`}
      fill={color}
      stroke={line}
      stroke-width={LW}
      stroke-linejoin="round"
      transform={`rotate(${a} ${CX} ${base})`}
    />
  );
  return (
    <g>
      {[-66, -33, 0, 33, 66].map((a) => p(a, 26, sp.colors.shade))}
      <rect
        x={CX - 6}
        y={base - 25}
        width={12}
        height={8}
        rx={3}
        fill={sp.colors.center}
        stroke={ink(sp.colors.center)}
        stroke-width={1}
      />
      {[-40, 0, 40].map((a) => p(a, 24, sp.colors.petal))}
    </g>
  );
}

function bract(sp: Species): El {
  const line = ink(sp.colors.shade);
  const group = (x: number, y: number, k: number) => (
    <g key={k} transform={`translate(${x} ${y}) scale(0.48) translate(${-CX} ${-CY})`}>
      {[0, 120, 240].map((a) =>
        petal('round', R, 0, a, k % 2 ? sp.colors.shade : sp.colors.petal, String(a), {
          line,
          width: 2.4,
          shade: k % 2 ? undefined : sp.colors.shade,
        }),
      )}
      <circle cx={CX} cy={CY} r={3.4} fill={sp.colors.center} stroke={line} stroke-width={1.4} />
    </g>
  );
  return <g>{[group(40, 40, 0), group(60, 39, 1), group(50, 25, 2)]}</g>;
}

function nopalFlower(sp: Species): El {
  return (
    <g>
      <g transform={`translate(${CX} ${CY + 2}) scale(1 0.72) translate(${-CX} ${-CY})`}>
        {radial({ ...sp, shape: 'radial' })}
      </g>
    </g>
  );
}

function head(sp: Species): El {
  switch (sp.shape) {
    case 'cluster':
      return cluster(sp);
    case 'rose':
      return rose(sp);
    case 'spike':
      return spike(sp);
    case 'cup':
      return cup(sp);
    case 'calla':
      return calla(sp);
    case 'orchid':
      return orchid(sp);
    case 'lotus':
      return lotus(sp);
    case 'bract':
      return bract(sp);
    case 'nopal':
      return nopalFlower(sp);
    default:
      return radial(sp);
  }
}

/** A leaf from (x, y) at angle `a`: outlined, with its midrib. */
function leaf(x: number, y: number, a: number, s = 1, color = 'var(--leaf)', key?: string): El {
  return (
    <g key={key} transform={`translate(${x} ${y}) rotate(${a}) scale(${s})`}>
      <path
        d="M0 0C5 -7.5 15 -7.5 20 0C15 5.5 5 5.5 0 0Z"
        fill={color}
        stroke="var(--plant-line)"
        stroke-width={LW / s}
        stroke-linejoin="round"
      />
      <path d="M1.5 0Q10 -1.6 17.5 0" fill="none" stroke="#ffffff" stroke-width={0.9} opacity={0.4} />
    </g>
  );
}

/** A stem: outline, body and a thin light edge. */
function stem(d: string, w = 3.4): El {
  return (
    <g fill="none" stroke-linecap="round">
      <path d={d} stroke="var(--plant-line)" stroke-width={w + 2.2} />
      <path d={d} stroke="var(--leaf)" stroke-width={w} />
      <path d={d} stroke="var(--leaf-2)" stroke-width={w * 0.3} transform="translate(-0.7 0)" opacity={0.9} />
    </g>
  );
}

function Ground() {
  return (
    <g>
      <ellipse cx={50} cy={91} rx={26} ry={7} fill="var(--soil)" stroke="var(--soil-line)" stroke-width={LW} />
      <path d="M25 91Q50 101 75 91Q50 96.5 25 91Z" fill="var(--soil-2)" />
      <ellipse cx={37} cy={89.6} rx={1.9} ry={1.1} fill="var(--soil-3)" />
      <ellipse cx={64} cy={92} rx={1.5} ry={0.9} fill="var(--soil-3)" />
      <path
        d="M30 90.5l-1.6-5M31.8 90.6l.4-6.2M33.6 90.4l2-4.6M66 90.2l-.8-5.4M67.8 90.4l1.6-4.4"
        stroke="var(--leaf-2)"
        stroke-width={1.3}
        stroke-linecap="round"
      />
    </g>
  );
}

function body(stage: Stage, sp: Species, grow: boolean): El | null {
  const pad = sp.shape === 'nopal';
  switch (stage) {
    case 'soil':
      return <circle cx={50} cy={87} r={2} fill="var(--soil-3)" />;
    case 'seed':
      return (
        <g>
          <ellipse
            cx={50}
            cy={86.5}
            rx={7}
            ry={4.8}
            fill="#8b6b4a"
            stroke="var(--soil-line)"
            stroke-width={LW}
            transform="rotate(-12 50 86.5)"
          />
          <ellipse cx={47.6} cy={85} rx={2.2} ry={1.2} fill="#c9a882" transform="rotate(-12 47.6 85)" />
          <path d="M51 82C51 79 53 77 55 76" stroke="var(--leaf)" stroke-width={2} stroke-linecap="round" fill="none" />
        </g>
      );
    case 'sprout':
      return (
        <g>
          {stem('M50 90C49 84 51 79 50 74', 2.8)}
          <path
            d="M50 75C44 66 36 68 35 73C41 78 46 77 50 75Z"
            fill="var(--leaf-2)"
            stroke="var(--plant-line)"
            stroke-width={LW}
            stroke-linejoin="round"
          />
          <path
            d="M50 75C56 66 64 68 65 73C59 78 54 77 50 75Z"
            fill="var(--leaf)"
            stroke="var(--plant-line)"
            stroke-width={LW}
            stroke-linejoin="round"
          />
        </g>
      );
    case 'bud':
      return (
        <g>
          {stem('M50 90C47 76 53 62 50 46', 3.2)}
          {leaf(50, 74, 200, 0.95, 'var(--leaf-2)')}
          {leaf(50, 66, -20, 0.9)}
          <path
            d="M50 26C58 34 58 43 50 48C42 43 42 34 50 26Z"
            fill={sp.colors.petal}
            stroke={ink(sp.colors.shade)}
            stroke-width={LW}
            stroke-linejoin="round"
          />
          <path d="M47 32C46 36 46 40 48 43" fill="none" stroke="#ffffff" stroke-width={1.2} opacity={0.45} />
          <path
            d="M50 48C43 46 41 39 43 34L50 41L57 34C59 39 57 46 50 48Z"
            fill="var(--leaf)"
            stroke="var(--plant-line)"
            stroke-width={LW}
            stroke-linejoin="round"
          />
        </g>
      );
    default: {
      const extra = stage === 'full' || stage === 'gold';
      return (
        <g>
          {stage === 'gold' && (
            <g>
              <g opacity={0.24}>
                <circle cx={CX} cy={CY} r={33} fill="var(--gold)" class="anim-shimmer" />
              </g>
              {[
                [18, 20],
                [82, 26],
                [22, 52],
                [80, 56],
              ].map(([x, y], i) => (
                <path
                  key={i}
                  d={`M${x} ${(y as number) - 5}L${(x as number) + 1.4} ${(y as number) - 1.4}L${(x as number) + 5} ${y}L${(x as number) + 1.4} ${(y as number) + 1.4}L${x} ${(y as number) + 5}L${(x as number) - 1.4} ${(y as number) + 1.4}L${(x as number) - 5} ${y}L${(x as number) - 1.4} ${(y as number) - 1.4}Z`}
                  fill="var(--gold)"
                  class="anim-twinkle"
                  style={`animation-delay:${i * 420}ms`}
                />
              ))}
            </g>
          )}
          {pad ? (
            <g stroke="var(--plant-line)" stroke-width={LW}>
              <ellipse cx={50} cy={70} rx={16} ry={21} fill="var(--leaf)" />
              <ellipse cx={66} cy={78} rx={9} ry={12} fill="var(--leaf-2)" transform="rotate(35 66 78)" />
              <ellipse cx={45} cy={62} rx={4} ry={8} fill="#ffffff" stroke="none" opacity={0.18} />
              {[
                [44, 60],
                [56, 64],
                [46, 76],
                [55, 82],
                [50, 68],
              ].map(([x, y]) => (
                <circle key={`${x}${y}`} cx={x} cy={y} r={0.9} fill="#f1f3c4" stroke="none" />
              ))}
            </g>
          ) : (
            <g>
              {stem('M50 90C47 74 53 58 50 40')}
              {sp.shape === 'lotus' ? (
                <ellipse
                  cx={50}
                  cy={86}
                  rx={20}
                  ry={5}
                  fill="var(--leaf-2)"
                  stroke="var(--plant-line)"
                  stroke-width={LW}
                />
              ) : (
                <>
                  {leaf(50, 76, 205, 1, 'var(--leaf-2)')}
                  {leaf(50, 66, -25, 0.95)}
                  {extra && leaf(50, 84, -30, 0.85, 'var(--leaf)', 'x1')}
                  {extra && leaf(50, 58, 210, 0.75, 'var(--leaf-2)', 'x2')}
                </>
              )}
            </g>
          )}
          <g transform={extra ? `translate(${CX} ${CY}) scale(1.06) translate(${-CX} ${-CY})` : undefined}>
            <g class={grow ? 'anim-bloom' : undefined}>{head(sp)}</g>
          </g>
        </g>
      );
    }
  }
}

export interface PlantProps {
  stage: Stage;
  species: string;
  size?: number;
  sway?: boolean;
  /** Animate the current stage in (growth or bloom). */
  grow?: boolean;
  ground?: boolean;
  label?: string;
  class?: string;
}

export function Plant({
  stage,
  species,
  size = 64,
  sway = false,
  grow = false,
  ground = true,
  label,
  class: cls,
}: PlantProps) {
  const sp = SPECIES_BY_ID.get(species) ?? (SPECIES[0] as Species);
  const bloomed = stage === 'bloom' || stage === 'full' || stage === 'gold';
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      class={cls}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      data-stage={stage}
      data-flower={stage === 'soil' ? 'seed' : bloomed ? 'flower' : 'bud'}
      overflow="visible"
    >
      {ground && <Ground />}
      <g class={`${sway ? 'sway' : ''}${grow && !bloomed ? ' anim-grow' : ''}`}>{body(stage, sp, grow)}</g>
    </svg>
  );
}

export function Bee({ x, y, size = 14 }: { x: number; y: number; size?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size / 14})`}>
      <g class="anim-flutter">
        <g opacity={0.9}>
          <ellipse
            cx={-2}
            cy={-5}
            rx={4}
            ry={3}
            fill="#ffffff"
            stroke="#3b2412"
            stroke-width={0.8}
            class="anim-wings"
          />
          <ellipse cx={3} cy={-5} rx={4} ry={3} fill="#ffffff" stroke="#3b2412" stroke-width={0.8} class="anim-wings" />
        </g>
        <ellipse cx={0} cy={0} rx={6} ry={4.2} fill="#f5b82e" stroke="#3b2412" stroke-width={1} />
        <path d="M-2 -4V4M2 -4V4" stroke="#3b2412" stroke-width={1.6} />
        <circle cx={6} cy={-0.5} r={2.2} fill="#3b2412" />
      </g>
    </g>
  );
}

export function Butterfly({
  x,
  y,
  size = 18,
  monarch = false,
}: {
  x: number;
  y: number;
  size?: number;
  monarch?: boolean;
}) {
  const wing = monarch ? '#f59f00' : '#b197fc';
  const edge = monarch ? '#3b2412' : '#5f3dc4';
  return (
    <g transform={`translate(${x} ${y}) scale(${size / 18})`}>
      <g class="anim-flutter">
        <g class="anim-wings">
          <path d="M0 0C-9 -12 -16 -6 -11 1C-15 7 -7 10 0 2Z" fill={wing} stroke={edge} stroke-width={1.3} />
          <path d="M0 0C9 -12 16 -6 11 1C15 7 7 10 0 2Z" fill={wing} stroke={edge} stroke-width={1.3} />
          <circle cx={-8} cy={-4} r={1.5} fill="#ffffff" opacity={0.8} />
          <circle cx={8} cy={-4} r={1.5} fill="#ffffff" opacity={0.8} />
        </g>
        <ellipse cx={0} cy={1} rx={1.3} ry={5} fill={edge} />
      </g>
    </g>
  );
}
