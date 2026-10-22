// A species card from the herbarium.
import { fill } from '../../shared/domain/format';
import { isRare, SPECIES_BY_ID } from '../../shared/game/species';
import { speciesText } from '../../shared/game/species-text';
import { Plant } from '../components/Plant';
import { Sheet } from '../components/Sheet';
import { gardenCopy } from '../copy/more';
import { speciesCounts } from '../garden-state';
import { closeSheet } from '../state/ui';

export default function SpeciesInfo({ id }: { id: string }) {
  const sp = SPECIES_BY_ID.get(id);
  if (!sp) return null;
  const n = speciesCounts.value.get(id) ?? 0;
  return (
    <Sheet
      label={speciesText(sp.id).name}
      onClose={closeSheet}
      header={<h2 class="title">{speciesText(sp.id).name}</h2>}
    >
      <div
        class="mb-2 flex flex-col items-center rounded-[24px] pt-3 pb-5 text-center"
        style="background: linear-gradient(180deg, var(--sky-2), var(--sky-1))"
      >
        <Plant stage="bloom" species={sp.id} size={170} grow />
        <p class="secondary muted italic">{speciesText(sp.id).latin}</p>
        <p class="headline mt-2 max-w-[30ch]">{speciesText(sp.id).fact}</p>
        <div class="mt-3 flex flex-wrap justify-center gap-2">
          {isRare(sp) && <span class="badge gold">{gardenCopy.rare}</span>}
          {sp.level < 0 && <span class="badge accent">{gardenCopy.seasonal}</span>}
          {n > 0 && <span class="badge leaf">{n === 1 ? gardenCopy.grownOne : fill(gardenCopy.grown, { n })}</span>}
        </div>
      </div>
    </Sheet>
  );
}
