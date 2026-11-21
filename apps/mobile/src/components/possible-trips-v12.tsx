import { Text, View } from 'react-native';
import { ActionButton, Body, InsetPanel, palette } from '@/components/ui';
import { createDiagnosticCorrelationId, recordAppDiagnostic } from '@/diagnostics/app-diagnostics';
import { possibleTripReasonSentence } from '@/reconstruction/possible-trip-copy';
import type { PossibleTripSummary } from '@/reconstruction/types';

function SectionHeading({ children }: { children: string }) {
  return <Text accessibilityRole="header" style={{ color: palette.limestone, fontSize: 22, fontWeight: '800' }}>{children}</Text>;
}

/**
 * CAP-3's real Possible-trips card (detector-v1-2.md): one closed reason
 * sentence per card, and a Set Home action for `home-not-set`. Keep/reject
 * is deliberately not reimplemented here — "Review outing" opens the
 * existing, already fully-instrumented journey correction screen, the same
 * path the main Atlas's confirmed trips already use.
 */
export function PossibleTripsV12Section({ trips, onReviewOuting, onSetHome }: {
  trips: readonly PossibleTripSummary[];
  onReviewOuting(displayId: string): void;
  onSetHome?(): void;
}) {
  if (!trips.length) return null;
  const setHome = onSetHome ? () => {
    recordAppDiagnostic({ operation: 'POSSIBLE_TRIP_REVIEW', stage: 'POSSIBLE_TRIP_SET_HOME', reasonCode: 'HOME_NOT_SET', durableOutcome: 'complete', retryable: false, correlationId: createDiagnosticCorrelationId() });
    onSetHome();
  } : undefined;
  return <InsetPanel>
    <SectionHeading>Possible trips</SectionHeading>
    <Body>These outings aren&apos;t confirmed yet. Review them when you have a moment.</Body>
    {trips.map((trip) => <View key={trip.displayId} accessibilityLabel={`Possible trip, ${trip.periodLabel}`} style={{ gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: palette.fern }}>
      <Body>{trip.periodLabel}</Body>
      <Body>{possibleTripReasonSentence(trip.reasonCode, trip.locatedCount)}</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {trip.reasonCode === 'home-not-set' && setHome && <ActionButton accessibilityLabel="Set Home" onPress={setHome}>Set Home</ActionButton>}
        <ActionButton variant="secondary" accessibilityLabel={`Review outing, ${trip.periodLabel}`} onPress={() => onReviewOuting(trip.displayId)}>Review outing</ActionButton>
      </View>
    </View>)}
  </InsetPanel>;
}
