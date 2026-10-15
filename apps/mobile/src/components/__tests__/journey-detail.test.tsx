import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { JourneyDetailScreen } from '@/components/journey-detail';

describe('JourneyDetailScreen', () => {
  it('keeps visit support separate from membership and retains text when a memory is unavailable', async () => {
    const view = await render(<JourneyDetailScreen id="atlas-safe" onBack={jest.fn()} onCorrect={jest.fn()} load={async () => ({ detail: { id: 'atlas-safe', title: 'Private journey', observedSpan: 'Observed 2024-01-01', visits: [{ id: 'visit-1', label: '2024-01-01', precision: 'Observed day', support: 'Source supports this visit; it does not prove owner presence.' }], memories: [{ id: 'memory-1', availability: 'unavailable', association: 'Associated with this journey as a memory; separate from destination support.' }], uncertainty: ['Visit ordering is uncertain.'] }, previews: [{ uri: null, availability: 'unavailable', kind: 'photo' }] })} />);
    await waitFor(() => expect(view.getByText(/separate from destination support/)).toBeOnTheScreen());
    expect(view.getByText('Memory unavailable')).toBeOnTheScreen();
    expect(view.getByText(/does not prove owner presence/)).toBeOnTheScreen();
  });

  it('returns safely when the selected journey becomes unavailable', async () => {
    const back = jest.fn(); const view = await render(<JourneyDetailScreen id="stale" onBack={back} onCorrect={jest.fn()} load={async () => { throw new Error('stale'); }} />);
    await waitFor(() => expect(view.getByText('Journey unavailable')).toBeOnTheScreen());
    fireEvent.press(view.getByRole('button', { name: 'Return to private Atlas' }));
    expect(back).toHaveBeenCalled();
  });

  it('opens the dedicated correction route without presenting unsaved correction controls', async () => {
    const correct = jest.fn();
    const view = await render(<JourneyDetailScreen id="atlas-safe" onBack={jest.fn()} onCorrect={correct} load={async () => ({ detail: { id: 'atlas-safe', title: 'Private journey', observedSpan: 'Observed 2024-01-01', visits: [], memories: [], uncertainty: [] }, previews: [] })} />);
    await waitFor(() => expect(view.getByRole('button', { name: 'Review journey correction' })).toBeOnTheScreen());
    fireEvent.press(view.getByRole('button', { name: 'Review journey correction' }));
    expect(correct).toHaveBeenCalledTimes(1);
    expect(view.queryByRole('button', { name: 'Confirm shown facts' })).toBeNull();
  });

  it('labels an owner-entered title and approximate date separately from observed evidence', async () => {
    const view = await render(<JourneyDetailScreen id="atlas-safe" onBack={jest.fn()} onCorrect={jest.fn()} load={async () => ({ detail: { id: 'atlas-safe', title: 'Spring trip', observedSpan: 'Observed 2024-03-03 to 2024-03-10', visits: [], memories: [], uncertainty: [], ownerClaim: { title: 'Spring trip', date: { kind: 'approximate', startDay: '2024-03-01', endDay: '2024-03-12' } } }, previews: [] })} />);
    await waitFor(() => expect(view.getByText('Owner claim')).toBeOnTheScreen());
    expect(view.getByText(/Owner date: 2024-03-01 to 2024-03-12 \(approximate\)/)).toBeOnTheScreen();
    expect(view.getByText('Observed evidence')).toBeOnTheScreen();
    expect(view.getByText('Observed 2024-03-03 to 2024-03-10')).toBeOnTheScreen();
  });
});
