import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AtlasClarification, PossibleTripsSection, RecognizableAtlasReveal, type PossibleTripCard } from '@/components/recognizable-atlas-reveal';

const reliable = { id: 'synthetic-reliable', title: 'Verified outing', observedPeriod: 'January 2026', coverUri: null };
const possible: PossibleTripCard = {
  id: 'synthetic-possible', title: 'Nearby outing', observedPeriod: 'February 2026', coverUri: null, reason: 'limited-photos',
};

describe('recognizable Atlas presentation', () => {
  it('allows opening an unmatched outing while withholding write actions', async () => {
    const view = await render(<PossibleTripsSection trips={[{ ...possible, canReview: false }]} selectedId={possible.id}
      reviewState="ready" onOpen={jest.fn()} onClose={jest.fn()} onDecision={jest.fn()} onCheckAgain={jest.fn()} />);
    expect(view.getByText(possible.title)).toBeOnTheScreen();
    expect(view.queryByRole('button', { name: 'Keep as a trip' })).toBeNull();
    expect(view.queryByRole('button', { name: 'Not a trip' })).toBeNull();
    expect(view.getByRole('button', { name: 'Close review' })).toBeOnTheScreen();
  });
  it('routes playback to only the featured trip and leaves provisional review separate', async () => {
    const play = jest.fn();
    const timeline = jest.fn();
    const openReview = jest.fn();
    const view = await render(<RecognizableAtlasReveal observedMap={<Text>Observed places</Text>}
      featuredTrip={reliable} onOpenTrip={jest.fn()} onPlayTrip={play} onOpenTimeline={timeline}
      possibleTrips={<PossibleTripsSection trips={[possible]} selectedId={null} reviewState="ready"
        onOpen={openReview} onClose={jest.fn()} onDecision={jest.fn()} onCheckAgain={jest.fn()} />} />);
    await fireEvent.press(view.getByRole('button', { name: 'Play this trip' }));
    await fireEvent.press(view.getByRole('button', { name: 'Open Timeline' }));
    await fireEvent.press(view.getByRole('button', { name: 'Review possible trip Nearby outing' }));
    expect(play).toHaveBeenCalledWith(reliable.id);
    expect(play).toHaveBeenCalledTimes(1);
    expect(timeline).toHaveBeenCalledTimes(1);
    expect(openReview).toHaveBeenCalledWith(possible.id);
  });

  it('keeps sparse observations explorable and offers no unsupported playback', async () => {
    const open = jest.fn();
    const view = await render(<RecognizableAtlasReveal observedMap={<Text>Observed places</Text>}
      featuredTrip={null} onOpenTrip={open} onOpenTimeline={jest.fn()} />);
    expect(view.getByText('Observed places')).toBeOnTheScreen();
    expect(view.queryByRole('button', { name: 'Play this trip' })).toBeNull();
    await view.rerender(<RecognizableAtlasReveal observedMap={<Text>Observed places</Text>}
      featuredTrip={reliable} onOpenTrip={open} onOpenTimeline={jest.fn()} />);
    await fireEvent.press(view.getByRole('button', { name: 'Open trip' }));
    expect(open).toHaveBeenCalledWith(reliable.id);
  });

  it('keeps the card until verified readback and only checks the existing receipt on unknown acknowledgement', async () => {
    const actions = { onOpen: jest.fn(), onClose: jest.fn(), onDecision: jest.fn(), onCheckAgain: jest.fn() };
    const view = await render(<PossibleTripsSection trips={[possible]} selectedId={possible.id} reviewState="ready" {...actions} />);
    await fireEvent.press(view.getByRole('button', { name: 'Keep as a trip' }));
    expect(actions.onDecision).toHaveBeenCalledWith(possible.id, 'keep');
    expect(view.getByText(possible.title)).toBeOnTheScreen();
    await view.rerender(<PossibleTripsSection trips={[possible]} selectedId={possible.id} reviewState="unknown" {...actions} />);
    expect(view.queryByRole('button', { name: 'Keep as a trip' })).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: 'Check again' }));
    await fireEvent.press(view.getByRole('button', { name: 'Close review' }));
    expect(actions.onCheckAgain).toHaveBeenCalledWith(possible.id);
    expect(actions.onClose).toHaveBeenCalledTimes(1);
    expect(actions.onDecision).toHaveBeenCalledTimes(1);
    await view.rerender(<PossibleTripsSection trips={[]} selectedId={null} reviewState="ready" {...actions} />);
    expect(view.queryByText(possible.title)).toBeNull();
  });
});

