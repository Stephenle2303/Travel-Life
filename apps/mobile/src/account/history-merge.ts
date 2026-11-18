import { assertHistoryRow, historyLayouts, type HistoryRow } from './history-contract';
import { projectCanonicalHistory, type CanonicalProjectionInput, type CanonicalProjectionStage } from '../reconstruction/canonical-projection';
import { resolveVerifiedDuplicateFamilies, type EvidenceRow, type FamilySnapshot } from '../reconstruction/canonical-core';
import { applyOwnerChanges, ownerChanges, type OwnerChanges } from './correction-journal';
import { indexJourneySupport, uniqueSupportJourney } from '../reconstruction/journey-support-map';

export type AccountHistorySource = Readonly<{ sourceId: string; rows: readonly HistoryRow[]; retainedOwnerFacts?: boolean }>;
export type AccountIdentityKey = Readonly<{ sourceId: string; kind: string; localId: string }>;
export type AccountIdentityMapping = AccountIdentityKey & Readonly<{ accountId: string }>;
export type VerifiedDuplicate = Readonly<{ sourceId: string; evidenceId: string; digest: string }>;
export type HistoryMergeReview = Readonly<{ reason: 'duplicate-metadata-conflict' | 'replay-group-needs-review' | 'correction-needs-review'; sourceId?: string; revisionId?: string }>;
export type AccountHistoryMergeOptions = Readonly<{
  profile?(stage: 'HISTORY_NORMALIZE' | 'HISTORY_PROJECT' | 'HISTORY_REPLAY_PROJECT' | 'HISTORY_REPLAY_MAP' | 'HISTORY_REPLAY_GROUP_ABSENT' | 'HISTORY_REPLAY_GROUP_TARGET' | `${'HISTORY_PROJECT' | 'HISTORY_REPLAY_PROJECT'}_${CanonicalProjectionStage}`): void;
  mapIdentity(sourceId: string, kind: string, localId: string): string;
  verifiedDuplicates?: readonly VerifiedDuplicate[];
  /** Persistence supplies the first accepted composition owner, never arrival order. */
  preferredReplaySourceId?: string;
  accountOwnerChanges?:OwnerChanges;
  /** Verified migration only: resolve the source's exact Replay against the account graph. */
  replayTargetRows?:readonly HistoryRow[];
}>;
export class HistoryMergeError extends Error {
  constructor(readonly code: 'HISTORY_SCHEMA' | 'HISTORY_REVIEW') {
    super(code === 'HISTORY_SCHEMA' ? 'Private history needs compatible identities.' : 'Private history needs owner review.');
    this.name = 'HistoryMergeError';
  }
}
const schema = (): never => { throw new HistoryMergeError('HISTORY_SCHEMA'); };
const review = (): never => { throw new HistoryMergeError('HISTORY_REVIEW'); };
const text = (value: unknown): string => typeof value === 'string' && value.length > 0 ? value : schema();
const json = (value: unknown): unknown => {
  if (typeof value !== 'string') return schema();
  try { return JSON.parse(value); } catch { return schema(); }
};
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : schema();
const strings = (value: unknown): string[] => Array.isArray(value) && value.every(item => typeof item === 'string' && item.length > 0) ? value : schema();
const sortedUnique = (values: string[]) => [...new Set(values)].sort();
const orderRows = (rows: readonly HistoryRow[]) => [...rows].sort((a, b) => a.kind.localeCompare(b.kind) || a.key.localeCompare(b.key));

function validateSources(sources: readonly AccountHistorySource[]) {
  const sourceIds = new Set<string>();
  for (const source of sources) {
    text(source.sourceId);
    if (sourceIds.has(source.sourceId)) schema();
    sourceIds.add(source.sourceId);
    if (source.retainedOwnerFacts !== undefined && typeof source.retainedOwnerFacts !== 'boolean') schema();
    const keys = new Set<string>();
    for (const row of source.rows) {
      try { assertHistoryRow(row); } catch { schema(); }
      if (source.retainedOwnerFacts && row.kind === 'evidence') schema();
      const allowed: Record<string, Record<string, readonly (string | number)[]>> = {
        evidence: { media_type: ['image', 'video'], availability: ['available', 'unavailable', 'unknown'], has_precise_offset: [0, 1] },
        overlay: { target_kind: ['evidence', 'history'], correction_scope: ['inclusion', 'label', 'note'], owner_action: ['apply', 'remove'] },
        'journey-correction': { action: ['confirm', 'reject', 'claim', 'place', 'split', 'merge', 'remove-visit'], state: ['effective', 'pending_remap', 'superseded'] },
        'memory-correction': { action: ['assign', 'move', 'reject', 'unassign'], state: ['effective', 'pending_remap', 'superseded'] },
        privacy: { action: ['hide', 'exclude', 'restore'], target_kind: ['manual', 'inferred'] },
        home: { origin: ['observed-area', 'legacy', 'manual-pin'] }, manual: { date_kind: ['exact', 'approximate'] },
      };
      for (const [field, values] of Object.entries(allowed[row.kind] ?? {})) if (!values.includes(row.value[field] as string | number)) schema();
      const key = `${row.kind}:${row.key}`;
      if (keys.has(key)) schema();
      keys.add(key);
    }
  }
  return [...sources].sort((a, b) => a.sourceId.localeCompare(b.sourceId));
}

