import { syntheticRecord } from './synthetic-record.ts';
import type { PrototypeAction, PrototypeState, Screen, SyntheticJourney } from '@/types/prototype';

export const NO_EXTERNAL_EFFECTS = Object.freeze({ permissions: false, network: false, account: false, persistence: false, mediaLibrary: false });
export const DEFAULT_ATLAS_CAMERA = Object.freeze({ zoom: 1, offsetX: 0, offsetY: 0 });
export function createInitialState(): PrototypeState { return { screen: 'welcome', viewMode: 'map', imported: false, selectedYear: 'all', selectedJourneyId: syntheticRecord.journeys[0].id, journeys: syntheticRecord.journeys, replaying: false, replayStep: 0, selectedHighlightIds: [], atlasCamera: DEFAULT_ATLAS_CAMERA }; }
export function routeForScreen(screen: Screen, journeyId?: string): string { return screen === 'detail' ? `/journey/${journeyId ?? syntheticRecord.journeys[0].id}` : screen === 'welcome' ? '/' : `/${screen}`; }
export function visibleJourneys(state: PrototypeState): SyntheticJourney[] { return state.journeys.filter((journey) => state.selectedYear === 'all' || journey.year === state.selectedYear); }
/** Unknown fictional coordinates stay in the readable Timeline; they are never plotted or fabricated on the atlas. */
export function atlasJourneys(state: PrototypeState): SyntheticJourney[] { return visibleJourneys(state).filter((journey) => journey.atlasAnchor); }
export function selectedJourney(state: PrototypeState): SyntheticJourney { return state.journeys.find((journey) => journey.id === state.selectedJourneyId) ?? state.journeys[0]; }
export function selectedHighlightJourneys(state: PrototypeState): SyntheticJourney[] { return state.journeys.filter((journey) => state.selectedHighlightIds.includes(journey.id)); }
export function prototypeReducer(state: PrototypeState, action: PrototypeAction): PrototypeState {
  switch (action.type) {
    case 'open-access': return { ...state, screen: 'access', sessionNotice: undefined };
    case 'open-import': return { ...state, screen: 'import', sessionNotice: undefined };
    case 'select-access': return { ...state, accessMode: action.accessMode, screen: 'import', sessionNotice: `Simulated ${action.accessMode === 'broad' ? 'full-library' : 'selected-photo'} access chosen. No device permission was requested.` };
    case 'complete-simulated-import': return { ...state, imported: true, screen: 'reveal', sessionNotice: 'Simulated import complete. Nothing was read or stored.' };
    case 'open-reveal': return { ...state, screen: 'reveal', replaying: false };
    case 'open-sparse': return { ...state, screen: 'sparse', replaying: false };
    case 'open-declined': return { ...state, screen: 'declined', replaying: false };
    case 'set-view': return { ...state, viewMode: action.viewMode };
    case 'set-atlas-camera': return { ...state, atlasCamera: { zoom: Math.min(2.2, Math.max(1, action.camera.zoom)), offsetX: Math.min(40, Math.max(-40, action.camera.offsetX)), offsetY: Math.min(40, Math.max(-40, action.camera.offsetY)) } };
    case 'fit-atlas': return { ...state, atlasCamera: DEFAULT_ATLAS_CAMERA, sessionNotice: 'Atlas fit returned to the full synthetic demo geography.' };
    case 'select-year': { const firstVisible = state.journeys.find((journey) => action.year === 'all' || journey.year === action.year); return { ...state, selectedYear: action.year, selectedJourneyId: firstVisible?.id ?? state.selectedJourneyId }; }
    case 'select-journey': return { ...state, selectedJourneyId: action.journeyId };
    case 'confirm-journey': return { ...state, journeys: state.journeys.map((journey) => journey.id === action.journeyId ? { ...journey, status: 'confirmed' } : journey), sessionNotice: 'Owner confirmation updated this session only. It will not persist.' };
    case 'rename-journey': return { ...state, journeys: state.journeys.map((journey) => journey.id === action.journeyId ? { ...journey, title: action.title } : journey), sessionNotice: 'Owner rename updated this session only. It will not persist.' };
    case 'start-replay': return { ...state, screen: 'replay', replaying: true, replayStep: 0, sessionNotice: undefined };
    case 'advance-replay': return state.replayStep >= state.journeys.length - 1
      ? { ...state, replaying: false, sessionNotice: 'Replay preview complete. No video was rendered or exported.' }
      : { ...state, replayStep: state.replayStep + 1 };
    case 'cancel-replay': return { ...state, replaying: false, screen: 'reveal', sessionNotice: 'Replay preview cancelled. No video was rendered or exported.' };
    case 'open-share': return { ...state, screen: 'share', replaying: false };
    case 'toggle-highlight': { const selectedHighlightIds = state.selectedHighlightIds.includes(action.journeyId) ? state.selectedHighlightIds.filter((id) => id !== action.journeyId) : [...state.selectedHighlightIds, action.journeyId]; return { ...state, selectedHighlightIds }; }
    case 'select-all-highlights': return { ...state, selectedHighlightIds: state.journeys.map((journey) => journey.id) };
    case 'clear-highlight': return { ...state, selectedHighlightIds: [] };
    case 'go-home': return { ...state, screen: 'welcome', replaying: false };
  }
}