describe('first-reveal clarification presentation', () => {
  const offer = {
    id: 'synthetic-offer', periodLabel: 'In 2024',
    previewUris: ['file:///synthetic-first', 'file:///synthetic-second', 'file:///synthetic-over-budget'],
  };

  it('shows a bounded recognizable question without blocking the map or Timeline', async () => {
    const onAnswer = jest.fn();
    const onDismiss = jest.fn();
    const onOpenTimeline = jest.fn();
    const view = await render(<RecognizableAtlasReveal observedMap={<Text>Observed places</Text>}
      featuredTrip={null} onOpenTrip={jest.fn()} onOpenTimeline={onOpenTimeline}
      clarification={<AtlasClarification state={{ kind: 'offered', offer }} onAnswer={onAnswer}
        onDismiss={onDismiss} onCheckAgain={jest.fn()} onUndo={jest.fn()} />} />);
    expect(view.getByText('In 2024')).toBeOnTheScreen();
    expect(view.getByLabelText('Usual place photo 1')).toBeOnTheScreen();
    expect(view.getByLabelText('Usual place photo 2')).toBeOnTheScreen();
    expect(view.queryByLabelText('Usual place photo 3')).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: 'Open Timeline' }));
    expect(onOpenTimeline).toHaveBeenCalledTimes(1);
    await fireEvent.press(view.getByRole('button', { name: 'Yes' }));
    await fireEvent.press(view.getByRole('button', { name: 'No' }));
    await fireEvent.press(view.getByRole('button', { name: 'Not sure' }));
    await fireEvent.press(view.getByRole('button', { name: 'Dismiss usual place question' }));
    expect(onAnswer.mock.calls).toEqual([[offer.id, 'yes'], [offer.id, 'no'], [offer.id, 'not-sure']]);
    expect(onDismiss).toHaveBeenCalledWith(offer.id);
    expect(view.queryByText(/We found/)).toBeNull();
  });

  it('withholds an unrecognizable offer and routes checking and undo to the exact receipt', async () => {
    const actions = { onAnswer: jest.fn(), onDismiss: jest.fn(), onCheckAgain: jest.fn(), onUndo: jest.fn() };
    const view = await render(<AtlasClarification state={{ kind: 'offered', offer: { ...offer, previewUris: [] } }} {...actions} />);
    expect(view.queryByRole('button', { name: 'Yes' })).toBeNull();
    await view.rerender(<AtlasClarification state={{ kind: 'checking' }} {...actions} />);
    expect(view.getByText('Checking your answer…')).toBeOnTheScreen();
    expect(view.queryByText(/We found/)).toBeNull();
    await view.rerender(<AtlasClarification state={{ kind: 'unknown', offerId: offer.id }} {...actions} />);
    await fireEvent.press(view.getByRole('button', { name: 'Check again' }));
    expect(actions.onCheckAgain).toHaveBeenCalledWith(offer.id);
    expect(view.queryByRole('button', { name: 'Undo answer' })).toBeNull();
    await view.rerender(<AtlasClarification state={{ kind: 'verified', answerRevision: 'verified-synthetic-revision',
      addedTrips: [reliable], removedRoutineCount: 2 }} {...actions} />);
    expect(view.getByText('We found one more trip.')).toBeOnTheScreen();
    expect(view.getByText('Everyday photos were removed from the trip list.')).toBeOnTheScreen();
    expect(view.getByText(reliable.title)).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Undo answer' }));
    expect(actions.onUndo).toHaveBeenCalledWith('verified-synthetic-revision');
    await view.rerender(<AtlasClarification state={{ kind: 'stale' }} {...actions} />);
    expect(view.getByText('Your Atlas changed. You can keep exploring.')).toBeOnTheScreen();
    expect(view.queryByRole('button', { name: 'Undo answer' })).toBeNull();
  });
});