/** Shared typed traversal: allocation and normalization enumerate exactly the same IDs. */
function normalizeSources(sources: readonly AccountHistorySource[], mapper: AccountHistoryMergeOptions['mapIdentity'], emitRows = true) {
  const mappings: AccountIdentityMapping[] = [];
  const mapped = new Map<string, string>();
  const reverse = new Map<string, string>();
  const identity = (source: string, kind: string, local: unknown): string => {
    const localId = text(local), key = JSON.stringify([source, kind, localId]);
    const prior = mapped.get(key); if (prior) return prior;
    let accountId: string;
    try { accountId = text(mapper(source, kind, localId)); } catch { return schema(); }
    if (accountId.length > 1024 || reverse.has(accountId) && reverse.get(accountId) !== key) schema();
    mapped.set(key, accountId); reverse.set(accountId, key); mappings.push({ sourceId: source, kind, localId, accountId }); return accountId;
  };
  const normalized: { sourceId: string; rows: HistoryRow[] }[] = [];
  let privacyRevision = 0;
  for (const source of sources) {
    const evidenceIds = new Set(source.rows.filter(row => row.kind === 'evidence').map(row => text(row.value.evidence_id)));
    const familyIds = new Set(source.rows.filter(row => row.kind === 'evidence' && row.value.platform_duplicate_family_id).map(row => text(row.value.platform_duplicate_family_id)));
    const manualIds = new Set(source.rows.filter(row => row.kind === 'manual').map(row => row.key));
    const evidence = (id: unknown) => { if (!source.retainedOwnerFacts && !evidenceIds.has(text(id))) schema(); return identity(source.sourceId, 'evidence', id); };
    const family = (id: unknown) => { if (!source.retainedOwnerFacts && !familyIds.has(text(id))) schema(); return identity(source.sourceId, 'family', id); };
    const support = (key: unknown) => {
      const value = text(key), prefix = value.slice(0, 2), local = value.slice(2);
      if (prefix === 'E:') return `E:${evidence(local)}`;
      if (prefix === 'F:' || prefix === 'P:') return `${prefix}${family(local)}`;
      return schema();
    };
    const supports = (value: unknown) => sortedUnique(strings(value).map(support));
    const normalizedRows: HistoryRow[] = [];
    const privacyRows = source.rows.filter(row => row.kind === 'privacy').sort((a, b) => Number(a.value.revision) - Number(b.value.revision));
    const privacyRevisions = new Map(privacyRows.map(row => [row.key, ++privacyRevision]));
    for (const row of orderRows(source.rows)) {
      const v = { ...row.value }, own = (field: string, kind: string) => { v[field] = identity(source.sourceId, kind, v[field]); };
      const optional = (field: string, kind: string) => { if (v[field] !== null) own(field, kind); };
      if (row.kind === 'evidence') {
        own('evidence_id', 'evidence'); v.source_ref = `account:${v.evidence_id}`;
        optional('platform_duplicate_family_id', 'family');
      } else if (row.kind === 'overlay') {
        if (v.target_kind === 'history') review();
        if (v.target_kind !== 'evidence') schema();
        own('overlay_id', 'overlay'); v.target_id = evidence(v.target_id);
        optional('identity_lineage_id', 'lineage'); optional('replaces_overlay_id', 'overlay');
      } else if (row.kind === 'journey-correction' || row.kind === 'memory-correction') {
        own('revision_id', row.kind); own('journey_id', 'journey'); optional('replaces_revision_id', row.kind); optional('command_key', 'command');
        v.source_run_id = 0;
        v.reviewed_support_json = JSON.stringify(supports(json(v.reviewed_support_json)));
        const snapshots = object(json(v.reviewed_family_snapshot_json));
        const remappedSnapshots: Record<string, FamilySnapshot> = {};
        for (const [key, raw] of Object.entries(snapshots)) {
          if (!key.startsWith('F:')) schema();
          const snapshot = object(raw);
          if (Object.keys(snapshot).sort().join(',') !== 'memberIds,tupleFingerprint,tupleVersion' || !Number.isInteger(snapshot.tupleVersion)) schema();
          remappedSnapshots[support(key)] = { memberIds: sortedUnique(strings(snapshot.memberIds).map(evidence)), tupleVersion: snapshot.tupleVersion as number, tupleFingerprint: text(snapshot.tupleFingerprint) };
        }
        v.reviewed_family_snapshot_json = JSON.stringify(remappedSnapshots);
        if (source.retainedOwnerFacts && v.state !== 'superseded') v.state = 'pending_remap';
        if (row.kind === 'journey-correction') {
          const visits = json(v.reviewed_visits_json); if (!Array.isArray(visits)) schema();
          v.reviewed_visits_json = JSON.stringify((visits as unknown[]).map(supports));
          if (v.structural_boundary_json !== null) {
            const boundary = json(v.structural_boundary_json);
            if (Array.isArray(boundary)) v.structural_boundary_json = JSON.stringify(supports(boundary));
            else {
              const relation = object(boundary);
              if (Object.keys(relation).sort().join(',') !== 'left,right') schema();
              v.structural_boundary_json = JSON.stringify({ left: supports(relation.left), right: supports(relation.right) });
            }
          }
          optional('owner_place_id', 'place');
        } else v.source_evidence_id = evidence(v.source_evidence_id);
      } else if (row.kind === 'privacy') {
        if (v.target_kind === 'manual' && !manualIds.has(text(v.manual_id))) schema();
        if (v.target_kind === 'manual' && v.action === 'exclude' || v.target_kind === 'inferred' && v.manual_id !== null) schema();
        own('policy_id', 'policy'); own('command_key', 'command'); optional('manual_id', 'manual');
        v.revision = privacyRevisions.get(row.key)!; v.source_run_id = 0;
        v.reviewed_evidence_json = JSON.stringify(sortedUnique(strings(json(v.reviewed_evidence_json)).map(evidence)));
        v.reviewed_family_json = JSON.stringify(supports(json(v.reviewed_family_json)));
      } else if (row.kind === 'manual') { own('manual_id', 'manual'); own('command_key', 'command'); }
      else if (row.kind === 'home') own('area_id', 'home');
      else if (row.kind === 'replay') {
        // validateSources already proved this exact portable body has no local handles.
        const composition = object(json(text(v.committed_overrides_json)));
        for (const field of ['keptEvidenceIds', 'excludedEvidenceIds', 'orderedEvidenceIds']) if (composition[field] !== undefined) composition[field] = strings(composition[field]).map(evidence);
        for (const field of ['keptMemoryRefs', 'excludedMemoryRefs', 'orderedMemoryRefs']) if (composition[field] !== undefined) composition[field] = strings(composition[field]).map(raw => {
          const pair = strings(json(raw)); if (pair.length !== 2) schema();
          return JSON.stringify([identity(source.sourceId, 'journey', pair[0]), evidence(pair[1])]);
        });
        for (const field of ['excludedGroupJourneyIds', 'autoGroupJourneyIds']) if (composition[field] !== undefined) composition[field] = strings(composition[field]).map(id => identity(source.sourceId, 'journey', id));
        if (emitRows) v.committed_overrides_json = JSON.stringify(composition);
      }
      if (emitRows) normalizedRows.push({ kind: row.kind, key: String(v[historyLayouts[row.kind].key]), value: v });
    }
    normalized.push({ sourceId: source.sourceId, rows: normalizedRows });
  }
  const allocated = (source: string, kind: string, local: string) => mapped.get(JSON.stringify([source, kind, local]));
  return { sources: normalized, mappings, identity, allocated };
}

