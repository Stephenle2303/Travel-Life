import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ClueReviewCardsSection, CluePassNoticeBanner, type PendingClueReviewCard } from '@/components/clue-review-cards';

const lowersAtlas: PendingClueReviewCard = { cardId: 'review-1', reason: 'would-lower-atlas-trip', periodLabel: 'March 2026', createdAtMillis: 1000 };
const protectedTrip: PendingClueReviewCard = { cardId: 'review-2', reason: 'protected-confirmed-trip', periodLabel: null, createdAtMillis: 2000 };

describe('ClueReviewCardsSection (CAP-3 owner review surface)', () => {
  it('renders nothing for an empty list', async () => {
    const view = await render(<ClueReviewCardsSection cards={[]} onResolve={async () => 'dismissed'} />);
    expect(view.toJSON()).toBeNull();
  });

  it('shows one reason sentence per card, with the period label only when known', async () => {
    const view = await render(<ClueReviewCardsSection cards={[lowersAtlas, protectedTrip]} onResolve={async () => 'approved'} />);
    expect(view.getByText('March 2026')).toBeTruthy();
    expect(view.getByText('A new detail would change one of your confirmed trips.')).toBeTruthy();
    expect(view.getByText('A new detail touches a trip you already confirmed a different way.')).toBeTruthy();
  });

  it('resolves the exact card id and decision when Approve or Dismiss is pressed', async () => {
    const onResolve = jest.fn(async () => 'approved' as const);
    const view = await render(<ClueReviewCardsSection cards={[lowersAtlas]} onResolve={onResolve} />);
    await fireEvent.press(view.getByLabelText('Approve this change'));
    expect(onResolve).toHaveBeenCalledWith('review-1', 'approve');

    const onDismiss = jest.fn(async () => 'dismissed' as const);
    const dismissView = await render(<ClueReviewCardsSection cards={[lowersAtlas]} onResolve={onDismiss} />);
    await fireEvent.press(dismissView.getByLabelText('Dismiss this change'));
    expect(onDismiss).toHaveBeenCalledWith('review-1', 'dismiss');
  });

  it('shows a stale message instead of silently dropping the card when approval reports stale', async () => {
    const onResolve = jest.fn(async () => 'stale' as const);
    const view = await render(<ClueReviewCardsSection cards={[lowersAtlas]} onResolve={onResolve} />);
    await fireEvent.press(view.getByLabelText('Approve this change'));
    await waitFor(() => expect(view.getByText("This is no longer available to review — your Atlas has changed since this was found.")).toBeTruthy());
  });
});

describe('CluePassNoticeBanner (background-and-surfacing.md)', () => {
  it('renders nothing when there is no notice', async () => {
    const view = await render(<CluePassNoticeBanner notice={null} onDismiss={() => {}} />);
    expect(view.toJSON()).toBeNull();
  });

  it('shows the message and calls onDismiss exactly once when dismissed', async () => {
    const onDismiss = jest.fn();
    const view = await render(<CluePassNoticeBanner notice={{ message: 'Travel Life updated 2 trips.' }} onDismiss={onDismiss} />);
    expect(view.getByText('Travel Life updated 2 trips.')).toBeTruthy();
    await fireEvent.press(view.getByLabelText('Dismiss update notice'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
