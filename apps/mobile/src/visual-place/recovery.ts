import { classifyAppDiagnosticError, createDiagnosticCorrelationId, recordAppDiagnostic, type AppDiagnosticEvent } from '@/diagnostics/app-diagnostics';
import type { VisualDateQuery } from './local-eligibility';
import { visualDiscoveryPhotoAttempts, visualDiscoveryTextAttempts } from './discovery';
import type { LandmarkEmbedding } from './landmark-embedding';
import { canonicalVisualStop, compatibleVisualPhotoClues, isVisualLocality, matchVisualSignage, resolveVisualPlace } from './place-catalog';
import { finishRegionalLandmarkSearch, searchRegionalLandmarks, type RegionalLandmarkSample } from './regional-landmarks';
import type { RegionalPackSession } from './regional-pack-loader';
export { ewhaPlace } from './place-catalog';

export const maximumVisualPhotos = 4;
export type VisualCluster = { token: object; photos: { id: string; uri: string }[]; observedPeriod: string };
export type VisualOfferPreview = Pick<VisualCluster, 'token' | 'observedPeriod'> & { hasMore?: boolean };
export type VisualPlace = { id: string; label: string; locality: string; clue: string };
export type VisualResult =
  | { status: 'proposed'; place: VisualPlace; selectedIds: string[] }
  | { status: 'recognized'; observations: VisualObservation[]; retryRegionalPack?: true }
  | { status: 'inconclusive' | 'unavailable' | 'stale' | 'cancelled' | 'retry' };
export type VisualConsent = { approvedOnDeviceAnalysis: boolean; selectedIds: readonly string[] };
export type VisualReviewDecision = { kind: 'dismiss' } | { kind: 'confirm'; correction?: { id: string; name: string } };
export type VisualPlaceReview = {
  load(signal: AbortSignal, dates?: VisualDateQuery): Promise<VisualOfferPreview | null>;
  loadPhotos(token: object, signal: AbortSignal): Promise<VisualCluster | null>;
  recognize(token: object, consent: VisualConsent, signal: AbortSignal): Promise<VisualResult>;
  review(token: object, decision: VisualReviewDecision, signal: AbortSignal): Promise<boolean>;
};
export type VisualObservation = {
  id: string; placeId: string | null; kind: 'signage' | 'image' | 'combined' | null;
  embedding?: LandmarkEmbedding;
};
export type AutomaticVisualProposal = {
  token: object; observedPeriod: string; place: VisualPlace; stops: VisualPlace[];
  covers: VisualCluster['photos']; count: number; correction: boolean; pendingPlace?: VisualPlace;
};
export type AutomaticVisualDiscovery = {
  enabled: boolean;
  settingBusy: boolean;
  settingFailed: boolean;
  setEnabled(enabled: boolean): Promise<void>;
  discover(signal: AbortSignal): Promise<{ proposal: AutomaticVisualProposal | null; more: boolean }>;
  loadAlbum(token: object, page: number, signal: AbortSignal): Promise<{ photos: VisualCluster['photos']; hasMore: boolean } | null>;
  review(token: object, decision: 'confirm' | 'dismiss', signal: AbortSignal): Promise<boolean>;
};
export type VisualStage = Extract<NonNullable<AppDiagnosticEvent['stage']>, 'HINT_ELIGIBILITY' | 'DATE_SEARCH' | 'MEDIA_SCOPE' | 'CONSENT_CHECK' | 'CONSENT_WRITE' | 'RECOGNITION' | 'LANDMARK_MODEL' | 'LANDMARK_MATCH' | 'RESULT_VALIDATE' | 'PACK_LOAD' | 'PACK_VALIDATE' | 'REGION_ROUTE' | 'TRIP_QUALIFY' | 'ALBUM_ASSOCIATE' | 'PROPOSAL_STAGE' | 'PROPOSAL_READBACK' | 'REVIEW_COMMIT' | 'REVIEW_READBACK'>;
type VisualGuardReason = Extract<AppDiagnosticEvent['reasonCode'], 'SKIPPED' | 'ACCESS' | 'HISTORY_STALE' | 'HISTORY_CONSENT' | 'HISTORY_READ_TIMEOUT' | 'ALREADY_RUNNING' | 'MEDIA_UNAVAILABLE' | 'MEDIA_DECODE' | 'MEDIA_SCHEMA' | 'MEDIA_VERIFY' | 'VISUAL_EPISODE_SUPPORT' | 'VISUAL_ALBUM_SUPPORT'>;

export class VisualPlaceError extends Error {
  constructor(readonly reason: VisualGuardReason) {
    super('Visual place review could not continue.');
  }
}

export class VisualReportedError extends Error {
  constructor(readonly originalError: unknown) { super('Visual place review could not continue.'); }
}

