import type { PreparationIntent } from '@/import-record/types';

export function validatePreparationIntent(value: unknown): PreparationIntent {
  if (!value || typeof value !== 'object') throw new Error('Onboarding schema is invalid.');
  const v = value as PreparationIntent;
  if (v.version !== 1 || typeof v.id !== 'string' || !v.id
    || !['full', 'limited', 'selected'].includes(v.scope)
    || !['queued', 'imported', 'publishing', 'complete', 'paused', 'interrupted', 'blocked'].includes(v.phase)
    || (v.resumePhase !== undefined && !['queued', 'imported', 'publishing'].includes(v.resumePhase))
    || !Array.isArray(v.selectedIds) || !v.selectedIds.every((id) => typeof id === 'string' && id.length > 0)
    || !Number.isSafeInteger(v.missingIds) || v.missingIds < 0
    || (v.scope !== 'selected' && v.selectedIds.length !== 0)) throw new Error('Onboarding schema is invalid.');
  return v;
}