/** Run before allocating random stable mapping UUIDs in the server transaction. */
export function collectAccountIdentityKeys(sources: readonly AccountHistorySource[]): readonly AccountIdentityKey[] {
  let next = 0;
  return normalizeSources(validateSources(sources), () => `allocation-${++next}`, false).mappings.map(({ sourceId, kind, localId }) => ({ sourceId, kind, localId }));
}

function privacyScope(rows: readonly HistoryRow[]) {
  const latest = new Map<string, HistoryRow>();
  for (const row of rows.filter(item => item.kind === 'privacy')) {
    const policy = text(row.value.policy_id), old = latest.get(policy);
    if (!old || Number(row.value.revision) > Number(old.value.revision)) latest.set(policy, row);
  }
  const evidence = rows.filter(row => row.kind === 'evidence');
  const hidden = new Set<string>(), excluded = new Set<string>(), manual = new Set<string>();
  for (const row of latest.values()) {
    if (row.value.action === 'restore') continue;
    if (row.value.target_kind === 'manual') { manual.add(text(row.value.manual_id)); continue; }
    const target = row.value.action === 'exclude' ? excluded : hidden;
    for (const id of strings(json(row.value.reviewed_evidence_json))) target.add(id);
    const protectedKeys = new Set(strings(json(row.value.reviewed_family_json)));
    for (const item of evidence) if (protectedKeys.has(`E:${item.key}`) || item.value.platform_duplicate_family_id && (protectedKeys.has(`F:${item.value.platform_duplicate_family_id}`) || protectedKeys.has(`P:${item.value.platform_duplicate_family_id}`))) target.add(item.key);
    // A verified duplicate cannot bypass a reviewed restriction through another
    // retained source copy. The immutable reviewed scope itself stays intact.
    const protectedFamilies = new Set(evidence.filter(item => target.has(item.key)).map(item => item.value.platform_duplicate_family_id).filter(Boolean));
    for (const item of evidence) if (item.value.platform_duplicate_family_id && protectedFamilies.has(item.value.platform_duplicate_family_id)) target.add(item.key);
  }
  return { hiddenEvidenceIds: [...hidden].sort(), excludedEvidenceIds: [...excluded].sort(), hiddenManualIds: [...manual].sort() };
}

