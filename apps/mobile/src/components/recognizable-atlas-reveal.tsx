import type { ReactNode } from 'react';
import { Image } from 'expo-image';
import { Text, View } from 'react-native';
import { ActionButton, Body, Eyebrow, InsetPanel, palette } from '@/components/ui';

export type AuthorizedTripCard = {
  id: string;
  title: string;
  observedPeriod: string;
  coverUri: string | null;
};

export type PossibleTripCard = AuthorizedTripCard & {
  reason: 'limited-photos' | 'uncertain-boundary';
  canReview?: boolean;
  canReject?: boolean;
};

type ReviewState = 'ready' | 'saving' | 'unknown' | 'stale';

type ClarificationOffer = {
  id: string;
  periodLabel: string;
  placeLabel?: string;
  previewUris: readonly string[];
};

export type AtlasClarificationState =
  | { kind: 'offered'; offer: ClarificationOffer }
  | { kind: 'checking' }
  | { kind: 'unknown'; offerId: string }
  | { kind: 'stale' }
  | { kind: 'verified'; answerRevision: string | null; addedTrips: readonly AuthorizedTripCard[]; removedRoutineCount: number };

const possibleReason: Record<PossibleTripCard['reason'], string> = {
  'limited-photos': 'An outing with limited photo evidence.',
  'uncertain-boundary': 'The photos may belong to one outing.',
};

function SectionHeading({ children }: { children: ReactNode }) {
  return <Text accessibilityRole="header" style={{ color: palette.limestone, fontSize: 22, fontWeight: '800' }}>{children}</Text>;
}

export function AuthorizedTripEvidence({ trip }: { trip: AuthorizedTripCard }) {
  return <>
    <SectionHeading>{trip.title}</SectionHeading>
    <Body>{trip.observedPeriod}</Body>
    {trip.coverUri
      ? <Image source={{ uri: trip.coverUri }} style={{ height: 144, borderRadius: 12 }}
        accessibilityLabel="Trip photo preview" cachePolicy="memory" allowDownscaling />
      : <Body>Photo preview unavailable.</Body>}
  </>;
}

export function ReadOnlyPossibleTripsSection({ trips }: { trips: readonly PossibleTripCard[] }) {
  if (!trips.length) return null;
  return <InsetPanel>
    <SectionHeading>Possible trips</SectionHeading>
    {trips.map((trip) => <InsetPanel key={trip.id}>
      <AuthorizedTripEvidence trip={trip} />
      <Body>{possibleReason[trip.reason]}</Body>
    </InsetPanel>)}
  </InsetPanel>;
}

/** Controlled presentation. Only a verified receipt may supply a visible diff
 * or an Undo revision. The caller revalidates every callback before a write. */
export function AtlasClarification({ state, onAnswer, onDismiss, onCheckAgain, onUndo }: {
  state: AtlasClarificationState;
  onAnswer(id: string, answer: 'yes' | 'no' | 'not-sure'): void;
  onDismiss(id: string): void;
  onCheckAgain(id: string): void;
  onUndo(answerRevision: string): void;
}) {
  switch (state.kind) {
    case 'offered': {
      const { id, periodLabel, placeLabel, previewUris } = state.offer;
      const previews = previewUris.filter(Boolean).slice(0, 2);
      if (!previews.length) return null;
      return <InsetPanel>
        <SectionHeading>Was this one of your usual places?</SectionHeading>
        <Body>{periodLabel}</Body>
        {placeLabel && <Body>{placeLabel}</Body>}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {previews.map((uri, index) => <Image key={index} source={{ uri }} style={{ flex: 1, height: 96, borderRadius: 8 }}
            accessibilityLabel={`Usual place photo ${index + 1}`} cachePolicy="memory" allowDownscaling />)}
        </View>
        <ActionButton onPress={() => onAnswer(id, 'yes')}>Yes</ActionButton>
        <ActionButton variant="secondary" onPress={() => onAnswer(id, 'no')}>No</ActionButton>
        <ActionButton variant="secondary" onPress={() => onAnswer(id, 'not-sure')}>Not sure</ActionButton>
        <ActionButton variant="secondary" accessibilityLabel="Dismiss usual place question" onPress={() => onDismiss(id)}>Dismiss</ActionButton>
      </InsetPanel>;
    }
    case 'checking':
      return <InsetPanel><View accessibilityLiveRegion="polite"><Body>Checking your answer…</Body></View></InsetPanel>;
    case 'unknown': {
      const { offerId } = state;
      return <InsetPanel>
        <Body>We’re checking whether your answer was saved.</Body>
        <ActionButton onPress={() => onCheckAgain(offerId)}>Check again</ActionButton>
      </InsetPanel>;
    }
    case 'stale':
      return <InsetPanel><View accessibilityLiveRegion="polite"><Body>Your Atlas changed. You can keep exploring.</Body></View></InsetPanel>;
    case 'verified': {
      const { addedTrips, removedRoutineCount, answerRevision } = state;
      const additions = addedTrips.length;
      return <InsetPanel>
        <SectionHeading>Your answer was saved</SectionHeading>
        <View accessibilityLiveRegion="polite">
          {additions > 0 && <Body>{additions === 1 ? 'We found one more trip.' : `We found ${additions} more trips.`}</Body>}
          {removedRoutineCount > 0 && <Body>Everyday photos were removed from the trip list.</Body>}
        </View>
        {addedTrips.map((trip) => <InsetPanel key={trip.id}><AuthorizedTripEvidence trip={trip} /></InsetPanel>)}
        {answerRevision && <ActionButton variant="secondary" onPress={() => onUndo(answerRevision)}>Undo answer</ActionButton>}
      </InsetPanel>;
    }
  }
}

