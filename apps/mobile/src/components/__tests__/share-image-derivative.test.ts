import { ImageManipulator } from 'expo-image-manipulator';
import { createShareImageDerivative } from '@/share/image-derivative';

jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: jest.fn() },
  SaveFormat: { JPEG: 'jpeg' },
}));

describe('share image derivative', () => {
  it('renders a new bounded JPEG instead of returning the selected source', async () => {
    const saveAsync = jest.fn().mockResolvedValue({ uri: 'file:///private/share-derived.jpg', width: 1600, height: 900 });
    const renderAsync = jest.fn().mockResolvedValue({ saveAsync });
    (ImageManipulator.manipulate as jest.Mock).mockReturnValue({ resize: jest.fn(), renderAsync });

    await expect(createShareImageDerivative({ sourceUri: 'file:///private/source.jpg', width: 4000, height: 2250, correlationId: 'runtime-safe-1' })).resolves.toEqual({ uri: 'file:///private/share-derived.jpg', width: 1600, height: 900, mimeType: 'image/jpeg' });
    expect(saveAsync).toHaveBeenCalledWith(expect.objectContaining({ format: 'jpeg', base64: false }));
  });

  it('rejects an invalid encoder result instead of falling back to the source', async () => {
    const renderAsync = jest.fn().mockResolvedValue({ saveAsync: jest.fn().mockResolvedValue({ uri: '', width: 0, height: 0 }) });
    (ImageManipulator.manipulate as jest.Mock).mockReturnValue({ resize: jest.fn(), renderAsync });

    await expect(createShareImageDerivative({ sourceUri: 'file:///private/source.jpg', width: 4000, height: 2250, correlationId: 'runtime-safe-2' })).rejects.toThrow('Share derivative did not finish.');
  });
});
