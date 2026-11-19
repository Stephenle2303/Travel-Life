import type { AppDiagnosticEvent } from '@/diagnostics/app-diagnostics';
import type { CaptureRecord, ProvenanceClass } from './types';

/**
 * Maps the native capture-metadata reader (`readCaptureMetadata`) into
 * CaptureRecords. The native side returns only offset tags and the containing
 * folder; folder text stays in memory here and is never stored, rendered or
 * logged. Every failure is reduced to a fixed reason code.
 */

export type CaptureMetadataReason = 'MEDIA_ACCESS' | 'MEDIA_DECODE' | 'MEDIA_SCHEMA' | 'MEDIA_UNAVAILABLE' | 'UNKNOWN';
export type ReadCaptureMetadata = (uri: string) => Promise<unknown>;
export type CaptureAsset = { id: string; uri: string; capturedAtMillis: number; located: boolean };

export class CaptureMetadataError extends Error {
  constructor(readonly reasonCode: CaptureMetadataReason) {
    super('Capture metadata unavailable.');
    this.name = 'CaptureMetadataError';
  }
}

const offsetPattern = /^([+-])(\d{2}):(\d{2})$/;

/** EXIF `OffsetTime*` value such as `+09:00`. Anything else is unknown. */
export function parseExifOffsetMinutes(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = offsetPattern.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  if (hours > 14 || minutes >= 60 || (hours === 14 && minutes > 0)) return null;
  const total = hours * 60 + minutes;
  return match[1] === '-' ? -total : total;
}

const localTimestampPattern = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;

/**
 * EXIF `DateTimeOriginal`/`DateTimeDigitized`, the camera's own local wall
 * clock with no zone, e.g. `2026:11:03 14:30:00`. Returned as the same
 * wall-clock numbers read as if they were UTC, so subtracting a true UTC
 * instant for the same capture yields the capture's zone offset.
 */
export function parseExifLocalTimestampMillis(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = localTimestampPattern.exec(value.trim());
  if (!match) return null;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  if (month! < 1 || month! > 12 || day! < 1 || day! > 31 || hour! > 23 || minute! > 59 || second! > 59) return null;
  return Date.UTC(year!, month! - 1, day!, hour!, minute!, second!);
}

/**
 * The second, weaker clue in the spec's clue table: a capture's own local
 * wall clock compared against a true UTC instant for the same capture (e.g.
 * MediaStore's recorded creation time), for devices or photos that carry no
 * explicit offset tag. Never alone names a place, and this alone never
 * decides a window; it only reports whether the device's clock looks
 * shifted. Rounded to the nearest 15 minutes, the finest standard zone unit.
 */
export function inferOffsetFromLocalClock(localTimestampMillis: number | null, trueUtcMillis: number): number | null {
  if (localTimestampMillis === null) return null;
  const rounded = Math.round((localTimestampMillis - trueUtcMillis) / 60_000 / 15) * 15;
  return rounded < -720 || rounded > 840 ? null : rounded;
}

const messagingTokens = ['whatsapp', 'telegram', 'zalo', 'messenger', 'kakao', 'viber', 'wechat', 'weixin', 'signal'];
const messagingSegments = new Set(['line', 'com.facebook.orca', 'org.thoughtcrime.securesms']);
const screenshotSegments = new Set(['screenshots', 'screenshot', 'screenrecorder', 'screen recordings', 'screenrecordings']);

/**
 * Provenance from the storage folder only. Camera means the device's own
 * camera folder; anything unrecognised stays `unknown` and goes to review.
 */
export function classifyProvenance(relativeDirectory: unknown): ProvenanceClass {
  if (typeof relativeDirectory !== 'string') return 'unknown';
  const segments = relativeDirectory.replace(/\\/g, '/').toLowerCase().split('/').map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) return 'unknown';
  if (segments.some((s) => screenshotSegments.has(s))) return 'screenshot';
  if (segments.some((s) => messagingSegments.has(s) || messagingTokens.some((t) => s.includes(t)))) return 'messaging';
  if (segments[0] === 'download' || segments[0] === 'downloads') return 'download';
  if (segments[0] === 'dcim' && segments[1] === 'camera') return 'camera';
  return 'unknown';
}

