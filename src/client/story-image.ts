import { addDays, dayRange } from '../shared/domain/day';
import { fill, shortDate } from '../shared/domain/format';
import type { SeasonReport } from '../shared/domain/story';
import type { LogRow, PlanRow } from '../shared/domain/types';
import { flowerModel } from '../shared/game/garden';
import { SPECIES_BY_ID, type Stage } from '../shared/game/species';
import { gameCopy, typeLabels } from './copy/es-MX';
import { storyCopy } from './copy/more';
import { levelBefore } from './state/selectors';

/** A small canvas plant in the species' colors (same stages as the garden). */
function drawPlant(ctx: CanvasRenderingContext2D, x: number, y: number, stage: Stage, species: string) {
  const c = SPECIES_BY_ID.get(species)?.colors ?? { petal: '#f7a1c4', shade: '#e77fb0', center: '#f5c13a' };
  const leaf = '#2f9e5b';
  if (stage === 'soil') return;
  if (stage === 'seed') {
    ctx.fillStyle = '#8b6b4a';
    ctx.beginPath();
    ctx.ellipse(x, y + 22, 8, 5, -0.2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.strokeStyle = leaf;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y + 28);
  ctx.lineTo(x, stage === 'sprout' ? y + 8 : y - 4);
  ctx.stroke();
  ctx.fillStyle = leaf;
  ctx.beginPath();
  ctx.ellipse(x - 9, stage === 'sprout' ? y + 8 : y + 12, 9, 4, -0.5, 0, Math.PI * 2);
  ctx.fill();
  if (stage === 'sprout') {
    ctx.beginPath();
    ctx.ellipse(x + 9, y + 8, 9, 4, 0.5, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (stage === 'bud') {
    ctx.fillStyle = c.petal;
    ctx.beginPath();
    ctx.ellipse(x, y - 12, 8, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (stage === 'gold') {
    ctx.fillStyle = 'rgba(242, 183, 5, 0.25)';
    ctx.beginPath();
    ctx.arc(x, y - 14, 34, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let n = 0; n < 7; n++) {
    ctx.save();
    ctx.translate(x, y - 14);
    ctx.rotate((n * Math.PI * 2) / 7);
    ctx.fillStyle = n % 2 ? c.shade : c.petal;
    ctx.beginPath();
    ctx.ellipse(0, -14, 8, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = c.center;
  ctx.beginPath();
  ctx.arc(x, y - 14, 7, 0, Math.PI * 2);
  ctx.fill();
}

/** Native canvas, no food photos or remote rendering. Generated files remain on the device. */
export async function storyImage(
  plan: PlanRow,
  logs: LogRow[],
  report: SeasonReport,
  kind: 'recap' | 'report',
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = kind === 'recap' ? 1100 : 1400;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, '#fbe3ec');
  sky.addColorStop(1, '#fdf1e8');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#352d35';
  const text = (s: string, x: number, y: number, size = 28, bold = false) => {
    ctx.font = `${bold ? '700' : '400'} ${size}px system-ui`;
    ctx.fillText(s, x, y, 800);
  };
  text(storyCopy.brand, 50, 65, 24, true);
  text(kind === 'recap' ? fill(gameCopy.season, { n: report.season }) : storyCopy.report, 50, 130, 44, true);
  text(fill(storyCopy.dates, { from: shortDate(report.from), to: shortDate(report.to) }), 50, 177);
  text(fill(report.flowers === 1 ? storyCopy.flowerOne : storyCopy.flowers, { n: report.flowers }), 50, 238, 32, true);
  text(fill(report.meals === 1 ? storyCopy.mealOne : storyCopy.meals, { n: report.meals }), 50, 282);
  text(fill(report.fullDays === 1 ? storyCopy.fullDayOne : storyCopy.fullDays, { n: report.fullDays }), 50, 326);
  if (kind === 'recap') {
    text(fill(report.stamps === 1 ? storyCopy.stampOne : storyCopy.stamps, { n: report.stamps }), 50, 370);
    const start = [report.from, addDays(report.to, -34)].sort().at(-1)!;
    const days = report.to >= start ? dayRange(start, report.to) : [];
    const own = logs.filter((l) => l.plan_id === plan.id);
    days.forEach((day, i) => {
      const m = flowerModel(plan.data, own, day, report.to, { level: levelBefore(day), closed: true });
      const x = 105 + (i % 7) * 115,
        y = 470 + Math.floor(i / 7) * 112;
      if (i % 7 === 0) {
        ctx.fillStyle = '#c49a74';
        ctx.beginPath();
        ctx.roundRect(55, y + 26, 790, 14, 7);
        ctx.fill();
      }
      drawPlant(ctx, x, y, m.stage, m.species);
      ctx.fillStyle = '#6b5e6e';
      text(String(Number(day.slice(8))), x - 12, y + 66, 20);
    });
    text(fill(storyCopy.dates, { from: shortDate(start), to: shortDate(report.to) }), 50, 1050, 22);
  } else {
    const slotLabel = (key: string) => {
      const slot = plan.data.slots.find((s) => s.key === key);
      if (!slot) return storyCopy.extra;
      const siblings = plan.data.slots.filter((s) => s.label === slot.label);
      return siblings.length === 1
        ? slot.label
        : `${slot.label} · ${slot.time ?? siblings.findIndex((s) => s.key === key) + 1}`;
    };
    let y = 395;
    text(storyCopy.counted, 50, y, 30, true);
    y += 42;
    for (const s of report.slots) {
      text(`${slotLabel(s.key)}   ${s.percentOn === null ? '—' : `${s.percentOn}%`}   (${s.on}/${s.counted})`, 50, y);
      y += 40;
    }
    if (report.pending) {
      text(fill(report.pending === 1 ? storyCopy.pendingOne : storyCopy.pending, { n: report.pending }), 50, y, 22);
      y += 38;
    }
    y += 25;
    text(storyCopy.extras, 50, y, 30, true);
    y += 42;
    if (!report.extras.length) text(storyCopy.noExtras, 50, y, 25);
    for (const e of report.extras.slice(0, 5)) {
      const slot = slotLabel(e.slot);
      text(`${slot} · ${typeLabels[e.type].short}   ×${e.occasions}   +${Math.round(e.units * 100) / 100}`, 50, y, 25);
      y += 38;
    }
    y = Math.max(980, y + 45);
    text(storyCopy.weight, 50, y, 30, true);
    y += 45;
    if (!report.weights.length) text(storyCopy.noWeights, 50, y, 25);
    for (const w of report.weights.slice(-6)) {
      text(
        `${shortDate(w.day)} · ${w.kg.toFixed(1)} ${storyCopy.kg} · ${w.source === 'nutritionist' ? storyCopy.nutritionist : storyCopy.home}`,
        50,
        y,
        25,
      );
      y += 37;
    }
  }
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Image unavailable'))), 'image/png'),
  );
}
export function downloadImage(file: File) {
  const url = URL.createObjectURL(file),
    a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
