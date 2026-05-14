// Timezone-aware "start of period" helpers. The server may run in any TZ
// (usually UTC); calendar boundaries like "today" must follow the caller's
// IANA timezone (eg. "Europe/Istanbul"). Postgres stores UTC, so each helper
// returns a UTC `Date` representing the instant of 00:00 *in the target tz*.

const VALID_TZ_CACHE = new Map<string, boolean>();

export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  const cached = VALID_TZ_CACHE.get(tz);
  if (cached !== undefined) return cached;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    VALID_TZ_CACHE.set(tz, true);
    return true;
  } catch {
    VALID_TZ_CACHE.set(tz, false);
    return false;
  }
}

export function normalizeTz(tz: string | null | undefined): string {
  if (tz && isValidTimeZone(tz)) return tz;
  return "UTC";
}

// Return the calendar parts of `instant` as observed in `tz`.
function partsInTz(instant: Date, tz: string): {
  year: number; month: number; day: number;
  hour: number; minute: number; second: number;
} {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const out = { year: 0, month: 0, day: 0, hour: 0, minute: 0, second: 0 };
  for (const p of fmt.formatToParts(instant)) {
    if (p.type === "year") out.year = Number(p.value);
    else if (p.type === "month") out.month = Number(p.value);
    else if (p.type === "day") out.day = Number(p.value);
    else if (p.type === "hour") out.hour = Number(p.value) % 24;
    else if (p.type === "minute") out.minute = Number(p.value);
    else if (p.type === "second") out.second = Number(p.value);
  }
  return out;
}

// Convert (year, month, day, hour, minute, second) in `tz` to a UTC instant.
// Works by exploiting that the offset of (Y,M,D,h,m,s) interpreted as UTC vs
// the same wall-clock interpreted in `tz` equals the tz offset at that moment.
function tzWallToUtc(
  year: number, month: number, day: number,
  hour: number, minute: number, second: number,
  tz: string,
): Date {
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const parts = partsInTz(new Date(asUtc), tz);
  const asUtcFromParts = Date.UTC(
    parts.year, parts.month - 1, parts.day,
    parts.hour, parts.minute, parts.second,
  );
  const offset = asUtcFromParts - asUtc; // tz minus UTC, in ms
  return new Date(asUtc - offset);
}

export function startOfDayInTz(now: Date, tz: string): Date {
  const t = normalizeTz(tz);
  const { year, month, day } = partsInTz(now, t);
  return tzWallToUtc(year, month, day, 0, 0, 0, t);
}

// ISO week start (Monday 00:00) in the given tz.
export function startOfWeekInTz(now: Date, tz: string): Date {
  const t = normalizeTz(tz);
  const today = startOfDayInTz(now, t);
  // Day-of-week as observed in tz. JS getUTCDay on `today` would yield the
  // UTC day, which may differ; ask the formatter for the local weekday.
  const wdFmt = new Intl.DateTimeFormat("en-US", { timeZone: t, weekday: "short" });
  const wd = wdFmt.format(today);
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const offset = map[wd] ?? 0;
  return new Date(today.getTime() - offset * 86_400_000);
}

export function startOfMonthInTz(now: Date, tz: string): Date {
  const t = normalizeTz(tz);
  const { year, month } = partsInTz(now, t);
  return tzWallToUtc(year, month, 1, 0, 0, 0, t);
}

export function startOfYearInTz(now: Date, tz: string): Date {
  const t = normalizeTz(tz);
  const { year } = partsInTz(now, t);
  return tzWallToUtc(year, 1, 1, 0, 0, 0, t);
}
