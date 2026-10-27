/** Pure shared v1 contract. Never contains source IDs, storage paths or credentials. */
export const SHARE_CONTRACT = 'travel-life-share-v1';
export type ShareDate = { value: string; precision: 'day' | 'month' | 'year' };
export type ShareDestination = { key: string; name: string; country: string; centroid: { latitude: number; longitude: number } | null; date: ShareDate | null; status: 'inferred' | 'confirmed' };
export type ShareMedia = { key: string; kind: 'photo' | 'video'; mimeType: 'image/jpeg' | 'video/mp4'; width: number; height: number; durationMillis: number | null; byteLength: number; sha256: string; caption: string };
export type ShareSnapshot = { schemaVersion: typeof SHARE_CONTRACT; version: string; kind: 'journey' | 'lifetime-highlight'; title: string; destinations: ShareDestination[]; chapters: { destinationKey: string; mediaKeys: string[] }[]; media: ShareMedia[]; summary: { destinationCount: number; mediaCount: number } };
export const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export const keys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).length === allowed.length && allowed.every(key => Object.hasOwn(value, key));
export const opaque = (value: unknown, min = 1, max = 128): value is string => typeof value === 'string' && value.length >= min && value.length <= max && /^[A-Za-z0-9_-]+$/.test(value);
const text = (value: unknown, max: number, empty = false) => typeof value === 'string' && (empty || value.length > 0) && [...value].length <= max && !/[<>\u0000-\u001f\u007f]|(?:https?:|javascript:|data:|file:|content:)/i.test(value);
const integer = (value: unknown, min: number, max: number): value is number => Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max;
const date = (value: unknown) => {
  if (value === null) return true;
  if (!object(value) || !keys(value, ['value', 'precision']) || typeof value.value !== 'string') return false;
  const format = value.precision === 'day' ? /^\d{4}-\d{2}-\d{2}$/ : value.precision === 'month' ? /^\d{4}-\d{2}$/ : value.precision === 'year' ? /^\d{4}$/ : null;
  if (!format?.test(value.value) || value.value.startsWith('0000')) return false;
  const day = value.value + (value.precision === 'month' ? '-01' : value.precision === 'year' ? '-01-01' : '');
  const parsed = new Date(day + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day;
};
export function validateSnapshot(value: unknown): ShareSnapshot | null {
  try {
    if (!object(value) || !keys(value, ['schemaVersion', 'version', 'kind', 'title', 'destinations', 'chapters', 'media', 'summary']) || value.schemaVersion !== SHARE_CONTRACT || !opaque(value.version) || !['journey', 'lifetime-highlight'].includes(String(value.kind)) || !text(value.title, 120)) return null;
    if (new TextEncoder().encode(JSON.stringify(value)).byteLength > 262_144 || !Array.isArray(value.destinations) || value.destinations.length < 1 || value.destinations.length > 1000 || !Array.isArray(value.media) || value.media.length > 100 || !Array.isArray(value.chapters) || value.chapters.length !== value.destinations.length) return null;
    const destinations = new Set<string>(); const media = new Set<string>();
    for (const d of value.destinations) {
      if (!object(d) || !keys(d, ['key', 'name', 'country', 'centroid', 'date', 'status']) || !opaque(d.key) || destinations.has(d.key) || !text(d.name, 200) || !text(d.country, 200, true) || !date(d.date) || !['inferred', 'confirmed'].includes(String(d.status))) return null;
      if (d.centroid !== null && (!object(d.centroid) || !keys(d.centroid, ['latitude', 'longitude']) || typeof d.centroid.latitude !== 'number' || !Number.isFinite(d.centroid.latitude) || Math.abs(d.centroid.latitude) > 90 || typeof d.centroid.longitude !== 'number' || !Number.isFinite(d.centroid.longitude) || Math.abs(d.centroid.longitude) > 180)) return null;
      destinations.add(d.key);
    }
    let bytes = 0;
    for (const m of value.media) {
      if (!object(m) || !keys(m, ['key', 'kind', 'mimeType', 'width', 'height', 'durationMillis', 'byteLength', 'sha256', 'caption']) || !opaque(m.key) || media.has(m.key) || !integer(m.width, 1, 1600) || !integer(m.height, 1, 1600) || !integer(m.byteLength, 1, 52_428_800) || typeof m.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(m.sha256) || !text(m.caption, 200, true)) return null;
      if (m.kind === 'photo' ? m.mimeType !== 'image/jpeg' || m.durationMillis !== null : m.kind !== 'video' || m.mimeType !== 'video/mp4' || Math.min(m.width, m.height) > 720 || !integer(m.durationMillis, 1, 3_600_000)) return null;
      media.add(m.key); bytes += m.byteLength;
    }
    if (bytes > 262_144_000) return null;
    const chapterDestinations = new Set<string>(); const referenced = new Set<string>();
    for (const c of value.chapters) {
      if (!object(c) || !keys(c, ['destinationKey', 'mediaKeys']) || typeof c.destinationKey !== 'string' || !destinations.has(c.destinationKey) || chapterDestinations.has(c.destinationKey) || !Array.isArray(c.mediaKeys) || c.mediaKeys.length > 100) return null;
      chapterDestinations.add(c.destinationKey);
      for (const key of c.mediaKeys) { if (typeof key !== 'string' || !media.has(key) || referenced.has(key)) return null; referenced.add(key); }
    }
    if (referenced.size !== media.size || !object(value.summary) || !keys(value.summary, ['destinationCount', 'mediaCount']) || value.summary.destinationCount !== destinations.size || value.summary.mediaCount !== media.size) return null;
    return value as ShareSnapshot;
  } catch { return null; }
}
export async function sha256(bytes: Uint8Array | string) {
  const data = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  const hash = await crypto.subtle.digest('SHA-256', data as BufferSource);
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
/** Canonical key ordering binds retries to one complete immutable value. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (object(value)) return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
export function parseRange(value: string | null, size: number): { start: number; end: number } | null {
  if (!value || !Number.isSafeInteger(size) || size < 1) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2])) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || start > end || end >= size || !match[1] && Number(match[2]) < 1) return null;
  return { start, end };
}
const operations = new Set(['SHARE_PUBLISH', 'SHARE_READ', 'SHARE_MANAGE', 'SHARE_DELETE_ALL', 'SHARE_CLEANUP']);
const stages = new Set(['SHARE_SERIALIZE', 'SHARE_AUTH', 'SHARE_QUOTA', 'SHARE_UPLOAD', 'SHARE_VERIFY', 'SHARE_ACTIVATE', 'SHARE_ACK', 'SHARE_RECONCILE', 'SHARE_REVOKE', 'SHARE_EXPIRY_UPDATE', 'SHARE_DELETE_FENCE', 'SHARE_TOKEN', 'SHARE_SNAPSHOT', 'SHARE_MEDIA', 'SHARE_MAP', 'SHARE_OBJECT_DELETE', 'SHARE_CLEANUP_LEASE', 'SHARE_CLEANUP_ACK']);
const reasons = new Set(['START', 'COMPLETE', 'SKIPPED', 'INVALID_REQUEST', 'ACCESS', 'QUOTA', 'CONFLICT', 'FENCED', 'TERMINAL', 'UNAVAILABLE', 'UNKNOWN']);
const outcomes = new Set(['unchanged', 'failed', 'skipped', 'complete']);
export function newCorrelation() { return 'share_' + crypto.randomUUID().replaceAll('-', ''); }
export function safeCorrelation(value: unknown) { return typeof value === 'string' && /^(?:share_[a-f0-9]{32}|local_[a-z0-9]{8,32}|runtime-[a-z0-9]+-[a-z0-9]+)$/.test(value) ? value : newCorrelation(); }
export function createShareDiagnostic(sink: (event: Record<string, unknown>) => void) {
  return (event: Record<string, unknown>) => {
    if (!operations.has(String(event.operation)) || !stages.has(String(event.stage)) || !reasons.has(String(event.reasonCode)) || !outcomes.has(String(event.durableOutcome))) return;
    sink({ operation: event.operation, stage: event.stage, reasonCode: event.reasonCode, retryable: event.retryable === true, durableOutcome: event.durableOutcome, correlationId: safeCorrelation(event.correlationId) });
  };
}

