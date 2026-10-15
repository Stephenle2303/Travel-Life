import type { AtlasExploration } from '@/reveal/types';

/** Ephemeral navigation state only: it contains opaque display IDs, never media/source data. */
let pendingAtlasContext: AtlasExploration | null = null;

export function saveAtlasPreviewContext(context: AtlasExploration) {
  pendingAtlasContext = { ...context };
}

export function consumeAtlasPreviewContext() {
  const context = pendingAtlasContext;
  pendingAtlasContext = null;
  return context;
}
