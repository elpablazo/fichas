import type { PlanDraftView } from '../shared/api';
import { api } from './db/sync';
import { preparePhoto } from './media/photo';

export class PlanError extends Error {
  constructor(
    public code: string,
    public duplicateId?: string,
  ) {
    super(code);
  }
}
export async function latestDraft(): Promise<PlanDraftView> {
  const res = await api('/api/plans/drafts/latest');
  if (!res.ok) throw new PlanError('network');
  return res.json() as Promise<PlanDraftView>;
}
export async function parseDraft(id: string): Promise<PlanDraftView> {
  const res = await api(`/api/plans/drafts/${id}/parse`, { method: 'POST' });
  if (res.status === 409) {
    const body = (await res.json()) as { duplicate_id?: string };
    if (body.duplicate_id) throw new PlanError('duplicate', body.duplicate_id);
  }
  if (!res.ok) throw new PlanError('network');
  return res.json() as Promise<PlanDraftView>;
}
const bytesFromBase64 = (encoded: string) => Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
const base64FromBytes = (bytes: Uint8Array) => {
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 8192) chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
  return btoa(chunks.join(''));
};
export async function uploadPlan(
  files: File[],
  progress: (state: 'preparing' | 'uploading' | 'reading', n: number) => void,
): Promise<PlanDraftView> {
  if (!navigator.onLine) throw new PlanError('offline');
  if (!files.length || files.length > 5) throw new PlanError('files');
  progress('preparing', 0);
  const prepared = await Promise.all(
    files.map(async (file, i) => {
      const pdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      if (file.size > (pdf ? 5_000_000 : 20_000_000)) throw new PlanError('files');
      const image = pdf ? null : await preparePhoto(file, 1600, 0.8);
      const bytes = image ? bytesFromBase64(image) : new Uint8Array(await file.arrayBuffer());
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) =>
        b.toString(16).padStart(2, '0'),
      ).join('');
      return {
        name: pdf ? `plan-${i + 1}.pdf` : `plan-${i + 1}.jpg`,
        type: pdf ? 'application/pdf' : 'image/jpeg',
        size: bytes.length,
        sha256: hash,
        base64: image ?? base64FromBytes(bytes),
      };
    }),
  );
  const created = await api('/api/plans/drafts', {
    method: 'POST',
    body: JSON.stringify({ files: prepared.map(({ base64: _, ...file }) => file) }),
  });
  if (created.status === 409) {
    const body = (await created.json()) as { duplicate_id: string };
    throw new PlanError('duplicate', body.duplicate_id);
  }
  if (!created.ok) throw new PlanError('network');
  const { draft_id } = (await created.json()) as { draft_id: string };
  for (const [i, file] of prepared.entries()) {
    progress('uploading', i + 1);
    const res = await api(`/api/plans/drafts/${draft_id}/files/${i}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain' },
      body: file.base64,
    });
    if (!res.ok) throw new PlanError('network');
  }
  progress('reading', 0);
  return parseDraft(draft_id);
}
export async function downloadPlanFile(id: string, n: number): Promise<void> {
  const res = await api(`/api/plans/${id}/files/${n}`);
  if (!res.ok) throw new PlanError('network');
  const type = res.headers.get('X-Original-Type') ?? 'application/pdf';
  const url = URL.createObjectURL(new Blob([bytesFromBase64(await res.text())], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `plan-${id}-${n + 1}.${type === 'application/pdf' ? 'pdf' : 'jpg'}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
