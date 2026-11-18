import { isRegionalPackDigest } from './regional-pack-config';
import {
  parseRegionalLandmarkPack, regionalLandmarkDescriptor, regionalLandmarkMaximumPackBytes,
  regionalLandmarkModelSha256, regionalLandmarkVerifier, RegionalPackSchemaError, type RegionalLandmarkPack,
} from './regional-landmarks';
import { visualDiagnostic, visualLifecycle, VisualPlaceError, VisualReportedError } from './recovery';

const maximumManifestBytes = 256 * 1024;
const manifestFilename = 'regional-landmarks-v1.json';

type PackEntry = {
  id: string; descriptorVersion: string; size: number; sha256: string; countries: string[];
  snapshot: string; sourceManifestSha256: string; margin: number | null;
};
export type RegionalPackContext = { signal: AbortSignal; verify: () => Promise<void>; correlationId: string };
type PackLoadResult<T> = { value: T; retryable: false } | { value: null; retryable: boolean };
export type RegionalPackSession = {
  release: string;
  starter: RegionalLandmarkPack;
  loadDeep(country: string, context: RegionalPackContext): Promise<PackLoadResult<RegionalLandmarkPack>>;
};

function requireManifest(condition: unknown): asserts condition {
  if (!condition) throw new RegionalPackSchemaError();
}

function parseManifest(value: unknown) {
  const manifest = value as { version?: unknown; qualified?: unknown; packs?: unknown[] };
  requireManifest(manifest?.version === 1 && manifest.qualified === true && Array.isArray(manifest.packs)
    && manifest.packs.length >= 3 && manifest.packs.length <= 16);
  const entries = new Map<string, PackEntry>();
  for (const pack of manifest.packs) {
    const row = pack as Partial<{ version: number; packId: string; countries: string[]; modelSha256: string;
      descriptorVersion: string; size: number; sha256: string; snapshot: string; sourceManifestSha256: string;
      verification: { margin: number } }>;
    requireManifest(row?.version === 1 && typeof row.packId === 'string' && (row.packId === 'starter' || /^[a-z]{2}$/.test(row.packId))
      && !entries.has(row.packId) && row.modelSha256 === regionalLandmarkModelSha256
      && (row.descriptorVersion === regionalLandmarkDescriptor || row.descriptorVersion === regionalLandmarkVerifier)
      && typeof row.size === 'number' && Number.isSafeInteger(row.size) && row.size > 0 && row.size <= regionalLandmarkMaximumPackBytes
      && isRegionalPackDigest(row.sha256) && isRegionalPackDigest(row.sourceManifestSha256)
      && typeof row.snapshot === 'string' && /^[a-z0-9][a-z0-9-]{0,79}$/.test(row.snapshot)
      && Array.isArray(row.countries) && row.countries.length >= 1 && row.countries.length <= 15
      && new Set(row.countries).size === row.countries.length
      && row.countries.every((country) => typeof country === 'string' && /^[A-Z]{2}$/.test(country)));
    const margin = row.descriptorVersion === regionalLandmarkVerifier ? row.verification?.margin : null;
    requireManifest(row.descriptorVersion === regionalLandmarkVerifier
      ? typeof margin === 'number' && Number.isFinite(margin) && margin > 0 && margin < 1
      : row.verification === undefined);
    requireManifest(row.packId === 'starter' ? row.countries.length >= 2
      : row.countries.length === 1 && row.countries[0].toLowerCase() === row.packId);
    entries.set(row.packId, { id: row.packId, countries: [...row.countries].sort(), descriptorVersion: row.descriptorVersion,
      size: row.size, sha256: row.sha256, snapshot: row.snapshot, sourceManifestSha256: row.sourceManifestSha256, margin: margin as number | null });
  }
  const starter = entries.get('starter');
  requireManifest(starter && starter.countries.length === entries.size - 1);
  requireManifest(starter.countries.every((country) => {
    const regional = entries.get(country.toLowerCase());
    return regional?.descriptorVersion === starter.descriptorVersion && regional.snapshot === starter.snapshot
      && regional.sourceManifestSha256 === starter.sourceManifestSha256 && regional.margin === starter.margin;
  }));
  return { starter, entries };
}

function parseJson(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new RegionalPackSchemaError();
  }
}

type PackTarget = { filename: string; maximumBytes: number; exactBytes?: number; sha256: string };
type PackTransport = {
  download(filename: string, maximumBytes: number, signal: AbortSignal): Promise<Uint8Array>;
  digest(bytes: Uint8Array): Promise<string>;
};

async function checkAuthority(context: RegionalPackContext, stage: 'PACK_LOAD' | 'PACK_VALIDATE') {
  try {
    if (context.signal.aborted) throw new VisualPlaceError('SKIPPED');
    await context.verify();
    if (context.signal.aborted) throw new VisualPlaceError('SKIPPED');
  } catch (error) {
    visualDiagnostic(context.correlationId, stage, error);
    throw new VisualReportedError(error);
  }
}

