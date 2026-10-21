import { useEffect, useState } from 'react';
import { ScrollView, TextInput } from 'react-native';

import { ActionButton, Body, Eyebrow, InsetPanel, Title } from '@/components/ui';
import type { JourneyDetail } from '@/reveal/types';
import { searchOwnerPlaces } from '@/reconstruction/owner-place-search';
import { createDiagnosticCorrelationId, recordAppDiagnostic } from '@/diagnostics/app-diagnostics';

export type JourneyEditTask = 'location' | 'name-dates' | 'destinations' | 'photos' | 'accuracy' | 'privacy';
type CorrectionAction = 'confirm' | 'reject' | 'claim' | 'place' | 'split' | 'merge' | 'remove-visit';
type OwnerPlace = NonNullable<JourneyDetail['ownerPlace']>;

const taskCopy: Record<JourneyEditTask, { label: string; description: string }> = {
  location: { label: 'Location', description: 'No location set' },
  'name-dates': { label: 'Name & dates', description: 'Private title and dates' },
  destinations: { label: 'Destinations', description: 'Journey places and boundaries' },
  photos: { label: 'Photos in this trip', description: 'Private memory membership' },
  accuracy: { label: 'Trip accuracy', description: 'Review this inferred journey' },
  privacy: { label: 'Visibility & evidence', description: 'Hide or exclude reviewed travel evidence' },
};

export function JourneyEditHub({ id, load, onBack, onTask }: { id: string; load(id: string): Promise<{ detail: JourneyDetail }>; onBack(): void; onTask(task: JourneyEditTask): void }) {
  const [loaded, setLoaded] = useState<{ id: string; detail?: JourneyDetail; error?: string } | null>(null);
  useEffect(() => { let active = true; void load(id).then((result) => { if (active) setLoaded({ id, detail: result.detail }); }).catch(() => { if (active) setLoaded({ id, error: 'This private journey is unavailable. Return to Atlas and choose it again.' }); }); return () => { active = false; }; }, [id, load]);
  const current = loaded?.id === id ? loaded : null;
  if (current?.error) return <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 32 }} accessibilityLabel="Edit private journey"><Eyebrow>Private journey</Eyebrow><Title>Edit unavailable</Title><Body>{current.error}</Body><ActionButton accessibilityLabel="Return to selected journey" onPress={onBack} variant="secondary">Back</ActionButton></ScrollView>;
  if (!current?.detail) return <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 32 }} accessibilityLabel="Edit private journey"><Eyebrow>Private journey</Eyebrow><Title>Edit</Title><Body>Opening this private journey.</Body></ScrollView>;
  const detail = current.detail;
  return <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 32 }} accessibilityLabel="Edit private journey">
    <Eyebrow>Private journey</Eyebrow><Title>Edit</Title><Body>{detail.title}</Body>
    {(Object.keys(taskCopy) as JourneyEditTask[]).filter((task) => !detail.ownerEntered || task === 'privacy').map((task) => <InsetPanel key={task}><Title>{taskCopy[task].label}</Title><Body>{task === 'location' && detail.ownerPlace ? `${detail.ownerPlace.name} · ${detail.ownerPlace.context}` : taskCopy[task].description}</Body><ActionButton accessibilityLabel={`Edit ${taskCopy[task].label}`} onPress={() => onTask(task)} variant="secondary">Open</ActionButton></InsetPanel>)}
    <ActionButton accessibilityLabel="Return to selected journey" onPress={onBack} variant="secondary">Back</ActionButton>
  </ScrollView>;
}

