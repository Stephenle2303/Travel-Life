import * as SecureStore from 'expo-secure-store';
import { classifyAppDiagnosticError, createDiagnosticCorrelationId, recordAppDiagnostic } from '@/diagnostics/app-diagnostics';

export type EntryDisposition = 'started' | 'atlas';
export type Presentation = { version: 1; disposition: EntryDisposition; updatesOffer: boolean };
const key = 'travel-life.presentation.v1';
let tail: Promise<unknown> = Promise.resolve();
export class PresentationPersistenceError extends Error {
  constructor() { super('Could not save setup progress.'); }
}

export async function readPresentation(): Promise<Presentation | null> {
  const raw = await SecureStore.getItemAsync(key);
  if (raw === null) return null;
  let value: Presentation;
  try { value = JSON.parse(raw) as Presentation; }
  catch { throw new Error('Onboarding schema is invalid.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1 || !['started', 'atlas'].includes(value.disposition) || typeof value.updatesOffer !== 'boolean') throw new Error('Onboarding schema is invalid.');
  return value;
}

/** Serialized, idempotent presentation writes; acknowledgement loss is read back. */
export function savePresentation(disposition?: EntryDisposition, updatesOffer?: boolean, correlationId = createDiagnosticCorrelationId()) {
  const work = tail.then(async () => {
    let desired: Presentation | undefined;
    let stage: 'ENTRY_READ' | 'ENTRY_MIGRATE' | 'UPDATE_PREFERENCE' = updatesOffer === undefined ? 'ENTRY_READ' : 'UPDATE_PREFERENCE';
    try {
      const current = await readPresentation();
      desired = { version: 1, disposition: current?.disposition === 'atlas' ? 'atlas' : disposition ?? current?.disposition ?? 'started', updatesOffer: updatesOffer ?? current?.updatesOffer ?? false };
      stage = updatesOffer === undefined ? 'ENTRY_MIGRATE' : 'UPDATE_PREFERENCE';
      await SecureStore.setItemAsync(key, JSON.stringify(desired));
      return desired;
    } catch (error) {
      if (desired) {
        try { const saved = await readPresentation(); if (JSON.stringify(saved) === JSON.stringify(desired)) return saved!; } catch { /* Unresolved acknowledgement remains unknown. */ }
      }
      recordAppDiagnostic({ operation: updatesOffer === undefined ? 'ONBOARDING_ENTRY' : 'ONBOARDING_UPDATES', stage, reasonCode: classifyAppDiagnosticError(error), retryable: true, durableOutcome: 'unknown', correlationId });
      throw new PresentationPersistenceError();
    }
  });
  tail = work.catch(() => undefined);
  return work;
}
