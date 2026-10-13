import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { ActionButton, Body, Eyebrow, InsetPanel, Title } from '@/components/ui';
import type { JourneyDetail } from '@/reveal/types';
import type { OwnerPreview } from '@/photo-access/types';

export function JourneyDetailScreen({ id, load, onBack, onCorrect }: { id: string; load(id: string): Promise<{ detail: JourneyDetail; previews: OwnerPreview[] }>; onBack(): void; onCorrect(): void }) {
  const [result, setResult] = useState<{ detail: JourneyDetail; previews: OwnerPreview[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { let active = true; void load(id).then((next) => { if (active) setResult(next); }).catch(() => { if (active) setError('This journey can no longer be read. Return to Atlas and reconnect or choose another available journey.'); }); return () => { active = false; }; }, [id, load]);
  if (error) return <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 32 }} accessibilityLabel="Private journey detail"><Title>Journey unavailable</Title><InsetPanel><Body>{error}</Body></InsetPanel><ActionButton accessibilityLabel="Return to private Atlas" onPress={onBack}>Return to Atlas</ActionButton></ScrollView>;
  if (!result) return <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 32 }} accessibilityLabel="Private journey detail"><Title>Opening private journey</Title><Body>Reading the selected local record.</Body></ScrollView>;
  return <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 32 }} accessibilityLabel="Private journey detail"><Eyebrow>Private journey</Eyebrow><Title>{result.detail.title}</Title><InsetPanel><Body>{result.detail.observedSpan}</Body><Body>Photo metadata may support a visit or be associated with a journey. It does not prove your presence.</Body></InsetPanel>
    <InsetPanel><Title>Observed visits</Title>{result.detail.visits.map((visit, index) => <Body key={`${visit.label}-${index}`}>{visit.label} · {visit.precision}. {visit.support}</Body>)}</InsetPanel>
    <InsetPanel><Title>Memories</Title>{result.detail.memories.map((memory, index) => { const preview = result.previews[index]; return <View key={memory.id}>{preview?.uri ? <Image source={{ uri: preview.uri }} style={{ height: 110, borderRadius: 12 }} accessibilityLabel="Available private memory preview" cachePolicy="memory" allowDownscaling priority="low" /> : <Body>Memory unavailable</Body>}<Body>{memory.association}</Body></View>; })}</InsetPanel>
    {!!result.detail.uncertainty.length && <InsetPanel><Title>Uncertainty</Title>{result.detail.uncertainty.map((item) => <Body key={item}>{item}</Body>)}</InsetPanel>}
    <ActionButton accessibilityLabel="Review journey correction" onPress={onCorrect} variant="secondary">Review or correct this journey</ActionButton><ActionButton accessibilityLabel="Return to private Atlas" onPress={onBack} variant="secondary">Return to Atlas</ActionButton></ScrollView>;
}