export function JourneyLocationTask({ id, load, save, retryProjection, onBack, onApplied }: { id: string; load(id: string): Promise<{ detail: JourneyDetail; snapshotToken: number }>; save(id: string, action: CorrectionAction, snapshotToken: number, snapshot: JourneyDetail, commandKey: string, payload?: OwnerPlace): Promise<'applied' | 'pending'>; retryProjection(): Promise<boolean>; onBack(): void; onApplied(): void }) {
  const [loaded, setLoaded] = useState<{ detail: JourneyDetail; snapshotToken: number } | null>(null);
  const [query, setQuery] = useState('');
  const [place, setPlace] = useState<OwnerPlace | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => { let active = true; void load(id).then((result) => { if (active) setLoaded(result); }).catch(() => { if (active) setStatus('This private journey is no longer available. Return to Atlas and choose it again.'); }); return () => { active = false; }; }, [id, load]);
  const choose = (next: OwnerPlace) => { setPlace(next); setQuery(`${next.name} · ${next.context}`); setStatus(null); };
  const apply = async () => {
    if (!loaded || !place) return;
    setSaving(true); setStatus(null);
    try {
      const outcome = await save(id, 'place', loaded.snapshotToken, loaded.detail, `journey:${id}:${loaded.snapshotToken}:place:${place.id}:${Date.now()}`, place);
      if (outcome === 'applied') { setStatus(`Confirmed place applied: ${place.name}.`); onApplied(); }
      else setStatus('The place was saved locally but has not been verified in this trip yet. Retry the local update; Atlas will not report it as applied.');
    } catch {
      recordAppDiagnostic({ operation: 'JOURNEY_PLACE_SAVE', reasonCode: 'SAVE_FAILED', stage: null, retryable: true, durableOutcome: 'unchanged', correlationId: createDiagnosticCorrelationId() });
      setStatus('Could not save this place. Your prior journey remains available. Retry when ready.');
    }
    finally { setSaving(false); }
  };
  const retry = async () => { setSaving(true); try { const rebuilt = await retryProjection(); setStatus(rebuilt ? 'The local update finished. Reload this trip to verify the chosen place before Atlas reports it as applied.' : 'The local update did not finish. The prior view remains available.'); } catch { setStatus('The local update could not be verified. The prior view remains available.'); } finally { setSaving(false); } };
  const results = place ? [] : searchOwnerPlaces(query);
  return <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="always" accessibilityLabel="Edit trip location">
    <Eyebrow>Private journey · Edit</Eyebrow><Title>Location</Title><Body>Choose a private display place. This does not change inferred evidence or make photo location proof of presence.</Body>
    <InsetPanel><TextInput accessibilityLabel="Search a place to confirm" value={query} onChangeText={(value) => { setQuery(value); setPlace(null); setStatus(null); }} placeholder="Search places, for example Phú Quốc or Tokyo" placeholderTextColor="#B4C6B5" autoCorrect={false} style={{ color: '#F3EEDD', borderColor: '#B4C6B5', borderWidth: 1, borderRadius: 12, minHeight: 48, paddingHorizontal: 12 }} />
      {results.map((result) => <ActionButton key={result.id} accessibilityLabel={`Select place ${result.name}`} onPress={() => choose({ id: result.id, name: result.name, context: result.context, anchor: { latitude: result.latitude, longitude: result.longitude } })} variant="secondary">{result.name} · {result.context}</ActionButton>)}
      {!!query.trim() && !place && !results.length && <Body>No local place result. Try a broader name or alternate spelling.</Body>}
      {place && <><Body>Selected: {place.name} · {place.context}</Body><ActionButton accessibilityLabel="Confirm place" onPress={() => void apply()} disabled={saving}>{saving ? 'Saving privately…' : 'Confirm place'}</ActionButton><ActionButton accessibilityLabel="Choose another place" onPress={() => { setPlace(null); setQuery(''); }} disabled={saving} variant="secondary">Choose another place</ActionButton></>}
    </InsetPanel>
    {status && <InsetPanel><Body>{status}</Body>{status.includes('not been verified') || status.includes('still not verified') ? <ActionButton accessibilityLabel="Retry local correction update" onPress={() => void retry()} disabled={saving}>{saving ? 'Retrying local update…' : 'Retry local update'}</ActionButton> : null}</InsetPanel>}
    <ActionButton accessibilityLabel="Return to Edit" onPress={onBack} variant="secondary">Back</ActionButton>
  </ScrollView>;
}

export function JourneyEditTaskScreen({ task, onBack }: { task: Exclude<JourneyEditTask, 'location'>; onBack(): void }) {
  const copy = taskCopy[task];
  return <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 32 }} accessibilityLabel={`Edit trip ${copy.label}`}><Eyebrow>Private journey · Edit</Eyebrow><Title>{copy.label}</Title><InsetPanel><Body>{copy.description}</Body><Body>This focused task keeps drafts isolated. Existing review controls remain available only in their relevant private correction flow while this task is completed.</Body></InsetPanel><ActionButton accessibilityLabel="Return to Edit" onPress={onBack} variant="secondary">Back</ActionButton></ScrollView>;
}
