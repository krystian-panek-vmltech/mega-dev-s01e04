// Plan morning-digest § 1. The contract every part of § 2 builds against.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl, once parsed.
export type RunLine = {
  at: string; // ISO 8601 with the log's own offset; never converted
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job for a night.
export type DigestRow = {
  job: string;
  owner: string | null; // null renders as "—"
  runs: number; // lines for this job
  retries: number; // lines with status "retry"
  lastStatus: RunStatus; // status of the latest line
  lastError: string | null; // latest `error` seen for this job, or null
  firstAt: string; // earliest `at`, offset kept
  lastAt: string; // latest `at`, offset kept
};

export type Night = {
  night: string; // YYYY-MM-DD, the file name
  rows: DigestRow[]; // sorted by job
  badLines: number; // lines that did not parse; counted, never thrown
  counts: Record<RunStatus, number>; // lines per status, for the board
};

// Returns null when runs/<night>.jsonl does not exist (the routes answer 404).
// An empty file gives a Night with no rows.
export type ReadNight = (runsDir: string, night: string) => Night | null;
