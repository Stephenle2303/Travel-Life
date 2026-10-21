import type { ReconstructionGraph } from '@/reconstruction';

/** Coarsened on-device point used only by the native map boundary. */
export type RevealMapAnchor = { latitude: number; longitude: number };
export type DurableRevealJourney = {
  /** A local display ordinal, never a reconstruction or source identifier. */
  displayId: string;
  state: 'inferred' | 'possible-merge' | 'owner-entered';
  anchor: RevealMapAnchor | null;
  years: number[];
  periodLabel: string;
  ordering: 'chronological' | 'uncertain';
  /** A locally derived, coarse trip label such as a country name. Never a coordinate or raw capture value. */
  label?: string;
  /** An owner-confirmed local place is intentionally distinct from inferred evidence. */
  locationKind?: 'inferred' | 'owner-confirmed' | 'owner-entered';
  /** A private correction's reviewed support now spans this displayed journey. */
  needsReview?: boolean;
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
  /** Fixed owner-safe controller guidance; never sourced from native errors. */
  reconstructionMessage?: string | null;
  reconciliationStatus: 'idle' | 'running' | 'complete' | 'pending' | 'restricted' | 'error';
  pendingCount: number;
  queuedChangeCount?: number;
  unresolvedRemapCount?: number;
  sourceScope: 'full' | 'limited' | 'unasked' | 'denied' | 'revoked' | 'unavailable';
  importedCount: number;
};

export type RevealJourney = {
  id: string;
  label: string;
  status: 'Inferred' | 'Needs review' | 'Owner-entered';
  years: number[];
  periodLabel: string;
  ordering: 'Chronological' | 'Order uncertain';
  hasMapSupport: boolean;
  mapAnchor: RevealMapAnchor | null;
};

export type RevealModel = {
  state: 'ready' | 'sparse' | 'processing' | 'restricted' | 'failed';
  /** Queued changes are waiting; no reconstruction is necessarily running. */
  pendingUpdates?: boolean;
  reviewRequired?: boolean;
  coverage: string;
  message: string;
  journeys: RevealJourney[];
  replay: { eligible: boolean; reason: string };
  statistics: InferredStatistics | null;
  diagnostics?: RevealDiagnostics | null;
};

export type AtlasView = 'map' | 'timeline';
export type AtlasCamera = { center: [number, number]; zoom: number };
export type AtlasExploration = { view: AtlasView; year: number | null; selectedJourneyId: string | null; camera?: AtlasCamera; localViewport?: { scale: number; x: number; y: number } };

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
    title?: string;
    date?: { kind: 'exact'; day: string } | { kind: 'approximate'; startDay: string; endDay: string };
  };
  /** Owner-selected local place and coarse map anchor, separate from observed evidence. */
  ownerPlace?: { id: string; name: string; context: string; anchor: RevealMapAnchor };
  /** A separate private assertion. It has no evidence, visit support or media. */
  ownerEntered?: boolean;
};

/** A bounded gallery page. Its source references stay inside the repository/provider boundary. */
export type JourneyMediaPage = {
  items: { id: string; availability: 'available' | 'unavailable' | 'unknown'; association: string; kind: 'photo' | 'video' }[];
  hasMore: boolean;
};
