import type { AssetMetadata } from 'expo-media-library';

import { createDiagnosticCorrelationId, recordAppDiagnostic } from '@/diagnostics/app-diagnostics';
import { assessWindow, findCandidateWindows, inferHomeOffsetMinutes, scanCaptureMetadata, selectMembers, windowPhotoIds, type CandidateWindow, type CaptureAsset, type CaptureRecord } from './index';
import type { ReadCaptureMetadata } from './capture-metadata';
import type { ConfirmedPlace, TravelWindowStorage } from './storage';

/**
 * Production discovery driver for GPS-less trip detection (decision
 * 0019/0020). Deliberately self-contained: unlike visual-place's discovery,
 * this never reads reconstruction state (no shadow-stamp staleness check, no
 * privacy/account gating) because it depends on none of it — its only inputs
 * are this device's photo library and its own storage. Scope cut, stated
 * honestly: this drives only from a foreground-focus loop (see
 * `useTravelWindowDiscovery`); decision 0004's background-task path is not
 * wired in this pass (see delivery.md).
 */

// Small enough that one batch's native EXIF reads stay fast on a mid-range
// device, matching visual-place's own page-sized increments.
const SCAN_BATCH_SIZE = 150;
export const travelWindowDiscoveryPauseMillis = 250;
const travelWindowPolicyVersion = 'travel-window-v1';
// Matches visual-place's own album page size (visualProposalPageSize).
export const travelWindowProposalPageSize = 12;

export function travelWindowCommand(window: Pick<CandidateWindow, 'startMillis' | 'endMillis'>): string {
  return `${travelWindowPolicyVersion}:${window.startMillis}:${window.endMillis}`;
}

export type TravelWindowProposalToken = { command: string; startMillis: number; endMillis: number };
export type TravelWindowProposal = {
  token: TravelWindowProposalToken;
  startDate: string; endDate: string; days: number; cameraCount: number; shiftMinutes: number | null;
};
export type TravelWindowDiscoveryResult = { proposal: TravelWindowProposal | null; more: boolean };
export type TravelWindowPhoto = { id: string; uri: string };
export type ResolveOwnerPreviews = (assetIds: (string | null)[], limit: number) =>
  Promise<{ uri: string | null; availability: 'available' | 'unavailable'; kind: 'photo' | 'video' }[]>;

export type AutomaticTravelWindowDiscovery = {
  enabled: boolean;
  discover(signal: AbortSignal): Promise<TravelWindowDiscoveryResult>;
  /** Lets the owner look at the window's own photos before naming a place; never required to confirm or dismiss. */
  loadPhotos(token: TravelWindowProposalToken, page: number, signal: AbortSignal): Promise<{ photos: TravelWindowPhoto[]; hasMore: boolean } | null>;
  confirm(token: TravelWindowProposalToken, place: ConfirmedPlace, signal: AbortSignal): Promise<boolean>;
  dismiss(token: TravelWindowProposalToken, signal: AbortSignal): Promise<boolean>;
};

function toProposal(window: CandidateWindow): TravelWindowProposal {
  return {
    token: { command: travelWindowCommand(window), startMillis: window.startMillis, endMillis: window.endMillis },
    startDate: new Date(window.startMillis).toISOString().slice(0, 10),
    endDate: new Date(window.endMillis).toISOString().slice(0, 10),
    days: Math.max(1, Math.round((window.endMillis - window.startMillis) / 86_400_000)),
    cameraCount: window.cameraCount,
    shiftMinutes: window.shiftMinutes,
  };
}

/** The first undecided travel-looking window, newest first — matches the scan order, so a recent trip surfaces first. */
function firstPendingProposal(records: readonly CaptureRecord[], dispositions: ReadonlyMap<string, 'confirmed' | 'dismissed'>): TravelWindowProposal | null {
  const home = { offsetMinutes: inferHomeOffsetMinutes(records) };
  const windows = findCandidateWindows(records, home).filter((window) => assessWindow(window).travelLooking);
  windows.sort((a, b) => b.startMillis - a.startMillis);
  const pending = windows.find((window) => !dispositions.has(travelWindowCommand(window)));
  return pending ? toProposal(pending) : null;
}

// Lazy, like photo-access/native-adapter.ts's mediaLibrary() — a top-level
// import of expo-media-library fails to load its native binding outside a
// real native runtime (e.g. provider.tsx's own Jest tests).
function mediaLibrary(): typeof import('expo-media-library') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-media-library');
}

async function queryBatch(order: 'asc' | 'desc', boundary: { field: 'gt' | 'lt'; millis: number } | null): Promise<AssetMetadata[]> {
  const { AssetField, MediaType, Query } = mediaLibrary();
  let query = new Query().eq(AssetField.MEDIA_TYPE, MediaType.IMAGE).orderBy({ key: AssetField.CREATION_TIME, ascending: order === 'asc' });
  if (boundary) query = boundary.field === 'gt' ? query.gt(AssetField.CREATION_TIME, boundary.millis) : query.lt(AssetField.CREATION_TIME, boundary.millis);
  return query.limit(SCAN_BATCH_SIZE).exeForMetadata();
}

/**
 * One bounded step: reads up to SCAN_BATCH_SIZE new assets (oldest-first
 * backfill, then newest-first catch-up once backfill is complete), persists
 * them, and recomputes candidates over everything cached so far. Safe to
 * call repeatedly; each call does a bounded amount of native work.
 */
