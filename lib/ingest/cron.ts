import "server-only";

// Minimal 5-field cron parser (minute hour day-of-month month day-of-week).
// Supports: *, step (slash-N), comma-lists (1,2,3), ranges (1-5), and single numbers.
// Enough for our needs; advanced cron features (L, W, #) are not supported.
// Input: e.g. "*/15 * * * *"; output: the next matching Date after the given time.

type FieldRange = { min: number; max: number };

const MINUTE: FieldRange = { min: 0, max: 59 };
const HOUR: FieldRange = { min: 0, max: 23 };
const DOM: FieldRange = { min: 1, max: 31 };
const MONTH: FieldRange = { min: 1, max: 12 };
const DOW: FieldRange = { min: 0, max: 6 };

function parseField(raw: string, range: FieldRange): Set<number> {
  const out = new Set<number>();
  for (const part of raw.split(",")) {
    const [main, stepStr] = part.split("/");
    const step = stepStr ? Number(stepStr) : 1;
    if (!Number.isFinite(step) || step < 1) {
      throw new Error(`cron: bad step in "${part}"`);
    }
    let start: number;
    let end: number;
    if (main === "*") {
      start = range.min;
      end = range.max;
    } else if (main.includes("-")) {
      const [a, b] = main.split("-").map((s) => Number(s));
      if (!Number.isFinite(a) || !Number.isFinite(b)) {
        throw new Error(`cron: bad range "${main}"`);
      }
      start = a;
      end = b;
    } else {
      const n = Number(main);
      if (!Number.isFinite(n)) throw new Error(`cron: bad number "${main}"`);
      start = n;
      end = stepStr ? range.max : n;
    }
    for (let v = start; v <= end; v += step) {
      if (v < range.min || v > range.max) continue;
      out.add(v);
    }
  }
  if (out.size === 0) throw new Error(`cron: empty field "${raw}"`);
  return out;
}

export type ParsedCron = {
  minute: Set<number>;
  hour: Set<number>;
  dayOfMonth: Set<number>;
  month: Set<number>;
  dayOfWeek: Set<number>;
  // Raw strings for special-case "*" detection (needed for DOM+DOW OR semantics).
  domRaw: string;
  dowRaw: string;
};

export function parseCron(expr: string): ParsedCron {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`cron: expected 5 fields, got ${parts.length} in "${expr}"`);
  }
  const [m, h, dom, mo, dow] = parts;
  return {
    minute: parseField(m, MINUTE),
    hour: parseField(h, HOUR),
    dayOfMonth: parseField(dom, DOM),
    month: parseField(mo, MONTH),
    dayOfWeek: parseField(dow, DOW),
    domRaw: dom,
    dowRaw: dow,
  };
}

/**
 * Vanilla POSIX cron semantics: DOM and DOW combine with OR when both are constrained;
 */
function dayMatches(parsed: ParsedCron, d: Date): boolean {
  const domOk = parsed.dayOfMonth.has(d.getDate());
  const dowOk = parsed.dayOfWeek.has(d.getDay());
  const domStar = parsed.domRaw === "*";
  const dowStar = parsed.dowRaw === "*";
  if (domStar && dowStar) return true;
  if (domStar) return dowOk;
  if (dowStar) return domOk;
  return domOk || dowOk;
}

export function nextRun(expr: string, from: Date = new Date()): Date {
  const parsed = parseCron(expr);
  // Start at the next minute (so the current minute doesn't fire twice).
  const d = new Date(from.getTime());
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);

  for (let i = 0; i < 366 * 24 * 60; i++) {
    if (
      parsed.month.has(d.getMonth() + 1) &&
      dayMatches(parsed, d) &&
      parsed.hour.has(d.getHours()) &&
      parsed.minute.has(d.getMinutes())
    ) {
      return d;
    }
    d.setMinutes(d.getMinutes() + 1);
  }
  throw new Error(`cron: no match within 1 year for "${expr}"`);
}
