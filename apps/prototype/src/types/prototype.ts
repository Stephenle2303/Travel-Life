export type FactStatus = 'inferred' | 'confirmed';
export type ViewMode = 'map' | 'timeline';
export type AccessMode = 'broad' | 'limited';
export type Screen = 'welcome' | 'access' | 'import' | 'reveal' | 'detail' | 'replay' | 'share' | 'sparse' | 'declined';
export type SyntheticImageKey = 'rainforest-river' | 'limestone-coast' | 'misty-highland';

export interface SyntheticMemory { id: string; label: string; type: 'illustration' | 'caption'; }
export interface SyntheticImage { key: SyntheticImageKey; fileName: string; alt: string; }
export interface AtlasAnchor { latitude: number; longitude: number; regionLabel: string; }
export interface AtlasCamera { zoom: number; offsetX: number; offsetY: number; }
export interface SyntheticJourney {
  id: string; title: string; year: number; observedSpan: string; destinations: string[]; status: FactStatus;
  sourceCoverage: string; evidenceReason: string; memories: SyntheticMemory[]; atlasAnchor?: AtlasAnchor; image: SyntheticImage;
}
export interface PrototypeRecord { label: string; journeys: SyntheticJourney[]; sourceCoverage: string; }
export interface PrototypeState {
  screen: Screen; viewMode: ViewMode; imported: boolean; selectedYear: number | 'all'; selectedJourneyId: string;
  journeys: SyntheticJourney[]; replaying: boolean; replayStep: number; selectedHighlightIds: string[]; atlasCamera: AtlasCamera; accessMode?: AccessMode; sessionNotice?: string;
}
export type PrototypeAction =
  | { type: 'open-access' } | { type: 'open-import' } | { type: 'select-access'; accessMode: AccessMode } | { type: 'complete-simulated-import' } | { type: 'open-reveal' }
  | { type: 'open-sparse' } | { type: 'open-declined' } | { type: 'set-view'; viewMode: ViewMode }
  | { type: 'set-atlas-camera'; camera: AtlasCamera } | { type: 'fit-atlas' }
  | { type: 'select-year'; year: number | 'all' } | { type: 'select-journey'; journeyId: string }
  | { type: 'confirm-journey'; journeyId: string } | { type: 'rename-journey'; journeyId: string; title: string }
  | { type: 'start-replay' } | { type: 'advance-replay' } | { type: 'cancel-replay' }
  | { type: 'open-share' } | { type: 'toggle-highlight'; journeyId: string }
  | { type: 'select-all-highlights' } | { type: 'clear-highlight' } | { type: 'go-home' };