export async function stepTravelWindowDiscovery(
  read: ReadCaptureMetadata, storage: TravelWindowStorage, signal: AbortSignal,
): Promise<TravelWindowDiscoveryResult> {
  const correlationId = createDiagnosticCorrelationId();
  const none: TravelWindowDiscoveryResult = { proposal: null, more: false };
  let state: Awaited<ReturnType<TravelWindowStorage['readScanState']>>;
  let dispositions: Awaited<ReturnType<TravelWindowStorage['readDispositions']>>;
  try {
    [state, dispositions] = await Promise.all([storage.readScanState(), storage.readDispositions()]);
  } catch {
    return none; // Already diagnosed inside storage; stop this loop rather than retry-storm.
  }
  if (signal.aborted) return none;

  if (!state.cursor.backfillComplete) {
    const page = await queryBatch('desc', state.cursor.backfillCursorMillis === null ? null : { field: 'lt', millis: state.cursor.backfillCursorMillis });
    if (signal.aborted) return none;
    const assets: CaptureAsset[] = page.flatMap((item) => item.creationTime === null ? [] : [{ id: item.id, uri: item.id, capturedAtMillis: item.creationTime, located: false }]);
    const scan = await scanCaptureMetadata(read, assets, { correlationId, record: recordAppDiagnostic, signal });
    if (scan.status !== 'complete') return none;
    const backfillComplete = page.length < SCAN_BATCH_SIZE;
    try {
      await storage.writeScanBatch(scan.records, {
        backfillCursorMillis: assets.length ? Math.min(...assets.map((a) => a.capturedAtMillis)) : state.cursor.backfillCursorMillis,
        backfillComplete,
        newestCursorMillis: state.cursor.newestCursorMillis ?? (assets.length ? Math.max(...assets.map((a) => a.capturedAtMillis)) : null),
      });
    } catch { return none; }
    const merged = [...state.captures, ...scan.records];
    return { proposal: firstPendingProposal(merged, dispositions), more: !backfillComplete };
  }

  if (state.cursor.newestCursorMillis !== null) {
    const page = await queryBatch('asc', { field: 'gt', millis: state.cursor.newestCursorMillis });
    if (signal.aborted) return none;
    if (page.length) {
      const assets: CaptureAsset[] = page.flatMap((item) => item.creationTime === null ? [] : [{ id: item.id, uri: item.id, capturedAtMillis: item.creationTime, located: false }]);
      const scan = await scanCaptureMetadata(read, assets, { correlationId, record: recordAppDiagnostic, signal });
      if (scan.status !== 'complete') return none;
      try {
        await storage.writeScanBatch(scan.records, { newestCursorMillis: assets.length ? Math.max(...assets.map((a) => a.capturedAtMillis)) : state.cursor.newestCursorMillis });
      } catch { return none; }
      return { proposal: firstPendingProposal([...state.captures, ...scan.records], dispositions), more: page.length >= SCAN_BATCH_SIZE };
    }
  }
  return { proposal: firstPendingProposal(state.captures, dispositions), more: false };
}

export function createAutomaticTravelWindowDiscovery(options: { read: ReadCaptureMetadata | null; storage: TravelWindowStorage; enabled: boolean; resolvePreviews?: ResolveOwnerPreviews | null }): AutomaticTravelWindowDiscovery | null {
  const { read, storage, enabled, resolvePreviews } = options;
  if (!read) return null;
  return {
    enabled,
    discover: (signal) => stepTravelWindowDiscovery(read, storage, signal),
    async loadPhotos(token, page, signal) {
      if (!resolvePreviews || !Number.isSafeInteger(page) || page < 0) return null;
      try {
        const state = await storage.readScanState();
        if (signal.aborted) return null;
        const ids = windowPhotoIds({ startMillis: token.startMillis, endMillis: token.endMillis }, state.captures);
        const start = page * travelWindowProposalPageSize;
        if (start > ids.length) return null;
        const pageIds = ids.slice(start, start + travelWindowProposalPageSize);
        const previews = await resolvePreviews(pageIds, pageIds.length);
        if (signal.aborted) return null;
        if (previews.length !== pageIds.length) return null;
        const photos: TravelWindowPhoto[] = [];
        previews.forEach((preview, index) => {
          if (preview.kind === 'photo' && preview.availability === 'available' && typeof preview.uri === 'string') {
            photos.push({ id: pageIds[index]!, uri: preview.uri });
          }
        });
        return { photos, hasMore: start + travelWindowProposalPageSize < ids.length };
      } catch {
        return null;
      }
    },
    async confirm(token, place, signal) {
      try {
        // readScanState/confirmWindow each emit their own closed diagnostic
        // on failure (storage.ts); re-recording here would double-count one
        // terminal emission, so this just turns a throw into `false`.
        const state = await storage.readScanState();
        if (signal.aborted) return false;
        const members = selectMembers({ startMillis: token.startMillis, endMillis: token.endMillis }, state.captures);
        const manualId = `travel-window-${token.startMillis}-${token.endMillis}-${Date.now().toString(36)}`;
        const dateRange = { startDay: new Date(token.startMillis).toISOString().slice(0, 10), endDay: new Date(token.endMillis).toISOString().slice(0, 10) };
        await storage.confirmWindow(token.command, manualId, members.memberIds, members.reviewIds, place, dateRange);
        return true;
      } catch {
        return false;
      }
    },
    async dismiss(token, signal) {
      if (signal.aborted) return false;
      try {
        await storage.dismissWindow(token.command);
        return true;
      } catch {
        return false;
      }
    },
  };
}
