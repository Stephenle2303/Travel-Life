import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { JourneyPrivacyManager, JourneyPrivacyTask } from '@/components/journey-privacy';
import { JourneyEditHub } from '@/components/journey-edit';
import { createPrivateSelection, projectReveal } from '@/reveal/projection';

beforeEach(() => { jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(new Promise<boolean>(() => {})); });
afterEach(() => jest.restoreAllMocks());

it('requires an explicit reviewed-scope exclusion confirmation and supports cancellation', async () => {
  const save = jest.fn(async () => undefined); const applied = jest.fn();
  const review = async () => ({ reviewId: 'review', title: 'Synthetic journey', ownerEntered: false, supportingPhotoCount: 3, duplicatePhotoCount: 1, duplicateFamilyCount: 1 });
  const view = await render(<JourneyPrivacyTask id="trip" review={review} save={save} onBack={jest.fn()} onApplied={applied} />);
  await waitFor(() => expect(view.getByRole('button', { name: 'Exclude reviewed travel evidence' })).toBeOnTheScreen());
  expect(view.getByText(/3 supporting photos or videos, plus 1 duplicate/)).toBeOnTheScreen();
  await fireEvent.press(view.getByRole('button', { name: 'Exclude reviewed travel evidence' }));
  expect(save).not.toHaveBeenCalled();
  await fireEvent.press(view.getByRole('button', { name: 'Cancel privacy change' }));
  expect(save).not.toHaveBeenCalled();
  await fireEvent.press(view.getByRole('button', { name: 'Exclude reviewed travel evidence' }));
  await fireEvent.press(view.getByRole('button', { name: 'Confirm exclude evidence' }));
  await waitFor(() => expect(applied).toHaveBeenCalledTimes(1));
  expect(save).toHaveBeenCalledWith('review', 'exclude', expect.any(String), 'trip');
});

it('offers only Hide for owner-entered journeys and keeps their privacy task accessible', async () => {
  const review = async () => ({ reviewId: 'manual-review', title: 'Synthetic manual', ownerEntered: true, supportingPhotoCount: 0, duplicatePhotoCount: 0, duplicateFamilyCount: 0 });
  const view = await render(<JourneyPrivacyTask id="manual:id" review={review} save={jest.fn()} onBack={jest.fn()} onApplied={jest.fn()} />);
  await waitFor(() => expect(view.getByRole('button', { name: 'Hide this journey' })).toBeOnTheScreen());
  expect(view.queryByRole('button', { name: 'Exclude reviewed travel evidence' })).toBeNull();
  const hub = await render(<JourneyEditHub id="manual:id" load={async () => ({ detail: { id: 'manual:id', title: 'Synthetic', ownerEntered: true, visits: [], memories: [], uncertainty: [], observedSpan: 'Owner claim' } })} onBack={jest.fn()} onTask={jest.fn()} />);
  await waitFor(() => expect(hub.getByRole('button', { name: 'Edit Visibility & evidence' })).toBeOnTheScreen());
  expect(hub.queryByRole('button', { name: 'Edit Trip accuracy' })).toBeNull();
});

it('keeps an ambiguous protected scope restorable with explicit confirmation', async () => {
  const policy = { policyId: 'policy', revision: 4, action: 'exclude' as const, title: 'Synthetic scope', supportingPhotoCount: 4, duplicateFamilyCount: 1, status: 'protected' as const };
  let restored = false;
  const load = async () => restored ? [] : [policy];
  const restore = jest.fn(async () => { restored = true; });
  const view = await render(<JourneyPrivacyManager load={load} restore={restore} />);
  await fireEvent.press(await view.findByRole('button', { name: 'Restore Synthetic scope' }));
  expect(restore).not.toHaveBeenCalled();
  await fireEvent.press(view.getByRole('button', { name: 'Confirm restore privacy choice' }));
  await waitFor(() => expect(restore).toHaveBeenCalledWith('policy', 4, expect.any(String)));
  expect(createPrivateSelection()).toEqual([]);
});

it('withholds native graph fallback before durable privacy eligibility has loaded', () => {
  const model = projectReveal({ graph: { ruleVersion: 'reconstruction-v1', places: [], visits: [], journeys: [{ id: 'internal-private', visitIds: [], state: 'inferred' }], memberships: [], dispositions: [], possibleMerges: [] }, privacyReady: false, reconstructionStatus: 'complete', reconciliationStatus: 'complete', pendingCount: 0, sourceScope: 'full', importedCount: 1 });
  expect(model.journeys).toEqual([]);
  expect(model.replay.eligible).toBe(false);
});

it('distinguishes pending, failed and empty privacy lists and retries a failed load', async () => {
  let rejectLoad!: (error: Error) => void;
  const load = jest.fn<Promise<[]>, []>()
    .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectLoad = reject; }))
    .mockResolvedValue([]);
  const view = await render(<JourneyPrivacyManager load={load} restore={jest.fn()} />);
  expect(view.queryByText('No hidden journey or excluded evidence scope is listed.')).toBeNull();
  rejectLoad(new Error('Synthetic unavailable read'));
  await waitFor(() => expect(view.getByRole('button', { name: 'Reload privacy choices' })).toBeOnTheScreen());
  expect(view.queryByText('No hidden journey or excluded evidence scope is listed.')).toBeNull();
  await fireEvent.press(view.getByRole('button', { name: 'Reload privacy choices' }));
  await waitFor(() => expect(view.getByText('No hidden journey or excluded evidence scope is listed.')).toBeOnTheScreen());
});

it('reviews hide scope, cancels and requires confirmation for the current journey', async () => {
  const save = jest.fn(async () => undefined);
  const review = async (id: string) => ({ reviewId: `review:${id}`, title: id, ownerEntered: false,
    supportingPhotoCount: 3, duplicatePhotoCount: 1, duplicateFamilyCount: 1, hideMediaCount: 6, affectedJourneyCount: 2 });
  const view = await render(<JourneyPrivacyTask id="one" review={review} save={save} onBack={jest.fn()} onApplied={jest.fn()} />);
  await waitFor(() => expect(view.getByRole('button', { name: 'Hide this journey' })).toBeOnTheScreen());
  expect(view.getByText(/6 reviewed photos or videos/)).toBeOnTheScreen();
  await fireEvent.press(view.getByRole('button', { name: 'Hide this journey' }));
  await fireEvent.press(view.getByRole('button', { name: 'Cancel privacy change' }));
  expect(save).not.toHaveBeenCalled();
  await fireEvent.press(view.getByRole('button', { name: 'Hide this journey' }));
  await view.rerender(<JourneyPrivacyTask id="two" review={review} save={save} onBack={jest.fn()} onApplied={jest.fn()} />);
  await waitFor(() => expect(view.getByText('two')).toBeOnTheScreen());
  expect(view.queryByRole('button', { name: 'Confirm hide journey' })).toBeNull();
  await fireEvent.press(view.getByRole('button', { name: 'Hide this journey' }));
  await fireEvent.press(view.getByRole('button', { name: 'Confirm hide journey' }));
  await waitFor(() => expect(save).toHaveBeenCalledWith('review:two', 'hide', expect.any(String), 'two'));
});
