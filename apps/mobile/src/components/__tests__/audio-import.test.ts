import * as FileSystem from 'expo-file-system/legacy';
import { importReplayAudio } from '@/replay/audio-import';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  copyAsync: jest.fn(),
  getInfoAsync: jest.fn(),
  deleteAsync: jest.fn(),
}));

describe('Replay private audio destination validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(FileSystem.copyAsync).mockResolvedValue(undefined);
    jest.mocked(FileSystem.deleteAsync).mockResolvedValue(undefined);
  });

  it.each([
    ['missing', { exists: false }],
    ['empty', { exists: true, size: 0 }],
    ['oversized', { exists: true, size: 5_000_001 }],
    ['unreadable', null],
  ])('rejects a %s private copy despite valid picker metadata', async (_name, destination) => {
    if (destination === null) jest.mocked(FileSystem.getInfoAsync).mockRejectedValueOnce(new Error('synthetic read failure'));
    else jest.mocked(FileSystem.getInfoAsync).mockResolvedValueOnce(destination as FileSystem.FileInfo);

    const importing = importReplayAudio({ uri: 'file:///cache/song.m4a', name: 'song.m4a', size: 1024 });

    await expect(importing).rejects.toBeInstanceOf(Error);
    const copiedUri = jest.mocked(FileSystem.copyAsync).mock.calls[0]![0].to;
    expect(FileSystem.getInfoAsync).toHaveBeenCalledWith(copiedUri);
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(copiedUri, { idempotent: true });
  });
});
