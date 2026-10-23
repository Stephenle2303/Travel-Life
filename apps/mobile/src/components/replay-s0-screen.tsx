import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ActionButton, Body, Eyebrow, InsetPanel, Screen, Title } from '@/components/ui';
import { runSyntheticEncodeS0, runSyntheticS0 } from '@/replay/renderer';
import { createDiagnosticCorrelationId, recordAppDiagnostic } from '@/diagnostics/app-diagnostics';
import { appRoutes, openRoute } from '@/navigation/app-contract';

/** Development-only, synthetic native-module probe. It never accepts owner media or paths. */
export function ReplayS0Screen() {
  const router = useRouter();
  const { auto } = useLocalSearchParams<{ auto?: string }>();
  const autoStarted = useRef(false);
  const [state, setState] = useState<'idle' | 'running' | 'passed' | 'failed'>('idle');
  const [encodeState, setEncodeState] = useState<'idle' | 'running' | 'passed' | 'failed'>('idle');
  const run = useCallback(async () => {
    setState('running');
    const correlationId = createDiagnosticCorrelationId();
    recordAppDiagnostic({ operation: 'REPLAY_RENDER', reasonCode: 'START', stage: null, retryable: false, durableOutcome: 'unchanged', correlationId });
    try {
      const result = await runSyntheticS0(['-version']);
      if (!result.success) throw new Error('S0_FAILED');
      setState('passed');
      recordAppDiagnostic({ operation: 'REPLAY_RENDER', reasonCode: 'COMPLETE', stage: null, retryable: false, durableOutcome: 'complete', correlationId });
      return true;
    } catch {
      setState('failed');
      recordAppDiagnostic({ operation: 'REPLAY_RENDER', reasonCode: 'UNKNOWN', stage: null, retryable: true, durableOutcome: 'failed', correlationId });
      return false;
    }
  }, []);
  const encode = useCallback(async () => {
    setEncodeState('running');
    const correlationId = createDiagnosticCorrelationId();
    recordAppDiagnostic({ operation: 'REPLAY_RENDER', reasonCode: 'START', stage: null, retryable: false, durableOutcome: 'unchanged', correlationId });
    const verified = await runSyntheticEncodeS0();
    setEncodeState(verified ? 'passed' : 'failed');
    recordAppDiagnostic({ operation: 'REPLAY_RENDER', reasonCode: verified ? 'COMPLETE' : 'UNKNOWN', stage: null, retryable: !verified, durableOutcome: verified ? 'complete' : 'failed', correlationId });
    return verified;
  }, []);
  useEffect(() => {
    if (!__DEV__ || auto !== '1' || autoStarted.current) return;
    autoStarted.current = true;
    void (async () => { if (await run()) await encode(); })();
  }, [auto, encode, run]);
  return <Screen>
    <Eyebrow>Replay native S0</Eyebrow>
    <Title>{state === 'passed' ? 'Renderer responded on this phone.' : state === 'failed' ? 'Renderer check did not complete.' : 'Check the local renderer.'}</Title>
    <InsetPanel><Body>This development-only check runs a synthetic version query. It uses no personal media, locations, or export.</Body></InsetPanel>
    {state === 'passed' && <InsetPanel><Title>Check complete</Title><Body>The native renderer responded on this device. Encoding, output validation and sharing still need separate checks.</Body></InsetPanel>}
    {state === 'failed' && <InsetPanel><Body>The renderer did not complete this synthetic check. No private content was processed.</Body></InsetPanel>}
    <ActionButton accessibilityLabel="Run synthetic Replay renderer check" disabled={state === 'running' || state === 'passed'} onPress={() => void run()}>{state === 'running' ? 'Checking local renderer…' : state === 'passed' ? 'Renderer response confirmed' : 'Run synthetic renderer check'}</ActionButton>
    {state === 'passed' && <InsetPanel><Body>This next device-only gate encodes a one-second synthetic colour clip in the app cache and verifies it with FFprobe. It does not use or retain personal media.</Body></InsetPanel>}
    {state === 'passed' && <ActionButton accessibilityLabel="Create and verify synthetic Replay video" disabled={encodeState === 'running' || encodeState === 'passed'} onPress={() => void encode()}>{encodeState === 'running' ? 'Creating synthetic test video…' : encodeState === 'passed' ? 'Synthetic video verified' : 'Create and verify synthetic video'}</ActionButton>}
    {encodeState === 'passed' && <InsetPanel><Title>Synthetic video verified</Title><Body>A local MP4 with a video stream was encoded and verified on this phone. Private Replay composition and sharing remain separate gates.</Body></InsetPanel>}
    {encodeState === 'failed' && <InsetPanel><Title>Synthetic video was not verified</Title><Body>No private content was processed. Native encoding remains unavailable.</Body></InsetPanel>}
    <ActionButton accessibilityLabel="Return to private Replay" onPress={() => openRoute(router, appRoutes.replay, 'replace')} variant="secondary">Return to Replay</ActionButton>
    <ActionButton accessibilityLabel="Return to private Atlas" onPress={() => openRoute(router, appRoutes.atlas, 'replace')} variant="secondary">Return to Atlas</ActionButton>
  </Screen>;
}