export function visualDiagnostic(correlationId: string, stage: VisualStage, error: unknown, outcome?: AppDiagnosticEvent['durableOutcome']) {
  if (error instanceof VisualReportedError) return;
  const reasonCode = error instanceof VisualPlaceError ? error.reason : classifyAppDiagnosticError(error);
  const durableOutcome = reasonCode === 'ACCESS' ? 'restricted'
    : reasonCode === 'HISTORY_CONSENT' ? 'blocked'
      : ['SKIPPED', 'HISTORY_STALE', 'ALREADY_RUNNING', 'MEDIA_UNAVAILABLE', 'VISUAL_EPISODE_SUPPORT', 'VISUAL_ALBUM_SUPPORT'].includes(reasonCode) ? 'skipped' : 'unchanged';
  const retryable = (stage === 'PACK_LOAD' && reasonCode === 'MEDIA_UNAVAILABLE')
    || ['HISTORY_READ_TIMEOUT', 'ALREADY_RUNNING', 'MEDIA_DECODE', 'MEDIA_VERIFY', 'DATABASE_BUSY', 'NATIVE_HANDLE', 'UNKNOWN'].includes(reasonCode);
  recordAppDiagnostic({ operation: 'VISUAL_PLACE_REVIEW', stage, reasonCode, durableOutcome: outcome ?? durableOutcome, retryable, correlationId });
  return retryable;
}

export function visualLifecycle(correlationId: string, stage: VisualStage, reasonCode: 'START' | 'COMPLETE', durableOutcome: AppDiagnosticEvent['durableOutcome'] = 'unchanged') {
  recordAppDiagnostic({ operation: 'VISUAL_PLACE_REVIEW', stage, reasonCode, durableOutcome, retryable: false, correlationId });
}

function validateSignageText(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length > 48
    || raw.some((block: unknown) => typeof block !== 'string' || block.length > 256)) throw new VisualPlaceError('MEDIA_SCHEMA');
  return raw as string[];
}

function waitForRecognition<T>(operation: Promise<T>, signal: AbortSignal, timeoutMillis: number, stop: () => void) {
  return new Promise<T>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
    };
    const abort = () => { cleanup(); stop(); reject(new VisualPlaceError('SKIPPED')); };
    const timer = setTimeout(() => { cleanup(); stop(); reject(new VisualPlaceError('HISTORY_READ_TIMEOUT')); }, timeoutMillis);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    void operation.then((result) => { cleanup(); resolve(result); }, (error) => { cleanup(); reject(error); });
  });
}

type ReadLandmark = (uri: string, signal: AbortSignal, regional?: boolean) => Promise<{
  place: VisualPlace | 'ambiguous' | null; embedding?: LandmarkEmbedding;
}>;
type AutomaticRecognition = { correlationId: string; regional?: { packs: RegionalPackSession; samples: readonly RegionalLandmarkSample[] } };