function projectionInput(rows: readonly HistoryRow[]): CanonicalProjectionInput {
  const privacy = privacyScope(rows), excluded = new Set(privacy.excludedEvidenceIds);
  const latestOverlays = new Map<string, HistoryRow>();
  for (const row of rows.filter(item => item.kind === 'overlay')) {
    if (row.value.target_kind === 'history') review();
    const key = `${row.value.target_id}:${row.value.correction_scope}`, old = latestOverlays.get(key);
    if (!old || Number(row.value.revision) > Number(old.value.revision)) latestOverlays.set(key, row);
  }
  for (const row of latestOverlays.values()) if (row.value.correction_scope === 'inclusion' && row.value.owner_action === 'remove') excluded.add(text(row.value.target_id));
  const evidenceRows = rows.filter(row => row.kind === 'evidence');
  const excludedFamilies = new Set(evidenceRows.filter(row => excluded.has(row.key)).map(row => row.value.platform_duplicate_family_id).filter(Boolean));
  for (const row of evidenceRows) if (row.value.platform_duplicate_family_id && excludedFamilies.has(row.value.platform_duplicate_family_id)) excluded.add(row.key);
  return {
    rows: rows.filter(row => row.kind === 'evidence').map(row => row.value as unknown as EvidenceRow), excluded,
    privateFilter: { excluded: new Set(privacy.excludedEvidenceIds) },
    configuredHomeAreas: rows.filter(row => row.kind === 'home').map(row => row.value as unknown as CanonicalProjectionInput['configuredHomeAreas'][number]),
    storedCorrections: rows.filter(row => row.kind === 'journey-correction' && row.value.state === 'effective').map(row => row.value as unknown as CanonicalProjectionInput['storedCorrections'][number]),
    storedMemoryCorrections: rows.filter(row => row.kind === 'memory-correction' && row.value.state === 'effective').map(row => row.value as unknown as CanonicalProjectionInput['storedMemoryCorrections'][number]),
  };
}

export type PreparedAccountHistory = Readonly<{
  original: readonly AccountHistorySource[];
  sources: readonly AccountHistorySource[];
  mappings: readonly AccountIdentityMapping[];
}>;
const copySources = (sources: readonly AccountHistorySource[]) => sources.map(source => ({ ...source, rows: source.rows.map(row => ({ ...row, value: { ...row.value } })) }));

/** Private service checkpoint only; it never authorizes a client-supplied graph. */
export function prepareAccountHistory(input: readonly AccountHistorySource[], options: AccountHistoryMergeOptions): PreparedAccountHistory {
  try {
    options.profile?.('HISTORY_NORMALIZE');
    const original = validateSources(input), normalized = normalizeSources(original, options.mapIdentity);
    // Source-local projection never consumes the original composition body. Its
    // presence still protects removed-source review; normalized choices are exact.
    const checkpointOriginal = copySources(original);
    for (const source of checkpointOriginal) for (const row of source.rows) if (row.kind === 'replay') row.value.committed_overrides_json = '{}';
    return { original: checkpointOriginal, sources: normalized.sources, mappings: normalized.mappings };
  } catch (error) {
    if (error instanceof HistoryMergeError) throw error;
    throw new HistoryMergeError('HISTORY_REVIEW');
  }
}

