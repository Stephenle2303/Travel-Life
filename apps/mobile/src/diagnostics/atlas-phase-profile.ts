import { createDiagnosticCorrelationId, recordAppDiagnostic } from './app-diagnostics';
import type { DurableRevealStage } from '@/reconstruction/repository';

export type AtlasProfileStage =
  | 'REBUILD_OPEN' | 'REBUILD_SCHEMA' | 'REBUILD_BEGIN' | 'REBUILD_INPUT'
  | 'REBUILD_PROCESSING' | 'REBUILD_PERSISTENCE' | 'REBUILD_ACK' | 'REBUILD_COMMIT'
  | 'REBUILD_BASELINE_GRAPH' | 'REBUILD_BASELINE_MAPPING' | 'REBUILD_CONSTRAINED_GRAPH'
  | 'REBUILD_CONFIRMED_MAPPING' | 'REBUILD_MEMORY_OVERLAY' | 'REBUILD_OWNER_MERGE'
  | 'REBUILD_CONTINUITY' | 'REBUILD_MEMBERSHIP' | 'REBUILD_FINAL_MAPPING'
  | 'DURABLE_DESTINATION_QUERY' | 'DURABLE_DESTINATION_COMPUTATION';

export type AtlasPhaseProfile = {
  next(stage: AtlasProfileStage | DurableRevealStage): void;
  finish(success: boolean): void;
};

/** Local opt-in phase wall times; never accepts SQL, records, results or errors. */
export function createAtlasPhaseProfile(operation: 'ATLAS_REBUILD_PROFILE' | 'ATLAS_DURABLE_READ_PROFILE', initialStage: AtlasProfileStage | DurableRevealStage): AtlasPhaseProfile {
  const enabled = typeof __DEV__ !== 'undefined' && __DEV__ && process.env.EXPO_PUBLIC_ATLAS_PHASE_PROFILE === '1';
  const correlationId = enabled ? createDiagnosticCorrelationId() : '';
  let stage = initialStage;
  let finished = false;
  function emit(reasonCode: 'START' | 'COMPLETE' | 'UNKNOWN') {
    if (!enabled) return;
    try {
      recordAppDiagnostic({ operation, reasonCode, stage, retryable: false, durableOutcome: 'unchanged', correlationId });
    } catch {
      // Optional measurement must never change repository outcomes.
    }
  }
  emit('START');
  return {
    next(nextStage: AtlasProfileStage | DurableRevealStage) {
      if (finished) return;
      emit('COMPLETE');
      stage = nextStage;
      emit('START');
    },
    finish(success: boolean) {
      if (finished) return;
      emit(success ? 'COMPLETE' : 'UNKNOWN');
      finished = true;
    },
  };
}
