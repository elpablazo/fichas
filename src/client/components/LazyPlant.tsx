// Startup-light plants: a tiny SVG for small sizes and first paint; the detailed renderer loads right after.
import { useEffect, useState } from 'preact/hooks';
import { SPECIES_BY_ID, type Stage } from '../../shared/game/species';
import type { PlantProps } from './Plant';

type PlantModule = typeof import('./Plant');
let mod: PlantModule | null = null;
let loading: Promise<PlantModule> | null = null;
export function loadPlant(): Promise<PlantModule> {
  loading ??= import('./Plant').then((m) => {
    mod = m;
    return m;
  });
  return loading;
}

/** Seed, sprout, bud or a simple six-petal flower in the species' colors. */
export function MiniPlant({
  stage,
  species,
  size = 26,
  label,
}: Pick<PlantProps, 'stage' | 'species' | 'size' | 'label'>) {
  const c = SPECIES_BY_ID.get(species)?.colors ?? { petal: '#f7a1c4', shade: '#e77fb0', center: '#f5c13a' };
  const bloomed = stage === 'bloom' || stage === 'full' || stage === 'gold';
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      data-stage={stage}
      data-flower={stage === 'soil' ? 'seed' : bloomed ? 'flower' : 'bud'}
    >
      <ellipse cx={50} cy={90} rx={26} ry={7} fill="var(--soil)" />
      {stageBody(stage as Stage, c, bloomed)}
    </svg>
  );
}

function stageBody(stage: Stage, c: { petal: string; shade: string; center: string }, bloomed: boolean) {
  if (stage === 'soil') return null;
  if (stage === 'seed') return <ellipse cx={50} cy={84} rx={9} ry={6} fill="#8b6b4a" />;
  if (stage === 'sprout')
    return (
      <g fill="var(--leaf)">
        <rect x={47} y={62} width={6} height={26} rx={3} />
        <ellipse cx={36} cy={62} rx={14} ry={7} transform="rotate(-20 36 62)" />
        <ellipse cx={64} cy={62} rx={14} ry={7} transform="rotate(20 64 62)" />
      </g>
    );
  return (
    <g>
      <rect x={47} y={40} width={6} height={48} rx={3} fill="var(--leaf)" />
      <ellipse cx={36} cy={68} rx={13} ry={6} transform="rotate(-25 36 68)" fill="var(--leaf)" />
      {stage === 'gold' && <circle cx={50} cy={34} r={32} fill="var(--gold)" opacity={0.3} />}
      {bloomed ? (
        <g>
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <ellipse key={a} cx={50} cy={20} rx={11} ry={15} fill={c.petal} transform={`rotate(${a} 50 34)`} />
          ))}
          <circle cx={50} cy={34} r={9} fill={c.center} />
        </g>
      ) : (
        <path d="M50 14C62 26 62 40 50 46C38 40 38 26 50 14Z" fill={c.petal} />
      )}
    </g>
  );
}

/** The detailed plant once its module is loaded; the mini plant until then. */
export function LazyPlant(props: PlantProps) {
  const [, setReady] = useState(!!mod);
  useEffect(() => {
    if (mod) return;
    let alive = true;
    void loadPlant().then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);
  return mod ? <mod.Plant {...props} /> : <MiniPlant {...props} />;
}
