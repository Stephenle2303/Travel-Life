import { useEffect, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { Image } from 'expo-image';

import { ActionButton, Body, Eyebrow, InsetPanel, Title } from '@/components/ui';
import type { JourneyDetail } from '@/reveal/types';
import type { OwnerPreview } from '@/photo-access/types';

type OwnerClaim = NonNullable<JourneyDetail['ownerClaim']>;
type StructuralSplit = { afterVisitId: string };
type StructuralMerge = { withJourneyId: string };
type VisitRemoval = { visitId: string };
type JourneyCorrectionAction = 'confirm' | 'reject' | 'claim' | 'split' | 'merge' | 'remove-visit';
type ClaimDraft = { title: string; dateMode: 'exact' | 'approximate'; exactDay: string; startDay: string; endDay: string };
type MemoryAction = 'assign' | 'move' | 'reject' | 'unassign';
type UncertainMemory = { id: string; capturedDay: string | null; availability: 'available' | 'unavailable' | 'unknown'; locationState: string; association: string; membershipState: 'suggested' | 'primary' | 'unassigned' | 'rejected' };
type LoadedCorrection = { detail: JourneyDetail; previews: OwnerPreview[]; snapshotToken: number; draft: ClaimDraft };

function claimDraft(detail: JourneyDetail): ClaimDraft {
  const claim = detail.ownerClaim;
  return {
    title: claim?.title ?? '', dateMode: claim?.date.kind ?? 'exact',
    exactDay: claim?.date.kind === 'exact' ? claim.date.day : '',
    startDay: claim?.date.kind === 'approximate' ? claim.date.startDay : '',
    endDay: claim?.date.kind === 'approximate' ? claim.date.endDay : '',
  };
}

function asClaim(draft: ClaimDraft): OwnerClaim | null {
  const title = draft.title.trim();
  if (!title || title.length > 120) return null;
  if (draft.dateMode === 'exact') return draft.exactDay ? { title, date: { kind: 'exact', day: draft.exactDay } } : null;
  return draft.startDay && draft.endDay ? { title, date: { kind: 'approximate', startDay: draft.startDay, endDay: draft.endDay } } : null;
}

function ownerClaimPreview(claim: OwnerClaim | undefined, observedSpan: string) {
  if (!claim) return `Owner claim details are unavailable. Observed evidence remains: ${observedSpan}.`;
  const date = claim.date.kind === 'exact' ? claim.date.day : `${claim.date.startDay} to ${claim.date.endDay} (approximate)`;
  return `Owner title: ${claim.title}. Owner date: ${date}. Observed evidence remains: ${observedSpan}.`;
}

export function JourneyCorrectionScreen({ id, load, save, saveMemory, loadUncertainMemories, discardPendingRemap, retryProjection, onBack, onRejected }: { id: string; load(id: string): Promise<{ detail: JourneyDetail; previews: OwnerPreview[]; snapshotToken: number }>; save(id: string, action: JourneyCorrectionAction, snapshotToken: number, snapshot: JourneyDetail, commandKey: string, payload?: OwnerClaim | StructuralSplit | StructuralMerge | VisitRemoval): Promise<'applied' | 'pending'>; saveMemory?(id: string, memoryId: string, action: MemoryAction, snapshotToken: number, commandKey: string): Promise<'applied' | 'pending'>; loadUncertainMemories?(id: string, snapshotToken: number, query: string, page: number): Promise<{ memories: UncertainMemory[]; hasMore: boolean }>; discardPendingRemap?(id: string, snapshotToken: number, commandKey: string): Promise<'applied' | 'pending'>; retryProjection(): Promise<boolean>; onBack(): void; onRejected(): void }) {
  const [state, setState] = useState<{ id: string; result?: LoadedCorrection; error?: string } | null>(null);
  const [preview, setPreview] = useState<{ id: string; action: JourneyCorrectionAction; commandKey: string; payload?: OwnerClaim | StructuralSplit | StructuralMerge | VisitRemoval } | null>(null);
  const [selection, setSelection] = useState<{ id: string; action: JourneyCorrectionAction; applied: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [memoryPreview, setMemoryPreview] = useState<{ memoryId: string; action: MemoryAction; commandKey: string } | null>(null);
  const [memorySaved, setMemorySaved] = useState<string | null>(null);
  const [discardPreview, setDiscardPreview] = useState<{ commandKey: string } | null>(null);
  const [pendingDiscarded, setPendingDiscarded] = useState(false);
  const [uncertain, setUncertain] = useState<{ query: string; page: number; memories: UncertainMemory[]; hasMore: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    void load(id)
      .then((result) => { if (active) setState({ id, result: { ...result, draft: claimDraft(result.detail) } }); })
      .catch(() => { if (active) setState({ id, error: 'This private review cannot continue. Return to the Atlas and choose a fresh local record.' }); });
    return () => { active = false; };
  }, [id, load]);

  const current = state?.id === id ? state : null;
  if (current?.error) return <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 32 }} accessibilityLabel="Journey correction review"><Title>Review unavailable</Title><InsetPanel><Body>{current.error}</Body></InsetPanel><ActionButton accessibilityLabel="Return to journey detail" onPress={onBack}>Return to journey</ActionButton></ScrollView>;
  if (!current?.result) return <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 32 }} accessibilityLabel="Journey correction review"><Title>Preparing review</Title><Body>Loading the selected private record and the visible evidence set.</Body></ScrollView>;

  const { detail, previews, draft } = current.result;
  const snapshotToken = current.result.snapshotToken;
  const updateDraft = (next: Partial<ClaimDraft>) => setState((previous) => previous?.id === id && previous.result ? { ...previous, result: { ...previous.result, draft: { ...previous.result.draft, ...next } } } : previous);
  const persist = async (action: JourneyCorrectionAction, commandKey: string, payload?: OwnerClaim | StructuralSplit | StructuralMerge | VisitRemoval) => {
    setSaving(true); setSaveError(null);
    try {
      const projection = action === 'claim' || action === 'split' || action === 'merge' || action === 'remove-visit'
        ? await save(id, action, snapshotToken, detail, commandKey, payload)
        : await save(id, action, snapshotToken, detail, commandKey);
      setSelection({ id, action, applied: projection === 'applied' });
      setPreview(null);
    }
    catch { setSaveError('The save could not be confirmed. Reload this private journey before retrying; do not assume the decision was or was not saved.'); }
    finally { setSaving(false); }
  };
  const retry = async () => {
    setRetrying(true); setSaveError(null);
    try {
      const applied = await retryProjection();
      if (!applied) {
        setSaveError('The saved decision is still not reflected in the journey. Your previous complete view remains available.');
        return;
      }
      setSelection((previous) => previous?.id === id ? { ...previous, applied: true } : previous);
    } catch {
      setSaveError('The saved decision is still not reflected in the journey. Your previous complete view remains available.');
    } finally { setRetrying(false); }
  };
  const persistMemory = async () => {
    if (!memoryPreview || !saveMemory) return;
    setSaving(true); setSaveError(null);
    try {
      const result = await saveMemory(id, memoryPreview.memoryId, memoryPreview.action, snapshotToken, memoryPreview.commandKey);
      setMemorySaved(result === 'applied' ? 'Memory membership saved locally and applied to this complete reconstruction.' : 'Memory membership is saved locally; the prior complete view remains until its rebuild finishes.');
      setMemoryPreview(null);
    } catch { setSaveError('The memory decision could not be confirmed. Reload this private journey before retrying.'); }
    finally { setSaving(false); }
  };
  const discard = async () => {
    if (!discardPreview || !discardPendingRemap) return;
    setSaving(true); setSaveError(null);
    try {
      const result = await discardPendingRemap(id, snapshotToken, discardPreview.commandKey);
      setPendingDiscarded(result === 'applied');
      setDiscardPreview(null);
    } catch { setSaveError('The pending correction could not be discarded. Reload this private journey before retrying.'); }
    finally { setSaving(false); }
  };
  const loadUncertain = async (query: string, page: number) => {
    if (!loadUncertainMemories) return;
    setSaveError(null);
    try {
      const result = await loadUncertainMemories(id, snapshotToken, query, page);
      setUncertain({ query, page, memories: result.memories, hasMore: result.hasMore });
    } catch { setSaveError('Uncertain memories could not be loaded. Reload this private journey before retrying.'); }
  };
  return (
    <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 32 }} accessibilityLabel="Journey correction review">
      <Eyebrow>Private review</Eyebrow>
      <Title>{detail.title}</Title>
      <InsetPanel>
        <Body>Review state: {detail.correctionState === 'confirmed' ? 'Confirmed by you' : detail.correctionState === 'rejected' ? 'Rejected by you' : detail.correctionState === 'pending remap' ? 'Pending your remap review' : detail.correctionState === 'pending scope review' ? 'Pending scope review after a structural correction' : 'Inferred; not yet reviewed'}</Body>
        <Body>{detail.observedSpan}</Body>
        <Body>Owner corrections stay on device. They never upload the source media, and they never turn a photo&apos;s location into proof of presence.</Body>
      </InsetPanel>
      {detail.correctionState === 'pending scope review' && <InsetPanel>
        <Title>Review predecessor claims</Title>
        <Body>A prior journey-wide confirmation or owner title/date is not applied to this successor. Review and save a new scoped claim or confirmation if it belongs here.</Body>
      </InsetPanel>}
      {detail.correctionState === 'pending remap' && <InsetPanel>
        <Title>Review withheld correction</Title>
        <Body>{detail.pendingRemap?.reason ?? 'The previous correction did not map uniquely to this rebuilt journey.'}</Body>
        <Body>Save a new scoped correction if it belongs to this journey, or preview discarding the withheld correction. It will remain private until you choose.</Body>
        {!!discardPendingRemap && <ActionButton accessibilityLabel="Preview discard pending correction" onPress={() => { setDiscardPreview({ commandKey: `journey:${id}:${snapshotToken}:discard-pending-remap:${Date.now()}` }); setSaveError(null); }} disabled={saving || pendingDiscarded} variant="secondary">Preview discard pending correction</ActionButton>}
      </InsetPanel>}
      <InsetPanel>
        <Title>Owner title and date claim</Title>
        <Body>These are your private claims, separate from the observed evidence shown below. An approximate interval does not describe a route or observed departure and return times.</Body>
        <TextInput accessibilityLabel="Owner journey title" value={draft.title} onChangeText={(title) => updateDraft({ title })} placeholder="Private journey title" placeholderTextColor="#B4C6B5" style={{ color: '#F3EEDD', borderColor: '#B4C6B5', borderWidth: 1, borderRadius: 12, minHeight: 48, paddingHorizontal: 12 }} />
        <ActionButton accessibilityLabel="Use exact owner date" onPress={() => updateDraft({ dateMode: 'exact' })} accessibilityState={{ selected: draft.dateMode === 'exact' }} variant="secondary">Exact day</ActionButton>
        <ActionButton accessibilityLabel="Use approximate owner date" onPress={() => updateDraft({ dateMode: 'approximate' })} accessibilityState={{ selected: draft.dateMode === 'approximate' }} variant="secondary">Approximate interval</ActionButton>
        {draft.dateMode === 'exact'
          ? <TextInput accessibilityLabel="Owner exact date" value={draft.exactDay} onChangeText={(exactDay) => updateDraft({ exactDay })} placeholder="YYYY-MM-DD" placeholderTextColor="#B4C6B5" style={{ color: '#F3EEDD', borderColor: '#B4C6B5', borderWidth: 1, borderRadius: 12, minHeight: 48, paddingHorizontal: 12 }} />
          : <><TextInput accessibilityLabel="Owner approximate start date" value={draft.startDay} onChangeText={(startDay) => updateDraft({ startDay })} placeholder="Start YYYY-MM-DD" placeholderTextColor="#B4C6B5" style={{ color: '#F3EEDD', borderColor: '#B4C6B5', borderWidth: 1, borderRadius: 12, minHeight: 48, paddingHorizontal: 12 }} /><TextInput accessibilityLabel="Owner approximate end date" value={draft.endDay} onChangeText={(endDay) => updateDraft({ endDay })} placeholder="End YYYY-MM-DD" placeholderTextColor="#B4C6B5" style={{ color: '#F3EEDD', borderColor: '#B4C6B5', borderWidth: 1, borderRadius: 12, minHeight: 48, paddingHorizontal: 12 }} /></>}
        <ActionButton accessibilityLabel="Preview owner title and date claim" onPress={() => {
          const claim = asClaim(draft);
          if (!claim) { setSaveError('Enter a private title and a complete owner date before previewing the claim.'); return; }
          setPreview({ id, action: 'claim', payload: claim, commandKey: `journey:${id}:${snapshotToken}:claim:${Date.now()}` }); setSaveError(null);
        }} disabled={saving}>Preview owner claim</ActionButton>
      </InsetPanel>
      <InsetPanel>
        <Title>Review choices</Title>
        <ActionButton accessibilityLabel="Preview confirmation" onPress={() => { setPreview({ id, action: 'confirm', commandKey: `journey:${id}:${snapshotToken}:confirm:${Date.now()}` }); setSaveError(null); }} disabled={saving}>Preview confirmation</ActionButton>
        <ActionButton accessibilityLabel="Preview rejection" onPress={() => { setPreview({ id, action: 'reject', commandKey: `journey:${id}:${snapshotToken}:reject:${Date.now()}` }); setSaveError(null); }} disabled={saving} variant="secondary">Preview rejection</ActionButton>
      </InsetPanel>
      {detail.visits.length > 1 && <InsetPanel>
        <Title>Separate this journey</Title>
        <Body>Choose a boundary only where both adjacent visits have a strict observed order. This creates two private successor journeys and does not change source evidence.</Body>
        {detail.visits.slice(0, -1).map((visit, index) => <ActionButton key={visit.id} accessibilityLabel={`Preview split after ${visit.label}`} onPress={() => { setPreview({ id, action: 'split', payload: { afterVisitId: visit.id }, commandKey: `journey:${id}:${snapshotToken}:split:${visit.id}:${Date.now()}` }); setSaveError(null); }} disabled={saving} variant="secondary">Separate after visit {index + 1}</ActionButton>)}
      </InsetPanel>}
      {!!detail.mergeCandidates?.length && <InsetPanel>
        <Title>Merge adjacent journey</Title>
        <Body>Choose a nearby private journey to preview. Saving is allowed only when both journeys are adjacent and strictly ordered.</Body>
        {detail.mergeCandidates.map((candidate) => <ActionButton key={candidate.id} accessibilityLabel={`Preview merge with ${candidate.label}`} onPress={() => { setPreview({ id, action: 'merge', payload: { withJourneyId: candidate.id }, commandKey: `journey:${id}:${snapshotToken}:merge:${candidate.id}:${Date.now()}` }); setSaveError(null); }} disabled={saving} variant="secondary">Preview merge with {candidate.label}</ActionButton>)}
      </InsetPanel>}
      {preview?.id === id && <InsetPanel>
        <Title>{preview.action === 'confirm' ? 'Preview confirmation' : preview.action === 'reject' ? 'Preview rejection' : preview.action === 'remove-visit' ? 'Preview destination removal' : preview.action === 'split' ? 'Preview journey split' : preview.action === 'merge' ? 'Preview journey merge' : 'Preview owner claim'}</Title>
        <Body>{preview.action === 'confirm'
          ? `This records only the facts currently shown: ${detail.title}, ${detail.visits.length} observed visit${detail.visits.length === 1 ? '' : 's'}, and ${detail.memories.length} visible ${detail.memories.length === 1 ? 'memory' : 'memories'}. New or unseen evidence stays inferred.`
          : preview.action === 'reject'
            ? `This rejects only the current grouping of ${detail.visits.length} observed visit${detail.visits.length === 1 ? '' : 's'}. Source photos and independently supported visits are retained.`
            : preview.action === 'remove-visit'
              ? 'This removes only the selected destination from this journey projection. Its source evidence, visit support, place, and country count remain available.'
            : preview.action === 'split'
              ? 'This records a private boundary after the selected strictly ordered visit. The rebuilt successors remain evidence-based and predecessor-wide claims require fresh review.'
              : preview.action === 'merge'
                ? 'This records a private relationship between two strictly ordered adjacent journeys. The merged successor remains evidence-based and predecessor-wide claims require fresh review.'
              : ownerClaimPreview(preview.payload as OwnerClaim | undefined, detail.observedSpan)}</Body>
        <Body>The preview is tied to the loaded local reconstruction. If that reconstruction changes before saving, the save will be refused.</Body>
        <ActionButton accessibilityLabel={preview.action === 'confirm' ? 'Save confirmation' : preview.action === 'reject' ? 'Save rejection' : preview.action === 'remove-visit' ? 'Save destination removal' : preview.action === 'split' ? 'Save journey split' : preview.action === 'merge' ? 'Save journey merge' : 'Save owner title and date claim'} onPress={() => void persist(preview.action, preview.commandKey, preview.payload)} disabled={saving}>
          {saving ? 'Saving privately…' : preview.action === 'confirm' ? 'Save confirmation' : preview.action === 'reject' ? 'Save rejection' : preview.action === 'remove-visit' ? 'Save destination removal' : preview.action === 'split' ? 'Save journey split' : preview.action === 'merge' ? 'Save journey merge' : 'Save owner claim'}
        </ActionButton>
        <ActionButton accessibilityLabel="Cancel decision preview" onPress={() => setPreview(null)} disabled={saving} variant="secondary">Cancel</ActionButton>
      </InsetPanel>}
      {discardPreview && <InsetPanel>
        <Title>Preview discard pending correction</Title>
        <Body>This permanently abandons the withheld private correction. It does not delete source evidence, observed visits, places, memories, or a newer correction you save separately.</Body>
        <Body>The preview is tied to the loaded local reconstruction. A stale or disconnected save is refused.</Body>
        <ActionButton accessibilityLabel="Discard pending correction" onPress={() => void discard()} disabled={saving}>{saving ? 'Discarding privately…' : 'Discard pending correction'}</ActionButton>
        <ActionButton accessibilityLabel="Cancel pending correction discard" onPress={() => setDiscardPreview(null)} disabled={saving} variant="secondary">Cancel</ActionButton>
      </InsetPanel>}
      {memoryPreview && <InsetPanel>
        <Title>Preview memory membership</Title>
        <Body>{memoryPreview.action === 'assign' ? 'This assigns the selected memory as this journey’s one accepted primary membership.' : memoryPreview.action === 'move' ? 'This moves the selected memory’s accepted primary membership to this journey in one local save.' : memoryPreview.action === 'reject' ? 'This rejects only the selected memory suggestion for this journey.' : 'This leaves the selected memory unassigned from this journey.'} It does not add visit, place, country, or owner-presence support.</Body>
        <Body>The preview is tied to the loaded local reconstruction. A stale or disconnected save is refused.</Body>
        <ActionButton accessibilityLabel="Save memory membership" onPress={() => void persistMemory()} disabled={saving}>{saving ? 'Saving privately…' : 'Save memory membership'}</ActionButton>
        <ActionButton accessibilityLabel="Cancel memory membership preview" onPress={() => setMemoryPreview(null)} disabled={saving} variant="secondary">Cancel</ActionButton>
      </InsetPanel>}
      {selection?.id === id && <InsetPanel>
        <Title>{selection.action === 'confirm' ? 'Confirmation saved' : selection.action === 'reject' ? 'Rejection saved' : selection.action === 'remove-visit' ? 'Destination removal saved' : selection.action === 'split' ? 'Journey split saved' : selection.action === 'merge' ? 'Journey merge saved' : 'Owner claim saved'}</Title>
        <Body>{selection.applied
          ? selection.action === 'confirm'
            ? 'Your decision is saved locally and applied to this complete reconstruction. Unseen evidence and later additions remain inferred.'
            : selection.action === 'reject'
              ? 'Your decision is saved locally and this grouping is removed from the updated projection. Source evidence remains available.'
              : selection.action === 'remove-visit'
                ? 'The destination is removed from this journey projection. Source evidence and support counts remain available.'
              : selection.action === 'split'
                ? 'Your private boundary is saved locally and the rebuilt successor journeys are ready for review. Source evidence remains unchanged.'
                : selection.action === 'merge'
                  ? 'Your private merge is saved locally and the rebuilt successor journey is ready for review. Source evidence remains unchanged.'
              : 'Your private title and date claim are saved locally and applied to this complete reconstruction. Observed evidence remains separate.'
          : 'Your decision is saved locally, but the previous complete journey view is still shown because the rebuild did not finish. It has not been presented as applied.'}</Body>
        {!selection.applied && <ActionButton accessibilityLabel="Retry local correction update" onPress={() => void retry()} disabled={retrying}>{retrying ? 'Retrying local update…' : 'Retry local update'}</ActionButton>}
        {selection.applied && selection.action === 'reject' && <ActionButton accessibilityLabel="Return to private Atlas" onPress={onRejected}>Return to private Atlas</ActionButton>}
      </InsetPanel>}
      {saveError && <InsetPanel><Body>{saveError}</Body></InsetPanel>}
      <InsetPanel>
        <Title>Observed visits</Title>
        {detail.visits.map((visit, index) => <View key={visit.id} style={{ gap: 8 }}><Body>{visit.label} · {visit.precision}. {visit.support}</Body><ActionButton accessibilityLabel={`Preview removal of visit ${index + 1}`} onPress={() => { setPreview({ id, action: 'remove-visit', payload: { visitId: visit.id }, commandKey: `journey:${id}:${snapshotToken}:remove-visit:${visit.id}:${Date.now()}` }); setSaveError(null); }} disabled={saving} variant="secondary">Remove this destination</ActionButton></View>)}
      </InsetPanel>
      <InsetPanel>
        <Title>Memories</Title>
        {detail.memories.map((memory, index) => {
          const preview = previews[index];
          return <View key={memory.id} style={{ gap: 8 }}>
            {preview?.uri ? <Image source={{ uri: preview.uri }} style={{ height: 110, borderRadius: 12 }} accessibilityLabel="Private memory preview" cachePolicy="memory" allowDownscaling priority="low" /> : <Body>Memory unavailable</Body>}
            <Body>{memory.association}</Body>
            {saveMemory && <View style={{ gap: 8 }}>
              {memory.membershipState === 'primary'
                ? <ActionButton accessibilityLabel={`Preview unassign ${memory.id}`} onPress={() => setMemoryPreview({ memoryId: memory.id, action: 'unassign', commandKey: `memory:${id}:${snapshotToken}:${memory.id}:unassign:${Date.now()}` })} disabled={saving}>Preview unassign</ActionButton>
                : <>
                  <ActionButton accessibilityLabel={`Preview assign ${memory.id}`} onPress={() => setMemoryPreview({ memoryId: memory.id, action: 'assign', commandKey: `memory:${id}:${snapshotToken}:${memory.id}:assign:${Date.now()}` })} disabled={saving || memory.availability !== 'available'}>Preview assign</ActionButton>
                  <ActionButton accessibilityLabel={`Preview move ${memory.id}`} onPress={() => setMemoryPreview({ memoryId: memory.id, action: 'move', commandKey: `memory:${id}:${snapshotToken}:${memory.id}:move:${Date.now()}` })} disabled={saving || memory.availability !== 'available'} variant="secondary">Preview move here</ActionButton>
                  {memory.membershipState === 'suggested' && <ActionButton accessibilityLabel={`Preview reject ${memory.id}`} onPress={() => setMemoryPreview({ memoryId: memory.id, action: 'reject', commandKey: `memory:${id}:${snapshotToken}:${memory.id}:reject:${Date.now()}` })} disabled={saving} variant="secondary">Preview reject suggestion</ActionButton>}
                </>}
            </View>}
          </View>;
        })}
        {!!loadUncertainMemories && <ActionButton accessibilityLabel="Review uncertain memories" onPress={() => void loadUncertain('', 0)} disabled={saving} variant="secondary">Review uncertain memories</ActionButton>}
      </InsetPanel>
      {uncertain && <InsetPanel>
        <Title>Uncertain memories</Title>
        <Body>Review a bounded private page. Search matches the observed date only; it never searches or sends source media.</Body>
        <TextInput accessibilityLabel="Search uncertain memories by observed date" value={uncertain.query} onChangeText={(query) => setUncertain({ ...uncertain, query })} placeholder="YYYY-MM-DD" placeholderTextColor="#B4C6B5" style={{ color: '#F3EEDD', borderColor: '#B4C6B5', borderWidth: 1, borderRadius: 12, minHeight: 48, paddingHorizontal: 12 }} />
        <ActionButton accessibilityLabel="Search uncertain memories" onPress={() => void loadUncertain(uncertain.query, 0)} disabled={saving} variant="secondary">Search</ActionButton>
        {uncertain.memories.map((memory) => <View key={memory.id} style={{ gap: 8 }}>
          <Body>{memory.capturedDay ?? 'Date unknown'} · {memory.locationState}. {memory.association}</Body>
          {memory.membershipState === 'primary'
            ? <ActionButton accessibilityLabel={`Preview unassign ${memory.id}`} onPress={() => setMemoryPreview({ memoryId: memory.id, action: 'unassign', commandKey: `memory:${id}:${snapshotToken}:${memory.id}:unassign:${Date.now()}` })} disabled={saving}>Preview unassign</ActionButton>
            : <><ActionButton accessibilityLabel={`Preview assign ${memory.id}`} onPress={() => setMemoryPreview({ memoryId: memory.id, action: 'assign', commandKey: `memory:${id}:${snapshotToken}:${memory.id}:assign:${Date.now()}` })} disabled={saving || memory.availability !== 'available'}>Preview assign</ActionButton><ActionButton accessibilityLabel={`Preview move ${memory.id}`} onPress={() => setMemoryPreview({ memoryId: memory.id, action: 'move', commandKey: `memory:${id}:${snapshotToken}:${memory.id}:move:${Date.now()}` })} disabled={saving || memory.availability !== 'available'} variant="secondary">Preview move here</ActionButton>{memory.membershipState === 'suggested' && <ActionButton accessibilityLabel={`Preview reject ${memory.id}`} onPress={() => setMemoryPreview({ memoryId: memory.id, action: 'reject', commandKey: `memory:${id}:${snapshotToken}:${memory.id}:reject:${Date.now()}` })} disabled={saving} variant="secondary">Preview reject suggestion</ActionButton>}</>}
        </View>)}
        {uncertain.hasMore && <ActionButton accessibilityLabel="Load more uncertain memories" onPress={() => void loadUncertain(uncertain.query, uncertain.page + 1)} disabled={saving} variant="secondary">Load more</ActionButton>}
      </InsetPanel>}
      {memorySaved && <InsetPanel><Body>{memorySaved}</Body></InsetPanel>}
      {pendingDiscarded && <InsetPanel><Title>Pending correction discarded</Title><Body>The withheld correction is removed locally. Source evidence and the current complete journey projection remain available.</Body></InsetPanel>}
      {!!detail.uncertainty.length && <InsetPanel>
        <Title>Uncertainty</Title>
        {detail.uncertainty.map((item) => <Body key={item}>{item}</Body>)}
      </InsetPanel>}
      {selection?.id !== id || selection.action !== 'reject' || !selection.applied
        ? <ActionButton accessibilityLabel="Return to journey detail" onPress={onBack} variant="secondary">Return to journey</ActionButton>
        : null}
    </ScrollView>
  );
}
