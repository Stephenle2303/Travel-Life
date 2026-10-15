import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { ActionButton, Body, Eyebrow, InsetPanel, Title } from '@/components/ui';
import type { JourneyDetail } from '@/reveal/types';
import type { OwnerPreview } from '@/photo-access/types';

export function JourneyDetailScreen({ id, load, onBack, onCorrect }: { id: string; load(id: string): Promise<{ detail: JourneyDetail; previews: OwnerPreview[] }>; onBack(): void; onCorrect(): void }) {
  const [state, setState] = useState<{ id: string; result?: { detail: JourneyDetail; previews: OwnerPreview[] }; error?: string } | null>(null);
  useEffect(() => {
    let active = true;
    void load(id)
      .then((result) => { if (active) setState({ id, result }); })
      .catch(() => { if (active) setState({ id, error: 'This journey can no longer be read. Return to Atlas and reconnect or choose another available journey.' }); });
    return () => { active = false; };
  }, [id, load]);
  const currentState = state?.id === id ? state : null;
  if (currentState?.error) return <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 32 }} accessibilityLabel="Private journey detail"><Title>Journey unavailable</Title><InsetPanel><Body>{currentState.error}</Body></InsetPanel><ActionButton accessibilityLabel="Return to private Atlas" onPress={onBack}>Return to Atlas</ActionButton></ScrollView>;
  if (!currentState?.result) return <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 32 }} accessibilityLabel="Private journey detail"><Title>Opening private journey</Title><Body>Reading the selected local record.</Body></ScrollView>;
  const result = currentState.result;
  return <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 32 }} accessibilityLabel="Private journey detail"><Eyebrow>Private journey</Eyebrow><Title>{result.detail.title}</Title>{result.detail.ownerClaim && <InsetPanel><Title>Owner claim</Title><Body>Owner title: {result.detail.ownerClaim.title}</Body><Body>Owner date: {result.detail.ownerClaim.date.kind === 'exact' ? result.detail.ownerClaim.date.day : `${result.detail.ownerClaim.date.startDay} to ${result.detail.ownerClaim.date.endDay} (approximate)`}</Body><Body>This is your private claim, separate from observed evidence.</Body></InsetPanel>}<InsetPanel><Title>Observed evidence</Title><Body>{result.detail.observedSpan}</Body><Body>Photo metadata may support a visit or be associated with a journey. It does not prove your presence.</Body></InsetPanel>
    <InsetPanel><Title>Observed visits</Title>{result.detail.visits.map((visit, index) => <Body key={`${visit.label}-${index}`}>{visit.label} · {visit.precision}. {visit.support}</Body>)}</InsetPanel>
    <InsetPanel><Title>Memories</Title>{result.detail.memories.map((memory, index) => { const preview = result.previews[index]; return <View key={memory.id}>{preview?.uri ? <Image source={{ uri: preview.uri }} style={{ height: 110, borderRadius: 12 }} accessibilityLabel="Available private memory preview" cachePolicy="memory" allowDownscaling priority="low" /> : <Body>Memory unavailable</Body>}<Body>{memory.association}</Body></View>; })}</InsetPanel>
    {!!result.detail.uncertainty.length && <InsetPanel><Title>Uncertainty</Title>{result.detail.uncertainty.map((item) => <Body key={item}>{item}</Body>)}</InsetPanel>}
    <ActionButton accessibilityLabel="Review journey correction" onPress={onCorrect} variant="secondary">Review or correct this journey</ActionButton><ActionButton accessibilityLabel="Return to private Atlas" onPress={onBack} variant="secondary">Return to Atlas</ActionButton></ScrollView>;
}
