import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

const tmp = mkdtempSync(join(tmpdir(), 'rig-digest-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('readNight', () => {
  it('reads 2026-10-28: 5 jobs, 1 bad line', () => {
    const n = readNight('runs', '2026-10-28');
    expect(n).not.toBeNull();
    if (!n) return;
    expect(n.night).toBe('2026-10-28');
    expect(n.badLines).toBe(1);
    expect(n.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(n.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
    const fx = n.rows.find((r) => r.job === 'fixtures/refresh');
    expect(fx).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    const sync = n.rows.find((r) => r.job === 'lane/sync');
    expect(sync?.firstAt).toBe('2026-10-28T23:00:06+01:00');
    expect(sync?.lastAt).toBe('2026-10-29T05:00:04+01:00');
  });

  it('keeps a row whose owner is null', () => {
    const row = readNight('runs', '2026-10-28')?.rows.find((r) => r.job === 'digest/render');
    expect(row?.owner).toBeNull();
    expect(row?.lastError).toBeNull();
  });

  it('returns null when the night has no file', () => {
    expect(readNight(tmp, '1999-01-01')).toBeNull();
  });

  it('gives no rows for an empty file', () => {
    writeFileSync(join(tmp, '2026-01-01.jsonl'), '');
    expect(readNight(tmp, '2026-01-01')).toEqual({
      night: '2026-01-01',
      rows: [],
      badLines: 0,
      counts: { ok: 0, retry: 0, fail: 0 },
    });
  });

  it('counts lines of the wrong shape as bad, skips blank lines', () => {
    writeFileSync(
      join(tmp, '2026-01-02.jsonl'),
      [
        '{"at":"2026-01-02T01:00:00+01:00","job":"a","status":"ok","owner":"x"}',
        '{"at":"2026-01-02T02:00:00+01:00","job":"a","status":"done","owner":"x"}',
        '{"at":"2026-01-02T03:00:00+01:00","job":7,"status":"ok","owner":"x"}',
        '[1,2]',
        '',
        '',
      ].join('\n'),
    );
    const n = readNight(tmp, '2026-01-02');
    expect(n?.badLines).toBe(3);
    expect(n?.rows).toHaveLength(1);
  });
});