function packStepWithDeadline<T>(run: (signal: AbortSignal) => Promise<T>, signal: AbortSignal, deadlineMillis: number) {
  const work = new AbortController();
  return new Promise<T>((resolve, reject) => {
    const clean = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); };
    const stop = (reason: 'SKIPPED' | 'HISTORY_READ_TIMEOUT') => { clean(); work.abort(); reject(new VisualPlaceError(reason)); };
    const abort = () => stop('SKIPPED');
    const timer = setTimeout(() => stop('HISTORY_READ_TIMEOUT'), deadlineMillis);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) { abort(); return; }
    void Promise.resolve().then(() => run(work.signal))
      .then((bytes) => { clean(); resolve(bytes); }, (error) => { clean(); work.abort(); reject(error); });
  });
}

/** Holds one verified starter release and at most one deeper snapshot in memory. */
export function createRegionalPackLoader(manifestSha256: string, transport: PackTransport, deadlineMillis = 8_000) {
  let session: RegionalPackSession | null = null;

  function unavailable(context: RegionalPackContext, stage: 'PACK_LOAD' | 'PACK_VALIDATE', error: unknown): PackLoadResult<never> {
    return { value: null, retryable: visualDiagnostic(context.correlationId, stage, error, 'unchanged') ?? false };
  }

  async function readVerified<T>(target: PackTarget, parse: (value: unknown) => T, context: RegionalPackContext): Promise<PackLoadResult<T>> {
    const { correlationId } = context;
    await checkAuthority(context, 'PACK_LOAD');
    visualLifecycle(correlationId, 'PACK_LOAD', 'START');
    let bytes: Uint8Array;
    try {
      bytes = await packStepWithDeadline((signal) => transport.download(target.filename, target.maximumBytes, signal), context.signal, deadlineMillis);
    } catch (error) {
      await checkAuthority(context, 'PACK_LOAD');
      if (error instanceof VisualPlaceError && error.reason === 'MEDIA_VERIFY') {
        visualLifecycle(correlationId, 'PACK_LOAD', 'COMPLETE');
        return unavailable(context, 'PACK_VALIDATE', error);
      }
      return unavailable(context, 'PACK_LOAD', error);
    }
    await checkAuthority(context, 'PACK_LOAD');
    visualLifecycle(correlationId, 'PACK_LOAD', 'COMPLETE');
    visualLifecycle(correlationId, 'PACK_VALIDATE', 'START');
    let checksum: string;
    try {
      if (!bytes.byteLength || bytes.byteLength > target.maximumBytes || (target.exactBytes !== undefined && bytes.byteLength !== target.exactBytes)) {
        throw new VisualPlaceError('MEDIA_VERIFY');
      }
      checksum = await packStepWithDeadline(() => transport.digest(bytes), context.signal, deadlineMillis);
      if (checksum !== target.sha256) throw new VisualPlaceError('MEDIA_VERIFY');
    } catch (error) {
      await checkAuthority(context, 'PACK_VALIDATE');
      return unavailable(context, 'PACK_VALIDATE', error);
    }
    await checkAuthority(context, 'PACK_VALIDATE');
    try {
      const parsed = parse(parseJson(bytes));
      visualLifecycle(correlationId, 'PACK_VALIDATE', 'COMPLETE');
      return { value: parsed, retryable: false };
    } catch (error) {
      return unavailable(context, 'PACK_VALIDATE', error instanceof RegionalPackSchemaError ? new VisualPlaceError('MEDIA_SCHEMA') : error);
    }
  }

  function load(entry: PackEntry, context: RegionalPackContext) {
    const { id, descriptorVersion, size, sha256, countries, margin } = entry;
    return readVerified({ filename: `${descriptorVersion}-${id}.json`, maximumBytes: size, exactBytes: size, sha256 }, (value) => {
      const pack = parseRegionalLandmarkPack(value, id);
      requireManifest(pack.descriptorVersion === descriptorVersion && pack.margin === margin
        && pack.countries.length === countries.length && countries.every((country, index) => pack.countries[index] === country));
      return pack;
    }, context);
  }

  return async function prepareStarter(context: RegionalPackContext): Promise<RegionalPackSession | null> {
    if (session) {
      await checkAuthority(context, 'PACK_VALIDATE');
      return session;
    }
    const { value: manifest } = await readVerified({ filename: manifestFilename, maximumBytes: maximumManifestBytes, sha256: manifestSha256 }, parseManifest, context);
    if (!manifest) return null;
    const { value: starter } = await load(manifest.starter, context);
    if (!starter) return null;
    let deep: RegionalLandmarkPack | null = null;
    session = Object.freeze({ release: manifestSha256, starter, async loadDeep(country: string, action: RegionalPackContext): Promise<PackLoadResult<RegionalLandmarkPack>> {
      if (!/^[A-Z]{2}$/.test(country)) return { value: null, retryable: false };
      const entry = manifest.entries.get(country.toLowerCase());
      if (!entry) {
        return unavailable(action, 'PACK_LOAD', new VisualPlaceError('MEDIA_UNAVAILABLE'));
      }
      if (deep?.id === entry.id) {
        await checkAuthority(action, 'PACK_VALIDATE');
        return { value: deep, retryable: false };
      }
      const verified = await load(entry, action);
      if (verified.value) deep = verified.value;
      return verified;
    } });
    return session;
  };
}
