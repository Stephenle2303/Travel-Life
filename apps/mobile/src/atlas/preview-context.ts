import type { AtlasExploration } from '@/reveal/types';

/** In-memory navigation handoff; the provider controller owns the record session. */
let pendingAtlasContext: { context: AtlasExploration; owner?: object } | null = null;

export function saveAtlasPreviewContext(context: AtlasExploration, owner?: object) {
  pendingAtlasContext = { context: { ...context }, owner };
}

export function consumeAtlasPreviewContext(owner?: object) {
  const pending = pendingAtlasContext;
  pendingAtlasContext = null;
  return pending?.owner === owner ? pending?.context ?? null : null;
}
