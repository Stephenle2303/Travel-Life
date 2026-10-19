import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import type { PressableProps } from 'react-native';

import { JourneyCorrectionScreen } from '@/components/journey-correction';

// The screen's visual primitives include a device reduced-motion subscription.
// This focused state-machine suite replaces those primitives so its assertions
// cover correction transitions without an unrelated native accessibility read.
jest.mock('@/components/ui', () => {
  const { Pressable, Text, View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    ActionButton: ({ children, ...props }: Omit<PressableProps, 'children'> & { children: ReactNode }) => <Pressable accessibilityRole="button" {...props}><Text>{children}</Text></Pressable>,
    Body: ({ children }: { children: ReactNode }) => <Text>{children}</Text>,
    Eyebrow: ({ children }: { children: ReactNode }) => <Text>{children}</Text>,
    InsetPanel: ({ children }: { children: ReactNode }) => <View>{children}</View>,
    Title: ({ children }: { children: ReactNode }) => <Text>{children}</Text>,
  };
});

const load = async () => ({ detail: { id: 'atlas-safe', title: 'Private journey', observedSpan: 'Observed 2024-01-01', visits: [], memories: [], uncertainty: [] }, previews: [], snapshotToken: 7 });
const retryProjection = async () => true;

describe('JourneyCorrectionScreen', () => {
  it('allows an owner title without inventing an owner date', async () => {
    const save = jest.fn().mockResolvedValue('applied');
    const view = await render(<JourneyCorrectionScreen id="atlas-safe" load={load} save={save} retryProjection={retryProjection} onBack={jest.fn()} onRejected={jest.fn()} />);
    await waitFor(() => expect(view.getByLabelText('Owner journey title')).toBeOnTheScreen());
    fireEvent.changeText(view.getByLabelText('Owner journey title'), 'Family holiday');
    await waitFor(() => expect(view.getByLabelText('Owner journey title')).toHaveProp('value', 'Family holiday'));
    await fireEvent.press(view.getByRole('button', { name: 'Preview owner title and date claim' }));
    await waitFor(() => expect(view.getByRole('button', { name: 'Save owner title and date claim' })).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'Save owner title and date claim' }));
    expect(save).toHaveBeenCalledWith('atlas-safe', 'claim', 7, expect.anything(), expect.stringMatching(/:claim:/), { title: 'Family holiday' });
  });
  it('previews the selected decision and shows it as applied only after save and projection finish', async () => {
    let resolve!: () => void;
    const save = jest.fn(() => new Promise<'applied' | 'pending'>((done) => { resolve = () => done('applied'); }));
    const view = await render(<JourneyCorrectionScreen id="atlas-safe" load={load} save={save} retryProjection={retryProjection} onBack={jest.fn()} onRejected={jest.fn()} />);
    await waitFor(() => expect(view.getByRole('button', { name: 'Preview confirmation' })).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'Preview confirmation' }));
    await waitFor(() => expect(view.getByRole('button', { name: 'Save confirmation' })).toBeOnTheScreen());
    expect(view.getByText(/records only the facts currently shown/i)).toBeOnTheScreen();
    expect(save).not.toHaveBeenCalled();
    await fireEvent.press(view.getByRole('button', { name: 'Save confirmation' }));
    expect(save).toHaveBeenCalledWith('atlas-safe', 'confirm', 7, expect.objectContaining({ id: 'atlas-safe', title: 'Private journey' }), expect.stringMatching(/^journey:atlas-safe:7:confirm:/));
    expect(view.queryByText('Confirmation saved')).toBeNull();
    resolve();
    await waitFor(() => expect(view.getByText('Confirmation saved')).toBeOnTheScreen());
    expect(view.getByText(/applied to this complete reconstruction/i)).toBeOnTheScreen();
  });

  it('does not claim a save when the revision-bound durable operation fails', async () => {
    const view = await render(<JourneyCorrectionScreen id="atlas-safe" load={load} save={async () => { throw new Error('stale'); }} retryProjection={retryProjection} onBack={jest.fn()} onRejected={jest.fn()} />);
    await waitFor(() => expect(view.getByRole('button', { name: 'Preview rejection' })).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'Preview rejection' }));
    await waitFor(() => expect(view.getByRole('button', { name: 'Save rejection' })).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'Save rejection' }));
    await waitFor(() => expect(view.getByText(/save could not be confirmed/i)).toBeOnTheScreen());
    expect(view.queryByText('Rejection saved')).toBeNull();
  });

  it('requires a preview before discarding a pending remap', async () => {
    const discardPendingRemap = jest.fn(async () => 'applied' as const);
    const pendingLoad = async () => ({
      detail: { id: 'atlas-safe', title: 'Private journey', observedSpan: 'Observed 2024-01-01', visits: [], memories: [], uncertainty: [], correctionState: 'pending remap' as const, pendingRemap: { reason: 'Reviewed support no longer maps to one successor.' } }, previews: [], snapshotToken: 7,
    });
    const view = await render(<JourneyCorrectionScreen id="atlas-safe" load={pendingLoad} save={async () => 'applied'} discardPendingRemap={discardPendingRemap} retryProjection={retryProjection} onBack={jest.fn()} onRejected={jest.fn()} />);
    await waitFor(() => expect(view.getByText(/Pending your remap review/i)).toBeOnTheScreen());
    expect(view.getByText(/no longer maps to one successor/i)).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Preview discard pending correction' }));
    await waitFor(() => expect(view.getByRole('button', { name: 'Discard pending correction' })).toBeOnTheScreen());
    expect(discardPendingRemap).not.toHaveBeenCalled();
    await fireEvent.press(view.getByRole('button', { name: 'Discard pending correction' }));
    await waitFor(() => expect(discardPendingRemap).toHaveBeenCalledWith('atlas-safe', 7, expect.stringMatching(/^journey:atlas-safe:7:discard-pending-remap:/)));
    expect(view.getByText(/Pending correction discarded/i)).toBeOnTheScreen();
  });

  it('shows a durable decision as pending when projection fails and offers a retry', async () => {
    const retry = jest.fn(async () => true);
    const onRejected = jest.fn();
    const view = await render(<JourneyCorrectionScreen id="atlas-safe" load={load} save={async () => 'pending'} retryProjection={retry} onBack={jest.fn()} onRejected={onRejected} />);
    await waitFor(() => expect(view.getByRole('button', { name: 'Preview rejection' })).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'Preview rejection' }));
    await waitFor(() => expect(view.getByRole('button', { name: 'Save rejection' })).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'Save rejection' }));
    await waitFor(() => expect(view.getByText(/previous complete journey view is still shown/i)).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'Retry local correction update' }));
    await waitFor(() => expect(view.getByText(/this grouping is removed from the updated projection/i)).toBeOnTheScreen());
    expect(retry).toHaveBeenCalledTimes(1);
    await fireEvent.press(view.getByRole('button', { name: 'Return to private Atlas' }));
    expect(onRejected).toHaveBeenCalledTimes(1);
  });

  it('does not carry a completed choice into a newly selected journey', async () => {
    const view = await render(<JourneyCorrectionScreen id="atlas-safe" load={load} save={async () => 'applied'} retryProjection={retryProjection} onBack={jest.fn()} onRejected={jest.fn()} />);
    await waitFor(() => expect(view.getByRole('button', { name: 'Preview confirmation' })).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'Preview confirmation' }));
    await waitFor(() => expect(view.getByRole('button', { name: 'Save confirmation' })).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'Save confirmation' }));
    await waitFor(() => expect(view.getByText('Confirmation saved')).toBeOnTheScreen());

    const nextJourney = async () => ({
      detail: { id: 'atlas-next', title: 'Another private journey', observedSpan: 'Observed 2025-01-01', visits: [], memories: [], uncertainty: [] },
      previews: [],
      snapshotToken: 8,
    });
    await view.rerender(<JourneyCorrectionScreen id="atlas-next" load={nextJourney} save={async () => 'applied'} retryProjection={retryProjection} onBack={jest.fn()} onRejected={jest.fn()} />);
    await waitFor(() => expect(view.getByText('Another private journey')).toBeOnTheScreen());
    expect(view.queryByText('Confirmation saved')).toBeNull();
  });

  it('previews and saves an exact owner title and date claim separately from observed evidence', async () => {
    const save = jest.fn(async () => 'applied' as const);
    const view = await render(<JourneyCorrectionScreen id="atlas-safe" load={load} save={save} retryProjection={retryProjection} onBack={jest.fn()} onRejected={jest.fn()} />);
    await waitFor(() => expect(view.getByLabelText('Owner journey title')).toBeOnTheScreen());
    await fireEvent.changeText(view.getByLabelText('Owner journey title'), 'Winter break');
    await fireEvent.changeText(view.getByLabelText('Owner exact date'), '2024-01-01');
    await waitFor(() => expect(view.getByLabelText('Owner exact date')).toHaveProp('value', '2024-01-01'));
    await fireEvent.press(view.getByRole('button', { name: 'Preview owner title and date claim' }));
    await waitFor(() => expect(view.getByRole('button', { name: 'Save owner title and date claim' })).toBeOnTheScreen());
    expect(view.getByText(/Owner date: 2024-01-01/)).toBeOnTheScreen();
    expect(view.getByText(/Observed evidence remains: Observed 2024-01-01/)).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Save owner title and date claim' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith('atlas-safe', 'claim', 7, expect.any(Object), expect.stringMatching(/^journey:atlas-safe:7:claim:/), { title: 'Winter break', date: { kind: 'exact', day: '2024-01-01' } }));
    await waitFor(() => expect(view.getByText('Owner claim saved')).toBeOnTheScreen());
    expect(view.getByText(/Observed evidence remains separate/)).toBeOnTheScreen();
  });

  it('searches locally and saves Phú Quốc as a distinct owner-confirmed map anchor', async () => {
    const save = jest.fn(async () => 'applied' as const);
    const view = await render(<JourneyCorrectionScreen id="atlas-safe" load={load} save={save} retryProjection={retryProjection} onBack={jest.fn()} onRejected={jest.fn()} />);
    await waitFor(() => expect(view.getByLabelText('Search a place to confirm')).toBeOnTheScreen());
    expect(view.getByLabelText('Journey correction review')).toHaveProp('keyboardShouldPersistTaps', 'always');
    await fireEvent.changeText(view.getByLabelText('Search a place to confirm'), 'Phu Quoc');
    await waitFor(() => expect(view.getByRole('button', { name: 'Preview confirmed place Phú Quốc' })).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'Preview confirmed place Phú Quốc' }));
    expect(view.getByText(/Atlas will move this journey/i)).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Save confirmed place' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith('atlas-safe', 'place', 7, expect.any(Object), expect.stringMatching(/^journey:atlas-safe:7:place:wikidata:Q146695:/), {
      id: 'wikidata:Q146695', name: 'Phú Quốc', context: 'Kiên Giang, Vietnam', anchor: { latitude: 10.233333, longitude: 103.95 },
    }));
  });

  it('previews an approximate owner interval and accepts an independent private title', async () => {
    const save = jest.fn(async () => 'applied' as const);
    const view = await render(<JourneyCorrectionScreen id="atlas-safe" load={load} save={save} retryProjection={retryProjection} onBack={jest.fn()} onRejected={jest.fn()} />);
    await waitFor(() => expect(view.getByLabelText('Owner journey title')).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'Use approximate owner date' }));
    await fireEvent.changeText(view.getByLabelText('Owner journey title'), 'Spring trip');
    await fireEvent.changeText(view.getByLabelText('Owner approximate start date'), '2024-03-01');
    await fireEvent.changeText(view.getByLabelText('Owner approximate end date'), '2024-03-12');
    await waitFor(() => expect(view.getByLabelText('Owner approximate end date')).toHaveProp('value', '2024-03-12'));
    await fireEvent.press(view.getByRole('button', { name: 'Preview owner title and date claim' }));
    await waitFor(() => expect(view.getByRole('button', { name: 'Save owner title and date claim' })).toBeOnTheScreen());
    expect(view.getByText(/2024-03-01 to 2024-03-12 \(approximate\)/)).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Cancel decision preview' }));
    await fireEvent.changeText(view.getByLabelText('Owner approximate end date'), '');
    await fireEvent.press(view.getByRole('button', { name: 'Preview owner title and date claim' }));
    await waitFor(() => expect(view.getByRole('button', { name: 'Save owner title and date claim' })).toBeOnTheScreen());
    expect(save).not.toHaveBeenCalled();
  });

  it('previews a selected suggested memory before saving its primary membership', async () => {
    const saveMemory = jest.fn(async () => 'applied' as const);
    const memoryLoad = async () => ({
      detail: { id: 'atlas-safe', title: 'Private journey', observedSpan: 'Observed 2024-01-01', visits: [], memories: [{ id: 'memory-1', availability: 'available' as const, membershipState: 'suggested' as const, association: 'Suggested memory membership; separate from destination support.' }], uncertainty: [] }, previews: [], snapshotToken: 7,
    });
    const view = await render(<JourneyCorrectionScreen id="atlas-safe" load={memoryLoad} save={async () => 'applied'} saveMemory={saveMemory} retryProjection={retryProjection} onBack={jest.fn()} onRejected={jest.fn()} />);
    await waitFor(() => expect(view.getByRole('button', { name: 'Preview assign memory-1' })).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'Preview assign memory-1' }));
    await waitFor(() => expect(view.getByRole('button', { name: 'Save memory membership' })).toBeOnTheScreen());
    expect(view.getByText(/does not add visit, place, country, or owner-presence support/i)).toBeOnTheScreen();
    expect(saveMemory).not.toHaveBeenCalled();
    await fireEvent.press(view.getByRole('button', { name: 'Save memory membership' }));
    await waitFor(() => expect(saveMemory).toHaveBeenCalledWith('atlas-safe', 'memory-1', 'assign', 7, expect.stringMatching(/^memory:atlas-safe:7:memory-1:assign:/)));
    expect(view.getByText(/Memory membership saved locally and applied/i)).toBeOnTheScreen();
  });

  it('opens a bounded searchable uncertain-memory page before previewing a membership change', async () => {
    const loadUncertainMemories = jest.fn(async () => ({ memories: [{ id: 'memory-review-1', capturedDay: '2024-02-01', availability: 'available' as const, locationState: 'Location metadata available', association: 'Suggested by 2 journeys; separate from destination support.', membershipState: 'suggested' as const }], hasMore: true }));
    const view = await render(<JourneyCorrectionScreen id="atlas-safe" load={load} save={async () => 'applied'} loadUncertainMemories={loadUncertainMemories} saveMemory={async () => 'applied'} retryProjection={retryProjection} onBack={jest.fn()} onRejected={jest.fn()} />);
    await waitFor(() => expect(view.getByRole('button', { name: 'Review uncertain memories' })).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'Review uncertain memories' }));
    await waitFor(() => expect(view.getByText(/Suggested by 2 journeys/)).toBeOnTheScreen());
    expect(loadUncertainMemories).toHaveBeenCalledWith('atlas-safe', 7, '', 0);
    await fireEvent.press(view.getByRole('button', { name: 'Preview assign memory-review-1' }));
    await waitFor(() => expect(view.getByRole('button', { name: 'Save memory membership' })).toBeOnTheScreen());
  });
});
