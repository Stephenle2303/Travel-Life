import type { ReconstructionGraph } from '@/reconstruction';

/** Coarsened on-device point used only by the native map boundary. */
export type RevealMapAnchor = { latitude: number; longitude: number };
export type DurableRevealJourney = {
  /** A local display ordinal, never a reconstruction or source identifier. */
  displayId: string;
  /** Supported offline geographic name, never an owner-presence claim. */
  label?: string;
  state: 'inferred' | 'possible-merge';
  anchor: RevealMapAnchor | null;
  years: number[];
  periodLabel: string;
  ordering: 'chronological' | 'uncertain';
};
export type InferredStatistics = { journeyCount: number; placeCount: number; supportedCountryCount: number; countryStatus: 'supported' | 'unavailable' };
/** Aggregate counts from one completed local reconstruction; no evidence identifiers or locations. */
export type RevealDiagnostics = {
  assessed: number; supported: number; places: number; visits: number;
  missingDay: number; invalidDay: number; unavailable: number;
  duplicateConflict: number; insufficientLocation: number; excluded: number;
};
export type DurableRevealRecord = { journeys: DurableRevealJourney[]; statistics?: InferredStatistics | null; diagnostics?: RevealDiagnostics | null };

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
  diagnostics?: RevealDiagnostics | null;
};

export type AtlasView = 'map' | 'timeline';
export type AtlasCamera = { center: [number, number]; zoom: number };
export type AtlasExploration = { view: AtlasView; year: number | null; selectedJourneyId: string | null; camera?: AtlasCamera };

/** Owner-readable data for one explicitly selected journey. It is never Atlas state. */
export type JourneyDetail = {
  id: string;
  title: string;
  observedSpan: string;
  visits: { id: string; label: string; precision: string; support: string }[];
  mergeCandidates?: { id: string; label: string }[];
  memories: { id: string; availability: 'available' | 'unavailable' | 'unknown'; association: string; membershipState?: 'suggested' | 'primary' | 'unassigned' | 'rejected' }[];
  uncertainty: string[];
  correctionState?: 'inferred' | 'confirmed' | 'rejected' | 'pending remap' | 'pending scope review';
  /** Why a prior private correction was withheld. Its durable identifier stays in the local repository. */
  pendingRemap?: { reason: string };
  /** A private statement from the owner. It is intentionally separate from observed evidence. */
  ownerClaim?: {
    title: string;
    date: { kind: 'exact'; day: string } | { kind: 'approximate'; startDay: string; endDay: string };
  };
};

/** A bounded gallery page. Its source references stay inside the repository/provider boundary. */
export type JourneyMediaPage = {
  items: { id: string; availability: 'available' | 'unavailable' | 'unknown'; association: string; kind: 'photo' | 'video' }[];
  hasMore: boolean;
};
