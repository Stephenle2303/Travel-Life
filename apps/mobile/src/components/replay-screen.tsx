import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView, type VideoThumbnail } from 'expo-video';
import { Image, type ImageRef } from 'expo-image';
import { replayThumbnails } from '@/replay/thumbnail-service';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { importReplayAudio, removeUnownedReplayAudio, type ReplayAudioCandidate } from '@/replay/audio-import';
import { getMediaInformation } from 'munim-ffmpeg';
import { useNavigation, useRouter } from 'expo-router';
import { ActionButton, Body, Eyebrow, InsetPanel, palette, Screen, Title } from '@/components/ui';
import { openRoute, appRoutes } from '@/navigation/app-contract';
import { ReplayDraftSaveError, usePhotoAccess } from '@/photo-access/provider';
import { ReplayEditSession, ReplaySaveOutcomeError, type ReplayEditSnapshot } from '@/replay/edit-session';
import { planPrivateReplay } from '@/replay/selection';
import { replayChapterFrames, replayDuration, type ReplayDirection, type ReplayManifestInput, type ReplayMemory, type ReplayPreparedPreview, type ReplaySoundtrack } from '@/replay/types';
import { classifyAppDiagnosticError, createDiagnosticCorrelationId, recordAppDiagnostic } from '@/diagnostics/app-diagnostics';
import { ReplayPreparationError, replayFailureStage, type ReplayFailureStage } from '@/replay/renderer';

type ViewState = 'idle' | 'sparse' | 'checking' | 'first-trip-ready' | 'final-ready' | 'finalization-failed' | 'recovery-ready' | 'editing' | 'share-review' | 'failed';

// The route owns an in-progress update just as it owns an open editor. Native
// Back must not discard an acknowledged draft while its replacement video is
// being rendered.
export const keepsReplayRoute = (state: ViewState) => state === 'editing' || state === 'share-review' || state === 'checking';
export function musicSaveFailureCopy(error: unknown) {
  if (error instanceof ReplayDraftSaveError && error.reason === 'scope') return 'Your Journey List changed while this sheet was open. Your audio file is ready, but reopen Edit to save it to the current Replay.';
  if (error instanceof ReplayDraftSaveError && (error.reason === 'revision' || error.reason === 'branch')) return 'A previous Replay edit is still being reconciled on this device. Your audio file is ready; try Done again.';
  if (error instanceof ReplaySaveOutcomeError && error.outcome.kind === 'outcome-unknown') return 'Still confirming this device’s Replay save. Your audio file is kept; check the save again before retrying.';
  if (error instanceof ReplaySaveOutcomeError && error.outcome.kind === 'conflict') return 'Your choices do not match the current local Replay draft. Your audio file is kept; review the saved draft before retrying.';
  return 'This device could not save your Replay changes. Your audio file is kept; try Done again.';
}
const failureCopy: Record<ReplayFailureStage, string> = {
  REPLAY_ACCESS: 'Current local photo access could not provide an original for Replay.',
  REPLAY_SCOPE: 'The selected Replay does not contain a usable moment to render on this device.',
  REPLAY_DECODE: 'Attached media could not be decoded into a Replay scene on this device.',
  REPLAY_ENCODE: 'This device could not compose the Replay video.',
  REPLAY_OUTPUT: 'The local Replay video did not pass verification.',
  REPLAY_STALE: 'Replay needs a refresh before it can be prepared. Your latest choices were not rendered.',
  REPLAY_UNAVAILABLE: 'The local Replay renderer is unavailable on this device.',
};

function ReplayPreview({ uri, muted, onMutedChange }: { uri: string; muted: boolean; onMutedChange(muted: boolean): void }) {
  const player = useVideoPlayer(uri, (video) => { video.muted = muted; video.staysActiveInBackground = false; video.play(); });
  const [fullscreen, setFullscreen] = useState(false);
  const toggleMuted = () => {
    // This is player-only listening state: no preparation, cache invalidation,
    // artifact replacement, or seek is involved.
    // eslint-disable-next-line react-hooks/immutability -- expo-video exposes mutable player controls by design.
    player.muted = !muted;
    onMutedChange(!muted);
  };
  const controls = <View style={styles.playerControls}>
      <Pressable accessibilityRole="button" accessibilityLabel={muted ? 'Unmute Replay audio' : 'Mute Replay audio'} accessibilityState={{ selected: muted }} onPress={toggleMuted} style={styles.playerControl}><Text style={styles.playerIcon}>{muted ? '🔇' : '🔊'}</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={fullscreen ? 'Close Replay fullscreen' : 'Open Replay fullscreen'} onPress={() => setFullscreen((current) => !current)} style={styles.playerControl}><Text style={styles.playerIcon}>⛶</Text></Pressable>
    </View>;
  return <><View style={styles.previewShell}>
    {!fullscreen && <VideoView player={player} style={styles.preview} nativeControls fullscreenOptions={{ enable: false }} contentFit="contain" />}
    {!fullscreen && controls}
  </View><Modal visible={fullscreen} animationType="fade" onRequestClose={() => setFullscreen(false)}><View style={styles.fullscreenShell}>
    <VideoView player={player} style={styles.fullscreenPreview} nativeControls fullscreenOptions={{ enable: false }} contentFit="contain" />
    {controls}
  </View></Modal></>;
}

/** Source inspection is optional and starts paused/muted, separate from Replay audio. */
function ReplaySourceVideo({ uri, intendedSeconds }: { uri: string; intendedSeconds: number }) {
  const player = useVideoPlayer(uri, (video) => { video.muted = true; video.pause(); });
  const [usedSeconds, setUsedSeconds] = useState<number | null>(null);
  useEffect(() => { let active = true; void Promise.resolve(getMediaInformation(uri)).then((media) => { const duration = Number(media?.format?.duration ?? 0); if (active && Number.isFinite(duration) && duration > 0) setUsedSeconds(Math.min(intendedSeconds, duration)); }).catch(() => undefined); return () => { active = false; player.pause(); }; }, [intendedSeconds, player, uri]);
  const end = usedSeconds === null ? 'loading' : `0:${String(Math.floor(usedSeconds)).padStart(2, '0')}`;
  return <><VideoView player={player} style={styles.inspectorImage} nativeControls contentFit="contain" accessibilityLabel="Inspected video" /><View accessibilityLabel="Used in Replay interval"><Body>Used in Replay: 0:00–{end}</Body></View></>;
}

/** Mirrors the renderer's card-borrowing and per-item frame allocation. */
export function replayVideoSceneSeconds(selectedCount: number, selectedIndex: number) {
  if (selectedCount < 1 || selectedIndex < 0 || selectedIndex >= selectedCount) return 0;
  const contentFrames = replayChapterFrames(selectedCount) - Math.min(72, replayChapterFrames(selectedCount));
  return (Math.floor(contentFrames / selectedCount) + (selectedIndex < contentFrames % selectedCount ? 1 : 0)) / 24;
}

/** A bounded local poster is recognisable without autoplaying source video. */
function ReplayVideoPoster({ uri, video = true }: { uri: string; video?: boolean }) {
  const [poster, setPoster] = useState<ImageRef | VideoThumbnail | null>(null);
  useEffect(() => {
    let active = true;
    let heldHandle: ImageRef | VideoThumbnail | undefined;
    const unsubscribe = replayThumbnails.subscribeInvalidation(() => { active = false; setPoster(null); });
    void replayThumbnails.request(uri, uri, video).then((handle) => { if (!active || !handle) return; heldHandle = handle; replayThumbnails.pin(uri); setPoster(handle); });
    return () => { active = false; unsubscribe(); if (heldHandle) replayThumbnails.unpin(uri, heldHandle); };
  }, [uri, video]);
  return poster ? <Image source={poster} style={styles.mediaImage} contentFit="cover" accessibilityLabel={video ? 'video poster' : 'photo thumbnail'} /> : <View style={styles.mediaFallback}><Text style={styles.mediaFallbackText}>{video ? 'VIDEO' : 'PHOTO'}</Text></View>;
}

/** Share can only offer media that belongs to the committed private Replay. */
export function shareableCommittedMemories(input: ReplayManifestInput | null, committedMemoryKeys: readonly string[]) {
  if (!input) return [];
  const committed = new Set(committedMemoryKeys);
  const included = new Set(input.includedGroupKeys ?? (input.groups.length ? input.groups.filter((group) => group.eligible).map((group) => group.key) : input.memories.map((memory) => memory.groupKey)));
  return input.memories.filter((memory) => memory.available && memory.eligible && included.has(memory.groupKey) && committed.has(memory.key));
}

