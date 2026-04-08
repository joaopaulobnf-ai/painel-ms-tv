export function fromUnixTimestamp(unix) {
  if (!unix) return null;
  const ts = Number(unix);
  if (!Number.isFinite(ts) || ts <= 0) return null;
  const date = new Date(ts * 1000);
  return {
    timestamp: ts,
    iso: date.toISOString(),
    br: date.toLocaleDateString("pt-BR"),
    date
  };
}

export function isExpired(unix) {
  if (!unix) return false;
  const ts = Number(unix) * 1000;
  return Number.isFinite(ts) ? ts < Date.now() : false;
}

export function daysUntil(unix) {
  if (!unix) return null;
  const ts = Number(unix) * 1000;
  if (!Number.isFinite(ts)) return null;
  const diff = ts - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