export function PossibleTripsSection({ trips, selectedId, reviewState, evidence, onOpen, onClose, onDecision, onCheckAgain, onLoadMore, onPrevious }: {
  trips: readonly PossibleTripCard[];
  selectedId: string | null;
  reviewState: ReviewState;
  evidence?: ReactNode;
  onOpen(id: string): void;
  onClose(): void;
  onDecision(id: string, decision: 'keep' | 'reject'): void;
  onCheckAgain(id: string): void;
  onLoadMore?: () => void;
  onPrevious?: () => void;
}) {
  const selected = trips.find((trip) => trip.id === selectedId);
  if (!trips.length) return null;

  return <InsetPanel>
    <SectionHeading>Possible trips</SectionHeading>
    <Body>Review outings you might want to keep.</Body>
    {trips.map((trip) => <InsetPanel key={trip.id}>
      <AuthorizedTripEvidence trip={trip} />
      <Body>{possibleReason[trip.reason]}</Body>
      {selected?.id === trip.id ? <>
        {evidence}
        {reviewState === 'stale' ? <Body>Your Atlas changed. Reopen Possible trips to see the current results.</Body> : <>
          {reviewState === 'saving' && <View accessibilityLiveRegion="polite"><Body>Saving your choice…</Body></View>}
          {reviewState === 'unknown' ? <>
            <Body>We’re checking whether your choice was saved.</Body>
            <ActionButton onPress={() => onCheckAgain(trip.id)}>Check again</ActionButton>
          </> : <>
            {trip.canReview === false ? <Body>This outing’s grouping cannot be saved here yet.</Body>
              : <ActionButton disabled={reviewState !== 'ready'} onPress={() => onDecision(trip.id, 'keep')}>Keep as a trip</ActionButton>}
            {(trip.canReject ?? trip.canReview !== false) && <ActionButton variant="secondary" disabled={reviewState !== 'ready'} onPress={() => onDecision(trip.id, 'reject')}>Not a trip</ActionButton>}
          </>}
        </>}
        <ActionButton variant="secondary" onPress={onClose}>Close review</ActionButton>
      </> : <ActionButton variant="secondary" disabled={reviewState === 'saving' || reviewState === 'unknown'} accessibilityLabel={`Review possible trip ${trip.title}`} onPress={() => onOpen(trip.id)}>Review outing</ActionButton>}
    </InsetPanel>)}
    {onPrevious && <ActionButton variant="secondary" disabled={reviewState === 'saving' || reviewState === 'unknown'} onPress={onPrevious}>Previous possible trips</ActionButton>}
    {onLoadMore && <ActionButton variant="secondary" disabled={reviewState === 'saving' || reviewState === 'unknown'} onPress={onLoadMore}>More possible trips</ActionButton>}
  </InsetPanel>;
}

/** Opt-in presentation for a verified projection. Scope, paging and persistence
 * stay with the caller. The observed map must not display provisional trips. */
export function RecognizableAtlasReveal({ observedMap, featuredTrip, onOpenTrip, onPlayTrip, onOpenTimeline, clarification, possibleTrips }: {
  observedMap: ReactNode;
  featuredTrip: AuthorizedTripCard | null;
  onOpenTrip?: (id: string) => void;
  onPlayTrip?: (id: string) => void;
  onOpenTimeline(): void;
  clarification?: ReactNode;
  possibleTrips?: ReactNode;
}) {
  return <View style={{ gap: 12 }}>
    {observedMap}
    {featuredTrip && <InsetPanel>
      <Eyebrow>Featured trip</Eyebrow>
      <AuthorizedTripEvidence trip={featuredTrip} />
      {onPlayTrip
        ? <ActionButton onPress={() => onPlayTrip(featuredTrip.id)}>Play this trip</ActionButton>
        : onOpenTrip && <ActionButton onPress={() => onOpenTrip(featuredTrip.id)}>Open trip</ActionButton>}
    </InsetPanel>}
    <ActionButton variant="secondary" onPress={onOpenTimeline}>Open Timeline</ActionButton>
    {clarification}
    {possibleTrips}
  </View>;
}
