/** Private reviewed scopes stay local. Generated journey ids are never lineage. */
export type JourneyPrivacyReview = {
  reviewId: string;
  title: string;
  ownerEntered: boolean;
  supportingPhotoCount: number;
  duplicatePhotoCount: number;
  duplicateFamilyCount: number;
  /** Full reviewed Hide scope, including associated memories and duplicates. */
  hideMediaCount?: number;
  affectedJourneyCount?: number;
};

export type JourneyPrivacyPolicy = {
  policyId: string;
  revision: number;
  action: 'hide' | 'exclude';
  title: string;
  supportingPhotoCount: number;
  duplicateFamilyCount: number;
  /** Scope is retained even when no unique current successor exists. */
  status: 'protected';
};

export type PrivacyRevision = {
  revision: number;
  policy_id: string;
  command_key: string;
  action: 'hide' | 'exclude' | 'restore';
  target_kind: 'manual' | 'inferred';
  manual_id: string | null;
  source_run_id: number;
  reviewed_evidence_json: string;
  reviewed_family_json: string;
  reviewed_label: string;
};

export function reviewedPrivacyIds(json: string): string[] {
  const value: unknown = JSON.parse(json);
  if (!Array.isArray(value) || value.some((id) => typeof id !== 'string' || !id.length) || new Set(value).size !== value.length) {
    throw new Error('Private policy scope needs recovery.');
  }
  return value;
}

/** Persisted local policy data is validated even when a retained schema is suspect. */
export function assertPrivacyRevision(row: PrivacyRevision): void {
  const evidence = reviewedPrivacyIds(row.reviewed_evidence_json);
  const families = reviewedPrivacyIds(row.reviewed_family_json);
  if (!Number.isSafeInteger(row.revision) || row.revision < 1
    || !Number.isSafeInteger(row.source_run_id) || row.source_run_id < 0
    || typeof row.policy_id !== 'string' || !row.policy_id.length
    || typeof row.command_key !== 'string' || !row.command_key.length
    || typeof row.reviewed_label !== 'string' || !row.reviewed_label.length
    || !['hide', 'exclude', 'restore'].includes(row.action)
    || !['manual', 'inferred'].includes(row.target_kind)
    || (row.target_kind === 'manual' && (typeof row.manual_id !== 'string' || !row.manual_id.length || row.action === 'exclude' || evidence.length > 0 || families.length > 0))
    || (row.target_kind === 'inferred' && (row.manual_id !== null || evidence.length === 0))
    || families.some((key) => !/^[EFP]:.+/.test(key))) {
    throw new Error('Private policy scope needs recovery.');
  }
}

export const activePrivacySql = `SELECT policy.* FROM journey_privacy_revision policy
  JOIN (SELECT policy_id, MAX(revision) AS revision FROM journey_privacy_revision GROUP BY policy_id) latest
    ON latest.policy_id = policy.policy_id AND latest.revision = policy.revision
  WHERE policy.action <> 'restore'`;