function ReplayMediaTile({ memory, index, included, disabled = false, resolving = false, onToggle, onInspect }: { memory: ReplayMemory; index: number; included: boolean; disabled?: boolean; resolving?: boolean; onToggle(key: string): void; onInspect(memory: ReplayMemory): void }) {
  return <View style={[styles.mediaCell, disabled && styles.mediaCellInactive]}><Pressable accessibilityRole="checkbox" accessibilityLabel={`${disabled ? 'Inactive' : resolving ? 'Checking' : included ? 'Remove' : 'Add'} ${memory.kind} ${index + 1}`} accessibilityState={{ checked: included, disabled, busy: resolving }} disabled={disabled || resolving} onPress={() => onToggle(memory.key)} style={[styles.mediaTile, included && styles.mediaTileSelected]}>{memory.previewUri ? memory.kind === 'video' ? <ReplayVideoPoster uri={memory.previewUri} /> : <ReplayVideoPoster uri={memory.previewUri} video={false} /> : <View style={styles.mediaFallback}><Text style={styles.mediaFallbackText}>{resolving ? 'CHECKING' : memory.kind === 'video' ? 'VIDEO' : 'PHOTO'}</Text></View>}<View style={[styles.selectionBadge, included && styles.selectionBadgeSelected]}><Text style={styles.selectionBadgeText}>{included ? '✓' : ''}</Text></View>{memory.kind === 'video' && <View style={styles.videoBadge}><Text style={styles.videoBadgeText}>▶</Text></View>}</Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Inspect ${memory.kind} ${index + 1}`} onPress={() => onInspect(memory)} style={styles.inspectControl}><Text style={styles.inspectGlyph}>⌕</Text></Pressable></View>;
}

/** Private UI state only; it never receives native source references or creates an export. */
export function ReplayScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { loadReplayManifestInput, loadReplayEditorPreviewPage, loadPreparedReplay, replayEditSession, saveReplayDraft, stageReplayWorkingDraft, resetReplayDraft, preparePrivateReplay, exportPrivateReplay, discardPrivateReplay } = usePhotoAccess();
  const [fallbackSession] = useState(() => new ReplayEditSession((draft, revision) => stageReplayWorkingDraft(draft.memoryKeys, draft.snapshotToken, draft.privacyRevision, draft.direction, draft.soundtrack, revision, draft.includedGroupKeys, draft.autoGroupKeys.filter((key) => draft.includedGroupKeys.includes(key))), (error) => replayFailureStage(error) === 'REPLAY_STALE'));
  const editSession = replayEditSession ?? fallbackSession;
  const [input, setInput] = useState<ReplayManifestInput | null>(null);
  const [preview, setPreview] = useState<ReplayPreparedPreview | null>(null);
  const [muted, setMuted] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<ReplayFailureStage | null>(null);
  const [state, setState] = useState<ViewState>('idle');
  const [preparationPhase, setPreparationPhase] = useState<'opening' | 'resolving' | 'rendering'>('opening');
  const [preparationDetail, setPreparationDetail] = useState('Checking the visible trips and locally available memories you can use right now.');
  const [preparationProgress, setPreparationProgress] = useState<{ completed: number; total: number } | null>(null);
  const [editedMemoryKeys, setEditedMemoryKeys] = useState<readonly string[]>([]);
  /** The committed composition is the only candidate pool for deliberate export. */
  const [committedMemoryKeys, setCommittedMemoryKeys] = useState<readonly string[]>([]);
  const [editorManifestReady, setEditorManifestReady] = useState(false);
  const [editorOrigin, setEditorOrigin] = useState<'final-ready' | 'failed'>('final-ready');
  /** Edit is deliberately two-step: trip overview first, then one trip gallery. */
  const [editorStage, setEditorStage] = useState<'overview' | 'gallery'>('overview');
  const [timelineDirection, setTimelineDirection] = useState<ReplayDirection>('oldest-first');
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);
  const [includedGroupKeys, setIncludedGroupKeys] = useState<readonly string[]>([]);
  const [autoGroupKeys, setAutoGroupKeys] = useState<readonly string[]>([]);
  const [bulkProgress, setBulkProgress] = useState<{ completed: number; total: number } | null>(null);
  const [lastTripChange, setLastTripChange] = useState<{ keys: readonly string[]; autoGroupKeys: readonly string[] } | null>(null);
  const [showSelectedMedia, setShowSelectedMedia] = useState(false);
  const [showTripActions, setShowTripActions] = useState(false);
  const [showReplaySettings, setShowReplaySettings] = useState(false);
  const [recoveringDraft, setRecoveringDraft] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [inspectedMemory, setInspectedMemory] = useState<ReplayMemory | null>(null);
  const [shareMemoryKeys, setShareMemoryKeys] = useState<readonly string[]>([]);
  const [sharing, setSharing] = useState(false);
  const [music, setMusic] = useState<ReplaySoundtrack>({ kind: 'bundled', revision: 'happy-moments-1.4' });
  const [selectedAudioName, setSelectedAudioName] = useState<string | null>(null);
  const [audioLoadState, setAudioLoadState] = useState<'idle' | 'loading' | 'saving' | 'loaded' | 'failed'>('idle');
  const [musicError, setMusicError] = useState<string | null>(null);
  const [selectingMusic, setSelectingMusic] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [workingSaveState, setWorkingSaveState] = useState<'idle' | 'pending' | 'saving' | 'waiting' | 'outcome-unknown' | 'failed' | 'conflict'>('idle');
  const [editorPreviewOverrides, setEditorPreviewOverrides] = useState<Readonly<Record<string, { available: boolean; previewUri?: string }>>>({});
  const [editorPreviewError, setEditorPreviewError] = useState(false);
  const [editorPreviewResolved, setEditorPreviewResolved] = useState<ReadonlySet<string>>(() => new Set());
  const [resolvingEditorMemoryKeys, setResolvingEditorMemoryKeys] = useState<ReadonlySet<string>>(() => new Set());
  const started = useRef(false);
  const exportInProgress = useRef(false);
  // React state renders selection feedback. This ref is the serialized intent
  // used by Done so a rapid toggle -> Done cannot commit the previous frame.
  const editedMemoryKeysRef = useRef<readonly string[]>([]);
  const timelineDirectionRef = useRef<ReplayDirection>('oldest-first');
  const musicRef = useRef<ReplaySoundtrack>({ kind: 'bundled', revision: 'happy-moments-1.4' });
  const [sheetMusic, setSheetMusic] = useState<ReplaySoundtrack>({ kind: 'bundled', revision: 'happy-moments-1.4' });
  const [sheetDirection, setSheetDirection] = useState<ReplayDirection>('oldest-first');
  const sheetMusicRef = useRef<ReplaySoundtrack>({ kind: 'bundled', revision: 'happy-moments-1.4' });
  const sheetDirectionRef = useRef<ReplayDirection>('oldest-first');
  const sheetGeneration = useRef(0);
  const sheetDoneRequested = useRef(false);
  const sheetCandidate = useRef<ReplayAudioCandidate | null>(null);
  const settingsSaveInProgress = useRef(false);
  const workingSaveQueue = useRef<Promise<void>>(Promise.resolve());
  const workingSaveGeneration = useRef(0);
  const workingRecovery = useRef(false);
  const pendingSelectionTasks = useRef(editSession.selectedTasks);
  const workingRevisionRef = useRef<number | undefined>(undefined);
  const includedGroupKeysRef = useRef<readonly string[]>([]);
  const autoGroupKeysRef = useRef<readonly string[]>([]);
  const editorPreviewLoading = useRef(false);
  const editorPreviewResolvedKeys = useRef(new Set<string>());
  /** Invalidates detached or superseded preparation before it reaches the provider. */
  const preparationGeneration = useRef(0);
  const isMounted = useRef(true);
  /** A verified whole Replay remains private-safe while a replacement is rendering. */
  const lastVerifiedPreview = useRef<ReplayPreparedPreview | null>(null);
  const adoptVerifiedPreview = (next: ReplayPreparedPreview) => { lastVerifiedPreview.current = next; setPreview(next); };
  const setReplayTimelineDirection = (direction: ReplayDirection) => { timelineDirectionRef.current = direction; setTimelineDirection(direction); };
  const setReplayMusic = (soundtrack: ReplaySoundtrack) => { musicRef.current = soundtrack; setMusic(soundtrack); };
  const setIncludedGroups = (next: readonly string[]) => { includedGroupKeysRef.current = next; setIncludedGroupKeys(next); };
  const setAutoGroups = (next: readonly string[]) => { autoGroupKeysRef.current = next; setAutoGroupKeys(next); };
  const setEditorSelection = (next: readonly string[]) => {
    editedMemoryKeysRef.current = next;
    setEditedMemoryKeys(next);
  };
  const replaceResolvedEditorPreviews = (keys: Iterable<string>) => {
    const next = new Set(keys);
    editorPreviewResolvedKeys.current = next;
    setEditorPreviewResolved(next);
  };
  const addResolvedEditorPreviews = (keys: Iterable<string>) => {
    const next = new Set(editorPreviewResolvedKeys.current);
    for (const key of keys) next.add(key);
    editorPreviewResolvedKeys.current = next;
    setEditorPreviewResolved(next);
  };
  useEffect(() => {
    if (!input || !editorManifestReady) return;
    const retained = editSession.initialize({ memoryKeys: editedMemoryKeysRef.current, includedGroupKeys: includedGroupKeysRef.current, autoGroupKeys: autoGroupKeysRef.current, direction: timelineDirectionRef.current, soundtrack: musicRef.current, snapshotToken: input.snapshotToken, privacyRevision: input.privacyRevision }, workingRevisionRef.current);
    if (!retained) { setWorkingSaveState('conflict'); setRecoveryMessage('Your trips changed. Restore the saved Replay to review the current trips.'); return; }
    setEditorSelection(retained.memoryKeys); setIncludedGroups(retained.includedGroupKeys); setAutoGroups(retained.autoGroupKeys); setReplayTimelineDirection(retained.direction); setReplayMusic(retained.soundtrack);
    setWorkingSaveState(editSession.scheduler.getStatus());
  // Hydrate once for each metadata/scope entry, never from a render-frame draft.
  }, [input, editorManifestReady, editSession]);
  const openReplaySettings = () => {
    sheetGeneration.current += 1; sheetDoneRequested.current = false;
    sheetMusicRef.current = musicRef.current; sheetDirectionRef.current = timelineDirectionRef.current;
    setSheetMusic(musicRef.current); setSheetDirection(timelineDirectionRef.current); setMusicError(null); setShowReplaySettings(true);
  };
  const applySettings = async () => {
    if (settingsSaveInProgress.current) return;
    settingsSaveInProgress.current = true;
    const soundtrack = sheetMusicRef.current;
    const direction = sheetDirectionRef.current;
    // Once enqueued, the session owns this file even if acknowledgement is
    // delayed or unknown. Sheet cancellation must never delete its soundtrack.
    sheetCandidate.current = null;
    setSettingsSaving(true);
    if (soundtrack.kind === 'custom') setAudioLoadState('saving');
    try {
      // Done is the acknowledgement point. Keep this sheet visible until the
      // exact draft the owner sees is durable; a later Update can then always
      // use the acknowledged draft instead of a background promise.
      await queueWorkingSave(editedMemoryKeysRef.current, direction, soundtrack, includedGroupKeysRef.current, autoGroupKeysRef.current, true);
      setReplayMusic(soundtrack); setReplayTimelineDirection(direction);
      sheetDoneRequested.current = false; sheetCandidate.current = null;
      if (sheetMusicRef.current.kind === 'custom') setAudioLoadState('loaded');
      setShowReplaySettings(false);
    } catch (error) {
      sheetDoneRequested.current = false;
      if (sheetMusicRef.current.kind === 'custom') setAudioLoadState('loaded');
      setMusicError(musicSaveFailureCopy(error));
    } finally {
      settingsSaveInProgress.current = false;
      setSettingsSaving(false);
    }
  };
  const chooseMusic = async () => {
    if (workingRecovery.current || selectingMusic || settingsSaveInProgress.current) return;
    const generation = sheetGeneration.current;
    const correlationId = createDiagnosticCorrelationId();
    recordAppDiagnostic({ operation: 'REPLAY_AUDIO_SELECTION', reasonCode: 'START', stage: null, retryable: false, durableOutcome: 'unchanged', correlationId });
    setMusicError(null); setSelectingMusic(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true, multiple: false });
      if (result.canceled || generation !== sheetGeneration.current) return;
      const source = result.assets?.[0]; if (!source) throw new Error();
      setSelectedAudioName((source.name ?? 'Custom audio file').split(/[\\/]/).pop() || 'Custom audio file'); setAudioLoadState('loading');
      const candidate = await importReplayAudio(source);
      if (generation !== sheetGeneration.current || workingRecovery.current) { await removeUnownedReplayAudio(candidate); return; }
      if (sheetCandidate.current) void removeUnownedReplayAudio(sheetCandidate.current);
      sheetCandidate.current = candidate; sheetMusicRef.current = candidate.soundtrack; setSheetMusic(candidate.soundtrack); setAudioLoadState('loaded');
      recordAppDiagnostic({ operation: 'REPLAY_AUDIO_SELECTION', reasonCode: 'COMPLETE', stage: null, retryable: false, durableOutcome: 'unchanged', correlationId });
      if (sheetDoneRequested.current) void applySettings();
    } catch (error) {
      if (generation !== sheetGeneration.current) return;
      sheetDoneRequested.current = false; setSettingsSaving(false); setAudioLoadState('failed'); setMusicError('Choose a readable audio file up to 5 MB. Your previous music is kept.');
      recordAppDiagnostic({ operation: 'REPLAY_AUDIO_SELECTION', reasonCode: classifyAppDiagnosticError(error), stage: 'REPLAY_ACCESS', retryable: true, durableOutcome: 'unchanged', correlationId });
    } finally { if (generation === sheetGeneration.current) setSelectingMusic(false); }
  };
  const prepare = async (soundtrack = music, committedOverride?: readonly string[]) => {
    const generation = ++preparationGeneration.current;
    const isCurrent = () => isMounted.current && preparationGeneration.current === generation;
    recordAppDiagnostic({ operation: 'REPLAY_RENDER', reasonCode: 'START', stage: null, retryable: false, durableOutcome: 'unchanged', correlationId: createDiagnosticCorrelationId() });
    setFailure(null); setEditorManifestReady(false); setPreparationPhase('resolving'); setPreparationDetail('Checking the visible trips and locally available memories you can use right now.'); setPreparationProgress(null); setState('checking');
    try {
      const next = await loadReplayManifestInput();
      if (!isCurrent()) return;
      const direction = next.direction ?? 'oldest-first';
      const plan = planPrivateReplay(next.groups, next.memories, undefined, direction, next.autoGroupKeys);
      const committedKeys = committedOverride ?? plan.memories.map((memory) => memory.key);
      const working = !committedOverride ? next.workingDraft : undefined;
      const chosenKeys = working?.memoryKeys ?? committedKeys;
      workingRevisionRef.current = working?.revision;
      const nextIncludedGroups = working?.includedGroupKeys ?? next.includedGroupKeys ?? next.groups.filter((group) => group.eligible).map((group) => group.key);
      const nextAutoGroups = working?.autoGroupKeys ?? next.autoGroupKeys ?? nextIncludedGroups;
      replaceResolvedEditorPreviews(next.memories.filter((memory) => memory.previewUri !== undefined).map((memory) => memory.key)); setEditorPreviewOverrides({}); setEditorPreviewError(false);
      setInput(next); setShowSelectedMedia(false); setIncludedGroups(nextIncludedGroups); setAutoGroups(nextAutoGroups); setReplayMusic(working?.soundtrack ?? next.soundtrack ?? { kind: 'bundled', revision: 'happy-moments-1.4' }); setReplayTimelineDirection(working?.direction ?? direction); setEditorSelection(chosenKeys); setCommittedMemoryKeys(committedKeys); setEditorManifestReady(plan.groups.length > 0); setActiveGroupKey((current) => current && next.groups.some((group) => group.key === current) ? current : plan.groups[0]?.key ?? next.groups[0]?.key ?? null);
      if (!plan.groups.length) { setState('sparse'); return; }
      setPreparationPhase('rendering'); setPreparationDetail('Starting the local video renderer.');
      const prepared = await preparePrivateReplay(committedOverride, (progress) => {
        if (!isCurrent()) return;
        setPreparationDetail(progress.message); setPreparationProgress({ completed: progress.completed, total: progress.total });
      }, soundtrack, (firstChapter) => {
        if (!isCurrent()) return;
        setPreview(firstChapter); setPreparationProgress({ completed: firstChapter.completedTrips ?? 1, total: firstChapter.totalTrips ?? plan.groups.length }); setPreparationDetail(`First trip ready · finishing ${firstChapter.completedTrips ?? 1} of ${firstChapter.totalTrips ?? plan.groups.length}`); setState('first-trip-ready');
      });
      if (!isCurrent()) {
        if (prepared.uri !== preview?.uri) await discardPrivateReplay(prepared.uri);
        return;
      }
      if (preview && preview.uri !== prepared.uri) await discardPrivateReplay(preview.uri);
      adoptVerifiedPreview(prepared); setState('final-ready');
      recordAppDiagnostic({ operation: 'REPLAY_RENDER', reasonCode: 'COMPLETE', stage: null, retryable: false, durableOutcome: 'complete', correlationId: createDiagnosticCorrelationId() });
    } catch (error) {
      if (!isCurrent()) return;
      const stage = replayFailureStage(error);
      if (stage === 'REPLAY_STALE') {
        // A scope or privacy revision changed after this screen read its
        // manifest. Do not keep old tiles, thumbnails or a stale preview.
        setInput(null); setEditorSelection([]); setCommittedMemoryKeys([]); setEditorManifestReady(false); setActiveGroupKey(null); setInspectedMemory(null); lastVerifiedPreview.current = null; setPreview(null);
      }
      setFailure(stage);
      if (stage !== 'REPLAY_STALE' && lastVerifiedPreview.current) {
        setPreview(lastVerifiedPreview.current);
        setState('recovery-ready');
      } else {
        // Failed preparation reclaims its temporary chapter files. Never keep
        // playing a progressive URI after the provider has removed it.
        setPreview(null);
        setState('failed');
      }
      recordAppDiagnostic({ operation: 'REPLAY_RENDER', reasonCode: 'UNKNOWN', stage, retryable: stage !== 'REPLAY_SCOPE', durableOutcome: 'unchanged', correlationId: createDiagnosticCorrelationId() });
    }
  };
  const cancel = () => {
    // Closing the view does not discard a verified automatic Replay. It is
    // deliberately available when the owner returns from Atlas or restarts.
    preparationGeneration.current += 1;
    setPreview(null); setExportMessage(null); setShareMemoryKeys([]); setState('idle'); recordAppDiagnostic({ operation: 'REPLAY_RENDER', reasonCode: 'SKIPPED', stage: null, retryable: false, durableOutcome: 'skipped', correlationId: createDiagnosticCorrelationId() });
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
        selectedArtifact = await preparePrivateReplay(shareMemoryKeys, undefined, music);
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
  const toggleAllShareMemories = () => {
    if (!input) return;
    const eligible = shareableCommittedMemories(input, committedMemoryKeys).map((memory) => memory.key);
    setShareMemoryKeys((current) => current.length === eligible.length ? [] : eligible);
  };
  useEffect(() => editSession.scheduler.subscribe(() => {
    if (!isMounted.current) return;
    workingRevisionRef.current = editSession.scheduler.getRevision();
    setWorkingSaveState(editSession.scheduler.getStatus());
  }), [editSession]);
  const queueWorkingSave = (next: readonly string[], direction = timelineDirectionRef.current, soundtrack = musicRef.current, included = includedGroupKeysRef.current, automatic = autoGroupKeysRef.current, immediate = false) => {
    if (!input || !editorManifestReady) return Promise.resolve();
    editSession.scheduler.initializeRevision(workingRevisionRef.current);
    const request: ReplayEditSnapshot = { memoryKeys: next, direction, soundtrack, includedGroupKeys: included, autoGroupKeys: automatic, snapshotToken: input.snapshotToken, privacyRevision: input.privacyRevision };
    const job = editSession.enqueue(request, immediate);
    workingSaveQueue.current = job; return job;
  };
  const flushWorkingSave = () => editSession.flush();
  const trackSelectionTask = (task: Promise<void>) => {
    pendingSelectionTasks.current.add(task);
    void task.finally(() => pendingSelectionTasks.current.delete(task)).catch(() => undefined);
    return task;
  };
  const toggleEditorMemory = (key: string) => trackSelectionTask(toggleEditorMemoryNow(key));
  const toggleEditorMemoryNow = async (key: string) => {
    const epoch = editSession.getTaskEpoch();
    if (workingRecovery.current) return;
    if (!input || resolvingEditorMemoryKeys.has(key)) return;
    if (!editorPreviewResolvedKeys.current.has(key)) {
      setResolvingEditorMemoryKeys((current) => new Set([...current, key]));
      try {
        const [resolved] = await loadReplayEditorPreviewPage([key], input.snapshotToken, input.privacyRevision);
        if (epoch !== editSession.getTaskEpoch() || !isMounted.current) return;
        if (!resolved) return;
        addResolvedEditorPreviews([resolved.key]);
        setEditorPreviewOverrides((previous) => ({ ...previous, [resolved.key]: { available: resolved.available, ...(resolved.previewUri ? { previewUri: resolved.previewUri } : {}) } }));
        if (!resolved.available) return;
      } catch {
        setEditorPreviewError(true);
        return;
      } finally {
        setResolvingEditorMemoryKeys((current) => { const next = new Set(current); next.delete(key); return next; });
      }
    }
    if (epoch !== editSession.getTaskEpoch() || !isMounted.current) return;
    const current = editedMemoryKeysRef.current;
    const next = current.includes(key) ? current.filter((value) => value !== key) : [...current, key];
    const automatic = activeGroupKey ? autoGroupKeysRef.current.filter((groupKey) => groupKey !== activeGroupKey) : autoGroupKeysRef.current;
    setLastTripChange({ keys: current, autoGroupKeys: autoGroupKeysRef.current }); setAutoGroups(automatic); setEditorSelection(next);
    void queueWorkingSave(next, timelineDirectionRef.current, musicRef.current, includedGroupKeysRef.current, automatic).catch(() => undefined);
  };
  const selectAllInActiveTrip = () => trackSelectionTask(selectAllInActiveTripNow());
  const selectAllInActiveTripNow = async () => {
    const epoch = editSession.getTaskEpoch();
    if (workingRecovery.current) return;
    if (!input || !activeGroupKey || bulkProgress) return;
    const trip = input.memories.filter((memory) => memory.groupKey === activeGroupKey && memory.eligible);
    const unresolved = trip.filter((memory) => !editorPreviewResolvedKeys.current.has(memory.key));
    const resolved: { key: string; available: boolean; previewUri?: string }[] = [];
    setBulkProgress({ completed: 0, total: unresolved.length });
    try {
      for (let offset = 0; offset < unresolved.length; offset += 48) {
        const page = await loadReplayEditorPreviewPage(unresolved.slice(offset, offset + 48).map((memory) => memory.key), input.snapshotToken, input.privacyRevision);
        if (epoch !== editSession.getTaskEpoch() || !isMounted.current) return;
        resolved.push(...page); addResolvedEditorPreviews(page.map((item) => item.key));
        setEditorPreviewOverrides((previous) => ({ ...previous, ...Object.fromEntries(page.map((item) => [item.key, { available: item.available, ...(item.previewUri ? { previewUri: item.previewUri } : {}) }])) }));
        setBulkProgress({ completed: Math.min(unresolved.length, offset + page.length), total: unresolved.length });
      }
      if (epoch !== editSession.getTaskEpoch() || !isMounted.current) return;
      const availability = new Map(resolved.map((item) => [item.key, item.available]));
      const available = trip.filter((memory) => availability.get(memory.key) ?? editorPreviewOverrides[memory.key]?.available ?? memory.available).map((memory) => memory.key);
      const keys = new Set(trip.map((memory) => memory.key)); const previous = editedMemoryKeysRef.current;
      const next = [...previous.filter((key) => !keys.has(key)), ...available]; const automatic = autoGroupKeysRef.current.filter((key) => key !== activeGroupKey);
      setLastTripChange({ keys: previous, autoGroupKeys: autoGroupKeysRef.current }); setAutoGroups(automatic); setEditorSelection(next);
      await queueWorkingSave(next, timelineDirectionRef.current, musicRef.current, includedGroupKeysRef.current, automatic);
    } catch { setWorkingSaveState('failed'); } finally { setBulkProgress(null); }
  };
  const clearActiveTrip = () => {
    if (workingRecovery.current) return;
    const trip = input?.memories.filter((memory) => memory.groupKey === activeGroupKey && memory.eligible) ?? [];
    const keys = new Set(trip.map((memory) => memory.key));
    const previous = editedMemoryKeysRef.current; const next = previous.filter((key) => !keys.has(key)); const automatic = activeGroupKey ? autoGroupKeysRef.current.filter((key) => key !== activeGroupKey) : autoGroupKeysRef.current;
    setLastTripChange({ keys: previous, autoGroupKeys: autoGroupKeysRef.current }); setAutoGroups(automatic); setEditorSelection(next); void queueWorkingSave(next, timelineDirectionRef.current, musicRef.current, includedGroupKeysRef.current, automatic).catch(() => undefined);
  };
  const restoreAutoInActiveTrip = () => {
    if (workingRecovery.current) return;
    if (!input || !activeGroupKey) return;
    const autoPlan = planPrivateReplay(input.groups.map((group) => ({ ...group, eligible: includedGroupKeysRef.current.includes(group.key) })), input.memories.map((memory) => ({ ...memory, ...editorPreviewOverrides[memory.key] })), undefined, timelineDirectionRef.current, [...autoGroupKeysRef.current, activeGroupKey]);
    const automaticKeys = autoPlan.memories.filter((memory) => memory.groupKey === activeGroupKey).map((memory) => memory.key);
    const tripKeys = new Set(input.memories.filter((memory) => memory.groupKey === activeGroupKey).map((memory) => memory.key)); const previous = editedMemoryKeysRef.current;
    const next = [...previous.filter((key) => !tripKeys.has(key)), ...automaticKeys]; const automatic = [...new Set([...autoGroupKeysRef.current, activeGroupKey])];
    setLastTripChange({ keys: previous, autoGroupKeys: autoGroupKeysRef.current }); setAutoGroups(automatic); setEditorSelection(next); void queueWorkingSave(next, timelineDirectionRef.current, musicRef.current, includedGroupKeysRef.current, automatic).catch(() => undefined);
  };
  const undoTripChange = () => {
    if (workingRecovery.current) return;
    if (!lastTripChange) return;
    setEditorSelection(lastTripChange.keys); setAutoGroups(lastTripChange.autoGroupKeys); setLastTripChange(null);
    void queueWorkingSave(lastTripChange.keys, timelineDirectionRef.current, musicRef.current, includedGroupKeysRef.current, lastTripChange.autoGroupKeys).catch(() => undefined);
  };
  const applyMineAfterConflict = async () => {
    if (!input || workingRecovery.current) return false;
    workingRecovery.current = true; setRecoveringDraft(true); setRecoveryMessage(null);
    try {
      while (pendingSelectionTasks.current.size) await Promise.all([...pendingSelectionTasks.current]);
      await workingSaveQueue.current.catch(() => undefined);
      const latest = await loadReplayManifestInput();
      if (latest.snapshotToken !== input.snapshotToken || latest.privacyRevision !== input.privacyRevision) {
        setRecoveryMessage('Your trips changed. Restore the saved Replay to reload current trips and choose again.');
        setWorkingSaveState('conflict');
        return false;
      }
      await resetReplayDraft(latest.snapshotToken, latest.privacyRevision);
      workingRevisionRef.current = undefined;
      await queueWorkingSave(editedMemoryKeysRef.current);
      return true;
    } catch { setWorkingSaveState('failed'); return false; }
    finally { workingRecovery.current = false; setRecoveringDraft(false); }
  };
  const resolveMineAndReturnToTripOverview = async () => {
    if (!await applyMineAfterConflict()) return;
    setInspectedMemory(null); setEditorStage('overview');
  };
  const restoreSavedReplaySelection = async () => {
    if (!input || workingRecovery.current) return;
    workingRecovery.current = true; setRecoveringDraft(true); setRecoveryMessage(null);
    try {
      const fenced = await editSession.fence();
      if (fenced.kind === 'outcome-unknown') { setWorkingSaveState('outcome-unknown'); setRecoveryMessage('Not saved yet. Check again before restoring.'); return; }
      const current = await loadReplayManifestInput();
      await resetReplayDraft(current.snapshotToken, current.privacyRevision);
      const latest = await loadReplayManifestInput();
      const direction = latest.direction ?? 'oldest-first';
      const plan = planPrivateReplay(latest.groups, latest.memories, undefined, direction, latest.autoGroupKeys);
      workingRevisionRef.current = latest.workingDraft?.revision;
      workingSaveQueue.current = Promise.resolve(); workingSaveGeneration.current += 1;
      editSession.replaceAfterRestore({ memoryKeys: plan.memories.map((memory) => memory.key), includedGroupKeys: latest.includedGroupKeys ?? latest.groups.filter((group) => group.eligible).map((group) => group.key), autoGroupKeys: latest.autoGroupKeys ?? [], direction, soundtrack: latest.soundtrack ?? { kind: 'bundled', revision: 'happy-moments-1.4' }, snapshotToken: latest.snapshotToken, privacyRevision: latest.privacyRevision }, latest.workingDraft?.revision);
      setInput(latest); setLastTripChange(null);
      replaceResolvedEditorPreviews(latest.memories.filter((memory) => memory.previewUri !== undefined).map((memory) => memory.key));
      setEditorPreviewOverrides({}); setEditorPreviewError(false);
      setIncludedGroups(latest.workingDraft?.includedGroupKeys ?? latest.includedGroupKeys ?? latest.groups.filter((group) => group.eligible).map((group) => group.key));
      setAutoGroups(latest.workingDraft?.autoGroupKeys ?? latest.autoGroupKeys ?? latest.groups.filter((group) => group.eligible).map((group) => group.key));
      setReplayMusic(latest.workingDraft?.soundtrack ?? latest.soundtrack ?? { kind: 'bundled', revision: 'happy-moments-1.4' });
      setReplayTimelineDirection(latest.workingDraft?.direction ?? direction);
      setEditorSelection(latest.workingDraft?.memoryKeys ?? plan.memories.map((memory) => memory.key));
      setCommittedMemoryKeys(plan.memories.map((memory) => memory.key));
      if (latest.privacyRevision !== input.privacyRevision || latest.snapshotToken !== input.snapshotToken) { setPreview(null); setEditorOrigin('failed'); setFailure('REPLAY_STALE'); }
      setEditorManifestReady(latest.groups.length > 0);
      setWorkingSaveState('idle'); setInspectedMemory(null); setEditorStage('overview');
    } catch { setWorkingSaveState('failed'); }
    finally { workingRecovery.current = false; setRecoveringDraft(false); }
  };
  const discardConflictingSelectionAndReturnToTripOverview = () => {
    Alert.alert('Restore saved Replay?', 'This discards working photo, music and order changes in all trips. Your saved video and original photos are kept.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Restore saved Replay', style: 'destructive', onPress: () => { void restoreSavedReplaySelection(); } },
    ]);
  };
  const toggleActiveTripInclusion = () => {
    if (workingRecovery.current) return;
    if (!activeGroupKey) return;
    const current = includedGroupKeysRef.current;
    const next = current.includes(activeGroupKey) ? current.filter((key) => key !== activeGroupKey) : [...current, activeGroupKey];
    const automatic = autoGroupKeysRef.current.filter((key) => next.includes(key));
    setIncludedGroups(next); setAutoGroups(automatic); void queueWorkingSave(editedMemoryKeysRef.current, timelineDirectionRef.current, musicRef.current, next, automatic).catch(() => undefined);
  };
  const loadNextEditorPreviewPage = (candidates: readonly ReplayMemory[], retry = false) => {
    if (!input || editorPreviewLoading.current) return;
    const keys = candidates.filter((memory) => !editorPreviewResolvedKeys.current.has(memory.key)).slice(0, 48).map((memory) => memory.key);
    if (!keys.length) return;
    editorPreviewLoading.current = true;
    if (retry) setEditorPreviewError(false);
    const epoch = editSession.getTaskEpoch();
    const applyBatch = (page: readonly { key: string; available: boolean; previewUri?: string }[]) => {
      if (epoch !== editSession.getTaskEpoch() || !isMounted.current) return;
      addResolvedEditorPreviews(page.map((item) => item.key));
      setEditorPreviewOverrides((previous) => ({ ...previous, ...Object.fromEntries(page.map((item) => [item.key, { available: item.available, ...(item.previewUri ? { previewUri: item.previewUri } : {}) }])) }));
    };
    void loadReplayEditorPreviewPage(keys, input.snapshotToken, input.privacyRevision, applyBatch).then((page) => {
      if (epoch !== editSession.getTaskEpoch() || !isMounted.current) return;
      addResolvedEditorPreviews(page.map((item) => item.key));
      setEditorPreviewOverrides((previous) => ({ ...previous, ...Object.fromEntries(page.map((item) => [item.key, { available: item.available, ...(item.previewUri ? { previewUri: item.previewUri } : {}) }])) }));
    }).catch(() => {
      // An unresolved page remains in the album; it is never represented as an
      // empty gallery or silently skipped from later retry/bulk accounting.
      setEditorPreviewError(true);
    }).finally(() => { editorPreviewLoading.current = false; });
  };
  const retainWorkingEdits = async () => {
    if (!input || !editorManifestReady) return true;
    try {
      // A direct edit already queues its durable working write. Done/Back must
      // await that exact write rather than enqueueing a second identical one:
      // the duplicate can create an avoidable revision conflict and leaves the
      // owner apparently stuck at the bottom of the gallery.
      // A new edit may join while navigation waits. Acknowledge the latest tail.
      let pending: Promise<void>;
      do {
        while (pendingSelectionTasks.current.size) await Promise.all([...pendingSelectionTasks.current]);
        pending = flushWorkingSave();
        await pending;
      } while (pendingSelectionTasks.current.size || editSession.scheduler.getCounts().pending > 0);
      return true;
    } catch {
      return false;
    }
  };
  const retryWorkingEdits = async () => {
    if (!input || !editorManifestReady || workingSaveState === 'conflict' || workingRecovery.current) return false;
    try {
      while (pendingSelectionTasks.current.size) await Promise.all([...pendingSelectionTasks.current]);
      await queueWorkingSave(editedMemoryKeysRef.current, timelineDirectionRef.current, musicRef.current, includedGroupKeysRef.current, autoGroupKeysRef.current, true);
      return await retainWorkingEdits();
    } catch {
      return false;
    }
  };
  const returnToTripOverview = async () => {
    setInspectedMemory(null); setEditorStage('overview');
    void flushWorkingSave().catch(() => undefined);
  };
  const cancelReplaySettings = () => {
    if (settingsSaveInProgress.current) return;
    sheetGeneration.current += 1; sheetDoneRequested.current = false;
    if (sheetCandidate.current) void removeUnownedReplayAudio(sheetCandidate.current);
    sheetCandidate.current = null; setSelectingMusic(false); setSettingsSaving(false); setMusicError(null); setShowReplaySettings(false);
  };
  const useDefaultMusic = () => {
    if (settingsSaveInProgress.current) return;
    if (sheetCandidate.current) void removeUnownedReplayAudio(sheetCandidate.current);
    sheetCandidate.current = null; sheetGeneration.current += 1; sheetDoneRequested.current = false;
    const next = { kind: 'bundled', revision: 'happy-moments-1.4' } as const;
    sheetMusicRef.current = next; setSheetMusic(next); setSelectedAudioName(null); setAudioLoadState('idle'); setMusicError(null); setSelectingMusic(false);
  };
  const applyReplayTimeline = (direction: ReplayDirection) => { if (settingsSaveInProgress.current) return; sheetDirectionRef.current = direction; setSheetDirection(direction); };
  const finishReplaySettings = async () => {
    if (recoveringDraft) return;
    if (selectingMusic) { sheetDoneRequested.current = true; setSettingsSaving(true); return; }
    void applySettings();
  };
  const saveEdits = async () => {
    // An included trip with no selected media is an intentional destination card,
    // so only an entirely excluded Replay blocks the aggregate update.
    if (!editorManifestReady || !includedGroupKeysRef.current.length) return;
    setFailure(null); setPreparationPhase('resolving'); setState('checking');
    try {
      if (!input) throw new ReplayPreparationError('REPLAY_STALE');
      await editSession.requestUpdate(async (finalDraft) => {
      if (!finalDraft.includedGroupKeys.length) throw new ReplayPreparationError('REPLAY_STALE');
      if (workingRevisionRef.current === undefined) await saveReplayDraft(finalDraft.memoryKeys, input.snapshotToken, input.privacyRevision, finalDraft.direction, finalDraft.soundtrack, undefined, finalDraft.includedGroupKeys, finalDraft.autoGroupKeys);
      else await saveReplayDraft(finalDraft.memoryKeys, input.snapshotToken, input.privacyRevision, finalDraft.direction, finalDraft.soundtrack, workingRevisionRef.current, finalDraft.includedGroupKeys, finalDraft.autoGroupKeys);
      workingRevisionRef.current = undefined;
      setCommittedMemoryKeys(finalDraft.memoryKeys);
      // The committed draft is now the canonical owner composition. Reload it
      // through the owner path so this is durable playback, not the separate
      // short-lived selected-share artifact path.
      // Read the ref, not the render-frame closure. A track may have just
      // completed its durable staging immediately before the owner taps
      // Update Replay; the final mux must receive that exact track.
      await prepare(finalDraft.soundtrack);
      });
    } catch (error) {
      const stage = replayFailureStage(error);
      setFailure(stage); setState('editing'); setEditorStage('overview'); setRecoveryMessage('Not saved yet. Your choices are retained.');
    }
  };
  const resetEdits = async () => {
    if (workingRecovery.current) return;
    try {
      if (!input) throw new ReplayPreparationError('REPLAY_STALE');
      await flushWorkingSave().catch(() => undefined);
      await resetReplayDraft(input.snapshotToken, input.privacyRevision);
      const automaticGroups = includedGroupKeysRef.current;
      const automatic = planPrivateReplay(input.groups.map((group) => ({ ...group, eligible: automaticGroups.includes(group.key) })), input.memories.map((memory) => ({ ...memory, ...editorPreviewOverrides[memory.key] })), undefined, 'oldest-first', automaticGroups).memories.map((memory) => memory.key);
      workingRevisionRef.current = undefined;
      setEditorSelection(automatic); setAutoGroups(automaticGroups); setReplayTimelineDirection('oldest-first');
      sheetDirectionRef.current = 'oldest-first'; setSheetDirection('oldest-first');
      await queueWorkingSave(automatic, 'oldest-first', musicRef.current, includedGroupKeysRef.current, automaticGroups);
    } catch {
      setWorkingSaveState('failed');
    }
  };
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let active = true;
    // A prepared Replay is already a verified private output. Publish it as
    // soon as the provider confirms the current cache/scope gate, then hydrate
    // the optional Edit gallery in the background. Waiting for preview tiles
    // here needlessly makes a cache hit look like a full render.
    setPreparationPhase('opening');
    setPreparationDetail('Checking your saved private Replay on this device.');
    setPreparationProgress(null);
    setEditorManifestReady(false);
    setState('checking');
    void loadPreparedReplay().then((cached) => {
      if (!active) return;
      if (cached) {
        adoptVerifiedPreview(cached); setState('final-ready');
        void loadReplayManifestInput().then((current) => {
          if (!active) return;
          const plan = planPrivateReplay(current.groups, current.memories, undefined, current.direction ?? 'oldest-first', current.autoGroupKeys);
          const working = current.workingDraft;
          workingRevisionRef.current = working?.revision;
          replaceResolvedEditorPreviews(current.memories.filter((memory) => memory.previewUri !== undefined).map((memory) => memory.key)); setEditorPreviewOverrides({}); setEditorPreviewError(false);
          const hydratedIncluded = working?.includedGroupKeys ?? current.includedGroupKeys ?? current.groups.filter((group) => group.eligible).map((group) => group.key);
          setInput(current); setShowSelectedMedia(false); setIncludedGroups(hydratedIncluded); setAutoGroups(working?.autoGroupKeys ?? current.autoGroupKeys ?? hydratedIncluded); setReplayMusic(working?.soundtrack ?? current.soundtrack ?? { kind: 'bundled', revision: 'happy-moments-1.4' }); setReplayTimelineDirection(working?.direction ?? current.direction ?? 'oldest-first'); setEditorSelection(working?.memoryKeys ?? plan.memories.map((memory) => memory.key)); setCommittedMemoryKeys(plan.memories.map((memory) => memory.key)); setEditorManifestReady(plan.groups.length > 0); setActiveGroupKey(plan.groups[0]?.key ?? current.groups[0]?.key ?? null);
        }).catch(() => {
          // Cached private playback has already passed its scope gate. A failed
          // optional Edit hydration must not take that verified preview away.
          if (active) setEditorManifestReady(false);
        });
        return;
      }
      void prepare();
    }).catch(() => { if (active) void prepare(); });
    return () => { active = false; };
  // The screen entry transaction intentionally runs once; adding `prepare`
  // would restart playback after every local state update.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadPreparedReplay]);
  useEffect(() => () => {
    isMounted.current = false;
    preparationGeneration.current += 1;
    // Pending intent belongs to the provider session and survives route removal.
  }, []);
  const backFromEditor = () => {
    if (inspectedMemory) { setInspectedMemory(null); return; }
    if (showTripActions) { setShowTripActions(false); return; }
    if (showReplaySettings) { cancelReplaySettings(); return; }
    if (editorStage === 'gallery') { void returnToTripOverview(); return; }
    setMusicError(null); setState(editorOrigin);
  };
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (state === 'editing') { backFromEditor(); return true; }
      if (state === 'share-review') { setMusicError(null); setInspectedMemory(null); setState('final-ready'); return true; }
      // Once Update Replay has committed the draft, the renderer owns the
      // transition to its replacement preview. Letting Android pop here loses
      // that render and returns the owner to Atlas/Audit with no result.
      if (state === 'checking') return true;
      return false;
    });
    return () => subscription.remove();
  // The callback deliberately reads the latest local draft queue when native Back fires.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorOrigin, editorStage, state, inspectedMemory, showTripActions, showReplaySettings]);
  useEffect(() => {
    // Android gesture/back and iOS interactive swipe both dispatch
    // `beforeRemove`. Keep the owner in the Replay preview when an optional
    // subflow is open, or while an Update is rendering its replacement, instead
    // of popping the whole Replay route to Atlas/Audit.
    return navigation.addListener('beforeRemove', (event) => {
      if (!keepsReplayRoute(state)) return;
      event.preventDefault();
      if (state === 'editing') backFromEditor();
      else if (state === 'share-review') { setMusicError(null); setInspectedMemory(null); setState('final-ready'); }
    });
  // The callback deliberately reads the latest local draft queue when native Back fires.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorOrigin, editorStage, navigation, state, inspectedMemory, showTripActions, showReplaySettings]);
  const shareCandidates = shareableCommittedMemories(input, committedMemoryKeys);
  if (state === 'editing' && input) {
    const activeGroup = input.groups.find((group) => group.key === activeGroupKey) ?? input.groups[0];
    // Candidate membership is authoritative before local access resolves. An
    // unknown item must remain visible and retryable rather than disappear.
    const tripCandidates = input.memories.filter((memory) => memory.groupKey === activeGroup?.key && memory.eligible);
    const selectedTripMemories = tripCandidates.filter((memory) => editedMemoryKeys.includes(memory.key));
    const activeTripIncluded = Boolean(activeGroup && includedGroupKeys.includes(activeGroup.key));
    const displayedMemories = (showSelectedMedia ? tripCandidates.filter((memory) => editedMemoryKeys.includes(memory.key)) : tripCandidates).map((memory) => ({ ...memory, ...editorPreviewOverrides[memory.key] }));
    const resolvedTripMediaCount = tripCandidates.filter((memory) => editorPreviewResolved.has(memory.key)).length;
    const hasUnresolvedTripMedia = resolvedTripMediaCount < tripCandidates.length;
    const estimatedDuration = replayDuration(selectedTripMemories.length);
    const inspectedTripMedia = inspectedMemory ? input.memories.filter((memory) => memory.groupKey === inspectedMemory.groupKey && editedMemoryKeys.includes(memory.key) && includedGroupKeys.includes(memory.groupKey)) : [];
    const inspectedVideoSeconds = inspectedMemory ? replayVideoSceneSeconds(inspectedTripMedia.length, inspectedTripMedia.findIndex((memory) => memory.key === inspectedMemory.key)) : 0;
    if (editorStage === 'overview') {
      const committedIncluded = input.includedGroupKeys ?? input.groups.filter((group) => group.eligible).map((group) => group.key);
      const committedAutomatic = input.autoGroupKeys ?? committedIncluded;
      const groupForMemory = new Map(input.memories.map((memory) => [memory.key, memory.groupKey]));
      const keysByGroup = (keys: readonly string[]) => {
        const result = new Map<string, readonly string[]>();
        for (const key of keys) { const group = groupForMemory.get(key); if (group) result.set(group, [...(result.get(group) ?? []), key]); }
        return result;
      };
      const workingByGroup = keysByGroup(editedMemoryKeys);
      const committedByGroup = keysByGroup(committedMemoryKeys);
      const tripChanged = (groupKey: string) => JSON.stringify(workingByGroup.get(groupKey) ?? []) !== JSON.stringify(committedByGroup.get(groupKey) ?? []) || includedGroupKeys.includes(groupKey) !== committedIncluded.includes(groupKey) || autoGroupKeys.includes(groupKey) !== committedAutomatic.includes(groupKey);
      const changed = input.groups.some((group) => tripChanged(group.key)) || timelineDirection !== (input.direction ?? 'oldest-first') || JSON.stringify(music) !== JSON.stringify(input.soundtrack ?? { kind: 'bundled', revision: 'happy-moments-1.4' });
      const settingsSummary = `${music.kind === 'custom' ? selectedAudioName ? `Custom audio · ${selectedAudioName}` : 'Custom audio ready' : 'Happy Moments 1.4'} · ${timelineDirection === 'oldest-first' ? 'Oldest first' : 'Newest first'}`;
      return <SafeAreaView style={styles.editorSafe} edges={['top', 'bottom']}>
        <View style={styles.galleryNavigation}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to saved Replay" onPress={backFromEditor} style={styles.galleryNavAction}><Text style={styles.galleryNavText}>‹ Back</Text></Pressable>
          <Text style={styles.galleryNavTitle}>Edit Replay</Text><View style={styles.galleryNavAction} />
        </View>
        <FlatList key="replay-trip-overview" accessibilityLabel="Replay trip overview" style={styles.editorList} contentContainerStyle={styles.editorListContent}
          data={input.groups} keyExtractor={(group) => group.key}
          ListHeaderComponent={<><Title>Your trips</Title><Body>Choose a trip to edit its moments.</Body></>}
          renderItem={({ item: group, index }) => {
            const tripMedia = input.memories.filter((memory) => memory.groupKey === group.key && memory.eligible);
            const selectedCount = tripMedia.filter((memory) => editedMemoryKeys.includes(memory.key)).length;
            const cover = tripMedia.find((memory) => memory.previewUri);
            const included = includedGroupKeys.includes(group.key);
            return <Pressable accessibilityRole="button" accessibilityLabel={`Edit trip ${group.label} ${group.interval?.startDay ?? `trip ${index + 1}`}`} disabled={!editorManifestReady || recoveringDraft} onPress={() => { setActiveGroupKey(group.key); setLastTripChange(null); setShowSelectedMedia(false); setShowTripActions(false); setEditorStage('gallery'); loadNextEditorPreviewPage(tripMedia); }} style={[styles.tripOverviewCard, !included && styles.tripChipInactive]}>
              <View style={styles.tripCover}>{cover?.previewUri ? cover.kind === 'video' ? <ReplayVideoPoster uri={cover.previewUri} /> : <ReplayVideoPoster uri={cover.previewUri} video={false} /> : <View style={styles.mediaFallback}><Text style={styles.mediaFallbackText}>TRIP</Text></View>}</View>
              <View style={styles.tripCopy}><Text style={styles.tripOverviewTitle}>{group.label}</Text><Text style={styles.tripChipMeta}>{group.interval?.startDay ?? 'Date unknown'} · {tripMedia.length} media</Text><Text style={styles.tripChipMeta}>{selectedCount} selected{!included ? ' · Not in Replay' : selectedCount ? '' : ' · Trip card only'}</Text>{tripChanged(group.key) && <Text style={styles.editedMark}>Edited</Text>}</View>
              <Text style={styles.tripArrow}>›</Text>
            </Pressable>;
          }}
          ListFooterComponent={<Pressable accessibilityRole="button" accessibilityLabel="Music and Replay order" disabled={recoveringDraft} onPress={openReplaySettings} style={styles.settingsEntry}><View><Text style={styles.galleryNavText}>Music & order</Text><Text style={styles.tripChipMeta}>{settingsSummary}</Text></View><Text style={styles.tripArrow}>›</Text></Pressable>}
        />
        <View style={styles.gallerySummary}>
          <Body>{input.groups.length} trips · {workingSaveState === 'saving' ? 'Saving changes…' : changed ? 'Draft changes' : 'Choose a trip and make a change to update your Replay.'}</Body>
          {workingSaveState === 'failed' && <ActionButton accessibilityLabel="Retry saving Replay changes" onPress={() => void retryWorkingEdits()} variant="secondary">Couldn’t save changes. Retry</ActionButton>}
          {workingSaveState === 'waiting' && <Body>Still saving…</Body>}
          {workingSaveState === 'outcome-unknown' && <><Body>Not saved yet</Body><ActionButton accessibilityLabel="Check Replay save again" onPress={() => { void editSession.scheduler.checkAgain().then(() => setWorkingSaveState(editSession.scheduler.getStatus())); }} variant="secondary">Check again</ActionButton></>}
          {workingSaveState === 'conflict' && <><Body>{recoveryMessage ?? 'Your choices could not be saved to the current local draft.'}</Body><View style={styles.bulkActions}><ActionButton accessibilityLabel="Use my Replay changes" disabled={recoveringDraft} onPress={() => void applyMineAfterConflict()} variant="secondary">Keep my choices</ActionButton><ActionButton accessibilityLabel="Use latest Replay changes" disabled={recoveringDraft} onPress={discardConflictingSelectionAndReturnToTripOverview} variant="secondary">Restore saved Replay</ActionButton></View></>}
          <ActionButton accessibilityLabel="Update Replay" onPress={saveEdits} disabled={!changed || !editorManifestReady || !includedGroupKeys.length || workingSaveState === 'conflict' || workingSaveState === 'failed' || workingSaveState === 'outcome-unknown' || recoveringDraft || editSession.isUpdating()}>Update Replay</ActionButton>
        </View>
        <Modal visible={showReplaySettings} animationType="slide" onRequestClose={cancelReplaySettings}>
          <SafeAreaView style={styles.editorSafe} edges={['top', 'bottom']}><View style={styles.galleryNavigation}><Pressable accessibilityRole="button" accessibilityLabel="Close Replay settings" disabled={settingsSaving} onPress={cancelReplaySettings} style={styles.galleryNavAction}><Text style={styles.galleryNavText}>‹ Back</Text></Pressable><Text style={styles.galleryNavTitle}>Music & order</Text><Pressable accessibilityRole="button" accessibilityLabel="Save music and Replay order" accessibilityState={{ busy: settingsSaving }} disabled={settingsSaving || recoveringDraft} onPress={() => void finishReplaySettings()} style={styles.galleryNavAction}><Text style={styles.galleryDoneText}>{settingsSaving ? 'Saving…' : 'Done'}</Text></Pressable></View>
          <ScrollView contentContainerStyle={styles.editorListContent}><Body>Up to 5 MB</Body><Body>Background music: {sheetMusic.kind === 'bundled' ? 'Happy Moments 1.4' : 'Custom audio ready'}</Body>{selectedAudioName && <Body>{audioLoadState === 'loading' ? `Loading audio: ${selectedAudioName}` : audioLoadState === 'saving' ? `Saving audio: ${selectedAudioName}` : audioLoadState === 'loaded' ? `Loaded audio: ${selectedAudioName}` : audioLoadState === 'failed' ? `Couldn’t load audio: ${selectedAudioName}` : `Selected audio: ${selectedAudioName}`}</Body>}{musicError && <Body>{musicError}</Body>}<ActionButton accessibilityLabel="Choose Replay audio file" disabled={settingsSaving || selectingMusic || recoveringDraft} onPress={() => void chooseMusic()} variant="secondary">{selectingMusic ? 'Loading audio…' : 'Choose audio file'}</ActionButton><ActionButton accessibilityLabel="Use default Replay music" disabled={settingsSaving || selectingMusic || recoveringDraft} onPress={useDefaultMusic} variant="secondary">Use default music</ActionButton><Body>Chapter order: {sheetDirection === 'oldest-first' ? 'Oldest first' : 'Newest first'}.</Body><ActionButton accessibilityLabel="Use oldest-first Replay timeline" onPress={() => applyReplayTimeline('oldest-first')} disabled={settingsSaving || sheetDirection === 'oldest-first'} variant="secondary">Oldest first</ActionButton><ActionButton accessibilityLabel="Use newest-first Replay timeline" onPress={() => applyReplayTimeline('newest-first')} disabled={settingsSaving || sheetDirection === 'newest-first'} variant="secondary">Newest first</ActionButton><ActionButton accessibilityLabel="Reset Replay edits" disabled={settingsSaving} onPress={() => void resetEdits()} variant="secondary">Reset automatic selection</ActionButton></ScrollView></SafeAreaView>
        </Modal>
      </SafeAreaView>;
    }
    return <SafeAreaView style={styles.editorSafe} edges={['top', 'bottom']}>
      <View style={styles.galleryNavigation}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to Replay trip overview" onPress={() => void returnToTripOverview()} style={styles.galleryNavAction}><Text style={styles.galleryNavText}>‹ Back</Text></Pressable>
        <Text style={styles.galleryNavTitle}>{activeGroup?.label}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Done editing this trip" onPress={() => void returnToTripOverview()} style={styles.galleryNavAction}><Text style={styles.galleryDoneText}>Done</Text></Pressable>
      </View>
      <FlatList
        key={`replay-trip-gallery-${activeGroup?.key ?? 'none'}`}
        accessibilityLabel="Replay media grid"
        style={styles.editorList}
        contentContainerStyle={styles.editorListContent}
        data={displayedMemories}
        keyExtractor={(memory) => memory.key}
        numColumns={3}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={5}
        onViewableItemsChanged={({ viewableItems }) => { const index = viewableItems[0]?.index ?? 0; loadNextEditorPreviewPage(displayedMemories.slice(index, index + 24)); }}
        onEndReached={() => loadNextEditorPreviewPage(tripCandidates)}
        onEndReachedThreshold={0.6}
        columnWrapperStyle={styles.mediaGridRow}
        ListHeaderComponent={<><View style={styles.galleryTabs}><Pressable accessibilityRole="button" accessibilityLabel="Show all media in this trip" accessibilityState={{ selected: !showSelectedMedia }} onPress={() => setShowSelectedMedia(false)} style={[styles.galleryTab, !showSelectedMedia && styles.galleryTabSelected]}><Text style={[styles.galleryTabText, !showSelectedMedia && styles.galleryTabTextSelected]}>All {tripCandidates.length}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Show selected Replay media" accessibilityState={{ selected: showSelectedMedia }} onPress={() => setShowSelectedMedia(true)} style={[styles.galleryTab, showSelectedMedia && styles.galleryTabSelected]}><Text style={[styles.galleryTabText, showSelectedMedia && styles.galleryTabTextSelected]}>Selected {selectedTripMemories.length}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Open trip media actions" onPress={() => setShowTripActions(true)} style={styles.galleryMore}><Text style={styles.galleryMoreText}>•••</Text></Pressable></View></>}
        renderItem={({ item, index }) => <ReplayMediaTile memory={item} index={index} included={editedMemoryKeys.includes(item.key)} disabled={recoveringDraft || !activeTripIncluded || (editorPreviewResolved.has(item.key) && editorPreviewOverrides[item.key]?.available === false)} resolving={resolvingEditorMemoryKeys.has(item.key)} onToggle={(key) => { void toggleEditorMemory(key); }} onInspect={setInspectedMemory} />}
        ListFooterComponent={<><View style={styles.editorFooter}>{hasUnresolvedTripMedia && <ActionButton accessibilityLabel="Load more trip media" onPress={() => loadNextEditorPreviewPage(tripCandidates)} variant="secondary">Load more · {resolvedTripMediaCount} of {tripCandidates.length}</ActionButton>}{editorPreviewError && <ActionButton accessibilityLabel="Retry loading trip media" onPress={() => loadNextEditorPreviewPage(tripCandidates, true)} variant="secondary">Couldn’t load more media. Retry</ActionButton>}{bulkProgress && <View accessibilityRole="progressbar" accessibilityLabel={`Selecting all media ${bulkProgress.total ? Math.round(bulkProgress.completed / bulkProgress.total * 100) : 100}% complete`} accessibilityValue={{ min: 0, max: 100, now: bulkProgress.total ? Math.round(bulkProgress.completed / bulkProgress.total * 100) : 100 }} style={styles.progressBlock}><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${bulkProgress.total ? Math.round(bulkProgress.completed / bulkProgress.total * 100) : 100}%` }]} /></View><Text style={styles.progressText}>{bulkProgress.completed}/{bulkProgress.total}</Text></View>}</View><Modal visible={showTripActions} transparent animationType="slide" onRequestClose={() => setShowTripActions(false)}><View style={styles.inspector}><InsetPanel><Title>{activeGroup?.label}</Title><Body>Trip actions</Body><View style={styles.secondaryControls}><ActionButton accessibilityLabel={activeTripIncluded ? 'Exclude this trip from Replay' : 'Include this trip in Replay'} onPress={() => { toggleActiveTripInclusion(); setShowTripActions(false); }} variant="secondary">{activeTripIncluded ? 'Exclude trip' : 'Include trip'}</ActionButton><ActionButton accessibilityLabel="Restore automatic media in this trip" onPress={() => { restoreAutoInActiveTrip(); setShowTripActions(false); }} disabled={!activeTripIncluded || autoGroupKeys.includes(activeGroup?.key ?? '')} variant="secondary">Restore Auto</ActionButton><ActionButton accessibilityLabel="Undo last trip media change" onPress={() => { undoTripChange(); setShowTripActions(false); }} disabled={!lastTripChange} variant="secondary">Undo</ActionButton><ActionButton accessibilityLabel="Select all media in this trip" onPress={() => { void selectAllInActiveTrip(); setShowTripActions(false); }} disabled={!activeTripIncluded || Boolean(bulkProgress)} variant="secondary">Select all</ActionButton><ActionButton accessibilityLabel="Clear media in this trip" onPress={() => { clearActiveTrip(); setShowTripActions(false); }} disabled={!activeTripIncluded || Boolean(bulkProgress)} variant="secondary">Clear</ActionButton><ActionButton accessibilityLabel="Close trip media actions" onPress={() => setShowTripActions(false)} variant="secondary">Close</ActionButton></View></InsetPanel></View></Modal><Modal visible={Boolean(inspectedMemory)} transparent animationType="slide" onRequestClose={() => setInspectedMemory(null)}><View style={styles.inspector}><InsetPanel><Title>{inspectedMemory?.kind === 'video' ? 'Replay video' : 'Replay photo'}</Title>{inspectedMemory?.previewUri ? inspectedMemory.kind === 'video' ? <ReplaySourceVideo uri={inspectedMemory.previewUri} intendedSeconds={inspectedVideoSeconds} /> : <Image source={{ uri: inspectedMemory.previewUri }} style={styles.inspectorImage} contentFit="contain" accessibilityLabel="Inspected photo" /> : <Body>This local media preview is unavailable.</Body>}<ActionButton accessibilityLabel="Close Replay media inspection" onPress={() => setInspectedMemory(null)} variant="secondary">Back to edit</ActionButton></InsetPanel></View></Modal></>}
      />
      <View accessibilityLabel="Trip selection summary" style={styles.gallerySummary}>
        <Body>{activeTripIncluded ? `${selectedTripMemories.length} selected · about ${estimatedDuration} seconds` : 'Not in Replay. Your choices are retained.'}</Body>
        {workingSaveState === 'saving' && <View accessibilityRole="progressbar" accessibilityLabel="Saving trip changes" accessibilityState={{ busy: true }}><Body>Saving trip changes…</Body></View>}
        {workingSaveState === 'failed' && <Body>Couldn’t save this trip. Your choices are kept; retry from the trip overview.</Body>}
        {workingSaveState === 'conflict' && <>
          <Body>{recoveryMessage ?? 'Your selected photos could not be matched to the last saved edit.'}</Body>
          <View style={styles.bulkActions}>
            <ActionButton accessibilityLabel="Keep my trip choices" disabled={recoveringDraft} onPress={() => void resolveMineAndReturnToTripOverview()} variant="secondary">Keep my choices</ActionButton>
            <ActionButton accessibilityLabel="Restore saved Replay selection" disabled={recoveringDraft} onPress={() => void discardConflictingSelectionAndReturnToTripOverview()} variant="secondary">Restore saved Replay</ActionButton>
          </View>
        </>}
      </View>
    </SafeAreaView>;
  }
  return <Screen scrollEnabled={state !== 'editing'}>
    <Eyebrow>Private Replay</Eyebrow><Title>{state === 'sparse' ? 'Replay needs available memories.' : state === 'checking' ? 'Getting your Replay ready.' : 'Your private Replay.'}</Title>
    {state === 'idle' && <InsetPanel><Body>Replay uses your current private Journey List and available attached memories. Journey order is presentation only: it does not claim a route, presence, or travel duration.</Body></InsetPanel>}
    {state === 'sparse' && <InsetPanel>
      <Body>Replay found {input?.groups.length ?? 0} visible trip{(input?.groups.length ?? 0) === 1 ? '' : 's'} and {input?.memories.filter((memory) => memory.available && memory.eligible).length ?? 0} usable attached memories.</Body>
      <Body>Nothing was rendered or shared. Return to your private Journey List to review which trips and attachments are currently visible; Travel Life will not invent missing memories.</Body>
    </InsetPanel>}
    {state === 'checking' && <InsetPanel>
      <View style={styles.preparingHeader} accessibilityLabel={preparationPhase === 'opening' ? 'Opening saved private Replay' : preparationPhase === 'resolving' ? 'Resolving private Replay memories' : `Rendering private Replay video${preparationProgress ? `, ${Math.min(100, Math.round(preparationProgress.completed / preparationProgress.total * 100))}% complete` : ''}`} accessibilityState={{ busy: true }}>
        <ActivityIndicator color={palette.citrus} />
        <Text style={styles.preparingTitle}>{preparationPhase === 'opening' ? 'Opening your private Replay' : preparationPhase === 'resolving' ? 'Finding your Replay moments' : 'Rendering your private Replay'}</Text>
      </View>
      <Body>{preparationDetail}</Body>
      {preparationPhase === 'rendering' && preparationProgress && <View style={styles.progressBlock} accessibilityLabel={`Replay rendering ${Math.min(100, Math.round(preparationProgress.completed / preparationProgress.total * 100))}% complete`} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.min(100, Math.round(preparationProgress.completed / preparationProgress.total * 100)) }}>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(100, Math.round(preparationProgress.completed / preparationProgress.total * 100))}%` }]} /></View>
        <Text style={styles.progressText}>{Math.min(100, Math.round(preparationProgress.completed / preparationProgress.total * 100))}%</Text>
      </View>}
      <Body>Nothing is shared while Replay is getting ready.</Body>
    </InsetPanel>}
    {(state === 'first-trip-ready' || state === 'finalization-failed') && preview && <InsetPanel><Title>{state === 'first-trip-ready' ? `First trip ready · finishing ${preparationProgress?.completed ?? 1} of ${preparationProgress?.total ?? 1}` : 'The full Replay was not completed. This is only the first trip.'}</Title><ReplayPreview uri={preview.uri} muted={muted} onMutedChange={setMuted} /><Body>{state === 'first-trip-ready' ? 'Sound will be ready with the full Replay.' : 'This incomplete preview stays private and cannot be shared or saved.'}</Body>{preparationProgress && <View accessibilityRole="progressbar" accessibilityLabel={`Replay finalizing ${Math.min(100, Math.round(preparationProgress.completed / preparationProgress.total * 100))}% complete`} accessibilityValue={{ min: 0, max: 100, now: Math.min(100, Math.round(preparationProgress.completed / preparationProgress.total * 100)) }} style={styles.progressBlock}><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(100, Math.round(preparationProgress.completed / preparationProgress.total * 100))}%` }]} /></View><Text style={styles.progressText}>{Math.min(100, Math.round(preparationProgress.completed / preparationProgress.total * 100))}%</Text></View>}</InsetPanel>}
    {state === 'recovery-ready' && preview && <InsetPanel><Title>Your previous verified Replay is still ready.</Title><ReplayPreview uri={preview.uri} muted={muted} onMutedChange={setMuted} /><Body>The new Replay did not finish, so its partial result was not saved or shared.</Body></InsetPanel>}
    {state === 'final-ready' && preview && <InsetPanel><Title>Your private Replay</Title><ReplayPreview uri={preview.uri} muted={muted} onMutedChange={setMuted} /><Body>Playing your private Replay. Built locally from {preview.renderedMemoryCount} selected memories. It stays private while you watch.</Body>{exportMessage && <Body>{exportMessage}</Body>}</InsetPanel>}
    {state === 'share-review' && preview && input && <InsetPanel><Title>Choose moments to share</Title><Body>Sharing may create a copy outside Travel Life. Only moments in this current private Replay can be selected.</Body>{sharing && <Body>Preparing your selected private Replay.</Body>}{shareCandidates.length === 0 ? <Body>This Replay has no selected media to share. Return to Edit to choose moments.</Body> : <><ActionButton accessibilityLabel="Select all Replay moments for sharing" disabled={sharing} onPress={toggleAllShareMemories} variant="secondary">{shareMemoryKeys.length === shareCandidates.length ? 'Clear all moments' : 'Select all moments'}</ActionButton>{shareCandidates.map((memory, index) => { const selected = shareMemoryKeys.includes(memory.key); return <ActionButton key={memory.key} accessibilityLabel={`${selected ? 'Remove' : 'Select'} ${memory.kind} ${index + 1} for sharing`} disabled={sharing} onPress={() => setShareMemoryKeys((current) => selected ? current.filter((key) => key !== memory.key) : [...current, memory.key])} variant="secondary">{selected ? 'Selected' : 'Select'} {memory.kind} {index + 1}</ActionButton>; })}</>}{exportMessage && <Body>{exportMessage}</Body>}</InsetPanel>}
    {state === 'failed' && <InsetPanel><Title>Replay could not be prepared.</Title><Body>{failure ? failureCopy[failure] : failureCopy.REPLAY_UNAVAILABLE}</Body><Body>Your current private Journey List and attached media were kept unchanged.</Body></InsetPanel>}
    {state === 'share-review' && <Body>{music.kind === 'bundled' ? 'Your exported video includes Happy Moments 1.4 background music.' : 'Your exported video uses your selected custom audio.'}</Body>}
    {state === 'final-ready' && <ActionButton accessibilityLabel="Choose Replay for sharing" onPress={() => { setShareMemoryKeys([]); setExportMessage(null); setState('share-review'); }}>Share Replay</ActionButton>}
    {state === 'final-ready' && <ActionButton accessibilityLabel="Re-render private Replay" onPress={() => { if (preview) void discardPrivateReplay(preview.uri, { preserveFile: true }).then(() => void prepare()); }} variant="secondary">Re-render Replay</ActionButton>}
    {state === 'final-ready' && <ActionButton accessibilityLabel="Edit private Replay" onPress={() => { setEditorOrigin('final-ready'); setEditorStage('overview'); setState('editing'); }} variant="secondary">Edit Replay</ActionButton>}
    {state === 'failed' && input && editorManifestReady && <ActionButton accessibilityLabel="Edit private Replay" onPress={() => { setEditorOrigin('failed'); setEditorStage('overview'); setState('editing'); }} variant="secondary">Edit Replay</ActionButton>}
    {state === 'editing' && <ActionButton accessibilityLabel="Save Replay edits" onPress={() => void saveEdits()} disabled={!editorManifestReady || !editedMemoryKeys.length || !includedGroupKeys.length}>{workingSaveState === 'saving' ? 'Saving…' : 'Done'}</ActionButton>}
    {state === 'editing' && <ActionButton accessibilityLabel="Reset Replay edits" disabled={settingsSaving} onPress={() => void resetEdits()} variant="secondary">Reset automatic selection</ActionButton>}
    {state === 'editing' && <ActionButton accessibilityLabel="Cancel Replay edits" onPress={() => { void retainWorkingEdits().then((saved) => { if (saved) { setInspectedMemory(null); setState(editorOrigin); } }); }} variant="secondary">Back</ActionButton>}
    {state === 'share-review' && <ActionButton accessibilityLabel="Open Replay share sheet" onPress={() => void exportReplay()} disabled={!shareMemoryKeys.length || sharing}>{sharing ? 'Preparing selected Replay…' : 'Review and Share'}</ActionButton>}
    {state === 'share-review' && <ActionButton accessibilityLabel="Cancel Replay share selection" onPress={() => setState('final-ready')} variant="secondary">Back</ActionButton>}
    {state === 'finalization-failed' && <ActionButton accessibilityLabel="Retry full Replay finalization" onPress={() => void prepare()} variant="secondary">Retry Replay</ActionButton>}
    {state === 'recovery-ready' && <ActionButton accessibilityLabel="Retry full Replay finalization" onPress={() => void prepare()} variant="secondary">Retry Replay</ActionButton>}
    {state === 'sparse' && <ActionButton accessibilityLabel="Return to private Journey List" onPress={() => openRoute(router, appRoutes.atlas, 'replace')}>Return to Journey List</ActionButton>}
    {state === 'failed' && <ActionButton accessibilityLabel="Retry private Replay" onPress={() => void prepare()}>Retry Replay</ActionButton>}
    {__DEV__ && state === 'failed' && <ActionButton accessibilityLabel="Open synthetic Replay renderer check" onPress={() => openRoute(router, appRoutes.replayS0)}>Open synthetic Replay renderer check</ActionButton>}
    {(state === 'checking' || state === 'first-trip-ready' || state === 'finalization-failed' || state === 'recovery-ready' || state === 'failed' || state === 'final-ready' || state === 'editing' || state === 'share-review') && <ActionButton accessibilityLabel="Cancel Replay preparation" onPress={cancel} variant="secondary">Close Replay</ActionButton>}
    <ActionButton accessibilityLabel="Return to private Atlas" onPress={() => openRoute(router, appRoutes.atlas, 'replace')} variant="secondary">Return to Atlas</ActionButton>
  </Screen>;
}

