import { Download, Share2 } from 'lucide-preact';
import { useEffect, useState } from 'preact/hooks';
import { fill } from '../../shared/domain/format';
import type { SeasonReport } from '../../shared/domain/story';
import type { LogRow, PlanRow } from '../../shared/domain/types';
import { storyCopy } from '../copy/more';
import { showToast } from '../state/ui';
import { downloadImage, storyImage } from '../story-image';
import { Sheet } from './Sheet';

export function SeasonSummary({
  plan,
  logs,
  report,
  kind,
  onClose,
}: {
  plan: PlanRow;
  logs: LogRow[];
  report: SeasonReport;
  kind: 'recap' | 'report';
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState('');
  useEffect(() => {
    let disposed = false,
      url = '';
    void storyImage(plan, logs, report, kind)
      .then((blob) => {
        if (disposed) return;
        url = URL.createObjectURL(blob);
        setPreview(url);
        setFile(new File([blob], `fichas-${kind}-${report.from}.png`, { type: 'image/png' }));
      })
      .catch(() => {
        if (!disposed) showToast(storyCopy.retry);
      });
    return () => {
      disposed = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [plan, logs, report, kind]);
  const share = async () => {
    if (!file) return;
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
      else downloadImage(file);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) showToast(storyCopy.retry);
    }
  };
  return (
    <Sheet
      label={kind === 'recap' ? storyCopy.recap : storyCopy.report}
      onClose={onClose}
      header={<h2 class="title">{kind === 'recap' ? storyCopy.recap : storyCopy.report}</h2>}
    >
      <div data-testid="season-summary">
        <div class="sr-only">
          <p>{fill(report.flowers === 1 ? storyCopy.flowerOne : storyCopy.flowers, { n: report.flowers })}</p>
          <p>{fill(report.meals === 1 ? storyCopy.mealOne : storyCopy.meals, { n: report.meals })}</p>
          <p>{fill(report.fullDays === 1 ? storyCopy.fullDayOne : storyCopy.fullDays, { n: report.fullDays })}</p>
        </div>
        {preview ? (
          <img
            src={preview}
            alt={kind === 'recap' ? storyCopy.recap : storyCopy.report}
            class="my-2 w-full rounded-[18px] shadow-[0_0_0_1.5px_var(--edge)]"
          />
        ) : (
          <div class="my-2 aspect-[9/11] w-full animate-pulse rounded-[18px] bg-surface-2" />
        )}
        <button
          type="button"
          class="btn btn-primary mt-3 w-full"
          data-testid="story-share"
          disabled={!file}
          onClick={() => void share()}
        >
          <Share2 size={19} aria-hidden="true" />
          {storyCopy.share}
        </button>
        {file && (
          <button type="button" class="btn btn-neutral mt-2 w-full" onClick={() => downloadImage(file)}>
            <Download size={18} aria-hidden="true" />
            {storyCopy.download}
          </button>
        )}
      </div>
    </Sheet>
  );
}
