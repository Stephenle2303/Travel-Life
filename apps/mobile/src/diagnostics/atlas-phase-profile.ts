import { createDiagnosticCorrelationId, recordAppDiagnostic, type AppDiagnosticReasonCode } from './app-diagnostics';
import type { DurableRevealStage } from '@/reconstruction/repository';
import type { RebuildClassificationReasonCode } from '@/reconstruction/outcome-v1-2';

export type AtlasProfileStage =
  | 'REBUILD_OPEN' | 'REBUILD_SCHEMA' | 'REBUILD_BEGIN' | 'REBUILD_INPUT'
  | 'REBUILD_PROCESSING' | 'REBUILD_PERSISTENCE' | 'REBUILD_ACK' | 'REBUILD_COMMIT'
  | 'REBUILD_BASELINE_GRAPH' | 'REBUILD_BASELINE_MAPPING' | 'REBUILD_CONSTRAINED_GRAPH'
  | 'REBUILD_CONFIRMED_MAPPING' | 'REBUILD_MEMORY_OVERLAY' | 'REBUILD_OWNER_MERGE'
  | 'REBUILD_CONTINUITY' | 'REBUILD_MEMBERSHIP' | 'REBUILD_FINAL_MAPPING'
  /** trip-detector-v1.2 (decision 0021): the per-journey outcome-rule pass
   * that writes reconstruction_trip_qualification. */
  | 'REBUILD_QUALIFY'
  /** M10.2's device-aggregate read (delivery-and-diagnostics.md): one
   * classification() emission per journey, immediately after REBUILD_QUALIFY
   * writes it, so the owner's device can report its own real classification
   * mix without a separate pass over the just-written rows. */
  | 'REBUILD_QUALIFY_PROFILE'
  | 'DURABLE_DESTINATION_QUERY' | 'DURABLE_DESTINATION_COMPUTATION';

export type AtlasPhaseProfile = {
  next(stage: AtlasProfileStage | DurableRevealStage): void;
  /** One bucketed, content-free event per journey outcome (M10.2) — bounded
   * by journey count, never evidence/media count. No-op unless phase
   * profiling is enabled, same as every other event here. */
  classification(reasonCode: RebuildClassificationReasonCode): void;
  finish(success: boolean): void;
};

/** Local opt-in phase wall times; never accepts SQL, records, results or errors. */
export function createAtlasPhaseProfile(operation: 'ATLAS_REBUILD_PROFILE' | 'ATLAS_DURABLE_READ_PROFILE', initialStage: AtlasProfileStage | DurableRevealStage): AtlasPhaseProfile {
  const enabled = typeof __DEV__ !== 'undefined' && __DEV__ && process.env.EXPO_PUBLIC_ATLAS_PHASE_PROFILE === '1';
  const correlationId = enabled ? createDiagnosticCorrelationId() : '';
  let stage: AtlasProfileStage | DurableRevealStage = initialStage;
  let finished = false;
  function emit(reasonCode: AppDiagnosticReasonCode) {
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
    classification(reasonCode: RebuildClassificationReasonCode) {
      if (finished || !enabled) return;
      const atStage = stage; stage = 'REBUILD_QUALIFY_PROFILE';
      emit(reasonCode);
      stage = atStage;
    },
    finish(success: boolean) {
      if (finished) return;
      emit(success ? 'COMPLETE' : 'UNKNOWN');
      finished = true;
    },
  };
}
