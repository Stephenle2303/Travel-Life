import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { ActionButton, Body, Eyebrow, InsetPanel, Title } from './ui';
import type { JourneyPrivacyPolicy, JourneyPrivacyReview } from '@/history-record/privacy';

export function JourneyPrivacyTask({ id, review, save, onBack, onApplied }: {
  id: string; review(id: string): Promise<JourneyPrivacyReview>;
  save(reviewId: string, action: 'hide' | 'exclude', commandKey: string, displayId: string): Promise<void>;
  onBack(): void; onApplied(): void;
}) {
  const [loadedScope, setScope] = useState<{ id: string; scope: JourneyPrivacyReview } | null>(null);
  const scope = loadedScope?.id === id ? loadedScope.scope : null;
  const [confirmation, setConfirmation] = useState<{ reviewId: string; action: 'hide' | 'exclude' } | null>(null);
  const confirm = confirmation?.reviewId === scope?.reviewId ? confirmation?.action ?? null : null;
  const setConfirm = (action: 'hide' | 'exclude' | null) => setConfirmation(action && scope ? { reviewId: scope.reviewId, action } : null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void review(id).then((value) => { if (active) setScope({ id, scope: value }); }).catch(() => { if (active) setMessage('This privacy scope is unavailable. Return to Atlas and reopen the journey.'); });
    return () => { active = false; };
  }, [id, review]);
  const apply = async () => {
    if (!scope || !confirm || busy) return;
    setBusy(true);
    try { await save(scope.reviewId, confirm, `privacy:${Date.now()}:${scope.reviewId}`, id); onApplied(); }
    catch { setMessage('The privacy action could not be verified. Return to Privacy Settings to check the saved scope, or reopen this journey before retrying.'); setConfirm(null); }
    finally { setBusy(false); }
  };
  return <ScrollView accessibilityLabel="Journey privacy" contentContainerStyle={{ gap: 16, paddingBottom: 32 }}>
    <Eyebrow>Private journey · Edit</Eyebrow><Title>Visibility & evidence</Title>
    {scope ? <>
      <Body>{scope.title}</Body>
      <InsetPanel><Title>Hide this journey</Title><Body>Remove this whole journey from Atlas, Timeline, visible totals, Replay and new share selections. Evidence and corrections stay on this device. Restore it in Privacy Settings.</Body>
        {!scope.ownerEntered && <Body>{scope.hideMediaCount ?? scope.supportingPhotoCount + scope.duplicatePhotoCount} reviewed photos or videos, including associated memories and duplicates, stay protected. Shared evidence or memories can also withhold overlapping journeys{scope.affectedJourneyCount ? ` (${scope.affectedJourneyCount} in the current record)` : ''} until you restore this choice.</Body>}
        <ActionButton accessibilityLabel="Hide this journey" onPress={() => setConfirm('hide')} disabled={busy} variant="secondary">Hide this journey</ActionButton></InsetPanel>
      {!scope.ownerEntered && <InsetPanel><Title>Don’t use these photos as evidence of my travels</Title>
        <Body>Reviewed scope: {scope.supportingPhotoCount} supporting photos or videos, plus {scope.duplicatePhotoCount} duplicate photos or videos across {scope.duplicateFamilyCount} verified duplicate families. Only this reviewed scope is excluded from reconstruction and inferred memory membership. New or changed scope stays withheld for review.</Body>
        <Body>The journey is withheld immediately. Exclusion takes effect when local history is next rechecked. Restoring evidence allows the next recheck to use it again.</Body>
        <ActionButton accessibilityLabel="Exclude reviewed travel evidence" onPress={() => setConfirm('exclude')} disabled={busy} variant="secondary">Exclude reviewed evidence</ActionButton></InsetPanel>}
      {scope.ownerEntered && <Body>Owner-entered journeys have no observed evidence to exclude. Use Hide to control this private entry.</Body>}
      <Body>Original photos remain in your library. Existing published snapshots stay unchanged. Copies already exported or saved by others cannot be erased from this device.</Body>
      {confirm && <InsetPanel><Title>{confirm === 'hide' ? 'Hide this whole journey?' : 'Exclude this reviewed scope?'}</Title>
        <Body>{confirm === 'hide' ? 'Keep its evidence and corrections privately for restoration.' : `Do not use these ${scope.supportingPhotoCount + scope.duplicatePhotoCount} reviewed photos or videos as evidence of my travels. Restore this choice in Privacy Settings.`}</Body>
        <ActionButton accessibilityLabel={confirm === 'hide' ? 'Confirm hide journey' : 'Confirm exclude evidence'} onPress={() => void apply()} disabled={busy}>{busy ? 'Saving privately…' : 'Confirm'}</ActionButton>
        <ActionButton accessibilityLabel="Cancel privacy change" onPress={() => setConfirm(null)} disabled={busy} variant="secondary">Cancel</ActionButton></InsetPanel>}
    </> : !message && <Body>Opening reviewed private scope.</Body>}
    {message && <Body>{message}</Body>}
    <ActionButton accessibilityLabel="Return to Edit" onPress={onBack} disabled={busy} variant="secondary">Back</ActionButton>
  </ScrollView>;
}

