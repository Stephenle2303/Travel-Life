import { fireEvent, render } from '@testing-library/react-native';
import { HiddenOutingsV13Section } from '@/components/hidden-outings-v13';
import type { HiddenOutingSummary } from '@/reconstruction/types';

const briefOuting: HiddenOutingSummary = { displayId: 'synthetic-1', periodLabel: 'January 2026', reasonCode: 'brief-outing' };
const anotherOuting: HiddenOutingSummary = { displayId: 'synthetic-2', periodLabel: 'February 2026', reasonCode: 'brief-outing' };

describe('HiddenOutingsV13Section (M10.11, decision 0023)', () => {
  it('renders nothing for an empty list', async () => {
    const view = await render(<HiddenOutingsV13Section outings={[]} onReviewOuting={() => {}} />);
    expect(view.toJSON()).toBeNull();
  });

  it('is collapsed by default: shows only the count, no reason text or Review button', async () => {
    const view = await render(<HiddenOutingsV13Section outings={[briefOuting]} onReviewOuting={() => {}} />);
    expect(view.getByText('1 hidden outing')).toBeTruthy();
    expect(view.queryByText('A short outing with only a few photos.')).toBeNull();
    expect(view.queryByRole('button', { name: /Review outing/ })).toBeNull();
  });

  it('pluralizes the collapsed count for 2+ outings', async () => {
    const view = await render(<HiddenOutingsV13Section outings={[briefOuting, anotherOuting]} onReviewOuting={() => {}} />);
    expect(view.getByText('2 hidden outings')).toBeTruthy();
  });

  it('expands on press to show each outing\'s reason and a Review button', async () => {
    const view = await render(<HiddenOutingsV13Section outings={[briefOuting]} onReviewOuting={() => {}} />);
    await fireEvent.press(view.getByRole('button', { name: '1 hidden outing, collapsed' }));
    expect(view.getByText('A short outing with only a few photos.')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Review outing, January 2026' })).toBeTruthy();
  });

  it('opens review with the exact displayId on "Review outing"', async () => {
    const onReviewOuting = jest.fn();
    const view = await render(<HiddenOutingsV13Section outings={[briefOuting]} onReviewOuting={onReviewOuting} />);
    await fireEvent.press(view.getByRole('button', { name: '1 hidden outing, collapsed' }));
    await fireEvent.press(view.getByRole('button', { name: 'Review outing, January 2026' }));
    expect(onReviewOuting).toHaveBeenCalledWith('synthetic-1');
  });

  it('collapses again on a second press', async () => {
    const view = await render(<HiddenOutingsV13Section outings={[briefOuting]} onReviewOuting={() => {}} />);
    const toggle = view.getByRole('button', { name: '1 hidden outing, collapsed' });
    await fireEvent.press(toggle);
    expect(view.getByText('A short outing with only a few photos.')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: '1 hidden outing, expanded' }));
    expect(view.queryByText('A short outing with only a few photos.')).toBeNull();
  });
});
