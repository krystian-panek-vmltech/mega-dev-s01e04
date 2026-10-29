import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

let dir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
  copyFileSync(join(__dirname, '..', 'runs', '2026-10-28.jsonl'), join(dir, '2026-10-28.jsonl'));
  writeFileSync(join(dir, '2026-01-01.jsonl'), '');
  writeFileSync(
    join(dir, '2026-01-02.jsonl'),
    [
      '{"at":"2026-01-02T01:00:00+01:00","job":"b/two","status":"fail","owner":null,"error":"boom"}',
      'this is not json',
      '{"at":"2026-01-02T02:00:00+01:00","job":"a/one","status":"ok","owner":"rook"}',
      '',
    ].join('\n'),
  );
  app = createApp({
    adapter: 'test',
    installed: '2026-01-01',
    beatEverySeconds: 60,
    runsDir: dir,
  });
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

const page = async (night: string) => {
  const res = await app.request(`/digest/${night}`);
  return { res, html: await res.text() };
};
const api = async (night: string) => {
  const res = await app.request(`/api/digest/${night}`);
  return { res, json: (await res.json()) as Night };
};

describe('a night with data', () => {
  it('page answers 200 with the jobs', async () => {
    const { res, html } = await page('2026-10-28');
    expect(res.status).toBe(200);
    expect(html).toContain('lane/sync');
  });
  it('JSON answers 200 with rows', async () => {
    const { res, json } = await api('2026-10-28');
    expect(res.status).toBe(200);
    expect(json.rows.length).toBeGreaterThan(0);
  });
});

describe('a night with no file', () => {
  it('page is 404', async () => {
    expect((await page('2026-02-02')).res.status).toBe(404);
  });
  it('JSON is 404', async () => {
    expect((await api('2026-02-02')).res.status).toBe(404);
  });
});

describe('the empty night', () => {
  it('page says nothing ran', async () => {
    const { res, html } = await page('2026-01-01');
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
  });
  it('JSON has no rows', async () => {
    const { res, json } = await api('2026-01-01');
    expect(res.status).toBe(200);
    expect(json.rows).toEqual([]);
  });
});

describe('a night with a bad line', () => {
  it('page is 200 and shows it did not parse', async () => {
    const { res, html } = await page('2026-01-02');
    expect(res.status).toBe(200);
    expect(html).toContain('1 line did not parse');
    expect(html).toContain('a/one');
  });
  it('JSON counts one bad line', async () => {
    const { res, json } = await api('2026-01-02');
    expect(res.status).toBe(200);
    expect(json.badLines).toBe(1);
    expect(json.rows).toHaveLength(2);
  });
});

describe('page and JSON agree', () => {
  it.each(['2026-10-28', '2026-01-02'])('same jobs, same order for %s', async (night) => {
    const { html } = await page(night);
    const { json } = await api(night);
    const jobs = json.rows.map((r) => r.job);
    const tbody = html.slice(html.indexOf('<tbody>'));
    const shown = [...tbody.matchAll(/<tr><td>([^<]*)<\/td>/g)].map((m) => m[1]);
    expect(shown).toEqual(jobs);
  });
});
