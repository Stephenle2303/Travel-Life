import { createContext, useContext, useMemo, useReducer } from 'react';
import { atlasJourneys, createInitialState, prototypeReducer, selectedJourney, visibleJourneys } from '@/data/prototype-model';
import type { PrototypeAction, PrototypeState, SyntheticJourney } from '@/types/prototype';

interface PrototypeContextValue { state: PrototypeState; dispatch: (action: PrototypeAction) => void; selectedJourney: SyntheticJourney; visibleJourneys: SyntheticJourney[]; atlasJourneys: SyntheticJourney[]; }
const PrototypeContext = createContext<PrototypeContextValue | undefined>(undefined);
export function PrototypeProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(prototypeReducer, undefined, createInitialState);
  const value = useMemo(() => ({ state, dispatch, selectedJourney: selectedJourney(state), visibleJourneys: visibleJourneys(state), atlasJourneys: atlasJourneys(state) }), [state]);
  return <PrototypeContext.Provider value={value}>{children}</PrototypeContext.Provider>;
}
export function usePrototype(): PrototypeContextValue { const context = useContext(PrototypeContext); if (!context) throw new Error('usePrototype must be used inside PrototypeProvider'); return context; }