export function JourneyPrivacyManager({ load, restore }: {
  load?: () => Promise<JourneyPrivacyPolicy[]>;
  restore?: (policyId: string, revision: number, commandKey: string) => Promise<void>;
}) {
  const [policies, setPolicies] = useState<JourneyPrivacyPolicy[]>([]);
  const [selected, setSelected] = useState<JourneyPrivacyPolicy | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    if (load) void load().then((value) => { if (active) { setPolicies(value); setLoadState('ready'); } }).catch(() => { if (active) { setLoadState('failed'); setMessage('Private visibility controls could not load. Reconnect the private record or reload these choices.'); } });
    return () => { active = false; };
  }, [load, reload]);
  const apply = async () => {
    if (!selected || !restore || busy) return;
    setBusy(true);
    try {
      await restore(selected.policyId, selected.revision, `privacy-restore:${Date.now()}:${selected.revision}`);
      setPolicies(await load!()); setSelected(null);
      setMessage('Privacy choice restored. Recheck local history to include restored evidence again. Other privacy choices still apply.');
    } catch { setMessage('Restore could not be verified. Reopen Privacy Settings to review the current saved choice.'); }
    finally { setBusy(false); }
  };
  return <InsetPanel><Title>Hidden journeys & excluded evidence</Title>
    <Body>Reviewed scopes stay protected after changes or ambiguous splits and merges. You can restore the original choice here even when no current journey matches it.</Body>
    {loadState === 'loading' && <Body>Loading private visibility choices…</Body>}
    {loadState === 'ready' && !policies.length && <Body>No hidden journey or excluded evidence scope is listed.</Body>}
    {loadState === 'failed' && <ActionButton accessibilityLabel="Reload privacy choices" onPress={() => { setMessage(null); setLoadState('loading'); setReload((value) => value + 1); }} disabled={busy || !load} variant="secondary">Reload privacy choices</ActionButton>}
    {policies.map((policy) => <InsetPanel key={policy.policyId}><Body>{policy.title}</Body><Body>{policy.action === 'hide' ? 'Hidden journey' : 'Excluded travel evidence'} · Protected reviewed scope{policy.supportingPhotoCount ? ` · ${policy.supportingPhotoCount} photos or videos` : ''}</Body>
      <ActionButton accessibilityLabel={`Restore ${policy.title}`} onPress={() => setSelected(policy)} disabled={busy} variant="secondary">Review restore</ActionButton></InsetPanel>)}
    {selected && <InsetPanel><Title>Restore this privacy choice?</Title><Body>{selected.title}. {selected.action === 'exclude' ? 'The next local recheck may use this reviewed evidence again.' : 'This journey may appear in ordinary private views again.'} This does not publish or change an existing snapshot.</Body>
      <ActionButton accessibilityLabel="Confirm restore privacy choice" onPress={() => void apply()} disabled={busy}>{busy ? 'Restoring privately…' : 'Restore'}</ActionButton>
      <ActionButton accessibilityLabel="Cancel privacy restore" onPress={() => setSelected(null)} disabled={busy} variant="secondary">Cancel</ActionButton></InsetPanel>}
    {message && <Body>{message}</Body>}
  </InsetPanel>;
}
