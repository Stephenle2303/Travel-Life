import { buildSharePreview } from '@/share/preview';

describe('selected-share preview', () => {
  it('creates a sanitized immutable preview only from explicit selected facts and media', () => {
    const preview = buildSharePreview({
      title: 'Summer 2024',
      facts: [{ key: 'place-a', label: 'Da Nang', date: { value: '2024-06', precision: 'month' }, status: 'confirmed', selected: true }, { key: 'place-b', label: 'Hidden', date: null, status: 'inferred', selected: false }],
      media: [{ key: 'media-a', kind: 'photo', mimeType: 'image/jpeg', selected: true }, { key: 'media-b', kind: 'video', mimeType: 'video/mp4', selected: false }],
    });

    expect(preview).toEqual({
      schemaVersion: 'travel-life-share-v1', title: 'Summer 2024',
      facts: [{ key: 'place-a', label: 'Da Nang', date: { value: '2024-06', precision: 'month' }, status: 'confirmed' }],
      media: [{ key: 'media-a', kind: 'photo', mimeType: 'image/jpeg' }],
    });
  });

  it('rejects unsafe title or unsupported media instead of silently changing the preview', () => {
    expect(() => buildSharePreview({ title: '<script>', facts: [], media: [] })).toThrow('Share preview is invalid.');
    expect(() => buildSharePreview({ title: 'Okay', facts: [], media: [{ key: 'media-a', kind: 'photo', mimeType: 'image/heic', selected: true }] })).toThrow('Share preview is invalid.');
  });
});
