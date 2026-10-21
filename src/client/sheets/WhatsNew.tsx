import { CalendarDays, ChartLine, Flower2, Plus, Scale } from 'lucide-preact';
import { Sheet } from '../components/Sheet';
import { whatsNew } from '../copy/more';
import { setLocal } from '../db/dexie';
import { closeSheet } from '../state/ui';

const ITEMS = [
  { Icon: CalendarDays, text: whatsNew.days },
  { Icon: Scale, text: whatsNew.balance },
  { Icon: Flower2, text: whatsNew.garden },
  { Icon: ChartLine, text: whatsNew.weight },
  { Icon: Plus, text: whatsNew.add },
];

export default function WhatsNew() {
  const done = () => {
    void setLocal('whatsnew:1.0', true);
    closeSheet();
  };
  return (
    <Sheet
      label={whatsNew.title}
      onClose={done}
      header={<h2 class="title">{whatsNew.title}</h2>}
      footer={
        <button type="button" class="btn btn-primary w-full" onClick={done}>
          {whatsNew.ok}
        </button>
      }
    >
      <ul class="grid gap-2 py-1">
        {ITEMS.map(({ Icon, text }) => (
          <li key={text} class="well flex items-center gap-3 p-3">
            <span class="row-icon">
              <Icon size={19} aria-hidden="true" />
            </span>
            <span class="font-semibold">{text}</span>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
