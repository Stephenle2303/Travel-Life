import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ActionButton, Body, InsetPanel, palette } from '@/components/ui';
import { hiddenOutingReasonSentence } from '@/reconstruction/possible-trip-copy';
import type { HiddenOutingSummary } from '@/reconstruction/types';

/**
 * M10.11 (decision 0023/detector-v1-3.md): the real Hidden outings card.
 * Collapsed by default to one muted summary line — "noticeable but not
 * prominent" (the owner's own words, 2026-11-22): `sage`, not `limestone`
 * or `citrus`, and no badge. Lists only episodes the engine actually
 * classified hidden-with-a-reason (`reasonCode`); it never lists, and
 * never will, the fully-unshown reasons (no-away-evidence, non-capture-
 * source, no-location) decision 0023 keeps off this card entirely — those
 * never reach `loadHiddenOutings` in the first place.
 *
 * "Review" opens the same journey detail screen (photos first) as the
 * Possible-trips card's "Review outing" — see that card's own comment for
 * why it must not jump to the Edit hub. Keeping one records
 * `USER_CONFIRMED` through that same existing accuracy flow; this card
 * never reimplements Keep/reject, same as Possible trips.
 */
export function HiddenOutingsV13Section({ outings, onReviewOuting }: {
  outings: readonly HiddenOutingSummary[];
  onReviewOuting(displayId: string): void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!outings.length) return null;
  const label = outings.length === 1 ? '1 hidden outing' : `${outings.length} hidden outings`;
  return <InsetPanel>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${expanded ? 'expanded' : 'collapsed'}`}
      accessibilityState={{ expanded }}
      onPress={() => setExpanded((value) => !value)}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ color: palette.sage, fontSize: 15 }}>{label}</Text>
      <Text style={{ color: palette.sage, fontSize: 15 }}>{expanded ? '▾' : '▸'}</Text>
    </Pressable>
    {expanded && outings.map((outing) => <View key={outing.displayId} accessibilityLabel={`Hidden outing, ${outing.periodLabel}`} style={{ gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: palette.fern }}>
      <Body>{outing.periodLabel}</Body>
      <Body style={{ color: palette.sage }}>{hiddenOutingReasonSentence(outing.reasonCode)}</Body>
      <ActionButton variant="secondary" accessibilityLabel={`Review outing, ${outing.periodLabel}`} onPress={() => onReviewOuting(outing.displayId)}>Review outing</ActionButton>
    </View>)}
  </InsetPanel>;
}
