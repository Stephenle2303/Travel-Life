import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useRouter } from 'expo-router';
import { ActionButton, Body, Eyebrow, InsetPanel, palette, Screen, Title } from '@/components/ui';
import { openRoute, appRoutes } from '@/navigation/app-contract';
import { usePhotoAccess } from '@/photo-access/provider';
import { planPrivateReplay } from '@/replay/selection';
import { type ReplayDirection, type ReplayManifestInput } from '@/replay/types';
import { createDiagnosticCorrelationId, recordAppDiagnostic } from '@/diagnostics/app-diagnostics';
import { ReplayPreparationError, replayFailureStage, type ReplayFailureStage } from '@/replay/renderer';

type ViewState = 'idle' | 'sparse' | 'checking' | 'preview-ready' | 'editing' | 'share-review' | 'failed';
const failureCopy: Record<ReplayFailureStage, string> = {
  REPLAY_ACCESS: 'Current local photo access could not provide an original for Replay.',
  REPLAY_SCOPE: 'The selected Replay does not contain a usable moment to render on this device.',
  REPLAY_DECODE: 'Attached media could not be decoded into a Replay scene on this device.',
  REPLAY_ENCODE: 'This device could not compose the Replay video.',
  REPLAY_OUTPUT: 'The local Replay video did not pass verification.',
  REPLAY_STALE: 'Your Journey List changed while Replay was preparing. Prepare it again.',
  REPLAY_UNAVAILABLE: 'The local Replay renderer is unavailable on this device.',
};

function ReplayPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (video) => { video.muted = true; video.staysActiveInBackground = false; video.play(); });
  return <VideoView player={player} style={styles.preview} nativeControls contentFit="contain" />;
}