export function classifyCaptureMetadataError(error: unknown): CaptureMetadataReason {
  if (error instanceof CaptureMetadataError) return error.reasonCode;
  const code = error && typeof error === 'object' && 'code' in error ? (error as { code: unknown }).code : null;
  if (code === 'ERR_CAPTURE_ACCESS') return 'MEDIA_ACCESS';
  if (code === 'ERR_CAPTURE_DECODE' || code === 'ERR_CAPTURE_INPUT') return 'MEDIA_DECODE';
  return 'UNKNOWN';
}

function readField(value: unknown, key: string) {
  return value && typeof value === 'object' && key in value ? (value as Record<string, unknown>)[key] : undefined;
}

/** Converts one native result. A malformed result is a schema failure, never a guess. */
export function toCaptureRecord(asset: CaptureAsset, native: unknown): CaptureRecord {
  if (!native || typeof native !== 'object' || Array.isArray(native)) throw new CaptureMetadataError('MEDIA_SCHEMA');
  const original = parseExifOffsetMinutes(readField(native, 'offsetTimeOriginal'));
  return {
    id: asset.id,
    capturedAtMillis: asset.capturedAtMillis,
    utcOffsetMinutes: original ?? parseExifOffsetMinutes(readField(native, 'offsetTimeDigitized')),
    provenance: classifyProvenance(readField(native, 'relativeDirectory')),
    located: asset.located,
  };
}

/** Conservative stand-in when one capture cannot be read: no offset, review only. */
function unreadRecord(asset: CaptureAsset): CaptureRecord {
  return { id: asset.id, capturedAtMillis: asset.capturedAtMillis, utcOffsetMinutes: null, provenance: 'unknown', located: asset.located };
}

export type CaptureScanResult =
  | { status: 'complete'; records: CaptureRecord[]; unreadable: Partial<Record<CaptureMetadataReason, number>> }
  | { status: 'blocked' | 'skipped' | 'cancelled'; reasonCode: CaptureMetadataReason | 'SKIPPED' };

export type CaptureScanOptions = {
  correlationId: string;
  record: (event: AppDiagnosticEvent) => void;
  signal?: AbortSignal;
};

function diagnostic(reasonCode: AppDiagnosticEvent['reasonCode'], outcome: AppDiagnosticEvent['durableOutcome'], retryable: boolean, correlationId: string): AppDiagnosticEvent {
  return { operation: 'TRAVEL_WINDOW_SCAN', reasonCode, stage: 'CAPTURE_METADATA_READ', retryable, durableOutcome: outcome, correlationId };
}

/**
 * Reads every asset. Access loss stops the scan (the result would be partial);
 * a single unreadable capture becomes an unknown-provenance record so it can
 * only reach review, never the album. One diagnostic per distinct reason.
 */
export async function scanCaptureMetadata(
  read: ReadCaptureMetadata | null,
  assets: readonly CaptureAsset[],
  options: CaptureScanOptions,
): Promise<CaptureScanResult> {
  const { correlationId, record, signal } = options;
  if (!read) {
    record(diagnostic('MEDIA_UNAVAILABLE', 'skipped', false, correlationId));
    return { status: 'skipped', reasonCode: 'MEDIA_UNAVAILABLE' };
  }
  const records: CaptureRecord[] = [];
  const unreadable: Partial<Record<CaptureMetadataReason, number>> = {};
  for (const asset of assets) {
    if (signal?.aborted) {
      record(diagnostic('SKIPPED', 'skipped', true, correlationId));
      return { status: 'cancelled', reasonCode: 'SKIPPED' };
    }
    try {
      records.push(toCaptureRecord(asset, await read(asset.uri)));
    } catch (error) {
      const reason = classifyCaptureMetadataError(error);
      if (reason === 'MEDIA_ACCESS') {
        record(diagnostic('MEDIA_ACCESS', 'blocked', true, correlationId));
        return { status: 'blocked', reasonCode: 'MEDIA_ACCESS' };
      }
      unreadable[reason] = (unreadable[reason] ?? 0) + 1;
      records.push(unreadRecord(asset));
    }
  }
  for (const reason of Object.keys(unreadable) as CaptureMetadataReason[]) {
    record(diagnostic(reason, reason === 'UNKNOWN' ? 'unknown' : 'complete', false, correlationId));
  }
  record(diagnostic('COMPLETE', 'complete', false, correlationId));
  return { status: 'complete', records, unreadable };
}