function restorePreparedHistory(input: PreparedAccountHistory) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).sort().join(',') !== 'mappings,original,sources'
    || !Array.isArray(input.original) || !Array.isArray(input.sources) || !Array.isArray(input.mappings)) schema();
  for (const source of [...input.original, ...input.sources]) {
    if (!source || typeof source !== 'object' || Object.keys(source).some(key => !['sourceId','rows','retainedOwnerFacts'].includes(key)) || !Array.isArray(source.rows)) schema();
  }
  const original = validateSources(input.original), sources = validateSources(input.sources);
  if (original.length !== sources.length || original.some((source,index) => source.sourceId !== sources[index].sourceId)) schema();
  for (const source of original) for (const row of source.rows) if (row.kind === 'replay' && row.value.committed_overrides_json !== '{}') schema();
  const mapped = new Map<string,string>(), reverse = new Map<string,AccountIdentityMapping>();
  const kinds = new Set(['evidence','family','overlay','lineage','journey-correction','memory-correction','journey','command','place','policy','manual','home']);
  for (const mapping of input.mappings) {
    if (!mapping || typeof mapping !== 'object' || Object.keys(mapping).sort().join(',') !== 'accountId,kind,localId,sourceId') schema();
    const { sourceId, kind, localId, accountId } = mapping;
    if (!original.some(source => source.sourceId === sourceId) || !kinds.has(kind)) schema();
    text(sourceId);text(localId);text(accountId);
    const key = JSON.stringify([sourceId,kind,localId]);
    if (accountId.length > 1024 || mapped.has(key) || reverse.has(accountId)) schema();
    mapped.set(key,accountId);reverse.set(accountId,mapping);
  }
  const identity = (sourceId:string,kind:string,localId:string) => mapped.get(JSON.stringify([sourceId,kind,localId])) ?? schema();
  const allocated = (sourceId:string,kind:string,localId:string) => mapped.get(JSON.stringify([sourceId,kind,localId]));
  // Reuse the same typed traversal with a lookup-only mapper. This checks every
  // original identity, including nested correction/privacy scopes and optional
  // lineage/command fields; a checkpoint must never invent a replacement ID.
  const expected = normalizeSources(original, identity).sources;
  for (let sourceIndex=0;sourceIndex<sources.length;sourceIndex++) {
    const actualRows=sources[sourceIndex].rows,expectedRows=expected[sourceIndex].rows;
    if(actualRows.length!==expectedRows.length)schema();
    for(let rowIndex=0;rowIndex<actualRows.length;rowIndex++){
      const actual=actualRows[rowIndex],reference=expectedRows[rowIndex];
      if(actual.kind!==reference.kind||actual.key!==reference.key)schema();
      for(const field of Object.keys(historyLayouts[actual.kind].fields)){
        // Only the normalized Replay contains the full selected composition;
        // its typed account references are independently checked below.
        if(actual.kind==='replay'&&field==='committed_overrides_json')continue;
        if(actual.value[field]!==reference.value[field])schema();
      }
    }
  }
  // Replay references contain account IDs; every one must retain its typed
  // tuple, even when it is a historical group that remains owner-reviewable.
  for (const source of sources) for (const row of source.rows) if (row.kind === 'replay') {
    const composition=object(json(row.value.committed_overrides_json));
    const known=(id:string,kind:string)=>{const tuple=reverse.get(id);if(!tuple||tuple.sourceId!==source.sourceId||tuple.kind!==kind)schema();};
    for (const field of ['keptEvidenceIds','excludedEvidenceIds','orderedEvidenceIds']) if(composition[field]!==undefined) for(const id of strings(composition[field]))known(id,'evidence');
    for (const field of ['keptMemoryRefs','excludedMemoryRefs','orderedMemoryRefs']) if(composition[field]!==undefined) for(const raw of strings(composition[field])) {
      const pair=strings(json(raw));if(pair.length!==2)schema();known(pair[0],'journey');known(pair[1],'evidence');
    }
    for (const field of ['excludedGroupJourneyIds','autoGroupJourneyIds']) if(composition[field]!==undefined) for(const id of strings(composition[field]))known(id,'journey');
  }
  return { original, normalized: { sources:copySources(sources), mappings:input.mappings.map(mapping=>({...mapping})), identity, allocated } };
}

export async function mergeAccountHistory(input: readonly AccountHistorySource[], options: AccountHistoryMergeOptions) {
  return mergePreparedAccountHistory(prepareAccountHistory(input, options), options);
}

