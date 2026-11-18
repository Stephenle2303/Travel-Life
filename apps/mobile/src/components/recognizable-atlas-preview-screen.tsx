import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppState, View } from 'react-native';
import { appRoutes, isReconstructionPreviewEnabled, openRoute } from '@/navigation/app-contract';
import { usePhotoAccess } from '@/photo-access/provider';
import { ActionButton, Body, Eyebrow, InsetPanel, Screen, Title } from '@/components/ui';
import { AuthorizedTripEvidence, ReadOnlyPossibleTripsSection } from '@/components/recognizable-atlas-reveal';
import { RecognizableComparisonLimitError, type RecognizableShadowPreview } from '@/reconstruction/recognizable-shadow-types';
import type { DurableRevealRecord } from '@/reveal/types';

type PreviewState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'too-large' }
  | { status: 'ready'; preview: RecognizableShadowPreview; baseline: DurableRevealRecord | null; attempt: number };

export function RecognizableAtlasPreviewScreen() {
  const router = useRouter();
  const { controller, privateRecord, snapshot, durableReveal, loadRecognizableShadowPreview } = usePhotoAccess();
  const [state, setState] = useState<PreviewState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [foreground, setForeground] = useState(() => !AppState.currentState || AppState.currentState === 'active');
  const enabled = isReconstructionPreviewEnabled();
  const local = !controller.isAccountRecord && privateRecord.state === 'connected'
    && privateRecord.pendingAction === null && snapshot.scope === 'full';

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => setForeground(status === 'active'));
    return () => subscription.remove();
  }, []);

  useFocusEffect(useCallback(() => {
    if (!enabled || !foreground || !local || !loadRecognizableShadowPreview) return;
    const request = new AbortController();
    setState({ status: 'loading' });
    void loadRecognizableShadowPreview(request.signal).then((preview) => {
      if (!request.signal.aborted) setState({ status: 'ready', preview, baseline: durableReveal, attempt });
    }).catch((error: unknown) => {
      if (!request.signal.aborted) setState({ status: error instanceof RecognizableComparisonLimitError ? 'too-large' : 'error' });
    });
    return () => {
      request.abort();
      setState({ status: 'loading' });
    };
  }, [attempt, durableReveal, enabled, foreground, local, loadRecognizableShadowPreview]));

  const back = () => openRoute(router, appRoutes.settings, 'dismissTo');
  if (!enabled) return <Screen><Title>Preview unavailable</Title><ActionButton onPress={back}>Back to Settings</ActionButton></Screen>;

  return <Screen>
    <Eyebrow>Development preview</Eyebrow>
    <Title>Reconstruction preview</Title>
    <Body>Read-only comparison using saved local evidence.</Body>
    {(!local || !loadRecognizableShadowPreview) ? <InsetPanel><Body>Open connected Local history with full photo access to run this comparison.</Body></InsetPanel>
      : !foreground || state.status === 'loading' || (state.status === 'ready' && (state.baseline !== durableReveal || state.attempt !== attempt))
        ? <View accessibilityLiveRegion="polite"><Body>Comparing saved evidence…</Body></View>
      : state.status === 'too-large' ? <InsetPanel>
        <Body>This development comparison supports up to 24,000 photo and video records. Your saved Atlas is still available.</Body>
      </InsetPanel> : state.status === 'error' ? <InsetPanel>
        <Body>Couldn’t read the current comparison.</Body>
        <ActionButton onPress={() => setAttempt((previous) => previous + 1)}>Try again</ActionButton>
      </InsetPanel> : <ShadowResults preview={state.preview} />}
    <ActionButton variant="secondary" onPress={back}>Back to Settings</ActionButton>
  </Screen>;
}

function ShadowResults({ preview }: { preview: RecognizableShadowPreview }) {
  return <>
    {preview.comparison ? <InsetPanel>
      <Body>Compared {preview.comparison.evidenceRows.toLocaleString()} local records in {(preview.comparison.elapsedMillis / 1000).toFixed(1)} seconds.</Body>
      <Body>Baseline {preview.comparison.baselineRuleVersion} / {preview.comparison.baselineTripDetectorVersion}</Body>
      <Body>Candidate {preview.policyVersion}</Body>
    </InsetPanel> : null}
    {preview.separatePairs?.length ? <InsetPanel>
      <Title>Candidate groups kept separate</Title>
      {preview.separatePairs.map(({ id, left, right, baselineGrouping }) => <InsetPanel key={id}>
        <Body>{left.title} · {left.observedPeriod}</Body>
        <Body>{right.title} · {right.observedPeriod}</Body>
        <Body>{baselineGrouping === 'joined' ? 'Baseline groups this evidence together.'
          : baselineGrouping === 'separate' ? 'Baseline also keeps these groups separate.'
          : 'Exact baseline grouping could not be matched.'}</Body>
      </InsetPanel>)}
    </InsetPanel> : null}
    <InsetPanel>
      <Title>Reliable trip candidates</Title>
      <Body>{preview.reliable.length ? 'Trips this policy would include.' : 'No reliable trips in the comparison.'}</Body>
      {preview.reliable.map((trip) => <InsetPanel key={trip.id}>
        <AuthorizedTripEvidence trip={trip} />
      </InsetPanel>)}
    </InsetPanel>
    <ReadOnlyPossibleTripsSection trips={preview.possible} />
  </>;
}