/** Private UI state only; it never receives native source references or creates an export. */
export function ReplayScreen() {
  const router = useRouter();
  const { loadReplayManifestInput, saveReplayDraft, resetReplayDraft, preparePrivateReplay, exportPrivateReplay, discardPrivateReplay } = usePhotoAccess();
  const [input, setInput] = useState<ReplayManifestInput | null>(null);
  const [preview, setPreview] = useState<{ uri: string; renderedMemoryCount: number; durationSeconds: number } | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<ReplayFailureStage | null>(null);
  const [state, setState] = useState<ViewState>('idle');
  const [preparationPhase, setPreparationPhase] = useState<'resolving' | 'rendering'>('resolving');
  const [preparationDetail, setPreparationDetail] = useState('Checking the visible trips and locally available memories you can use right now.');
  const [preparationProgress, setPreparationProgress] = useState<{ completed: number; total: number } | null>(null);
  const [editedMemoryKeys, setEditedMemoryKeys] = useState<readonly string[]>([]);
  const [timelineDirection, setTimelineDirection] = useState<ReplayDirection>('oldest-first');
  const [replacementTarget, setReplacementTarget] = useState<string | null>(null);
  const [shareMemoryKeys, setShareMemoryKeys] = useState<readonly string[]>([]);
  const [sharing, setSharing] = useState(false);
  const started = useRef(false);
  const exportInProgress = useRef(false);
  const timelineDirectionRef = useRef<ReplayDirection>('oldest-first');
  const setReplayTimelineDirection = (direction: ReplayDirection) => { timelineDirectionRef.current = direction; setTimelineDirection(direction); };
  const prepare = async () => {
    recordAppDiagnostic({ operation: 'REPLAY_RENDER', reasonCode: 'START', stage: null, retryable: false, durableOutcome: 'unchanged', correlationId: createDiagnosticCorrelationId() });
    setFailure(null); setPreparationPhase('resolving'); setPreparationDetail('Checking the visible trips and locally available memories you can use right now.'); setPreparationProgress(null); setState('checking');
    try {
      const next = await loadReplayManifestInput();
      const direction = next.direction ?? 'oldest-first';
      const plan = planPrivateReplay(next.groups, next.memories, undefined, direction);
      setInput(next); setReplayTimelineDirection(direction); setEditedMemoryKeys(plan.memories.map((memory) => memory.key));
      if (!plan.groups.length) { setState('sparse'); return; }
      setPreparationPhase('rendering'); setPreparationDetail('Starting the local video renderer.');
      const prepared = await preparePrivateReplay(undefined, (progress) => { setPreparationDetail(progress.message); setPreparationProgress({ completed: progress.completed, total: progress.total }); });
      setPreview(prepared); setState('preview-ready');
    } catch (error) {
      const stage = replayFailureStage(error);
      setFailure(stage); setState('failed');
      recordAppDiagnostic({ operation: 'REPLAY_RENDER', reasonCode: 'UNKNOWN', stage, retryable: stage !== 'REPLAY_SCOPE', durableOutcome: 'unchanged', correlationId: createDiagnosticCorrelationId() });
    }
  };
  const cancel = () => {
    if (preview) void discardPrivateReplay(preview.uri);
    setPreview(null); setExportMessage(null); setShareMemoryKeys([]); setReplacementTarget(null); setState('idle'); recordAppDiagnostic({ operation: 'REPLAY_RENDER', reasonCode: 'SKIPPED', stage: null, retryable: false, durableOutcome: 'skipped', correlationId: createDiagnosticCorrelationId() });
  };
  const exportReplay = async () => {
    if (!preview || exportInProgress.current) return;
    exportInProgress.current = true;
    setSharing(true);
    const correlationId = createDiagnosticCorrelationId();
    recordAppDiagnostic({ operation: 'REPLAY_EXPORT', reasonCode: 'START', stage: null, retryable: false, durableOutcome: 'unchanged', correlationId });
    let selectedArtifact: { uri: string } | null = null;
    try {
      if (state === 'share-review') {
        if (!shareMemoryKeys.length) return;
        selectedArtifact = await preparePrivateReplay(shareMemoryKeys);
      }
      const result = await exportPrivateReplay(selectedArtifact?.uri ?? preview.uri);
      setExportMessage(result === 'closed' ? 'Share sheet closed. Travel Life cannot confirm whether a recipient saved or received a copy.' : 'Sharing is unavailable on this device. Your private preview is still here.');
      recordAppDiagnostic({ operation: 'REPLAY_EXPORT', reasonCode: result === 'closed' ? 'COMPLETE' : 'RESTRICTED', stage: null, retryable: result === 'unavailable', durableOutcome: result === 'closed' ? 'complete' : 'unchanged', correlationId });
    } catch {
      setExportMessage('The share handoff did not start. Your private preview is still here.');
      recordAppDiagnostic({ operation: 'REPLAY_EXPORT', reasonCode: 'UNKNOWN', stage: null, retryable: true, durableOutcome: 'unchanged', correlationId });
    } finally {
      if (selectedArtifact && selectedArtifact.uri !== preview?.uri) await discardPrivateReplay(selectedArtifact.uri);
      exportInProgress.current = false;
      setSharing(false);
    }
  };
  const toggleMemory = (key: string) => setEditedMemoryKeys((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key]);
  const moveMemory = (key: string, direction: -1 | 1) => setEditedMemoryKeys((current) => {
    const index = current.indexOf(key);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= current.length) return current;
    const reordered = [...current];
    [reordered[index], reordered[next]] = [reordered[next]!, reordered[index]!];
    return reordered;
  });
  const replaceMemory = (replacementKey: string) => {
    if (!replacementTarget) return;
    setEditedMemoryKeys((current) => current.map((key) => key === replacementTarget ? replacementKey : key));
    setReplacementTarget(null);
  };
  const toggleAllShareMemories = () => {
    if (!input) return;
    const eligible = input.memories.filter((memory) => memory.available && memory.eligible).map((memory) => memory.key);
    setShareMemoryKeys((current) => current.length === eligible.length ? [] : eligible);
  };
  const saveEdits = async () => {
    if (!editedMemoryKeys.length) return;
    setFailure(null); setPreparationPhase('resolving'); setState('checking');
    try {
      if (!input) throw new ReplayPreparationError('REPLAY_STALE');
      await saveReplayDraft(editedMemoryKeys, input.snapshotToken, input.privacyRevision, timelineDirectionRef.current);
      if (preview) await discardPrivateReplay(preview.uri);
      setPreview(null);
      await prepare();
    } catch (error) {
      const stage = replayFailureStage(error);
      setFailure(stage); setState('failed');
    }
  };
  const resetEdits = async () => {
    setFailure(null); setPreparationPhase('resolving'); setState('checking');
    try {
      if (!input) throw new ReplayPreparationError('REPLAY_STALE');
      await resetReplayDraft(input.snapshotToken, input.privacyRevision);
      if (preview) await discardPrivateReplay(preview.uri);
      setPreview(null);
      await prepare();
    } catch (error) {
      const stage = replayFailureStage(error);
      setFailure(stage); setState('failed');
    }
  };
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void prepare();
  });
  return <Screen>
    <Eyebrow>Private Replay</Eyebrow><Title>{state === 'sparse' ? 'Replay needs available memories.' : state === 'checking' ? 'Getting your Replay ready.' : 'Your private Replay.'}</Title>
    {state === 'idle' && <InsetPanel><Body>Replay uses your current private Journey List and available attached memories. Journey order is presentation only: it does not claim a route, presence, or travel duration.</Body></InsetPanel>}
    {state === 'sparse' && <InsetPanel>
      <Body>Replay found {input?.groups.length ?? 0} visible trip{(input?.groups.length ?? 0) === 1 ? '' : 's'} and {input?.memories.filter((memory) => memory.available && memory.eligible).length ?? 0} usable attached memories.</Body>
      <Body>Nothing was rendered or shared. Return to your private Journey List to review which trips and attachments are currently visible; Travel Life will not invent missing memories.</Body>
    </InsetPanel>}
    {state === 'checking' && <InsetPanel>
      <View style={styles.preparingHeader} accessibilityLabel={preparationPhase === 'resolving' ? 'Resolving private Replay memories' : `Rendering private Replay video${preparationProgress ? `, ${Math.min(100, Math.round(preparationProgress.completed / preparationProgress.total * 100))}% complete` : ''}`} accessibilityState={{ busy: true }}>
        <ActivityIndicator color={palette.citrus} />
        <Text style={styles.preparingTitle}>{preparationPhase === 'resolving' ? 'Finding your Replay moments' : 'Rendering your private Replay'}</Text>
      </View>
      <Body>{preparationDetail}</Body>
      {preparationPhase === 'rendering' && preparationProgress && <View style={styles.progressBlock} accessibilityLabel={`Replay rendering ${Math.min(100, Math.round(preparationProgress.completed / preparationProgress.total * 100))}% complete`} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.min(100, Math.round(preparationProgress.completed / preparationProgress.total * 100)) }}>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(100, Math.round(preparationProgress.completed / preparationProgress.total * 100))}%` }]} /></View>
        <Text style={styles.progressText}>{Math.min(100, Math.round(preparationProgress.completed / preparationProgress.total * 100))}%</Text>
      </View>}
      <Body>Nothing is shared while Replay is getting ready.</Body>
    </InsetPanel>}
    {state === 'preview-ready' && preview && <InsetPanel><Title>Playing your private Replay.</Title><ReplayPreview uri={preview.uri} /><Body>Built locally from {preview.renderedMemoryCount} selected memories. It stays private while you watch.</Body>{exportMessage && <Body>{exportMessage}</Body>}</InsetPanel>}
    {state === 'editing' && input && <InsetPanel><Title>Edit this Replay</Title><Body>Choose, replace, and order the available moments to use. These choices change only your private Replay, never your journey evidence.</Body><Body>Timeline order changes chapter presentation only. It does not claim a route, exact dates, or travel duration.</Body><ActionButton accessibilityLabel="Use oldest-first Replay timeline" onPress={() => setReplayTimelineDirection('oldest-first')} disabled={timelineDirection === 'oldest-first'} variant="secondary">Oldest first</ActionButton><ActionButton accessibilityLabel="Use newest-first Replay timeline" onPress={() => setReplayTimelineDirection('newest-first')} disabled={timelineDirection === 'newest-first'} variant="secondary">Newest first</ActionButton>{replacementTarget && <Body>Choose an available moment to replace the selected one.</Body>}{input.memories.filter((memory) => memory.available && memory.eligible).map((memory, index) => {
      const included = editedMemoryKeys.includes(memory.key);
      const selectedIndex = editedMemoryKeys.indexOf(memory.key);
      const date = memory.capture?.startDay ?? 'Date unknown';
      return <InsetPanel key={memory.key}>{included ? <><ActionButton accessibilityLabel={`Remove ${memory.kind} ${index + 1}`} onPress={() => toggleMemory(memory.key)} variant="secondary">Remove {memory.kind} · {date}</ActionButton><ActionButton accessibilityLabel={`Replace ${memory.kind} ${index + 1}`} onPress={() => setReplacementTarget(memory.key)} variant="secondary">Replace</ActionButton><ActionButton accessibilityLabel={`Move ${memory.kind} ${index + 1} earlier`} onPress={() => moveMemory(memory.key, -1)} disabled={selectedIndex === 0} variant="secondary">Move earlier</ActionButton><ActionButton accessibilityLabel={`Move ${memory.kind} ${index + 1} later`} onPress={() => moveMemory(memory.key, 1)} disabled={selectedIndex === editedMemoryKeys.length - 1} variant="secondary">Move later</ActionButton></> : <ActionButton accessibilityLabel={replacementTarget ? `Use ${memory.kind} ${index + 1} as replacement` : `Add ${memory.kind} ${index + 1}`} onPress={() => replacementTarget ? replaceMemory(memory.key) : toggleMemory(memory.key)} variant="secondary">{replacementTarget ? `Use as replacement · ${date}` : `Add ${memory.kind} · ${date}`}</ActionButton>}</InsetPanel>;
    })}</InsetPanel>}
    {state === 'share-review' && preview && input && <InsetPanel><Title>Choose moments to share</Title><Body>Sharing may create a copy outside Travel Life. Select the exact moments to render before opening the system share sheet.</Body>{sharing && <Body>Preparing your selected private Replay.</Body>}<ActionButton accessibilityLabel="Select all Replay moments for sharing" disabled={sharing} onPress={toggleAllShareMemories} variant="secondary">{shareMemoryKeys.length === input.memories.filter((memory) => memory.available && memory.eligible).length ? 'Clear all moments' : 'Select all moments'}</ActionButton>{input.memories.filter((memory) => memory.available && memory.eligible).map((memory, index) => { const selected = shareMemoryKeys.includes(memory.key); return <ActionButton key={memory.key} accessibilityLabel={`${selected ? 'Remove' : 'Select'} ${memory.kind} ${index + 1} for sharing`} disabled={sharing} onPress={() => setShareMemoryKeys((current) => selected ? current.filter((key) => key !== memory.key) : [...current, memory.key])} variant="secondary">{selected ? 'Selected' : 'Select'} {memory.kind} {index + 1}</ActionButton>; })}{exportMessage && <Body>{exportMessage}</Body>}</InsetPanel>}
    {state === 'failed' && <InsetPanel><Title>Replay could not be prepared.</Title><Body>{failure ? failureCopy[failure] : failureCopy.REPLAY_UNAVAILABLE}</Body><Body>Your current private Journey List and attached media were kept unchanged.</Body></InsetPanel>}
    {state === 'preview-ready' && <ActionButton accessibilityLabel="Choose Replay for sharing" onPress={() => { setShareMemoryKeys([]); setExportMessage(null); setState('share-review'); }}>Share Replay</ActionButton>}
    {state === 'preview-ready' && <ActionButton accessibilityLabel="Edit private Replay" onPress={() => setState('editing')} variant="secondary">Edit Replay</ActionButton>}
    {state === 'editing' && <ActionButton accessibilityLabel="Save Replay edits" onPress={() => void saveEdits()} disabled={!editedMemoryKeys.length}>Done</ActionButton>}
    {state === 'editing' && <ActionButton accessibilityLabel="Reset Replay edits" onPress={() => void resetEdits()} variant="secondary">Reset automatic selection</ActionButton>}
    {state === 'editing' && <ActionButton accessibilityLabel="Cancel Replay edits" onPress={() => { setReplacementTarget(null); setState('preview-ready'); }} variant="secondary">Back</ActionButton>}
    {state === 'share-review' && <ActionButton accessibilityLabel="Open Replay share sheet" onPress={() => void exportReplay()} disabled={!shareMemoryKeys.length || sharing}>{sharing ? 'Preparing selected Replay…' : 'Review and Share'}</ActionButton>}
    {state === 'share-review' && <ActionButton accessibilityLabel="Cancel Replay share selection" onPress={() => setState('preview-ready')} variant="secondary">Back</ActionButton>}
    {state === 'sparse' && <ActionButton accessibilityLabel="Return to private Journey List" onPress={() => openRoute(router, appRoutes.atlas, 'replace')}>Return to Journey List</ActionButton>}
    {state === 'failed' && <ActionButton accessibilityLabel="Retry private Replay" onPress={() => void prepare()}>Retry Replay</ActionButton>}
    {__DEV__ && state === 'failed' && <ActionButton accessibilityLabel="Open synthetic Replay renderer check" onPress={() => openRoute(router, appRoutes.replayS0)}>Open synthetic Replay renderer check</ActionButton>}
    {(state === 'checking' || state === 'failed' || state === 'preview-ready' || state === 'editing' || state === 'share-review') && <ActionButton accessibilityLabel="Cancel Replay preparation" onPress={cancel} variant="secondary">Close Replay</ActionButton>}
    <ActionButton accessibilityLabel="Return to private Atlas" onPress={() => openRoute(router, appRoutes.atlas, 'replace')} variant="secondary">Return to Atlas</ActionButton>
  </Screen>;
}

const styles = StyleSheet.create({
  preview: { width: '100%', aspectRatio: 16 / 9, marginVertical: 12, borderRadius: 12 },
  preparingHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  preparingTitle: { color: palette.limestone, fontSize: 18, fontWeight: '800' },
  progressBlock: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  progressTrack: { flex: 1, height: 8, borderRadius: 999, overflow: 'hidden', backgroundColor: palette.fern },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: palette.citrus },
  progressText: { color: palette.limestone, fontSize: 14, fontWeight: '800', minWidth: 38, textAlign: 'right' },
});
