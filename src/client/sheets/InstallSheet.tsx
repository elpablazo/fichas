import { Share, SquarePlus } from 'lucide-preact';
import { setSetting } from '../actions';
import { Sheet } from '../components/Sheet';
import { buttons, lines, titles } from '../copy/es-MX';
import { settings } from '../state/signals';
import { closeSheet } from '../state/ui';

export default function InstallSheet() {
  const done = () => {
    void setSetting('onboarding', { ...settings.value.onboarding, install_hint: true });
    closeSheet();
  };
  return (
    <Sheet
      label={titles.install}
      onClose={done}
      header={<h2 class="title">{titles.install}</h2>}
      footer={
        <button type="button" class="btn btn-primary w-full" onClick={done}>
          {buttons.ok}
        </button>
      }
    >
      <ol class="grid gap-3 py-2">
        <li class="well flex items-center gap-3 p-3">
          <span class="row-icon">
            <Share size={20} aria-hidden="true" />
          </span>
          <span class="font-semibold">{lines.installStep1}</span>
        </li>
        <li class="well flex items-center gap-3 p-3">
          <span class="row-icon">
            <SquarePlus size={20} aria-hidden="true" />
          </span>
          <span class="font-semibold">{lines.installStep2}</span>
        </li>
      </ol>
    </Sheet>
  );
}
