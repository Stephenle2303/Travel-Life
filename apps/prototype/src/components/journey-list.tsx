import { Image, LayoutAnimation, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { ActionButton, Pill, palette, tactileFeedback, useReducedMotion } from '@/components/ui';
import type { SyntheticImageKey, SyntheticJourney } from '@/types/prototype';

export const journeyImageAssets: Record<SyntheticImageKey, ImageSourcePropType> = {
  'rainforest-river': require('../../assets/synthetic/rainforest-river.png'),
  'limestone-coast': require('../../assets/synthetic/limestone-coast.png'),
  'misty-highland': require('../../assets/synthetic/misty-highland.png'),
};

interface JourneyListProps {
  journeys: SyntheticJourney[];
  selectedJourneyId: string;
  expandedJourneyId?: string;
  onSelect: (id: string) => void;
  onExpand: (id: string | undefined) => void;
  onOpen: (id: string) => void;
}

export function JourneyList({ journeys, selectedJourneyId, expandedJourneyId, onSelect, onExpand, onOpen }: JourneyListProps) {
  const reducedMotion = useReducedMotion();
  const toggle = (journey: SyntheticJourney) => {
    if (!reducedMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    tactileFeedback.selection();
    onSelect(journey.id);
    onExpand(expandedJourneyId === journey.id ? undefined : journey.id);
  };
  return <View accessibilityLabel="Journey timeline fallback" style={styles.list}>{journeys.map((journey) => {
    const selected = journey.id === selectedJourneyId;
    const expanded = journey.id === expandedJourneyId;
    return <View key={journey.id} style={[styles.card, selected && styles.selected]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Expand ${journey.title}`} accessibilityState={{ selected, expanded }} onPress={() => toggle(journey)} style={({ pressed }) => [styles.cardPressable, pressed && styles.pressed]}>
        <Image source={journeyImageAssets[journey.image.key]} accessibilityLabel={journey.image.alt} style={styles.image} resizeMode="cover" />
        <View style={styles.cardCopy}>
          <View style={styles.row}><Text style={styles.year}>{journey.year}</Text><Pill status={journey.status}>{journey.status}</Pill></View>
          <Text style={styles.title}>{journey.title}</Text>
          <Text style={styles.destinations}>{journey.destinations.join(' · ')}</Text>
          <Text style={styles.expandHint}>{expanded ? 'Close chapter' : 'Open chapter'}</Text>
        </View>
      </Pressable>
      {expanded ? <View style={styles.expanded}><Text style={styles.coverage}>{journey.sourceCoverage}</Text><Text style={styles.reason}>{journey.evidenceReason}</Text><ActionButton variant="quiet" onPress={() => onOpen(journey.id)}>Open journey details</ActionButton></View> : null}
    </View>;
  })}</View>;
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  card: { borderWidth: 1, borderColor: 'rgba(243,238,221,0.16)', borderRadius: 16, backgroundColor: palette.fern, overflow: 'hidden' },
  selected: { borderColor: palette.citrus, borderWidth: 2 },
  cardPressable: { minHeight: 116, flexDirection: 'row' },
  pressed: { opacity: 0.74 },
  image: { width: 112, minHeight: 116, backgroundColor: palette.rainforest },
  cardCopy: { flex: 1, minWidth: 0, padding: 13, gap: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  year: { color: palette.citrus, fontWeight: '900', fontSize: 13 },
  title: { color: palette.limestone, fontWeight: '900', fontSize: 17 },
  destinations: { color: palette.sage, fontSize: 12, lineHeight: 17 },
  expandHint: { color: palette.limestone, fontSize: 10, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase', marginTop: 4 },
  expanded: { gap: 9, padding: 14, paddingTop: 2 },
  coverage: { color: palette.limestone, fontSize: 12, lineHeight: 18, fontWeight: '800' },
  reason: { color: palette.sage, fontSize: 12, lineHeight: 18 },
});
