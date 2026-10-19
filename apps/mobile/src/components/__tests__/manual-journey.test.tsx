import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ManualJourneyScreen } from '@/components/manual-journey';
import type { ManualJourneyInput } from '@/import-record';

async function completeDraft(view: Awaited<ReturnType<typeof render>>) {
  await fireEvent.changeText(view.getByLabelText('Destination label'), 'Kyoto');
  await fireEvent.press(view.getByRole('button', { name: 'Select local place Kyōto Prefecture' }));
  await fireEvent.changeText(view.getByLabelText('Exact date'), '2024-04-01');
}

describe('ManualJourneyScreen', () => {
  it('creates a reviewed separate assertion with a retry-stable command key', async () => {
    const findOverlaps = jest.fn<Promise<never[]>, [ManualJourneyInput]>(async (_input) => []);
    const save = jest.fn<Promise<string>, [ManualJourneyInput]>(async (_input) => 'manual:kyoto'); const cancel = jest.fn();
    const view = await render(<ManualJourneyScreen findOverlaps={findOverlaps} save={save} onCancel={cancel} onEditExisting={jest.fn()} />);
    await completeDraft(view);
    await fireEvent.press(view.getByRole('button', { name: 'Review journey overlap' }));
    await waitFor(() => expect(view.getByRole('button', { name: 'Keep journey as a separate owner-entered record' })).toBeOnTheScreen());
    const reviewed = findOverlaps.mock.calls[0][0] as ManualJourneyInput;
    await fireEvent.press(view.getByRole('button', { name: 'Keep journey as a separate owner-entered record' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0][0]).toMatchObject({ commandKey: reviewed.commandKey, label: 'Kyōto Prefecture', context: 'Japan', date: { kind: 'exact', day: '2024-04-01' }, reviewedOverlapIds: [] });
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('keeps an invalid or reversed approximate claim out of persistence', async () => {
    const findOverlaps = jest.fn(async (input: ManualJourneyInput) => {
      if (input.date.kind === 'approximate' && input.date.startDay > input.date.endDay) throw new Error('Enter an ordered approximate date interval as YYYY-MM-DD.');
      return [];
    });
    const save = jest.fn(); const view = await render(<ManualJourneyScreen findOverlaps={findOverlaps} save={save} onCancel={jest.fn()} onEditExisting={jest.fn()} />);
    await fireEvent.changeText(view.getByLabelText('Destination label'), 'Kyoto'); await fireEvent.press(view.getByRole('button', { name: 'Select local place Kyōto Prefecture' }));
    await fireEvent.press(view.getByRole('button', { name: 'Use approximate date range' }));
    await fireEvent.changeText(view.getByLabelText('Approximate start date'), '2024-05-10'); await fireEvent.changeText(view.getByLabelText('Approximate end date'), '2024-05-01');
    await fireEvent.press(view.getByRole('button', { name: 'Review journey overlap' }));
    await waitFor(() => expect(view.getByText('Enter an ordered approximate date interval as YYYY-MM-DD.')).toBeOnTheScreen());
    expect(save).not.toHaveBeenCalled();
  });

  it('keeps a manual overlap separate and requires an explicit inferred target for Edit', async () => {
    const overlaps = [{ id: 'manual:old', label: 'Old trip · owner-entered', editable: false }, { id: 'atlas-inferred-a', label: 'Existing inferred journey', editable: true }, { id: 'atlas-inferred-b', label: 'Existing inferred journey', editable: true }];
    const save = jest.fn(async () => 'manual:new'); const edit = jest.fn();
    const view = await render(<ManualJourneyScreen findOverlaps={async () => overlaps} save={save} onCancel={jest.fn()} onEditExisting={edit} />);
    await completeDraft(view); await fireEvent.press(view.getByRole('button', { name: 'Review journey overlap' }));
    await waitFor(() => expect(view.getAllByRole('button', { name: 'Edit Existing inferred journey' })).toHaveLength(2));
    expect(view.queryByRole('button', { name: /Edit Old trip/ })).toBeNull();
    await fireEvent.press(view.getAllByRole('button', { name: 'Edit Existing inferred journey' })[1]);
    expect(edit).toHaveBeenCalledWith('atlas-inferred-b'); expect(save).not.toHaveBeenCalled();
  });

  it('preserves the draft on a stale-overlap rejection and cancel returns without a write', async () => {
    const save = jest.fn(async () => { throw new Error('The private record changed after overlap review. Review overlaps again before saving.'); }); const cancel = jest.fn();
    const view = await render(<ManualJourneyScreen findOverlaps={async () => []} save={save} onCancel={cancel} onEditExisting={jest.fn()} />);
    await completeDraft(view); await fireEvent.press(view.getByRole('button', { name: 'Review journey overlap' }));
    await waitFor(() => expect(view.getByRole('button', { name: 'Keep journey as a separate owner-entered record' })).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'Keep journey as a separate owner-entered record' }));
    await waitFor(() => expect(view.getByText(/changed after overlap review/)).toBeOnTheScreen());
    expect(view.getByDisplayValue('Kyōto Prefecture')).toBeOnTheScreen(); expect(cancel).not.toHaveBeenCalled();
    await fireEvent.press(view.getByRole('button', { name: 'Cancel adding a journey' })); expect(cancel).toHaveBeenCalledTimes(1);
  });
});
