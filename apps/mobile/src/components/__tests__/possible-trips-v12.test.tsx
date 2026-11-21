import { fireEvent, render } from '@testing-library/react-native';
import { PossibleTripsV12Section } from '@/components/possible-trips-v12';
import type { PossibleTripSummary } from '@/reconstruction/types';

const homeNotSet: PossibleTripSummary = { displayId: 'synthetic-1', periodLabel: 'January 2026', reasonCode: 'home-not-set', locatedCount: 0 };
const fewPhotos: PossibleTripSummary = { displayId: 'synthetic-2', periodLabel: 'February 2026', reasonCode: 'few-photos', locatedCount: 2 };

describe('PossibleTripsV12Section (CAP-3, detector-v1-2.md)', () => {
  it('renders nothing for an empty list', async () => {
    const view = await render(<PossibleTripsV12Section trips={[]} onReviewOuting={() => {}} />);
    expect(view.toJSON()).toBeNull();
  });

  it('shows one reason sentence per card and Set Home only for home-not-set', async () => {
    const onSetHome = jest.fn();
    const view = await render(<PossibleTripsV12Section trips={[homeNotSet, fewPhotos]} onReviewOuting={() => {}} onSetHome={onSetHome} />);
    expect(view.getByText("Your Home isn't set for this time.")).toBeTruthy();
    expect(view.getByText('Only 2 photos have a location.')).toBeTruthy();
    expect(view.getAllByRole('button', { name: 'Set Home' })).toHaveLength(1);
    await fireEvent.press(view.getByRole('button', { name: 'Set Home' }));
    expect(onSetHome).toHaveBeenCalledTimes(1);
  });

  it('never shows Set Home when the callback is not supplied, even for a home-not-set card', async () => {
    const view = await render(<PossibleTripsV12Section trips={[homeNotSet]} onReviewOuting={() => {}} />);
    expect(view.queryByRole('button', { name: 'Set Home' })).toBeNull();
  });

  it('opens review with the exact displayId on "Review outing"', async () => {
    const onReviewOuting = jest.fn();
    const view = await render(<PossibleTripsV12Section trips={[fewPhotos]} onReviewOuting={onReviewOuting} />);
    await fireEvent.press(view.getByRole('button', { name: 'Review outing, February 2026' }));
    expect(onReviewOuting).toHaveBeenCalledWith('synthetic-2');
  });
});