export async function mergePreparedAccountHistory(prepared: PreparedAccountHistory, options: Omit<AccountHistoryMergeOptions,'mapIdentity'> = {}) {
  try {
    const { original, normalized } = restorePreparedHistory(prepared);
    const rows = options.accountOwnerChanges?applyOwnerChanges(normalized.sources.flatMap(source=>source.rows),options.accountOwnerChanges):normalized.sources.flatMap(source => source.rows), reviewItems: HistoryMergeReview[] = [];
    // A removed source may retain owner-authored proposals, never its evidence.
    // Until the owner resolves references, gate activation instead of broadening
    // privacy or silently dropping a committed composition/correction.
    for (const source of original.filter(item => item.retainedOwnerFacts)) {
      if (source.rows.some(row => row.kind === 'overlay' || row.kind === 'replay' || row.kind === 'privacy' && row.value.target_kind === 'inferred' || (row.kind === 'journey-correction' || row.kind === 'memory-correction') && row.value.state !== 'superseded')) {
        reviewItems.push({ reason: 'correction-needs-review', sourceId: source.sourceId });
      }
    }
    const sourceCopies = original.flatMap(source => source.rows.filter(row => row.kind === 'evidence').map(row => ({ sourceId: source.sourceId, localEvidenceId: row.key, localSourceRef: text(row.value.source_ref), evidenceId: normalized.identity(source.sourceId, 'evidence', row.key), availability: row.value.availability })));
    const evidenceById = new Map(rows.filter(row => row.kind === 'evidence').map(row => [row.key, row]));
    const verified = new Map<string, string[]>();
    const digestByEvidence = new Map<string, string>();
    for (const copy of options.verifiedDuplicates ?? []) {
      if (!/^[a-f0-9]{64}$/i.test(copy.digest)) schema();
      const source = original.find(candidate => candidate.sourceId === copy.sourceId);
      if (!source?.rows.some(row => row.kind === 'evidence' && row.key === copy.evidenceId)) schema();
      const id = normalized.identity(copy.sourceId, 'evidence', copy.evidenceId);
      if (digestByEvidence.has(id) && digestByEvidence.get(id) !== copy.digest.toLowerCase()) schema();
      digestByEvidence.set(id, copy.digest.toLowerCase());
      verified.set(copy.digest.toLowerCase(), sortedUnique([...(verified.get(copy.digest.toLowerCase()) ?? []), id]));
    }
    // A proven digest is scoped to this account by its caller. The digest never
    // becomes a global identifier or a diagnostic correlation.
    for (const [digest, ids] of [...verified].sort(([a], [b]) => a.localeCompare(b))) {
      if (ids.length < 2) continue;
      const members = ids.map(id => evidenceById.get(id)!);
      // Family allocation derives from the first stable member's already allocated
      // identity, so collectAccountIdentityKeys needs no private digest input.
      const family = `verified:${ids[0]}`;
      const signature = (row: HistoryRow) => JSON.stringify(['captured_at_millis', 'captured_day', 'has_precise_offset', 'latitude', 'longitude', 'reported_accuracy_meters', 'media_type'].map(key => row.value[key]));
      const conflict = new Set(members.map(signature)).size !== 1;
      if (conflict) reviewItems.push({ reason: 'duplicate-metadata-conflict' });
      for (const member of members) {
        member.value.platform_duplicate_family_id = family;
        member.value.duplicate_tuple_version = 1;
        member.value.duplicate_tuple_fingerprint = conflict ? `${digest}:${member.key}` : digest;
      }
    }
    const coreInput = projectionInput(rows);
    // An exact-copy family's private availability is the union of retained copies.
    // Original per-source availability remains in sourceCopies and normalized rows.
    const availabilityByFamily = new Map<string, EvidenceRow['availability']>();
    for (const row of coreInput.rows) if (row.platform_duplicate_family_id?.startsWith('verified:')) {
      const current = availabilityByFamily.get(row.platform_duplicate_family_id);
      if (row.availability === 'available' || !current || current === 'unavailable' && row.availability === 'unknown') availabilityByFamily.set(row.platform_duplicate_family_id, row.availability);
    }
    coreInput.rows = coreInput.rows.map(row => row.platform_duplicate_family_id?.startsWith('verified:') ? { ...row, availability: availabilityByFamily.get(row.platform_duplicate_family_id)! } : row);
    // Exact-copy normalization can change E support into F support. Generate the
    // reviewed family snapshot from those proven copies rather than invalidating
    // a previously reviewed E identity solely because another copy was discovered.
    const families = resolveVerifiedDuplicateFamilies(options.replayTargetRows?projectionInput(options.replayTargetRows).rows:coreInput.rows);
    for (const row of rows.filter(row => row.kind === 'journey-correction' || row.kind === 'memory-correction')) {
      const snapshots = object(json(row.value.reviewed_family_snapshot_json));
      const support = (key: string) => {
        const oldSnapshot = snapshots[key];
        const oldMembers = key.startsWith('E:') ? [key.slice(2)] : key.startsWith('F:') && oldSnapshot ? strings(object(oldSnapshot).memberIds) : [];
        if (!oldMembers.length) return key;
        const currentKeys = new Set(oldMembers.map(id => families.keyForEvidence(id)));
        if (currentKeys.size !== 1) return key;
        const current = [...currentKeys][0];
        if (current.startsWith('F:verified:')) Object.assign(snapshots, families.snapshotsFor([current]));
        return current.startsWith('F:verified:') ? current : key;
      };
      row.value.reviewed_support_json = JSON.stringify(sortedUnique(strings(json(row.value.reviewed_support_json)).map(support)));
      if (row.kind === 'journey-correction') {
        row.value.reviewed_visits_json = JSON.stringify((json(row.value.reviewed_visits_json) as unknown[]).map(group => sortedUnique(strings(group).map(support))));
        if (row.value.structural_boundary_json !== null) {
          const boundary = json(row.value.structural_boundary_json);
          row.value.structural_boundary_json = JSON.stringify(Array.isArray(boundary) ? sortedUnique(strings(boundary).map(support)) : Object.fromEntries(Object.entries(object(boundary)).map(([key, value]) => [key, sortedUnique(strings(value).map(support))])));
        }
      }
      row.value.reviewed_family_snapshot_json = JSON.stringify(snapshots);
    }
    options.profile?.('HISTORY_PROJECT');
    const projection = await projectCanonicalHistory(options.replayTargetRows?projectionInput(options.replayTargetRows):coreInput,{next:stage=>options.profile?.(`HISTORY_PROJECT_${stage}`)});
    options.profile?.('HISTORY_PROJECT');
    for (const pending of projection.pendingFinalRemaps) reviewItems.push({ reason: 'correction-needs-review', revisionId: pending.revision_id });
    const chosen = options.preferredReplaySourceId ?? normalized.sources.find(source => source.rows.some(row => row.kind === 'replay'))?.sourceId;
    if (options.preferredReplaySourceId && !original.some(source => source.sourceId === chosen)) schema();
    const pendingReplay: HistoryRow[] = [];
    let replay: HistoryRow | null = null;
    for (const source of normalized.sources) for (const candidate of source.rows.filter(row => row.kind === 'replay'&&!options.accountOwnerChanges?.rows.some(item=>item.kind==='replay')&&!options.accountOwnerChanges?.deleted.some(item=>item.kind==='replay'))) {
      if (original.find(item => item.sourceId === source.sourceId)?.retainedOwnerFacts) { pendingReplay.push(candidate); continue; }
      if (source.sourceId !== chosen) { pendingReplay.push(candidate); continue; }
      const sourceOriginal = original.find(item => item.sourceId === source.sourceId)!;
      options.profile?.('HISTORY_REPLAY_PROJECT');
      const localProjection = await projectCanonicalHistory(projectionInput(sourceOriginal.rows),{next:stage=>options.profile?.(`HISTORY_REPLAY_PROJECT_${stage}`)}).catch(() => review());
      options.profile?.('HISTORY_REPLAY_MAP');
      const journeyIds = new Map<string, string>();
      const localJourneyTargets = new Map<string, string>();
      const finalSupport = indexJourneySupport(projection.graph);
      const localVisits = new Map(localProjection.graph.visits.map(visit => [visit.id, visit]));
      for (const journey of localProjection.graph.journeys) {
        const accountJourneyId = normalized.allocated(source.sourceId, 'journey', journey.id);
        const support = sortedUnique(journey.visitIds.flatMap(id => localVisits.get(id)?.evidenceIds ?? []).map(id => {
          const mapped = normalized.identity(source.sourceId, 'evidence', id), key = families.keyForEvidence(mapped);
          return key.startsWith('F:') ? families.resolveFamily(key, families.snapshotsFor([key])) ?? mapped : mapped;
        }));
        const target = uniqueSupportJourney(support, finalSupport);
        if (target !== null) {
          localJourneyTargets.set(journey.id, target);
          if (accountJourneyId) journeyIds.set(accountJourneyId, target);
        }
      }
      // Previously committed GPS-less memories can retain a pre-v1.1 group ID.
      // Reconcile only through its complete, uniquely surviving visit support;
      // a split/removed/ambiguous group still requires explicit owner review.
      for (const [legacyId, localTarget] of localProjection.legacyJourneyMappings) {
        const accountLegacy = normalized.allocated(source.sourceId, 'journey', legacyId);
        const target = localJourneyTargets.get(localTarget);
        if (accountLegacy && target) journeyIds.set(accountLegacy, target);
      }
      for (const manual of sourceOriginal.rows.filter(row => row.kind === 'manual')) {
        const journeyId = normalized.allocated(source.sourceId, 'journey', `manual:${manual.key}`);
        if (journeyId) journeyIds.set(journeyId, `manual:${normalized.identity(source.sourceId, 'manual', manual.key)}`);
      }
      const composition = object(json(candidate.value.committed_overrides_json));
      let unresolved = false;
      const knownSourceGroups = new Set([...localProjection.graph.journeys.map(item=>item.id),...localProjection.legacyJourneyMappings.keys(),...sourceOriginal.rows.filter(row=>row.kind==='manual').map(row=>`manual:${row.key}`)]);
      const knownAccountGroups = new Set([...knownSourceGroups].map(id=>normalized.allocated(source.sourceId,'journey',id)).filter(Boolean));
      let absent = false;
      const group = (id: string) => { const mapped = journeyIds.get(id); if (!mapped) { unresolved = true; if(!knownAccountGroups.has(id))absent=true; } return mapped ?? id; };
      for (const field of ['keptMemoryRefs', 'excludedMemoryRefs', 'orderedMemoryRefs']) if (composition[field] !== undefined) composition[field] = strings(composition[field]).map(raw => { const pair = json(raw) as string[]; return JSON.stringify([group(pair[0]), pair[1]]); });
      for (const field of ['excludedGroupJourneyIds', 'autoGroupJourneyIds']) if (composition[field] !== undefined) composition[field] = strings(composition[field]).map(group);
      if (unresolved) { options.profile?.(absent?'HISTORY_REPLAY_GROUP_ABSENT':'HISTORY_REPLAY_GROUP_TARGET'); reviewItems.push({ reason: 'replay-group-needs-review', sourceId: source.sourceId }); pendingReplay.push(candidate); }
      else replay = { ...candidate, value: { ...candidate.value, committed_overrides_json: JSON.stringify(composition) } };
    }
    const accountReplay=options.accountOwnerChanges?.rows.find(row=>row.kind==='replay');
    if(accountReplay){
      const composition=object(json(accountReplay.value.committed_overrides_json));
      const groups=new Set([...projection.graph.journeys.map(item=>item.id),...rows.filter(item=>item.kind==='manual').map(item=>`manual:${item.key}`)]);
      const refs=['keptMemoryRefs','excludedMemoryRefs','orderedMemoryRefs'].flatMap(field=>composition[field]===undefined?[]:strings(composition[field]).map(raw=>{const pair=json(raw);if(!Array.isArray(pair)||pair.length!==2)return schema();return String(pair[0]);}));
      if(refs.some(id=>!groups.has(id))||['excludedGroupJourneyIds','autoGroupJourneyIds'].some(field=>composition[field]!==undefined&&strings(composition[field]).some(id=>!groups.has(id))))reviewItems.push({reason:'replay-group-needs-review'});
      else replay=accountReplay;
    }
    const outputRows = orderRows([...rows.filter(row => row.kind !== 'replay'), ...(replay ? [replay] : [])]);
    return { rows: outputRows, projection, mappings: normalized.mappings.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))), sourceCopies, review: reviewItems, replay, pendingReplay, privacy: privacyScope(rows) };
  } catch (error) {
    if (error instanceof HistoryMergeError) throw error;
    throw new HistoryMergeError('HISTORY_REVIEW');
  }
}

