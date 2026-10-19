import { useState } from 'react';
import { ScrollView, TextInput } from 'react-native';

import { ActionButton, Body, Eyebrow, InsetPanel, Title } from '@/components/ui';
import type { ManualJourneyInput } from '@/import-record';
import { searchOwnerPlaces, type OwnerPlace } from '@/reconstruction/owner-place-search';

type Overlap = { id: string; label: string; editable: boolean };

/** This form is intentionally local-only: it gathers an owner assertion, never evidence. */
export function ManualJourneyScreen({ findOverlaps, save, onCancel, onEditExisting }: { findOverlaps(input: ManualJourneyInput): Promise<Overlap[]>; save(input: ManualJourneyInput): Promise<string>; onCancel(): void; onEditExisting(id: string): void }) {
  const [label, setLabel] = useState(''); const [context, setContext] = useState(''); const [day, setDay] = useState('');
  const [approximate, setApproximate] = useState(false); const [endDay, setEndDay] = useState(''); const [area, setArea] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<OwnerPlace | null>(null);
  const [overlaps, setOverlaps] = useState<Overlap[] | null>(null); const [status, setStatus] = useState<string | null>(null); const [saving, setSaving] = useState(false); const [commandKey, setCommandKey] = useState<string | null>(null);
  const draft = (key: string, includeOverlaps: boolean): ManualJourneyInput | null => {
    if (!area) return null;
    return { commandKey: key, label: label.trim(), context: context.trim(), anchor: area, date: approximate ? { kind: 'approximate', startDay: day.trim(), endDay: endDay.trim() } : { kind: 'exact', day: day.trim() }, reviewedOverlapIds: includeOverlaps ? overlaps?.map((item) => item.id) ?? [] : [] };
  };
  const changed = () => { setOverlaps(null); setStatus(null); setCommandKey(null); };
  const changeQuery = (value: string) => { setLabel(value); setSelectedPlace(null); setArea(null); changed(); };
  const choosePlace = (place: OwnerPlace) => { setLabel(place.name); setContext(place.context); setArea({ latitude: place.latitude, longitude: place.longitude }); setSelectedPlace(place); changed(); };
  const review = async () => { const key = commandKey ?? `manual:${Date.now()}:${Math.random().toString(36).slice(2)}`; const next = draft(key, false); if (!next) { setStatus('Choose a deliberately broad map area before reviewing this private claim.'); return; } setCommandKey(key); setSaving(true); try { setOverlaps(await findOverlaps(next)); } catch (error) { setStatus(error instanceof Error ? error.message : 'This private claim could not be reviewed.'); } finally { setSaving(false); } };
  const persist = async () => { if (!commandKey || overlaps === null) return; const next = draft(commandKey, true); if (!next) return; setSaving(true); try { await save(next); onCancel(); } catch (error) { setStatus(error instanceof Error ? error.message : 'This private claim could not be saved.'); setOverlaps(null); } finally { setSaving(false); } };
  const canReview = Boolean(area && label.trim() && context.trim() && day.trim() && (!approximate || endDay.trim()));
  const localResults = selectedPlace ? [] : searchOwnerPlaces(label);
  return <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 32 }} accessibilityLabel="Add a journey manually">
    <Eyebrow>Private Atlas · Owner-entered</Eyebrow><Title>Add a missing journey</Title>
    <Body>This is your private assertion. It never creates evidence, media, visit support, or a recovered trip.</Body>
    <InsetPanel><TextInput accessibilityLabel="Destination label" value={label} onChangeText={changeQuery} placeholder="Search places, for example Phú Quốc or Tokyo" placeholderTextColor="#B4C6B5" style={{ color: '#F3EEDD', borderColor: '#B4C6B5', borderWidth: 1, borderRadius: 12, minHeight: 48, paddingHorizontal: 12 }} />
      {localResults.map((place) => <ActionButton key={place.id} accessibilityLabel={`Select local place ${place.name}`} onPress={() => choosePlace(place)} variant="secondary">{place.name} · {place.context}</ActionButton>)}
      <TextInput accessibilityLabel="Destination area" value={context} onChangeText={(value) => { setContext(value); changed(); }} placeholder="Country or broad area" placeholderTextColor="#B4C6B5" style={{ color: '#F3EEDD', borderColor: '#B4C6B5', borderWidth: 1, borderRadius: 12, minHeight: 48, paddingHorizontal: 12, marginTop: 8 }} />
      <TextInput accessibilityLabel={approximate ? 'Approximate start date' : 'Exact date'} value={day} onChangeText={(value) => { setDay(value); changed(); }} placeholder="YYYY-MM-DD" placeholderTextColor="#B4C6B5" style={{ color: '#F3EEDD', borderColor: '#B4C6B5', borderWidth: 1, borderRadius: 12, minHeight: 48, paddingHorizontal: 12, marginTop: 8 }} />
      {approximate && <TextInput accessibilityLabel="Approximate end date" value={endDay} onChangeText={(value) => { setEndDay(value); changed(); }} placeholder="YYYY-MM-DD" placeholderTextColor="#B4C6B5" style={{ color: '#F3EEDD', borderColor: '#B4C6B5', borderWidth: 1, borderRadius: 12, minHeight: 48, paddingHorizontal: 12, marginTop: 8 }} />}
      <ActionButton accessibilityLabel="Use approximate date range" onPress={() => { setApproximate((value) => !value); changed(); }} variant="secondary">{approximate ? 'Use one exact date' : 'Use approximate date range'}</ActionButton>
      {!localResults.length && !selectedPlace && <><Body>No offline place matched. Enter your own label and choose a deliberately broad area; it is not a confirmed place.</Body>
      {[[35.7, 139.7, 'East Asia'], [13.8, 100.5, 'Southeast Asia'], [48.9, 2.3, 'Western Europe']].map(([latitude, longitude, name]) => <ActionButton key={name as string} accessibilityLabel={`Choose broad map area ${name}`} onPress={() => { setArea({ latitude: latitude as number, longitude: longitude as number }); changed(); }} variant={area?.latitude === latitude ? 'primary' : 'secondary'}>{name as string}</ActionButton>)}</>}
    </InsetPanel>
    {overlaps !== null && <InsetPanel><Title>{overlaps.length ? 'This overlaps another trip' : 'No visible overlap'}</Title>{overlaps.map((item) => <Body key={item.id}>{item.label}</Body>)}{overlaps.some((item) => item.editable) && <>{overlaps.filter((item) => item.editable).map((item) => <ActionButton key={item.id} accessibilityLabel={`Edit ${item.label}`} onPress={() => onEditExisting(item.id)} variant="secondary">Edit this inferred trip instead</ActionButton>)}<Body>Editing abandons this unsaved manual draft. It never merges evidence or provenance.</Body></>}<ActionButton accessibilityLabel="Keep journey as a separate owner-entered record" onPress={() => void persist()} disabled={saving}>{saving ? 'Saving privately…' : 'Keep separate'}</ActionButton></InsetPanel>}
    {overlaps === null && <ActionButton accessibilityLabel="Review journey overlap" onPress={() => void review()} disabled={saving || !canReview}>Review overlap</ActionButton>}
    {status && <Body>{status}</Body>}<ActionButton accessibilityLabel="Cancel adding a journey" onPress={onCancel} variant="secondary">Cancel</ActionButton>
  </ScrollView>;
}
