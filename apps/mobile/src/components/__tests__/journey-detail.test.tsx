import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { JourneyDetailScreen } from '@/components/journey-detail';

describe('JourneyDetailScreen', () => {
  it('keeps visit support separate from membership and retains text when a memory is unavailable', async () => {
    const view = await render(<JourneyDetailScreen id="atlas-safe" onBack={jest.fn()} onCorrect={jest.fn()} load={async () => ({ detail: { id: 'atlas-safe', title: 'Private journey', observedSpan: 'Observed 2024-01-01', visits: [{ label: '2024-01-01', precision: 'Observed day', support: 'Source supports this visit; it does not prove owner presence.' }], memories: [{ id: 'memory-1', availability: 'unavailable', association: 'Associated with this journey as a memory; separate from destination support.' }], uncertainty: ['Visit ordering is uncertain.'] }, previews: [{ uri: null, availability: 'unavailable' }] })} />);
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
});
