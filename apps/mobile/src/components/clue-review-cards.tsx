import { useState } from 'react';
import { Text, View } from 'react-native';
import { ActionButton, Body, InsetPanel, palette } from '@/components/ui';
import { reviewCardReasonSentence } from '@/clues/review-card-copy';

function SectionHeading({ children }: { children: string }) {
  return <Text accessibilityRole="header" style={{ color: palette.limestone, fontSize: 22, fontWeight: '800' }}>{children}</Text>;
}

export type PendingClueReviewCard = { cardId: string; reason: string; periodLabel: string | null; createdAtMillis: number };

/**
 * CAP-3's owner-facing surface for clues the background pass held back
 * instead of silently lowering an Atlas trip. Approving re-validates
 * against the live Atlas (the repository may answer "stale" if the
 * situation changed since the card was created); dismissing never applies
 * the clue.
 */
export function ClueReviewCardsSection({ cards, onResolve }: {
  cards: readonly PendingClueReviewCard[];
  onResolve(cardId: string, decision: 'approve' | 'dismiss'): Promise<'approved' | 'dismissed' | 'stale'>;
}) {
  const [busyCardId, setBusyCardId] = useState<string | null>(null);
  const [staleCardId, setStaleCardId] = useState<string | null>(null);
  if (!cards.length) return null;
  const resolve = async (cardId: string, decision: 'approve' | 'dismiss') => {
    setBusyCardId(cardId);
    setStaleCardId(null);
    try {
      const result = await onResolve(cardId, decision);
      if (result === 'stale') setStaleCardId(cardId);
    } finally { setBusyCardId(null); }
  };
  return <InsetPanel>
    <SectionHeading>Needs your review</SectionHeading>
    <Body>Travel Life found something about your photos that could change a trip you&apos;ve already confirmed. Nothing changes until you decide.</Body>
    {cards.map((card) => <View key={card.cardId} accessibilityLabel={`Review item, ${card.periodLabel ?? 'date unknown'}`} style={{ gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: palette.fern }}>
      {card.periodLabel && <Body>{card.periodLabel}</Body>}
      <Body>{reviewCardReasonSentence(card.reason)}</Body>
      {staleCardId === card.cardId && <Body>This is no longer available to review — your Atlas has changed since this was found.</Body>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <ActionButton accessibilityLabel="Approve this change" disabled={busyCardId === card.cardId} onPress={() => void resolve(card.cardId, 'approve')}>Approve</ActionButton>
        <ActionButton variant="secondary" accessibilityLabel="Dismiss this change" disabled={busyCardId === card.cardId} onPress={() => void resolve(card.cardId, 'dismiss')}>Dismiss</ActionButton>
      </View>
    </View>)}
  </InsetPanel>;
}

/** The "Travel Life updated N trips" note (background-and-surfacing.md):
 * shown once, dismissed by the owner, never re-shown for the same change. */
export function CluePassNoticeBanner({ notice, onDismiss }: { notice: { message: string } | null; onDismiss(): void }) {
  if (!notice) return null;
  return <InsetPanel>
    <Body>{notice.message}</Body>
    <ActionButton variant="secondary" accessibilityLabel="Dismiss update notice" onPress={onDismiss}>Dismiss</ActionButton>
  </InsetPanel>;
}
