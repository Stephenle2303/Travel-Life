import * as Sharing from 'expo-sharing';
import { execute, getMediaInformation, pickEncoder } from 'munim-ffmpeg';
import { munimReplayRenderer, replayFailureStage, runSyntheticS0, shareReplayArtifact, unavailableReplayRenderer } from '@/replay/renderer';

jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('expo-file-system/legacy', () => ({ cacheDirectory: 'file:///cache/', makeDirectoryAsync: jest.fn(), deleteAsync: jest.fn(), copyAsync: jest.fn(), writeAsStringAsync: jest.fn(), getInfoAsync: jest.fn() }));
jest.mock('munim-ffmpeg', () => ({ execute: jest.fn(), getMediaInformation: jest.fn(), pickEncoder: jest.fn() }));

describe('Replay renderer gate', () => {
  it('fails closed before a native renderer passes S0', async () => {
    await expect(unavailableReplayRenderer.render({ generation: 1, groupKeys: ['a', 'b'], memoryKeys: [], durationSeconds: 30 }, [], new AbortController().signal)).rejects.toThrow('REPLAY_UNAVAILABLE');
  });
  it('retains a closed preparation stage from a prior native refresh realm', () => {
    expect(replayFailureStage({ stage: 'REPLAY_ACCESS' })).toBe('REPLAY_ACCESS');
    expect(replayFailureStage({ stage: 'untrusted native detail' })).toBe('REPLAY_UNAVAILABLE');
  });
  it('uses only the closed native share result and never passes FFmpeg logs', async () => {
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(false);
    await expect(shareReplayArtifact({ uri: 'file:///private.mp4', digest: 'digest', manifest: { generation: 1, groupKeys: ['a', 'b'], memoryKeys: [], durationSeconds: 30 } })).resolves.toBe('unavailable');
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
    await runSyntheticS0(['-version']);
    expect(execute).toHaveBeenCalledWith(['-version']);
    expect(jest.mocked(execute).mock.calls[0]).toHaveLength(1);
  });
  it('keeps a selected video as a bounded moving clip without frozen filler', async () => {
    jest.mocked(execute).mockResolvedValue({ success: true } as never);
    jest.mocked(pickEncoder).mockResolvedValue('libopenh264' as never);
    jest.mocked(getMediaInformation)
      .mockResolvedValueOnce({ format: { duration: '0.5' }, streams: [{ codec_type: 'video', codec_name: 'h264', width: 1280, height: 720, pix_fmt: 'yuv420p' }] } as never)
      .mockResolvedValueOnce({ format: { duration: '0.5' }, streams: [{ codec_type: 'video', codec_name: 'h264', width: 1280, height: 720, pix_fmt: 'yuv420p' }] } as never);
    const FileSystem = jest.requireMock('expo-file-system/legacy') as { getInfoAsync: jest.Mock };
    FileSystem.getInfoAsync.mockResolvedValue({ exists: true, size: 1024 });
    await expect(munimReplayRenderer.render({ generation: 1, groupKeys: ['a'], memoryKeys: ['video'], durationSeconds: 5, chapters: [{ groupKey: 'a', memoryKeys: ['video'], frames: 120 }] }, [{ memoryKey: 'video', groupKey: 'a', kind: 'video', uri: 'file:///owner-video.mp4' }], new AbortController().signal)).resolves.toMatchObject({ uri: expect.stringContaining('.mp4'), manifest: { durationSeconds: 0.5 } });
    const commands = jest.mocked(execute).mock.calls.map(([arguments_]) => arguments_);
    expect(commands.some((arguments_) => arguments_.some((argument) => argument.includes('tpad=stop_mode=clone')))).toBe(false);
    expect(commands.some((arguments_) => arguments_.some((argument) => argument.includes('trim=duration=0.500000')))).toBe(true);
    expect(commands.some((arguments_) => arguments_.includes('file:///cache/replay-1') && arguments_.includes('-frames:v') && arguments_.includes('1'))).toBe(false);
  });
  it('renders a neutral local slate for a visible trip with no usable attachment', async () => {
    jest.mocked(execute).mockResolvedValue({ success: true } as never);
    jest.mocked(pickEncoder).mockResolvedValue('libopenh264' as never);
    jest.mocked(getMediaInformation).mockResolvedValue({ format: { duration: '3' }, streams: [{ codec_type: 'video', codec_name: 'h264', width: 1280, height: 720, pix_fmt: 'yuv420p' }] } as never);
    const FileSystem = jest.requireMock('expo-file-system/legacy') as { getInfoAsync: jest.Mock };
    FileSystem.getInfoAsync.mockResolvedValue({ exists: true, size: 1024 });
    await expect(munimReplayRenderer.render({ generation: 1, groupKeys: ['a'], memoryKeys: [], durationSeconds: 3, chapters: [{ groupKey: 'a', memoryKeys: [], frames: 72 }] }, [], new AbortController().signal)).resolves.toMatchObject({ manifest: { durationSeconds: 3 } });
    expect(jest.mocked(execute).mock.calls.some(([arguments_]) => arguments_.includes('color=c=#102C26:s=1280x720:r=24'))).toBe(true);
  });
  it('renders a sanitized private chapter card inside, rather than beyond, its frame budget', async () => {
    jest.mocked(execute).mockResolvedValue({ success: true } as never);
    jest.mocked(pickEncoder).mockResolvedValue('libopenh264' as never);
    jest.mocked(getMediaInformation).mockResolvedValue({ format: { duration: '5' }, streams: [{ codec_type: 'video', codec_name: 'h264', width: 1280, height: 720, pix_fmt: 'yuv420p' }] } as never);
    const FileSystem = jest.requireMock('expo-file-system/legacy') as { getInfoAsync: jest.Mock };
    FileSystem.getInfoAsync.mockResolvedValue({ exists: true, size: 1024 });
    await expect(munimReplayRenderer.render({ generation: 1, groupKeys: ['a'], memoryKeys: ['photo'], durationSeconds: 5, chapters: [{ groupKey: 'a', memoryKeys: ['photo'], frames: 120, card: { labelToken: "Private: place's name", timeToken: '2024:01', frames: 24 } }] }, [{ memoryKey: 'photo', groupKey: 'a', kind: 'photo', uri: 'file:///owner-photo.jpg' }], new AbortController().signal)).resolves.toMatchObject({ manifest: { durationSeconds: 5 } });
    const cardCommand = jest.mocked(execute).mock.calls.map(([arguments_]) => arguments_).find((arguments_) => arguments_.some((argument) => argument.includes("drawtext=text='Private place s name'")));
    expect(cardCommand).toEqual(expect.arrayContaining(['-vf', expect.stringContaining("drawtext=text='Private place s name'")]));
    expect(cardCommand?.join(' ')).not.toContain('2024:01');
  });
});
