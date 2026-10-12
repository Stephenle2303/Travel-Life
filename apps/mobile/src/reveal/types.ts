import type { ReconstructionGraph } from '@/reconstruction';

/** Coarsened on-device point used only by the native map boundary. */
export type RevealMapAnchor = { latitude: number; longitude: number };
export type DurableRevealJourney = {
  /** A local display ordinal, never a reconstruction or source identifier. */
  displayId: string;
  state: 'inferred' | 'possible-merge';
  anchor: RevealMapAnchor | null;
  years: number[];
  periodLabel: string;
  ordering: 'chronological' | 'uncertain';
};
export type DurableRevealRecord = { journeys: DurableRevealJourney[] };

/** The only reconstruction shape that the reveal UI may receive. */
export type RevealInput = {
  graph: ReconstructionGraph | null;
  durableRecord?: DurableRevealRecord | null;
  reconstructionStatus: 'idle' | 'running' | 'complete' | 'restricted' | 'error';
  reconciliationStatus: 'idle' | 'running' | 'complete' | 'pending' | 'restricted' | 'error';
  pendingCount: number;
  sourceScope: 'full' | 'limited' | 'unasked' | 'denied' | 'revoked' | 'unavailable';
  importedCount: number;
};

export type RevealJourney = {
  id: string;
  label: string;
  status: 'Inferred' | 'Needs review';
  years: number[];
  periodLabel: string;
  ordering: 'Chronological' | 'Order uncertain';
  hasMapSupport: boolean;
  mapAnchor: RevealMapAnchor | null;
};

export type RevealModel = {
  state: 'ready' | 'sparse' | 'processing' | 'restricted' | 'failed';
  coverage: string;
  message: string;
  journeys: RevealJourney[];
  replay: { eligible: boolean; reason: string };
};

export type AtlasView = 'map' | 'timeline';
export type AtlasExploration = { view: AtlasView; year: number | null; selectedJourneyId: string | null };
