import { useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import { ActionButton, Body, InsetPanel, Title, palette } from '@/components/ui';
import { LocalTripMediaCover } from '@/components/local-trip-media-cover';
import { createDiagnosticCorrelationId } from '@/diagnostics/app-diagnostics';
import type { OwnerPreview } from '@/photo-access/types';
import type { JourneyDetail, JourneyMergePair, RevealJourney } from '@/reveal/types';

type Evidence = { detail: JourneyDetail; previews: OwnerPreview[]; snapshotToken?: number };
export type ConfirmTimelineMerge = (pair: JourneyMergePair, detail: JourneyDetail, command: string) => Promise<'applied' | 'pending'>;

export function TimelineMergeCue({ left, right, connected, onPress }: {
  left: RevealJourney; right: RevealJourney; connected: boolean; onPress(): void;
}) {
  return <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 10, marginLeft: 24, paddingVertical: 6 }}>
    {connected && <View testID="timeline-merge-connector" importantForAccessibility="no"
      style={{ borderLeftWidth: 2, borderStyle: 'dotted', borderColor: '#4EA8DE' }} />}
    <View style={{ flex: 1, paddingLeft: connected ? 0 : 10 }}>
      <ActionButton variant="secondary" onPress={onPress}
        accessibilityLabel={`Review possible merge: ${left.label}, ${left.periodLabel} and ${right.label}, ${right.periodLabel}`}>
        Review possible merge · {left.label} &amp; {right.label}
      </ActionButton>
    </View>
  </View>;
}

export function TimelineMergeReview({ pair, left, right, current, load, confirm, close }: {
  pair: JourneyMergePair;
  left: RevealJourney;
  right: RevealJourney;
  current: boolean;
  load(id: string): Promise<Evidence>;
  confirm: ConfirmTimelineMerge;
  close(): void;
}) {
  const [evidence, setEvidence] = useState<readonly Evidence[] | null>(null);
  const [readFailed, setReadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const command = useRef<string | null>(null);
  const busy = useRef(false);
  useEffect(() => {
    let active = true;
    void Promise.all([load(pair.leftId), load(pair.rightId)]).then((results) => {
      if (!active) return;
      if (results.some((result) => result.snapshotToken !== pair.generation || result.detail.pendingRemap)) setReadFailed(true);
      else setEvidence(results);
    }).catch(() => { if (active) setReadFailed(true); });
    return () => { active = false; };
  }, [load, pair]);

  const save = async () => {
    if (!current || !evidence || busy.current) return;
    busy.current = true;
    setSaving(true);
    setSaveFailed(false);
    command.current ??= createDiagnosticCorrelationId();
    try {
      if (await confirm(pair, evidence[0].detail, command.current) === 'applied') close();
      else setSaveFailed(true);
    } catch { setSaveFailed(true); }
    finally { busy.current = false; setSaving(false); }
  };

  return <Modal transparent onRequestClose={() => { if (!busy.current) close(); }}>
    <View style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'flex-end', padding: 16 }}>
      <View accessibilityViewIsModal style={{ maxHeight: '88%', backgroundColor: '#1C2541', borderRadius: 18, padding: 16 }}>
        <ScrollView contentContainerStyle={{ gap: 12 }}>
          <Title>Review possible merge</Title>
          <Body>Check the photos and observed dates for both journeys.</Body>
          {current && [left, right].map((journey, index) => {
            const cover = evidence?.[index]?.previews.find((item) => item.availability === 'available' && item.uri);
            return <InsetPanel key={journey.id}>
              <Text style={{ color: palette.limestone, fontSize: 18, fontWeight: '700' }}>{journey.label}</Text>
              <Body>{journey.periodLabel}</Body>
              {cover?.uri && <View style={{ height: 104, borderRadius: 10, overflow: 'hidden' }}><LocalTripMediaCover uri={cover.uri} kind={cover.kind} /></View>}
            </InsetPanel>;
          })}
          {!current || readFailed ? <Body>This suggestion changed. Reopen it from Timeline to review the current journeys.</Body>
            : !evidence ? <Body>Opening both journeys…</Body> : null}
          {saveFailed && <View accessibilityLiveRegion="polite"><Body>The merge could not be verified. Check again before leaving this review.</Body></View>}
          <ActionButton disabled={!current || !evidence || saving} onPress={() => void save()}>
            {saving ? 'Saving merge…' : saveFailed ? 'Check merge again' : 'Confirm merge'}
          </ActionButton>
          <ActionButton variant="secondary" disabled={saving} onPress={close}>Close review</ActionButton>
        </ScrollView>
      </View>
    </View>
  </Modal>;
}
