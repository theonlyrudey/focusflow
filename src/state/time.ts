// Convert seconds to "MM:SS"
export function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function startOfDay(ts: number | Date = Date.now()): number {
  const d = new Date(typeof ts === "number" ? ts : ts.getTime());
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// returns [fromInclusive, toExclusive] for common ranges
export function rangePreset(preset: "today" | "7d" | "30d"): [number, number] {
  const now = Date.now();
  const end = startOfDay(now) + 24 * 60 * 60 * 1000; // tomorrow 00:00
  if (preset === "today") {
    const start = startOfDay(now);
    return [start, end];
  }
  if (preset === "7d") {
    const start = startOfDay(now - 6 * 24 * 60 * 60 * 1000); //include today + 6 days back
    return [start, end];
  }
  // 30d
  const start = startOfDay(now - 29 * 24 * 60 * 60 * 1000);
  return [start, end];
}