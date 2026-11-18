import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { JourneyMediaViewer } from '@/components/journey-media-viewer';

jest.mock('expo-video', () => ({
  useVideoPlayer: () => ({ pause: jest.fn(), play: jest.fn() }),
  VideoView: () => null,
}));

const detail = { id: 'journey-1', title: 'Private journey', observedSpan: 'Observed 2025', visits: [], memories: [], uncertainty: [] };
const photo = { uri: 'file:///photo.jpg', availability: 'available' as const, kind: 'photo' as const };

describe('JourneyMediaViewer', () => {
  it('discards a late inspection result after leaving the selected photo', async () => {
    let resolve!: (value: string) => void;
    const inspect = jest.fn(() => new Promise<string>((done) => { resolve = done; }));
    const loadPage = async () => ({ page: { items: [{ id: 'media-1', availability: 'available' as const,
      association: 'Visit support', kind: 'photo' as const }], hasMore: false }, previews: [photo] });
    const view = await render(<JourneyMediaViewer detail={detail} previews={[]} loadPage={loadPage} inspect={inspect} onClose={jest.fn()} />);
    await fireEvent.press(await view.findByTestId('journey-media-tile-media-1'));
    await fireEvent.press(view.getByRole('button', { name: 'Inspect this media' }));
    expect(inspect).toHaveBeenCalledWith('media-1', photo.uri);
    await fireEvent.press(view.getByRole('button', { name: 'Back to gallery' }));
    await act(async () => { resolve('Late inspection result'); });
    await fireEvent.press(view.getByTestId('journey-media-tile-media-1'));
    expect(view.queryByText('Late inspection result')).toBeNull();
  });

  it('appends batches into one grid and keeps the grid after Back', async () => {
    const loadPage = jest.fn()
      .mockResolvedValueOnce({ page: { items: [{ id: 'first', availability: 'available' as const, association: 'First associated item', kind: 'photo' as const }], hasMore: true }, previews: [photo] })
      .mockResolvedValueOnce({ page: { items: [{ id: 'second', availability: 'available' as const, association: 'Second associated item', kind: 'photo' as const }], hasMore: false }, previews: [photo] });
    const view = await render(<JourneyMediaViewer detail={detail} previews={[]} sessionKey="journey-1:7" loadPage={loadPage} onClose={jest.fn()} />);

    await waitFor(() => expect(view.getByTestId('journey-media-tile-first')).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'Load more media' }));
    await waitFor(() => expect(view.getByTestId('journey-media-tile-second')).toBeOnTheScreen());
    expect(loadPage).toHaveBeenNthCalledWith(1, 0);
    expect(loadPage).toHaveBeenNthCalledWith(2, 1);
    expect(loadPage).toHaveBeenCalledTimes(2);
    expect(view.getByTestId('journey-media-tile-first')).toBeOnTheScreen();

    await fireEvent.press(view.getByTestId('journey-media-tile-second'));
    await fireEvent.press(view.getByRole('button', { name: 'Back to gallery' }));
    expect(view.getByTestId('journey-media-grid')).toBeOnTheScreen();
    expect(view.getByTestId('journey-media-tile-first')).toBeOnTheScreen();
    expect(view.getByTestId('journey-media-tile-second')).toBeOnTheScreen();
  });

  it('retains prior items when a later batch fails and retries the same page', async () => {
    const loadPage = jest.fn()
      .mockResolvedValueOnce({ page: { items: [{ id: 'first', availability: 'available' as const, association: 'First associated item', kind: 'photo' as const }], hasMore: true }, previews: [photo] })
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValueOnce({ page: { items: [{ id: 'second', availability: 'available' as const, association: 'Second associated item', kind: 'photo' as const }], hasMore: false }, previews: [photo] });
    const view = await render(<JourneyMediaViewer detail={detail} previews={[]} sessionKey="journey-1:8" loadPage={loadPage} onClose={jest.fn()} />);

    await waitFor(() => expect(view.getByRole('button', { name: 'Load more media' })).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'Load more media' }));
    await waitFor(() => expect(view.getByRole('button', { name: 'Retry media page' })).toBeOnTheScreen());
    expect(view.getByTestId('journey-media-tile-first')).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Retry media page' }));
    await waitFor(() => expect(view.getByTestId('journey-media-tile-second')).toBeOnTheScreen());
    expect(loadPage).toHaveBeenNthCalledWith(2, 1);
    expect(loadPage).toHaveBeenNthCalledWith(3, 1);
  });
});