export function createVisualRecognition(
  readLocalText: ((uri: string) => Promise<unknown>) | null,
  timeoutMillis = 12_000,
  readLandmark?: ReadLandmark,
  prepareLandmark?: (signal: AbortSignal, regional?: boolean) => Promise<void>,
) {
  let nativeWork: Promise<unknown> | null = null;
  async function runRecognition<T>(read: (workSignal: AbortSignal) => Promise<T>, signal: AbortSignal, deadline: number) {
    if (nativeWork) throw new VisualPlaceError('ALREADY_RUNNING');
    const controller = new AbortController();
    const work = read(controller.signal);
    nativeWork = work;
    const clear = () => { if (nativeWork === work) nativeWork = null; };
    void work.then(clear, clear);
    return waitForRecognition(work, signal, deadline, () => controller.abort());
  }

  return async function recognize(cluster: VisualCluster, consent: VisualConsent, verify: () => Promise<boolean>, signal: AbortSignal,
    automatic?: AutomaticRecognition,
  ): Promise<VisualResult> {
    const correlationId = automatic?.correlationId ?? createDiagnosticCorrelationId();
    let stage: VisualStage = 'CONSENT_CHECK';
    const verifyCurrent = async () => {
      if (signal.aborted) throw new VisualPlaceError('SKIPPED');
      if (!await verify()) throw new VisualPlaceError('HISTORY_STALE');
      if (signal.aborted) throw new VisualPlaceError('SKIPPED');
    };
    try {
      const selectedIds = [...consent.selectedIds];
      const selection = new Map(cluster.photos.map((photo) => [photo.id, photo.uri]));
      if (!consent.approvedOnDeviceAnalysis || !selectedIds.length || selectedIds.length > (automatic ? visualDiscoveryPhotoAttempts : maximumVisualPhotos)
        || new Set(selectedIds).size !== selectedIds.length || selectedIds.some((id) => !selection.has(id))) throw new VisualPlaceError('HISTORY_CONSENT');
      const currentPhotoUri = async (id: string) => {
        stage = 'MEDIA_SCOPE';
        await verifyCurrent();
        const uri = selection.get(id)!;
        if (!/^(?:file:\/\/\/|content:\/\/)/.test(uri)) throw new VisualPlaceError('ACCESS');
        return uri;
      };
      const signage = new Map<string, VisualPlace | 'ambiguous'>();
      const observations = new Map<string, VisualObservation>();
      const recordLandmark = (id: string, place: VisualPlace | 'ambiguous' | null, embedding?: LandmarkEmbedding) => {
        const textClue = signage.get(id);
        if (place && place !== 'ambiguous' && (!resolveVisualPlace(place.id) || isVisualLocality(place.id))) throw new VisualPlaceError('MEDIA_SCHEMA');
        if (textClue === 'ambiguous') return false;
        const placeId = textClue && place && place !== 'ambiguous'
          ? compatibleVisualPhotoClues(textClue.id, place.id)
          : place && place !== 'ambiguous' ? canonicalVisualStop(place.id) : textClue ? canonicalVisualStop(textClue.id) : null;
        if (place === 'ambiguous' || (textClue && place && !placeId)) {
          observations.delete(id);
          signage.set(id, 'ambiguous');
          return false;
        }
        observations.set(id, { id, placeId, kind: textClue && place ? 'combined' : textClue ? 'signage' : place ? 'image' : null, embedding });
        return Boolean(place);
      };
      let started = false;
      let decodeFailed = false;
      let sawReadableText = false;
      let retryRegionalPack = false;
      const textIds = automatic ? selectedIds.slice(0, visualDiscoveryTextAttempts) : selectedIds;
      for (const id of textIds) {
        const uri = await currentPhotoUri(id);
        stage = 'RECOGNITION';
        if (!readLocalText) {
          if (automatic && readLandmark) break;
          throw new VisualPlaceError('MEDIA_UNAVAILABLE');
        }
        let raw: unknown;
        try {
          raw = await runRecognition(() => {
            if (!started) { visualLifecycle(correlationId, 'RECOGNITION', 'START'); started = true; }
            return readLocalText(uri);
          }, signal, automatic ? Math.min(timeoutMillis, 4_000) : timeoutMillis);
        } catch (error) {
          if (!(automatic && error instanceof VisualPlaceError && error.reason === 'MEDIA_DECODE')) throw error;
          decodeFailed = true;
          continue;
        }
        stage = 'MEDIA_SCOPE';
        await verifyCurrent();
        stage = 'RESULT_VALIDATE';
        const text = validateSignageText(raw);
        sawReadableText ||= text.some((block) => /[\p{L}\p{N}]/u.test(block));
        const place = matchVisualSignage(text);
        if (place) signage.set(id, place);
        if (place !== 'ambiguous') observations.set(id, {
          id, placeId: place ? canonicalVisualStop(place.id) : null, kind: place ? 'signage' : null,
        });
      }
      if (automatic && readLandmark && selectedIds.some((id) => signage.get(id) !== 'ambiguous')) {
        const regional = automatic.regional;
        const embeddings = new Map<string, LandmarkEmbedding>();
        if (prepareLandmark) {
          stage = 'MEDIA_SCOPE';
          await verifyCurrent();
          stage = 'LANDMARK_MODEL';
          await runRecognition((workSignal) => {
            visualLifecycle(correlationId, 'LANDMARK_MODEL', 'START');
            return regional ? prepareLandmark(workSignal, true) : prepareLandmark(workSignal);
          }, signal, 45_000);
          visualLifecycle(correlationId, stage, 'COMPLETE');
        }
        let landmarkStarted = false;
        let landmarkDecodeFailed = false;
        let landmarkDecoded = false;
        let landmarkMatched = false;
        for (const id of selectedIds) {
          const textClue = signage.get(id);
          if (textClue === 'ambiguous') continue;
          const uri = await currentPhotoUri(id);
          stage = 'LANDMARK_MATCH';
          let read: Awaited<ReturnType<ReadLandmark>>;
          try {
            read = await runRecognition((workSignal) => {
              if (!landmarkStarted) { visualLifecycle(correlationId, 'LANDMARK_MATCH', 'START'); landmarkStarted = true; }
              return regional ? readLandmark(uri, workSignal, true) : readLandmark(uri, workSignal);
            }, signal, Math.min(timeoutMillis, 4_000));
          } catch (error) {
            if (!(error instanceof VisualPlaceError && error.reason === 'MEDIA_DECODE')) throw error;
            landmarkDecodeFailed = true;
            continue;
          }
          stage = 'MEDIA_SCOPE';
          await verifyCurrent();
          landmarkDecoded = true;
          stage = 'RESULT_VALIDATE';
          const { place, embedding } = read;
          if (regional) {
            if (!embedding) throw new VisualPlaceError('MEDIA_SCHEMA');
            embeddings.set(id, embedding);
          } else if (recordLandmark(id, place, embedding)) landmarkMatched = true;
        }
        if (regional && landmarkDecoded) {
          stage = 'REGION_ROUTE';
          visualLifecycle(correlationId, stage, 'START');
          await verifyCurrent();
          const samples = regional.samples.map((sample) => {
            const textClue = signage.get(sample.id);
            return { ...sample, embedding: embeddings.get(sample.id), signagePlaceId: textClue && textClue !== 'ambiguous' ? textClue.id : undefined };
          });
          const search = searchRegionalLandmarks(samples, regional.packs.starter);
          if (search.route) visualLifecycle(correlationId, stage, 'COMPLETE');
          else recordAppDiagnostic({ operation: 'VISUAL_PLACE_REVIEW', stage,
            reasonCode: search.conflict ? 'VISUAL_PLACE_CONFLICT' : 'VISUAL_EPISODE_SUPPORT', durableOutcome: 'skipped', retryable: false, correlationId });
          const deep = search.route ? await regional.packs.loadDeep(search.route, { signal, verify: verifyCurrent, correlationId }) : null;
          retryRegionalPack = deep?.retryable ?? false;
          await verifyCurrent();
          stage = 'LANDMARK_MATCH';
          for (const [id, hit] of finishRegionalLandmarkSearch(samples, search, deep?.value ?? null)) {
            const embedding = embeddings.get(id);
            if (embedding && recordLandmark(id, hit === 'ambiguous' ? hit : hit && resolveVisualPlace(hit.placeId), embedding)) landmarkMatched = true;
          }
        }
        if (landmarkDecodeFailed) visualDiagnostic(correlationId, 'LANDMARK_MATCH', new VisualPlaceError('MEDIA_DECODE'));
        if (landmarkMatched) visualLifecycle(correlationId, 'LANDMARK_MATCH', 'COMPLETE');
        else if (landmarkDecoded) recordAppDiagnostic({ operation: 'VISUAL_PLACE_REVIEW', stage: 'LANDMARK_MATCH',
          reasonCode: 'VISUAL_NO_LANDMARK_MATCH', durableOutcome: 'skipped', retryable: false, correlationId });
        if (!landmarkDecoded && !observations.size && !signage.size) return { status: 'inconclusive' };
      }
      if (!observations.size && decodeFailed && !signage.size) {
        visualDiagnostic(correlationId, 'RECOGNITION', new VisualPlaceError('MEDIA_DECODE'));
        return { status: 'inconclusive' };
      }
      const places = new Map([...signage.values()].filter((place): place is VisualPlace => place !== 'ambiguous')
        .map((place) => [place.id, place]));
      const resolved = places.size === 1 ? places.values().next().value : null;
      const ambiguous = [...signage.values()].includes('ambiguous');
      if (automatic ? ![...observations.values()].some((observation) => observation.placeId) : ambiguous || !resolved) {
        const noMatch = sawReadableText ? 'VISUAL_NO_PLACE_MATCH' : 'VISUAL_NO_READABLE_TEXT';
        const reasonCode = ambiguous || (!automatic && places.size > 1) ? 'VISUAL_PLACE_CONFLICT' : noMatch;
        recordAppDiagnostic({ operation: 'VISUAL_PLACE_REVIEW', stage: 'RESULT_VALIDATE',
          reasonCode, durableOutcome: 'skipped', retryable: false, correlationId });
        return { status: 'inconclusive' };
      }
      visualLifecycle(correlationId, 'RESULT_VALIDATE', 'COMPLETE');
      if (automatic) return { status: 'recognized', observations: [...observations.values()], ...(retryRegionalPack ? { retryRegionalPack: true } : {}) };
      return { status: 'proposed', place: resolved!, selectedIds };
    } catch (error) {
      visualDiagnostic(correlationId, stage, error);
      if (signal.aborted) return { status: 'cancelled' };
      const cause = error instanceof VisualReportedError ? error.originalError : error;
      if (cause instanceof VisualPlaceError) {
        if (cause.reason === 'HISTORY_STALE' || cause.reason === 'ACCESS') return { status: 'stale' };
        if (cause.reason === 'MEDIA_UNAVAILABLE') return { status: 'unavailable' };
      }
      return { status: 'retry' };
    }
  };
}