const styles = StyleSheet.create({
  editorSafe: { flex: 1, backgroundColor: palette.rainforest },
  editorList: { flex: 1 },
  editorListContent: { gap: 12, padding: 20, paddingBottom: 32 },
  editorFooter: { marginTop: 4 },
  previewShell: { width: '100%', aspectRatio: 16 / 9, marginVertical: 12, borderRadius: 12, overflow: 'hidden' },
  preview: { width: '100%', height: '100%' },
  fullscreenShell: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  fullscreenPreview: { width: '100%', aspectRatio: 16 / 9 },
  playerControls: { position: 'absolute', right: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 4, padding: 2, borderRadius: 22, backgroundColor: 'rgba(16,44,38,0.88)' },
  playerControl: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21 },
  playerIcon: { color: palette.limestone, fontSize: 21, lineHeight: 24 },
  preparingHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  preparingTitle: { color: palette.limestone, fontSize: 18, fontWeight: '800' },
  progressBlock: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  progressTrack: { flex: 1, height: 8, borderRadius: 999, overflow: 'hidden', backgroundColor: palette.fern },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: palette.citrus },
  progressText: { color: palette.limestone, fontSize: 14, fontWeight: '800', minWidth: 38, textAlign: 'right' },
  tripChip: { width: 142, minHeight: 66, padding: 10, borderWidth: 1, borderColor: palette.fern, borderRadius: 12, backgroundColor: palette.rainforest, justifyContent: 'center' },
  tripChipSelected: { borderColor: palette.citrus, backgroundColor: palette.fern },
  tripChipInactive: { opacity: 0.52 },
  tripChipTitle: { color: palette.limestone, fontSize: 14, fontWeight: '800' },
  tripChipMeta: { color: palette.sage, fontSize: 12, marginTop: 4 },
  bulkActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  tripOverviewCard: { minHeight: 112, paddingVertical: 12, borderBottomWidth: 1, borderColor: palette.fern, flexDirection: 'row', alignItems: 'center', gap: 12 },
  tripCover: { width: 76, height: 88, borderRadius: 12, overflow: 'hidden', backgroundColor: palette.fern },
  tripCopy: { flex: 1 },
  tripOverviewTitle: { color: palette.limestone, fontSize: 20, fontWeight: '800' },
  tripArrow: { color: palette.sage, fontSize: 26 },
  editedMark: { color: palette.citrus, fontSize: 12, marginTop: 6 },
  settingsEntry: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mediaGridRow: { gap: 8 },
  mediaCell: { flex: 1, gap: 4 },
  mediaCellInactive: { opacity: 0.48 },
  mediaTile: { aspectRatio: 1, overflow: 'hidden', borderRadius: 10, borderWidth: 2, borderColor: palette.fern, backgroundColor: palette.rainforest },
  mediaTileSelected: { borderColor: palette.citrus },
  mediaImage: { width: '100%', height: '100%' },
  mediaFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mediaFallbackText: { color: palette.sage, fontSize: 11, fontWeight: '900' },
  selectionBadge: { position: 'absolute', top: 5, right: 5, width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: palette.limestone, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(16,44,38,0.5)' },
  selectionBadgeSelected: { backgroundColor: palette.citrus, borderColor: palette.citrus },
  selectionBadgeText: { color: palette.rainforest, fontWeight: '900', fontSize: 16 },
  videoBadge: { position: 'absolute', left: 5, bottom: 5, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10, backgroundColor: 'rgba(16,44,38,0.88)' },
  videoBadgeText: { color: palette.limestone, fontSize: 10, fontWeight: '900' },
  mediaCaption: { color: palette.sage, fontSize: 11 },
  inspectControl: { alignSelf: 'flex-end', width: 30, height: 30, marginTop: -34, marginRight: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: 'rgba(16,44,38,0.8)' },
  inspectGlyph: { color: palette.limestone, fontSize: 18, fontWeight: '800' },
  galleryTabs: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 10 },
  gallerySummary: { padding: 16, gap: 8, borderTopWidth: 1, borderTopColor: 'rgba(243,238,221,0.18)' },
  galleryNavigation: { minHeight: 74, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(243,238,221,0.18)', backgroundColor: palette.rainforest },
  galleryNavAction: { width: 76, minHeight: 48, justifyContent: 'center' },
  galleryNavText: { color: palette.limestone, fontSize: 18, fontWeight: '800' },
  galleryNavTitle: { flex: 1, paddingHorizontal: 8, color: palette.limestone, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  galleryDoneText: { color: palette.citrus, fontSize: 18, fontWeight: '900', textAlign: 'right' },
  galleryTab: { minHeight: 40, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(243,238,221,0.42)', alignItems: 'center', justifyContent: 'center' },
  galleryTabSelected: { borderColor: palette.citrus, backgroundColor: palette.citrus },
  galleryTabText: { color: palette.limestone, fontSize: 14, fontWeight: '800' },
  galleryTabTextSelected: { color: palette.rainforest },
  galleryMore: { width: 40, height: 40, marginLeft: 'auto', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(243,238,221,0.42)', alignItems: 'center', justifyContent: 'center' },
  galleryMoreText: { color: palette.limestone, fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  secondaryControls: { gap: 6, marginTop: 12 },
  inspector: { flex: 1, justifyContent: 'center', padding: 18, backgroundColor: 'rgba(16,44,38,0.94)' },
  inspectorImage: { width: '100%', height: 340, borderRadius: 12 },
});
