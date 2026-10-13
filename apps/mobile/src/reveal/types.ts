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
export type InferredStatistics = { journeyCount: number; placeCount: number; supportedCountryCount: number; countryStatus: 'supported' | 'unavailable' };
export type DurableRevealRecord = { journeys: DurableRevealJourney[]; statistics?: InferredStatistics | null };

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
  statistics: InferredStatistics | null;
};

export type AtlasView = 'map' | 'timeline';
export type AtlasExploration = { view: AtlasView; year: number | null; selectedJourneyId: string | null };

/** Owner-readable data for one explicitly selected journey. It is never Atlas state. */
export type JourneyDetail = {
  id: string;
  title: string;
  observedSpan: string;
  visits: { label: string; precision: string; support: string }[];
  memories: { id: string; availability: 'available' | 'unavailable' | 'unknown'; association: string }[];
  uncertainty: string[];
};