/** Only a server-verified initial snapshot is admitted here. Canonical baselines
 * bypass this adapter entirely; opaque ID shape is never an authority signal. */
export async function translateLegacyOwnerChanges(input:{sourceId:string;baseline:readonly HistoryRow[];changes:OwnerChanges;canonicalRows:readonly HistoryRow[];mapIdentity:AccountHistoryMergeOptions['mapIdentity']}):Promise<OwnerChanges>{
  const edited=applyOwnerChanges(input.baseline,input.changes);
  // Reject evidence edits and unsupported removal before normalization.
  const delta=ownerChanges(input.baseline,edited);
  const normalized=normalizeSources(validateSources([{sourceId:input.sourceId,rows:edited}]),input.mapIdentity);
  const original=orderRows(edited),translated=normalized.sources[0].rows;
  const byLocal=new Map(original.map((row,index)=>[JSON.stringify([row.kind,row.key]),translated[index]]));
  let privacyRevision=input.canonicalRows.reduce((maximum,row)=>row.kind==='privacy'?Math.max(maximum,Number(row.value.revision)):maximum,1_000_000_000);
  const changedPrivacy=delta.rows.filter(row=>row.kind==='privacy').sort((a,b)=>Number(a.value.revision)-Number(b.value.revision));
  const privacyKeys=new Map(changedPrivacy.map(row=>{
    if(input.baseline.some(old=>old.kind==='privacy'&&old.key===row.key))review();
    if(!Number.isSafeInteger(++privacyRevision))schema();
    return [row.key,privacyRevision] as const;
  }));
  const rows=delta.rows.map(row=>{
    const mapped=byLocal.get(JSON.stringify([row.kind,row.key]));if(!mapped)return schema();
    if(row.kind!=='privacy')return mapped;
    const revision=privacyKeys.get(row.key)!;return {...mapped,key:String(revision),value:{...mapped.value,revision}};
  });
  const deleted=delta.deleted.map(row=>({kind:row.kind,key:row.kind==='replay'?row.key:input.mapIdentity(input.sourceId,row.kind,row.key)}));
  const changes={rows,deleted};
  const replay=rows.find(row=>row.kind==='replay');
  if(replay){
    const merged=await mergeAccountHistory([{sourceId:input.sourceId,rows:edited}],{mapIdentity:input.mapIdentity,replayTargetRows:applyOwnerChanges(input.canonicalRows,{rows:rows.filter(row=>row.kind!=='replay'),deleted})});
    if(merged.review.length||!merged.replay)review();
    changes.rows=rows.map(row=>row.kind==='replay'?merged.replay!:row);
  }else{
    const target=applyOwnerChanges(input.canonicalRows,changes);
    const projection=await projectCanonicalHistory(projectionInput(target));
    if(projection.pendingFinalRemaps.length)review();
    const existingReplay=target.find(row=>row.kind==='replay');
    if(existingReplay){
      const composition=object(json(existingReplay.value.committed_overrides_json));
      const groups=new Set([...projection.graph.journeys.map(journey=>journey.id),...target.filter(row=>row.kind==='manual').map(row=>`manual:${row.key}`)]);
      const referenced=['keptMemoryRefs','excludedMemoryRefs','orderedMemoryRefs'].flatMap(field=>composition[field]===undefined?[]:strings(composition[field]).map(raw=>{const pair=strings(json(raw));if(pair.length!==2)schema();return pair[0];}));
      referenced.push(...['excludedGroupJourneyIds','autoGroupJourneyIds'].flatMap(field=>composition[field]===undefined?[]:strings(composition[field])));
      if(referenced.some(group=>!groups.has(group)))review();
    }
  }
  return changes;
}
