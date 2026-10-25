import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView, type VideoThumbnail } from 'expo-video';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { getMediaInformation } from 'munim-ffmpeg';
import { useNavigation, useRouter } from 'expo-router';
import { ActionButton, Body, Eyebrow, InsetPanel, palette, Screen, Title } from '@/components/ui';
import { openRoute, appRoutes } from '@/navigation/app-contract';
import { usePhotoAccess } from '@/photo-access/provider';
import { planPrivateReplay } from '@/replay/selection';
import { replayChapterFrames, replayDuration, type ReplayDirection, type ReplayManifestInput, type ReplayMemory, type ReplaySoundtrack } from '@/replay/types';
import { createDiagnosticCorrelationId, recordAppDiagnostic } from '@/diagnostics/app-diagnostics';
import { ReplayPreparationError, replayFailureStage, type ReplayFailureStage } from '@/replay/renderer';

type ViewState = 'idle' | 'sparse' | 'checking' | 'preview-ready' | 'editing' | 'share-review' | 'failed';
type WorkingSaveRequest = Readonly<{ memoryKeys: readonly string[]; direction: ReplayDirection; soundtrack: ReplaySoundtrack; includedGroupKeys: readonly string[]; autoGroupKeys: readonly string[] }>;
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
  const player = useVideoPlayer(uri, (video) => { video.muted = false; video.staysActiveInBackground = false; video.play(); });
  const videoView = useRef<VideoView>(null);
  const [muted, setMuted] = useState(false);
  const toggleMuted = () => {
    // This is player-only listening state: no preparation, cache invalidation,
    // artifact replacement, or seek is involved.
    // eslint-disable-next-line react-hooks/immutability -- expo-video exposes mutable player controls by design.
    player.muted = !muted;
    setMuted(!muted);
  };
  return <View style={styles.previewShell}>
    <VideoView ref={videoView} player={player} style={styles.preview} nativeControls fullscreenOptions={{ enable: false }} contentFit="contain" />
    <View style={styles.playerControls}>
      <Pressable accessibilityRole="button" accessibilityLabel={muted ? 'Unmute Replay audio' : 'Mute Replay audio'} accessibilityState={{ selected: muted }} onPress={toggleMuted} style={styles.playerControl}><Text style={styles.playerIcon}>{muted ? '🔇' : '🔊'}</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Open Replay fullscreen" onPress={() => { void videoView.current?.enterFullscreen(); }} style={styles.playerControl}><Text style={styles.playerIcon}>⛶</Text></Pressable>
    </View>
  </View>;
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

function localAudioToken(uri: string) {
  let hash = 2166136261;
  for (const character of uri) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(36);
}

/** A bounded local poster is recognisable without autoplaying source video. */
function ReplayVideoPoster({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (video) => { video.muted = true; video.pause(); });
  const [poster, setPoster] = useState<VideoThumbnail | null>(null);
  useEffect(() => {
    let active = true;
    void player.generateThumbnailsAsync(0, { maxWidth: 360, maxHeight: 360 })
      .then(([thumbnail]) => { if (active && thumbnail) setPoster(thumbnail); })
      // A local source can still be inspectable when poster extraction fails.
      .catch(() => { if (active) setPoster(null); });
    return () => { active = false; player.pause(); };
  }, [player]);
  return poster ? <Image source={poster} style={styles.mediaImage} contentFit="cover" accessibilityLabel="video poster" /> : <View accessibilityLabel="video poster" style={styles.mediaFallback}><Text style={styles.mediaFallbackText}>VIDEO</Text></View>;
}

/** Share can only offer media that belongs to the committed private Replay. */
export function shareableCommittedMemories(input: ReplayManifestInput | null, committedMemoryKeys: readonly string[]) {
  if (!input) return [];
  const committed = new Set(committedMemoryKeys);
  const included = new Set(input.includedGroupKeys ?? (input.groups.length ? input.groups.filter((group) => group.eligible).map((group) => group.key) : input.memories.map((memory) => memory.groupKey)));
  return input.memories.filter((memory) => memory.available && memory.eligible && included.has(memory.groupKey) && committed.has(memory.key));
}

