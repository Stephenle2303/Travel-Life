import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { JourneyEditHub, JourneyLocationTask } from '@/components/journey-edit';

const detail = { id: 'trip-1', title: 'Private journey', observedSpan: 'Observed 2022', visits: [], memories: [], uncertainty: [] };

describe('Journey Edit flow', () => {
  it('keeps the five focused tasks in the shared Edit hub', async () => {
    const task = jest.fn();
    let view!: Awaited<ReturnType<typeof render>>;
    await act(async () => { view = await render(<JourneyEditHub id="trip-1" load={async () => ({ detail })} onBack={jest.fn()} onTask={task} />); await Promise.resolve(); });
    await waitFor(() => expect(view.getByRole('button', { name: 'Edit Location' })).toBeOnTheScreen());
    expect(view.getByRole('button', { name: 'Edit Name & dates' })).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Edit Destinations' })).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Edit Photos in this trip' })).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Edit Trip accuracy' })).toBeOnTheScreen();
    fireEvent.press(view.getByRole('button', { name: 'Edit Location' }));
    expect(task).toHaveBeenCalledWith('location');
  });

  it('fills the field from the selected offline result and keeps confirmation adjacent', async () => {
    const save = jest.fn().mockResolvedValue('pending');
    let view!: Awaited<ReturnType<typeof render>>;
    await act(async () => { view = await render(<JourneyLocationTask id="trip-1" load={async () => ({ detail, snapshotToken: 3 })} save={save} retryProjection={async () => false} onBack={jest.fn()} onApplied={jest.fn()} />); await Promise.resolve(); });
    await waitFor(() => expect(view.getByLabelText('Search a place to confirm')).toBeOnTheScreen());
    fireEvent.changeText(view.getByLabelText('Search a place to confirm'), 'Phú Quốc');
    await waitFor(() => expect(view.getByRole('button', { name: /Select place Phú Quốc/ })).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: /Select place Phú Quốc/ }));
    expect(view.getByLabelText('Search a place to confirm').props.value).toMatch(/Phú Quốc/);
    expect(view.getByRole('button', { name: 'Confirm place' })).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Confirm place' }));
    await waitFor(() => expect(view.getByText(/not been verified/)).toBeOnTheScreen());
  });

  it('keeps the repository rejection visible instead of masking it as a verification failure', async () => {
    const logged = jest.spyOn(console, 'error').mockImplementation();
    try {
      const view = await render(<JourneyLocationTask id="trip-1" load={async () => ({ detail, snapshotToken: 3 })} save={async () => { throw new Error('Review is stale. Reload the journey before saving.'); }} retryProjection={async () => false} onBack={jest.fn()} onApplied={jest.fn()} />);
      await waitFor(() => expect(view.getByLabelText('Search a place to confirm')).toBeOnTheScreen());
      fireEvent.changeText(view.getByLabelText('Search a place to confirm'), 'Phú Quốc');
      await fireEvent.press(await view.findByRole('button', { name: /Select place Phú Quốc/ }));
      await fireEvent.press(view.getByRole('button', { name: 'Confirm place' }));
      await waitFor(() => expect(view.getByText(/Review is stale\. Reload the journey before saving\./)).toBeOnTheScreen());
      expect(logged).toHaveBeenCalledWith('journey-place-save-failed', 'Review is stale. Reload the journey before saving.');
    } finally { logged.mockRestore(); }
  });
});
