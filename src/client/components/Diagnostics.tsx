import { useEffect, useState } from 'preact/hooks';
import { fill } from '../../shared/domain/format';
import { diagnosticsCopy } from '../copy/more';
import { api } from '../db/sync';

interface Report {
  events: { name: string; n: number; p50: number; p90: number }[];
  errors: number;
}
export function Diagnostics() {
  const [report, setReport] = useState<Report | null>(null);
  useEffect(() => {
    let disposed = false;
    void api('/api/diagnostics')
      .then(async (r) => {
        if (r.ok && !disposed) setReport((await r.json()) as Report);
      })
      .catch(() => {});
    return () => {
      disposed = true;
    };
  }, []);
  return (
    <details class="card mb-4 px-4 py-1">
      <summary class="flex min-h-12 cursor-pointer items-center font-semibold">{diagnosticsCopy.title}</summary>
      <p class="caption">{diagnosticsCopy.events}</p>
      {report && <p class="caption">{fill(diagnosticsCopy.errors, { n: report.errors })}</p>}
      {report?.events.length ? (
        <table class="num mt-2 mb-3 w-full text-left text-sm">
          <thead>
            <tr>
              <th>{diagnosticsCopy.title}</th>
              <th>{diagnosticsCopy.p50}</th>
              <th>{diagnosticsCopy.p90}</th>
            </tr>
          </thead>
          <tbody>
            {report.events.map((e) => (
              <tr key={e.name}>
                <td class="max-w-36 break-words py-2">
                  {e.name}
                  <span class="caption block">{fill(diagnosticsCopy.samples, { n: e.n })}</span>
                </td>
                <td>{Math.round(e.p50)} ms</td>
                <td>{Math.round(e.p90)} ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p class="caption mt-2">{diagnosticsCopy.empty}</p>
      )}
    </details>
  );
}
