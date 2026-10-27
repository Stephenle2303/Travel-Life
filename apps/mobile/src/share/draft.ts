import type { ShareCapabilityStore } from './capability-store';
import type { FrozenShareDraft } from './publish-controller';

/**
 * Completes the recoverable local half of an explicitly confirmed preview.
 * Capability persistence happens before the caller can issue a network request;
 * a failure leaves the draft unpublished rather than risking an unrecoverable
 * active link.
 */
export async function createFrozenShareDraft(input: Readonly<{
  requestId: string;
  contentDigest: string;
  expiresInDays: number;
  selections: FrozenShareDraft['selections'];
  capabilityStore: ShareCapabilityStore;
}>): Promise<FrozenShareDraft> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(input.requestId) || !/^[A-Za-z0-9_-]{1,256}$/.test(input.contentDigest) || input.expiresInDays < 1 || input.expiresInDays > 90 || !Number.isInteger(input.expiresInDays)) throw new Error('Share preview is invalid.');
  const capability = await input.capabilityStore.create(input.requestId);
  return Object.freeze({ requestId: input.requestId, contentDigest: input.contentDigest, capability, expiresInDays: input.expiresInDays, selections: Object.freeze([...input.selections]) });
}