function ReplayMediaTile({ memory, index, included, disabled = false, resolving = false, onToggle, onInspect }: { memory: ReplayMemory; index: number; included: boolean; disabled?: boolean; resolving?: boolean; onToggle(key: string): void; onInspect(memory: ReplayMemory): void }) {
  return <View style={[styles.mediaCell, disabled && styles.mediaCellInactive]}><Pressable accessibilityRole="checkbox" accessibilityLabel={`${disabled ? 'Inactive' : resolving ? 'Checking' : included ? 'Remove' : 'Add'} ${memory.kind} ${index + 1}`} accessibilityState={{ checked: included, disabled, busy: resolving }} disabled={disabled || resolving} onPress={() => onToggle(memory.key)} style={[styles.mediaTile, included && styles.mediaTileSelected]}>{memory.previewUri ? memory.kind === 'video' ? <ReplayVideoPoster uri={memory.previewUri} /> : <Image source={{ uri: memory.previewUri }} style={styles.mediaImage} contentFit="cover" cachePolicy="memory" accessibilityLabel="photo thumbnail" /> : <View style={styles.mediaFallback}><Text style={styles.mediaFallbackText}>{resolving ? 'CHECKING' : memory.kind === 'video' ? 'VIDEO' : 'PHOTO'}</Text></View>}<View style={[styles.selectionBadge, included && styles.selectionBadgeSelected]}><Text style={styles.selectionBadgeText}>{included ? '✓' : ''}</Text></View>{memory.kind === 'video' && <View style={styles.videoBadge}><Text style={styles.videoBadgeText}>▶</Text></View>}</Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Inspect ${memory.kind} ${index + 1}`} onPress={() => onInspect(memory)} style={styles.inspectControl}><Text style={styles.inspectGlyph}>⌕</Text></Pressable></View>;
}

/** Private UI state only; it never receives native source references or creates an export. */
export function ReplayScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { loadReplayManifestInput, loadReplayEditorPreviewPage, loadPreparedReplay, saveReplayDraft, stageReplayWorkingDraft, resetReplayDraft, preparePrivateReplay, exportPrivateReplay, discardPrivateReplay } = usePhotoAccess();
  const [input, setInput] = useState<ReplayManifestInput | null>(null);
  const [preview, setPreview] = useState<{ uri: string; renderedMemoryCount: number; durationSeconds: number } | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<ReplayFailureStage | null>(null);
  const [state, setState] = useState<ViewState>('idle');
  const [preparationPhase, setPreparationPhase] = useState<'resolving' | 'rendering'>('resolving');
  const [preparationDetail, setPreparationDetail] = useState('Checking the visible trips and locally available memories you can use right now.');
  const [preparationProgress, setPreparationProgress] = useState<{ completed: number; total: number } | null>(null);
  const [editedMemoryKeys, setEditedMemoryKeys] = useState<readonly string[]>([]);
  /** The committed composition is the only candidate pool for deliberate export. */
  const [committedMemoryKeys, setCommittedMemoryKeys] = useState<readonly string[]>([]);
  const [editorManifestReady, setEditorManifestReady] = useState(false);
  const [editorOrigin, setEditorOrigin] = useState<'preview-ready' | 'failed'>('preview-ready');
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
  const [audioLoadState, setAudioLoadState] = useState<'idle' | 'loading' | 'loaded' | 'failed'>('idle');
  const [musicError, setMusicError] = useState<string | null>(null);
  const [selectingMusic, setSelectingMusic] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [workingSaveState, setWorkingSaveState] = useState<'idle' | 'pending' | 'saving' | 'failed' | 'conflict'>('idle');
  const [tripNavigationPending, setTripNavigationPending] = useState(false);
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
  const customSoundtrackCounter = useRef(0);
  const workingSaveQueue = useRef<Promise<void>>(Promise.resolve());
  const scheduledWorkingSave = useRef<{ request: WorkingSaveRequest; promise: Promise<void>; resolve(): void; reject(error: unknown): void; timer: ReturnType<typeof setTimeout> | null } | null>(null);
  const workingSaveGeneration = useRef(0);
  const tripReturnPending = useRef(false);
  const workingRecovery = useRef(false);
  const pendingSelectionTasks = useRef(new Set<Promise<void>>());
  const workingRevisionRef = useRef<number | undefined>(undefined);
  const includedGroupKeysRef = useRef<readonly string[]>([]);
  const autoGroupKeysRef = useRef<readonly string[]>([]);
  const editorPreviewLoading = useRef(false);
  const editorPreviewResolvedKeys = useRef(new Set<string>());
  /** Invalidates detached or superseded preparation before it reaches the provider. */
  const preparationGeneration = useRef(0);
  const isMounted = useRef(true);
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
  const chooseMusic = async () => {
    if (workingRecovery.current || selectingMusic) return;
    setMusicError(null);
    setSelectingMusic(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true, multiple: false });
      if (result.canceled) return;
      const source = result.assets?.[0];
      if (!source || !FileSystem.documentDirectory || (typeof source.size === 'number' && source.size > 5_000_000)) throw new Error();
      const displayName = source.name?.trim() || 'Custom audio file';
      setSelectedAudioName(displayName);
      setAudioLoadState('loading');
      const suffix = /\.(mp3|m4a|aac|wav|ogg)$/i.exec(source.name ?? '')?.[0]?.toLowerCase() ?? (source.mimeType === 'audio/mpeg' ? '.mp3' : source.mimeType === 'audio/mp4' ? '.m4a' : source.mimeType === 'audio/wav' ? '.wav' : source.mimeType === 'audio/ogg' ? '.ogg' : '.audio');
      customSoundtrackCounter.current += 1;
      const revision = `custom-${localAudioToken(source.uri)}-${customSoundtrackCounter.current}`;
      const localUri = `${FileSystem.documentDirectory}replay-${revision}${suffix}`;
      await FileSystem.copyAsync({ from: source.uri, to: localUri });
      const copied = await FileSystem.getInfoAsync(localUri);
      if (!copied.exists || !copied.size || copied.size > 5_000_000) throw new Error();
      const media = await getMediaInformation(localUri);
      if (!(Number(media.format?.duration) > 0)) throw new Error();
      if (workingRecovery.current) return;
      const soundtrack = { kind: 'custom', revision, localUri } as const;
      setReplayMusic(soundtrack);
      setAudioLoadState('loaded');
      void queueWorkingSave(editedMemoryKeysRef.current, timelineDirectionRef.current, soundtrack).catch(() => undefined);
    } catch { setAudioLoadState('failed'); setMusicError('That audio file could not be used. Choose a readable audio file up to 5 MB.'); }
    finally { setSelectingMusic(false); }
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
      }, soundtrack);
      if (!isCurrent()) {
        if (prepared.uri !== preview?.uri) await discardPrivateReplay(prepared.uri);
        return;
      }
      if (preview && preview.uri !== prepared.uri) await discardPrivateReplay(preview.uri);
      setPreview(prepared); setState('preview-ready');
    } catch (error) {
      if (!isCurrent()) return;
      const stage = replayFailureStage(error);
      if (stage === 'REPLAY_STALE') {
        // A scope or privacy revision changed after this screen read its
        // manifest. Do not keep old tiles, thumbnails or a stale preview.
        setInput(null); setEditorSelection([]); setCommittedMemoryKeys([]); setEditorManifestReady(false); setActiveGroupKey(null); setInspectedMemory(null); setPreview(null);
      }
      setFailure(stage); setState('failed');
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
  const startWorkingSave = (scheduled: NonNullable<typeof scheduledWorkingSave.current>) => {
    if (scheduledWorkingSave.current !== scheduled) return scheduled.promise;
    if (scheduled.timer) clearTimeout(scheduled.timer);
    scheduled.timer = null;
    scheduledWorkingSave.current = null;
    if (!input || !editorManifestReady) {
      scheduled.resolve();
      return scheduled.promise;
    }
    const currentInput = input;
    const saveGeneration = ++workingSaveGeneration.current;
    setWorkingSaveState('saving');
    const { memoryKeys: next, direction, soundtrack, includedGroupKeys: included, autoGroupKeys: automatic } = scheduled.request;
    const job = workingSaveQueue.current.catch(() => undefined).then(async () => {
      const revision = workingRevisionRef.current === undefined
        ? await stageReplayWorkingDraft(next, currentInput.snapshotToken, currentInput.privacyRevision, direction, soundtrack, undefined, included, automatic)
        : await stageReplayWorkingDraft(next, currentInput.snapshotToken, currentInput.privacyRevision, direction, soundtrack, workingRevisionRef.current, included, automatic);
      workingRevisionRef.current = revision;
      if (saveGeneration === workingSaveGeneration.current) setWorkingSaveState('idle');
    }).catch((error: unknown) => { if (saveGeneration === workingSaveGeneration.current) setWorkingSaveState(replayFailureStage(error) === 'REPLAY_STALE' ? 'conflict' : 'failed'); throw error; });
    workingSaveQueue.current = job;
    void job.then(scheduled.resolve, scheduled.reject);
    return scheduled.promise;
  };
  const queueWorkingSave = (next: readonly string[], direction = timelineDirectionRef.current, soundtrack = musicRef.current, included = includedGroupKeysRef.current, automatic = autoGroupKeysRef.current, immediate = false) => {
    if (!input || !editorManifestReady) return Promise.resolve();
    const request: WorkingSaveRequest = { memoryKeys: next, direction, soundtrack, includedGroupKeys: included, autoGroupKeys: automatic };
    const existing = scheduledWorkingSave.current;
    if (existing) {
      existing.request = request;
      return immediate ? startWorkingSave(existing) : existing.promise;
    }
    let resolve!: () => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<void>((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
    const scheduled = { request, promise, resolve, reject, timer: null as ReturnType<typeof setTimeout> | null };
    scheduledWorkingSave.current = scheduled;
    setWorkingSaveState('pending');
    scheduled.timer = setTimeout(() => { void startWorkingSave(scheduled); }, 250);
    return immediate ? startWorkingSave(scheduled) : promise;
  };
  const flushWorkingSave = () => {
    const scheduled = scheduledWorkingSave.current;
    return scheduled ? startWorkingSave(scheduled) : workingSaveQueue.current;
  };
  const trackSelectionTask = (task: Promise<void>) => {
    pendingSelectionTasks.current.add(task);
    void task.finally(() => pendingSelectionTasks.current.delete(task)).catch(() => undefined);
    return task;
  };
  const toggleEditorMemory = (key: string) => trackSelectionTask(toggleEditorMemoryNow(key));
  const toggleEditorMemoryNow = async (key: string) => {
    if (workingRecovery.current) return;
    if (!input || resolvingEditorMemoryKeys.has(key)) return;
    if (!editorPreviewResolvedKeys.current.has(key)) {
      setResolvingEditorMemoryKeys((current) => new Set([...current, key]));
      try {
        const [resolved] = await loadReplayEditorPreviewPage([key], input.snapshotToken, input.privacyRevision);
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
    const current = editedMemoryKeysRef.current;
    const next = current.includes(key) ? current.filter((value) => value !== key) : [...current, key];
    const automatic = activeGroupKey ? autoGroupKeysRef.current.filter((groupKey) => groupKey !== activeGroupKey) : autoGroupKeysRef.current;
    setLastTripChange({ keys: current, autoGroupKeys: autoGroupKeysRef.current }); setAutoGroups(automatic); setEditorSelection(next);
    void queueWorkingSave(next, timelineDirectionRef.current, musicRef.current, includedGroupKeysRef.current, automatic).catch(() => undefined);
  };
  const selectAllInActiveTrip = () => trackSelectionTask(selectAllInActiveTripNow());
  const selectAllInActiveTripNow = async () => {
    if (workingRecovery.current) return;
    if (!input || !activeGroupKey || bulkProgress) return;
    const trip = input.memories.filter((memory) => memory.groupKey === activeGroupKey && memory.eligible);
    const unresolved = trip.filter((memory) => !editorPreviewResolvedKeys.current.has(memory.key));
    const resolved: { key: string; available: boolean; previewUri?: string }[] = [];
    setBulkProgress({ completed: 0, total: unresolved.length });
    try {
      for (let offset = 0; offset < unresolved.length; offset += 48) {
        const page = await loadReplayEditorPreviewPage(unresolved.slice(offset, offset + 48).map((memory) => memory.key), input.snapshotToken, input.privacyRevision);
        resolved.push(...page); addResolvedEditorPreviews(page.map((item) => item.key));
        setEditorPreviewOverrides((previous) => ({ ...previous, ...Object.fromEntries(page.map((item) => [item.key, { available: item.available, ...(item.previewUri ? { previewUri: item.previewUri } : {}) }])) }));
        setBulkProgress({ completed: Math.min(unresolved.length, offset + page.length), total: unresolved.length });
      }
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
      while (pendingSelectionTasks.current.size) await Promise.all([...pendingSelectionTasks.current]);
      await workingSaveQueue.current.catch(() => undefined);
      const current = await loadReplayManifestInput();
      await resetReplayDraft(current.snapshotToken, current.privacyRevision);
      const latest = await loadReplayManifestInput();
      const direction = latest.direction ?? 'oldest-first';
      const plan = planPrivateReplay(latest.groups, latest.memories, undefined, direction, latest.autoGroupKeys);
      workingRevisionRef.current = latest.workingDraft?.revision;
      workingSaveQueue.current = Promise.resolve(); workingSaveGeneration.current += 1;
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
    void loadReplayEditorPreviewPage(keys, input.snapshotToken, input.privacyRevision).then((page) => {
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
      } while (pendingSelectionTasks.current.size || pending !== workingSaveQueue.current || scheduledWorkingSave.current !== null);
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
    if (tripReturnPending.current) return;
    tripReturnPending.current = true;
    setTripNavigationPending(true);
    // A trip's Done/Back controls navigate; they are not the aggregate commit.
    // Return immediately so a durable local write never strands the owner in the
    // gallery. The overview exposes that write's saving, retry, or conflict state
    // and keeps aggregate Update disabled until it is acknowledged.
    setInspectedMemory(null);
    setEditorStage('overview');
    try {
      const saved = workingSaveState === 'failed' ? await retryWorkingEdits() : await retainWorkingEdits();
      if (!saved) return;
    } finally {
      tripReturnPending.current = false;
      setTripNavigationPending(false);
    }
  };
  const useDefaultMusic = () => {
    if (workingRecovery.current) return;
    const next = { kind: 'bundled', revision: 'happy-moments-1.4' } as const;
    setReplayMusic(next); setSelectedAudioName(null); setAudioLoadState('idle'); setMusicError(null);
    void queueWorkingSave(editedMemoryKeysRef.current, timelineDirectionRef.current, next).catch(() => undefined);
  };
  const applyReplayTimeline = (direction: ReplayDirection) => {
    if (workingRecovery.current) return;
    setReplayTimelineDirection(direction);
    void queueWorkingSave(editedMemoryKeysRef.current, direction).catch(() => undefined);
  };
  const finishReplaySettings = async () => {
    if (settingsSaving || recoveringDraft) return;
    setSettingsSaving(true);
    setMusicError(null);
    try {
      // Settings use the same recoverable working draft as trip edits. Done
      // flushes a just-selected track/order instead of relying on the short
      // coalescing delay or making the owner infer that Back saved it.
      await flushWorkingSave();
      setShowReplaySettings(false);
    } catch {
      setWorkingSaveState('failed');
      setMusicError('Couldn’t save music and order. Try Done again.');
    } finally {
      setSettingsSaving(false);
    }
  };
  const saveEdits = async () => {
    const selectedKeys = editedMemoryKeysRef.current;
    // An included trip with no selected media is an intentional destination card,
    // so only an entirely excluded Replay blocks the aggregate update.
    if (!editorManifestReady || !includedGroupKeysRef.current.length) return;
    setFailure(null); setPreparationPhase('resolving'); setState('checking');
    try {
      if (!input) throw new ReplayPreparationError('REPLAY_STALE');
      await flushWorkingSave();
      if (workingRevisionRef.current === undefined) await saveReplayDraft(selectedKeys, input.snapshotToken, input.privacyRevision, timelineDirectionRef.current, musicRef.current, undefined, includedGroupKeysRef.current, autoGroupKeysRef.current);
      else await saveReplayDraft(selectedKeys, input.snapshotToken, input.privacyRevision, timelineDirectionRef.current, musicRef.current, workingRevisionRef.current, includedGroupKeysRef.current, autoGroupKeysRef.current);
      workingRevisionRef.current = undefined;
      setCommittedMemoryKeys(selectedKeys);
      // The committed draft is now the canonical owner composition. Reload it
      // through the owner path so this is durable playback, not the separate
      // short-lived selected-share artifact path.
      await prepare(music);
    } catch (error) {
      const stage = replayFailureStage(error);
      setFailure(stage); setState('failed');
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
      await queueWorkingSave(automatic, 'oldest-first', musicRef.current, includedGroupKeysRef.current, automaticGroups);
    } catch {
      setWorkingSaveState('failed');
    }
  };
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let active = true;
    void loadPreparedReplay().then(async (cached) => {
      if (!active) return;
      if (cached) {
        const current = await loadReplayManifestInput();
        if (!active) return;
        const plan = planPrivateReplay(current.groups, current.memories, undefined, current.direction ?? 'oldest-first', current.autoGroupKeys);
        const working = current.workingDraft;
        workingRevisionRef.current = working?.revision;
        replaceResolvedEditorPreviews(current.memories.filter((memory) => memory.previewUri !== undefined).map((memory) => memory.key)); setEditorPreviewOverrides({}); setEditorPreviewError(false);
        const hydratedIncluded = working?.includedGroupKeys ?? current.includedGroupKeys ?? current.groups.filter((group) => group.eligible).map((group) => group.key);
        setInput(current); setShowSelectedMedia(false); setIncludedGroups(hydratedIncluded); setAutoGroups(working?.autoGroupKeys ?? current.autoGroupKeys ?? hydratedIncluded); setReplayMusic(working?.soundtrack ?? current.soundtrack ?? { kind: 'bundled', revision: 'happy-moments-1.4' }); setReplayTimelineDirection(working?.direction ?? current.direction ?? 'oldest-first'); setEditorSelection(working?.memoryKeys ?? plan.memories.map((memory) => memory.key)); setCommittedMemoryKeys(plan.memories.map((memory) => memory.key)); setEditorManifestReady(plan.groups.length > 0); setActiveGroupKey(plan.groups[0]?.key ?? current.groups[0]?.key ?? null);
        setPreview(cached); setState('preview-ready'); return;
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
    const scheduled = scheduledWorkingSave.current;
    if (scheduled?.timer) clearTimeout(scheduled.timer);
  }, []);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (state === 'editing') {
        void retainWorkingEdits().then((saved) => {
          if (!saved) return;
          setInspectedMemory(null);
          if (editorStage === 'gallery') setEditorStage('overview');
          else { setMusicError(null); setState(editorOrigin); }
        });
        return true;
      }
      if (state === 'share-review') { setMusicError(null); setInspectedMemory(null); setState('preview-ready'); return true; }
      return false;
    });
    return () => subscription.remove();
  // The callback deliberately reads the latest local draft queue when native Back fires.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorOrigin, editorStage, state]);
  useEffect(() => {
    // Android gesture/back and iOS interactive swipe both dispatch
    // `beforeRemove`. Keep the owner in the Replay preview when an optional
    // subflow is open instead of popping the whole Replay route to Atlas.
    return navigation.addListener('beforeRemove', (event) => {
      if (state !== 'editing' && state !== 'share-review') return;
      event.preventDefault();
      if (state === 'editing') void retainWorkingEdits().then((saved) => {
        if (!saved) return;
        setInspectedMemory(null);
        if (editorStage === 'gallery') setEditorStage('overview');
        else { setMusicError(null); setState(editorOrigin); }
      });
      else { setMusicError(null); setInspectedMemory(null); setState('preview-ready'); }
    });
  // The callback deliberately reads the latest local draft queue when native Back fires.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorOrigin, editorStage, navigation, state]);
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
          <Pressable accessibilityRole="button" accessibilityLabel="Back to saved Replay" onPress={() => { void retainWorkingEdits().then((saved) => { if (saved) { setMusicError(null); setState(editorOrigin); } }); }} style={styles.galleryNavAction}><Text style={styles.galleryNavText}>‹ Back</Text></Pressable>
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
              <View style={styles.tripCover}>{cover?.previewUri ? cover.kind === 'video' ? <ReplayVideoPoster uri={cover.previewUri} /> : <Image source={{ uri: cover.previewUri }} style={styles.mediaImage} contentFit="cover" accessibilityLabel="Trip cover" /> : <View style={styles.mediaFallback}><Text style={styles.mediaFallbackText}>TRIP</Text></View>}</View>
              <View style={styles.tripCopy}><Text style={styles.tripOverviewTitle}>{group.label}</Text><Text style={styles.tripChipMeta}>{group.interval?.startDay ?? 'Date unknown'} · {tripMedia.length} media</Text><Text style={styles.tripChipMeta}>{selectedCount} selected{!included ? ' · Not in Replay' : selectedCount ? '' : ' · Trip card only'}</Text>{tripChanged(group.key) && <Text style={styles.editedMark}>Edited</Text>}</View>
              <Text style={styles.tripArrow}>›</Text>
            </Pressable>;
          }}
          ListFooterComponent={<Pressable accessibilityRole="button" accessibilityLabel="Music and Replay order" disabled={recoveringDraft} onPress={() => setShowReplaySettings(true)} style={styles.settingsEntry}><View><Text style={styles.galleryNavText}>Music & order</Text><Text style={styles.tripChipMeta}>{settingsSummary}</Text></View><Text style={styles.tripArrow}>›</Text></Pressable>}
        />
        <View style={styles.gallerySummary}>
          <Body>{input.groups.length} trips · {tripNavigationPending || workingSaveState === 'saving' ? 'Saving changes…' : changed ? 'Draft changes' : 'Choose a trip and make a change to update your Replay.'}</Body>
          {workingSaveState === 'failed' && <ActionButton accessibilityLabel="Retry saving Replay changes" onPress={() => void retryWorkingEdits()} variant="secondary">Couldn’t save changes. Retry</ActionButton>}
          {workingSaveState === 'conflict' && <><Body>{recoveryMessage ?? 'Your choices could not be saved to the current local draft.'}</Body><View style={styles.bulkActions}><ActionButton accessibilityLabel="Use my Replay changes" disabled={recoveringDraft} onPress={() => void applyMineAfterConflict()} variant="secondary">Keep my choices</ActionButton><ActionButton accessibilityLabel="Use latest Replay changes" disabled={recoveringDraft} onPress={discardConflictingSelectionAndReturnToTripOverview} variant="secondary">Restore saved Replay</ActionButton></View></>}
          <ActionButton accessibilityLabel="Update Replay" onPress={saveEdits} disabled={!changed || !editorManifestReady || !includedGroupKeys.length || workingSaveState !== 'idle' || recoveringDraft || Boolean(bulkProgress)}>Update Replay</ActionButton>
        </View>
        <Modal visible={showReplaySettings} animationType="slide" onRequestClose={() => setShowReplaySettings(false)}>
          <SafeAreaView style={styles.editorSafe} edges={['top', 'bottom']}><View style={styles.galleryNavigation}><Pressable accessibilityRole="button" accessibilityLabel="Close Replay settings" disabled={settingsSaving} onPress={() => setShowReplaySettings(false)} style={styles.galleryNavAction}><Text style={styles.galleryNavText}>‹ Back</Text></Pressable><Text style={styles.galleryNavTitle}>Music & order</Text><Pressable accessibilityRole="button" accessibilityLabel="Save music and Replay order" accessibilityState={{ busy: settingsSaving }} disabled={settingsSaving || selectingMusic || recoveringDraft} onPress={() => void finishReplaySettings()} style={styles.galleryNavAction}><Text style={styles.galleryDoneText}>{settingsSaving ? 'Saving…' : 'Done'}</Text></Pressable></View>
          <ScrollView contentContainerStyle={styles.editorListContent}><Body>Background music: {music.kind === 'bundled' ? 'Happy Moments 1.4' : 'Custom audio ready'}</Body>{selectedAudioName && <Body>{audioLoadState === 'loading' ? `Loading audio: ${selectedAudioName}` : audioLoadState === 'loaded' ? `Loaded audio: ${selectedAudioName}` : audioLoadState === 'failed' ? `Couldn’t load audio: ${selectedAudioName}` : `Selected audio: ${selectedAudioName}`}</Body>}{musicError && <Body>{musicError}</Body>}<ActionButton accessibilityLabel="Choose Replay audio file" disabled={selectingMusic || recoveringDraft} onPress={() => void chooseMusic()} variant="secondary">{selectingMusic ? 'Loading audio…' : 'Choose audio file'}</ActionButton><ActionButton accessibilityLabel="Use default Replay music" disabled={selectingMusic || recoveringDraft} onPress={useDefaultMusic} variant="secondary">Use default music</ActionButton><Body>Chapter order: {timelineDirection === 'oldest-first' ? 'Oldest first' : 'Newest first'}.</Body><ActionButton accessibilityLabel="Use oldest-first Replay timeline" onPress={() => applyReplayTimeline('oldest-first')} disabled={timelineDirection === 'oldest-first'} variant="secondary">Oldest first</ActionButton><ActionButton accessibilityLabel="Use newest-first Replay timeline" onPress={() => applyReplayTimeline('newest-first')} disabled={timelineDirection === 'newest-first'} variant="secondary">Newest first</ActionButton><ActionButton accessibilityLabel="Reset Replay edits" onPress={() => void resetEdits()} variant="secondary">Reset automatic selection</ActionButton></ScrollView></SafeAreaView>
        </Modal>
      </SafeAreaView>;
    }
    return <SafeAreaView style={styles.editorSafe} edges={['top', 'bottom']}>
      <View style={styles.galleryNavigation}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to Replay trip overview" onPress={() => void returnToTripOverview()} style={styles.galleryNavAction}><Text style={styles.galleryNavText}>‹ Back</Text></Pressable>
        <Text style={styles.galleryNavTitle}>{activeGroup?.label}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Done editing this trip" accessibilityState={{ busy: tripNavigationPending }} onPress={() => void returnToTripOverview()} style={styles.galleryNavAction}><Text style={styles.galleryDoneText}>{tripNavigationPending ? 'Saving…' : 'Done'}</Text></Pressable>
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
        onEndReached={() => loadNextEditorPreviewPage(tripCandidates)}
        onEndReachedThreshold={0.6}
        columnWrapperStyle={styles.mediaGridRow}
        ListHeaderComponent={<><View style={styles.galleryTabs}><Pressable accessibilityRole="button" accessibilityLabel="Show all media in this trip" accessibilityState={{ selected: !showSelectedMedia }} onPress={() => setShowSelectedMedia(false)} style={[styles.galleryTab, !showSelectedMedia && styles.galleryTabSelected]}><Text style={[styles.galleryTabText, !showSelectedMedia && styles.galleryTabTextSelected]}>All {tripCandidates.length}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Show selected Replay media" accessibilityState={{ selected: showSelectedMedia }} onPress={() => setShowSelectedMedia(true)} style={[styles.galleryTab, showSelectedMedia && styles.galleryTabSelected]}><Text style={[styles.galleryTabText, showSelectedMedia && styles.galleryTabTextSelected]}>Selected {selectedTripMemories.length}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Open trip media actions" onPress={() => setShowTripActions(true)} style={styles.galleryMore}><Text style={styles.galleryMoreText}>•••</Text></Pressable></View></>}
        renderItem={({ item, index }) => <ReplayMediaTile memory={item} index={index} included={editedMemoryKeys.includes(item.key)} disabled={recoveringDraft || !activeTripIncluded || (editorPreviewResolved.has(item.key) && editorPreviewOverrides[item.key]?.available === false)} resolving={resolvingEditorMemoryKeys.has(item.key)} onToggle={(key) => { void toggleEditorMemory(key); }} onInspect={setInspectedMemory} />}
        ListFooterComponent={<><View style={styles.editorFooter}>{hasUnresolvedTripMedia && <ActionButton accessibilityLabel="Load more trip media" onPress={() => loadNextEditorPreviewPage(tripCandidates)} variant="secondary">Load more · {resolvedTripMediaCount} of {tripCandidates.length}</ActionButton>}{editorPreviewError && <ActionButton accessibilityLabel="Retry loading trip media" onPress={() => loadNextEditorPreviewPage(tripCandidates, true)} variant="secondary">Couldn’t load more media. Retry</ActionButton>}{bulkProgress && <View accessibilityRole="progressbar" accessibilityLabel={`Selecting all media ${bulkProgress.total ? Math.round(bulkProgress.completed / bulkProgress.total * 100) : 100}% complete`} accessibilityValue={{ min: 0, max: 100, now: bulkProgress.total ? Math.round(bulkProgress.completed / bulkProgress.total * 100) : 100 }} style={styles.progressBlock}><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${bulkProgress.total ? Math.round(bulkProgress.completed / bulkProgress.total * 100) : 100}%` }]} /></View><Text style={styles.progressText}>{bulkProgress.completed}/{bulkProgress.total}</Text></View>}</View><Modal visible={showTripActions} transparent animationType="slide" onRequestClose={() => setShowTripActions(false)}><View style={styles.inspector}><InsetPanel><Title>{activeGroup?.label}</Title><Body>Trip actions</Body><View style={styles.secondaryControls}><ActionButton accessibilityLabel={activeTripIncluded ? 'Exclude this trip from Replay' : 'Include this trip in Replay'} onPress={() => { toggleActiveTripInclusion(); setShowTripActions(false); }} variant="secondary">{activeTripIncluded ? 'Exclude trip' : 'Include trip'}</ActionButton><ActionButton accessibilityLabel="Restore automatic media in this trip" onPress={() => { restoreAutoInActiveTrip(); setShowTripActions(false); }} disabled={!activeTripIncluded || autoGroupKeys.includes(activeGroup?.key ?? '')} variant="secondary">Restore Auto</ActionButton><ActionButton accessibilityLabel="Undo last trip media change" onPress={() => { undoTripChange(); setShowTripActions(false); }} disabled={!lastTripChange} variant="secondary">Undo</ActionButton><ActionButton accessibilityLabel="Select all media in this trip" onPress={() => { void selectAllInActiveTrip(); setShowTripActions(false); }} disabled={!activeTripIncluded || Boolean(bulkProgress)} variant="secondary">Select all</ActionButton><ActionButton accessibilityLabel="Clear media in this trip" onPress={() => { clearActiveTrip(); setShowTripActions(false); }} disabled={!activeTripIncluded || Boolean(bulkProgress)} variant="secondary">Clear</ActionButton><ActionButton accessibilityLabel="Close trip media actions" onPress={() => setShowTripActions(false)} variant="secondary">Close</ActionButton></View></InsetPanel></View></Modal><Modal visible={Boolean(inspectedMemory)} transparent animationType="slide" onRequestClose={() => setInspectedMemory(null)}><View style={styles.inspector}><InsetPanel><Title>{inspectedMemory?.kind === 'video' ? 'Replay video' : 'Replay photo'}</Title>{inspectedMemory?.previewUri ? inspectedMemory.kind === 'video' ? <ReplaySourceVideo uri={inspectedMemory.previewUri} intendedSeconds={inspectedVideoSeconds} /> : <Image source={{ uri: inspectedMemory.previewUri }} style={styles.inspectorImage} contentFit="contain" accessibilityLabel="Inspected photo" /> : <Body>This local media preview is unavailable.</Body>}<ActionButton accessibilityLabel="Close Replay media inspection" onPress={() => setInspectedMemory(null)} variant="secondary">Back to edit</ActionButton></InsetPanel></View></Modal></>}
      />
      <View accessibilityLabel="Trip selection summary" style={styles.gallerySummary}>
        <Body>{activeTripIncluded ? `${selectedTripMemories.length} selected · about ${estimatedDuration} seconds` : 'Not in Replay. Your choices are retained.'}</Body>
        {tripNavigationPending && <View accessibilityRole="progressbar" accessibilityLabel="Acknowledging trip changes" accessibilityState={{ busy: true }}><Body>Saving your trip changes…</Body></View>}
        {workingSaveState === 'saving' && <View accessibilityRole="progressbar" accessibilityLabel="Saving trip changes" accessibilityState={{ busy: true }}><Body>Saving trip changes…</Body></View>}
        {workingSaveState === 'failed' && <Body>Couldn’t save this trip. Tap Done to retry. Your choices are still here.</Body>}
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
    {state === 'share-review' && preview && input && <InsetPanel><Title>Choose moments to share</Title><Body>Sharing may create a copy outside Travel Life. Only moments in this current private Replay can be selected.</Body>{sharing && <Body>Preparing your selected private Replay.</Body>}{shareCandidates.length === 0 ? <Body>This Replay has no selected media to share. Return to Edit to choose moments.</Body> : <><ActionButton accessibilityLabel="Select all Replay moments for sharing" disabled={sharing} onPress={toggleAllShareMemories} variant="secondary">{shareMemoryKeys.length === shareCandidates.length ? 'Clear all moments' : 'Select all moments'}</ActionButton>{shareCandidates.map((memory, index) => { const selected = shareMemoryKeys.includes(memory.key); return <ActionButton key={memory.key} accessibilityLabel={`${selected ? 'Remove' : 'Select'} ${memory.kind} ${index + 1} for sharing`} disabled={sharing} onPress={() => setShareMemoryKeys((current) => selected ? current.filter((key) => key !== memory.key) : [...current, memory.key])} variant="secondary">{selected ? 'Selected' : 'Select'} {memory.kind} {index + 1}</ActionButton>; })}</>}{exportMessage && <Body>{exportMessage}</Body>}</InsetPanel>}
    {state === 'failed' && <InsetPanel><Title>Replay could not be prepared.</Title><Body>{failure ? failureCopy[failure] : failureCopy.REPLAY_UNAVAILABLE}</Body><Body>Your current private Journey List and attached media were kept unchanged.</Body></InsetPanel>}
    {state === 'share-review' && <Body>{music.kind === 'bundled' ? 'Your exported video includes Happy Moments 1.4 background music.' : 'Your exported video uses your selected custom audio.'}</Body>}
    {state === 'preview-ready' && <ActionButton accessibilityLabel="Choose Replay for sharing" onPress={() => { setShareMemoryKeys([]); setExportMessage(null); setState('share-review'); }}>Share Replay</ActionButton>}
    {state === 'preview-ready' && <ActionButton accessibilityLabel="Re-render private Replay" onPress={() => { if (preview) void discardPrivateReplay(preview.uri).then(() => void prepare()); }} variant="secondary">Re-render Replay</ActionButton>}
    {state === 'preview-ready' && <ActionButton accessibilityLabel="Edit private Replay" onPress={() => { setEditorOrigin('preview-ready'); setEditorStage('overview'); setState('editing'); }} variant="secondary">Edit Replay</ActionButton>}
    {state === 'failed' && input && editorManifestReady && <ActionButton accessibilityLabel="Edit private Replay" onPress={() => { setEditorOrigin('failed'); setEditorStage('overview'); setState('editing'); }} variant="secondary">Edit Replay</ActionButton>}
    {state === 'editing' && <ActionButton accessibilityLabel="Save Replay edits" onPress={() => void saveEdits()} disabled={!editorManifestReady || !editedMemoryKeys.length || !includedGroupKeys.length}>{workingSaveState === 'saving' ? 'Saving…' : 'Done'}</ActionButton>}
    {state === 'editing' && <ActionButton accessibilityLabel="Reset Replay edits" onPress={() => void resetEdits()} variant="secondary">Reset automatic selection</ActionButton>}
    {state === 'editing' && <ActionButton accessibilityLabel="Cancel Replay edits" onPress={() => { void retainWorkingEdits().then((saved) => { if (saved) { setInspectedMemory(null); setState(editorOrigin); } }); }} variant="secondary">Back</ActionButton>}
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
  editorSafe: { flex: 1, backgroundColor: palette.rainforest },
  editorList: { flex: 1 },
  editorListContent: { gap: 12, padding: 20, paddingBottom: 32 },
  editorFooter: { marginTop: 4 },
  previewShell: { width: '100%', aspectRatio: 16 / 9, marginVertical: 12, borderRadius: 12, overflow: 'hidden' },
  preview: { width: '100%', height: '100%' },
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
