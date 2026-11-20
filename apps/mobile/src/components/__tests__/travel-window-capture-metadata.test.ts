import type { AppDiagnosticEvent } from '@/diagnostics/app-diagnostics';
import {
  bucketFolderCategory, classifyProvenance, inferOffsetFromLocalClock, parseExifLocalTimestampMillis, parseExifOffsetMinutes,
  scanCaptureMetadata, toCaptureRecord, CaptureMetadataError,
  type CaptureAsset,
} from '@/travel-window';

const asset = (n: number): CaptureAsset => ({ id: `asset-${n}`, uri: `file:///storage/emulated/0/DCIM/Camera/IMG_${n}.jpg`, capturedAtMillis: 1_780_000_000_000 + n, located: false });
const nativeError = (code: string) => Object.assign(new Error(`native detail /storage/emulated/0/DCIM/Camera/IMG_1.jpg ${code}`), { code });

describe('EXIF offset parsing', () => {
  it.each([
    ['+09:00', 540], ['+07:00', 420], ['-05:30', -330], ['+05:45', 345], [' +09:00 ', 540], ['+14:00', 840], ['-00:00', -0],
  ])('reads %s', (value, minutes) => expect(parseExifOffsetMinutes(value)).toBe(minutes));

  it.each([null, undefined, 9, '', 'Z', '+9:00', '+0900', '+15:00', '+14:30', '+09:60', 'GMT+9'])('treats %p as unknown', (value) => {
    expect(parseExifOffsetMinutes(value)).toBeNull();
  });
});

describe('EXIF local wall-clock parsing', () => {
  it.each([
    ['2026:11:03 14:30:00', Date.UTC(2026, 10, 3, 14, 30, 0)],
    ['2026:01:01 00:00:00', Date.UTC(2026, 0, 1, 0, 0, 0)],
    ['2026:12:31 23:59:59', Date.UTC(2026, 11, 31, 23, 59, 59)],
  ])('reads %s', (value, millis) => expect(parseExifLocalTimestampMillis(value)).toBe(millis));

  it.each([null, undefined, 9, '', '2026-11-03 14:30:00', '2026:11:03T14:30:00', '2026:13:01 00:00:00', '2026:11:32 00:00:00', '2026:11:03 24:00:00', '2026:11:03 00:60:00', '2026:11:03 00:00:60'])(
    'treats %p as unknown', (value) => expect(parseExifLocalTimestampMillis(value)).toBeNull(),
  );
});

describe('inferring offset from local-clock mismatch', () => {
  const trueUtc = Date.UTC(2026, 10, 3, 5, 0, 0); // 05:00 UTC

  it('reveals a Korea-sized shift from the camera local clock', () => {
    const local = Date.UTC(2026, 10, 3, 14, 0, 0); // camera says 14:00, true UTC is 05:00 => +09:00
    expect(inferOffsetFromLocalClock(local, trueUtc)).toBe(540);
  });

  it('rounds small clock drift to the nearest 15 minutes', () => {
    const local = Date.UTC(2026, 10, 3, 14, 1, 40); // ~9h01m40s, nearest 15-minute offset is still +09:00
    expect(inferOffsetFromLocalClock(local, trueUtc)).toBe(540);
  });

  it('rejects an implausible shift as clock skew, not a timezone', () => {
    const local = Date.UTC(2026, 10, 5, 5, 0, 0); // 2 days off: far past +14:00/-12:00
    expect(inferOffsetFromLocalClock(local, trueUtc)).toBeNull();
  });

  it('returns null without a parsed local timestamp', () => {
    expect(inferOffsetFromLocalClock(null, trueUtc)).toBeNull();
  });
});

describe('research-only folder bucketing (never a production decision)', () => {
  it.each([
    [null, 'no-folder-data'], [undefined, 'no-folder-data'], [42, 'no-folder-data'], ['', 'empty'],
    ['DCIM/Camera/', 'dcim-camera'], ['dcim/camera/', 'dcim-camera'],
    ['DCIM/', 'dcim-root'], ['DCIM/100ANDRO/', 'dcim-other-subfolder'], ['DCIM/OpenCamera/', 'dcim-other-subfolder'],
    ['Pictures/', 'pictures'], ['Pictures/Edited/', 'pictures'],
    ['Movies/', 'movies'], ['Music/', 'music'], ['Documents/', 'documents'],
    ['Android/media/com.some.app/', 'android-media'], ['Android/data/com.some.app/files/', 'android-data'],
    ['Bluetooth/', 'other-top-level'], ['SomeRandomApp/Exports/', 'other-top-level'],
  ])('%s -> %s', (folder, category) => expect(bucketFolderCategory(folder)).toBe(category));

  it('never includes the input folder text in its output', () => {
    const secret = 'MySecretDiaryPhotos2026';
    expect(bucketFolderCategory(`${secret}/`)).not.toContain(secret);
    expect(bucketFolderCategory(`Android/media/${secret}/`)).not.toContain(secret);
  });
});

describe('provenance from folder', () => {
  it.each([
    ['DCIM/Camera/', 'camera'],
    ['dcim/camera/', 'camera'],
    ['DCIM/Camera/Burst/', 'camera'],
    ['DCIM/Screenshots/', 'screenshot'],
    ['Pictures/Screenshots/', 'screenshot'],
    ['DCIM/ScreenRecorder/', 'screenshot'],
    ['Pictures/WhatsApp/', 'messaging'],
    ['Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Images/', 'messaging'],
    ['Pictures/Zalo/', 'messaging'],
    ['Pictures/Telegram/', 'messaging'],
    ['Pictures/KakaoTalk/', 'messaging'],
    ['Pictures/LINE/', 'messaging'],
    ['Download/', 'download'],
    ['Downloads/Trip/', 'download'],
    ['Pictures/', 'unknown'],
    ['DCIM/', 'unknown'],
    ['DCIM/Facebook/', 'unknown'],
    ['Pictures/Timeline/', 'unknown'],
    ['', 'unknown'],
  ])('%s is %s', (folder, expected) => expect(classifyProvenance(folder)).toBe(expected));

  it('never assumes camera without a folder', () => {
    expect(classifyProvenance(null)).toBe('unknown');
    expect(classifyProvenance(undefined)).toBe('unknown');
    expect(classifyProvenance(42)).toBe('unknown');
  });

  it.each([
    ['takeout-20261021T052809Z-1-001/Takeout/Google Photos/Photos from 2022/', 'imported'],
    ['Takeout/Google Photos/2015.11_Korea - Autumn Tail/', 'imported'],
    ['takeout-20200101T000000Z-1-001/Takeout/Google Photos/Profile pictures/', 'imported'],
    ['TAKEOUT/GOOGLE PHOTOS/Photos from 2013/', 'imported'],
  ])('%s is imported (decision 0020)', (folder, expected) => expect(classifyProvenance(folder)).toBe(expected));

  it.each([
    ['Takeout/', 'unknown'],
    ['Google Photos/', 'unknown'],
    ['Pictures/Takeout/', 'unknown'],
    ['MyTakeoutBackup/Google Photos/', 'unknown'],
  ])('%s does not loosely match the Takeout pattern: is %s', (folder, expected) => expect(classifyProvenance(folder)).toBe(expected));

  it('screenshot and messaging folders still win even nested under a Takeout-like path', () => {
    expect(classifyProvenance('Screenshots/Takeout/Google Photos/')).toBe('screenshot');
  });
});

describe('native result mapping', () => {
  it('prefers the original offset and falls back to digitized', () => {
    expect(toCaptureRecord(asset(1), { offsetTimeOriginal: '+09:00', offsetTimeDigitized: '+07:00', relativeDirectory: 'DCIM/Camera/' }))
      .toEqual({ id: 'asset-1', capturedAtMillis: asset(1).capturedAtMillis, utcOffsetMinutes: 540, provenance: 'camera', located: false });
    expect(toCaptureRecord(asset(1), { offsetTimeOriginal: null, offsetTimeDigitized: '+07:00', relativeDirectory: null }).utcOffsetMinutes).toBe(420);
    expect(toCaptureRecord(asset(1), {}).utcOffsetMinutes).toBeNull();
  });

  it('keeps the caller located flag and never stores the folder', () => {
    const record = toCaptureRecord({ ...asset(2), located: true }, { relativeDirectory: 'DCIM/Camera/' });
    expect(record.located).toBe(true);
    expect(JSON.stringify(record)).not.toContain('DCIM');
  });

  it('also treats the native EXIF GPS check alone as located, even when the caller flag is false', () => {
    // The real on-device bug this covers: every production caller passes
    // located: false unconditionally, so a GPS-tagged photo (already owned
    // by the separate reconstruction engine) was never excluded here before
    // the native reader started reporting hasLocation.
    expect(toCaptureRecord(asset(3), { relativeDirectory: 'DCIM/Camera/', hasLocation: true }).located).toBe(true);
  });

  it('stays not-located when the native reader omits or falsifies hasLocation', () => {
    expect(toCaptureRecord(asset(4), { relativeDirectory: 'DCIM/Camera/' }).located).toBe(false);
    expect(toCaptureRecord(asset(4), { relativeDirectory: 'DCIM/Camera/', hasLocation: false }).located).toBe(false);
    expect(toCaptureRecord(asset(4), { relativeDirectory: 'DCIM/Camera/', hasLocation: 'yes' }).located).toBe(false);
  });

  it.each([null, undefined, 'x', 3, ['DCIM/Camera/']])('rejects malformed result %p as schema', (value) => {
    expect(() => toCaptureRecord(asset(1), value)).toThrow(CaptureMetadataError);
    try { toCaptureRecord(asset(1), value); } catch (error) { expect((error as CaptureMetadataError).reasonCode).toBe('MEDIA_SCHEMA'); }
  });
});

describe('capture metadata scan', () => {
  function collect() {
    const events: AppDiagnosticEvent[] = [];
    return { events, record: (event: AppDiagnosticEvent) => events.push(event) };
  }

  it('reports an unavailable native reader as skipped, not an error', async () => {
    const { events, record } = collect();
    await expect(scanCaptureMetadata(null, [asset(1)], { correlationId: 'c1', record })).resolves.toEqual({ status: 'skipped', reasonCode: 'MEDIA_UNAVAILABLE' });
    expect(events).toEqual([{ operation: 'TRAVEL_WINDOW_SCAN', reasonCode: 'MEDIA_UNAVAILABLE', stage: 'CAPTURE_METADATA_READ', retryable: false, durableOutcome: 'skipped', correlationId: 'c1' }]);
  });

  it('turns one unreadable capture into a review-only record and keeps scanning', async () => {
    const { events, record } = collect();
    const read = jest.fn(async (uri: string) => {
      if (uri.endsWith('IMG_2.jpg')) throw nativeError('ERR_CAPTURE_DECODE');
      if (uri.endsWith('IMG_3.jpg')) throw new Error('surprise');
      if (uri.endsWith('IMG_4.jpg')) return 'not an object';
      return { offsetTimeOriginal: '+09:00', relativeDirectory: 'DCIM/Camera/' };
    });
    const result = await scanCaptureMetadata(read, [1, 2, 3, 4, 5].map(asset), { correlationId: 'c2', record });
    expect(result.status).toBe('complete');
    if (result.status !== 'complete') return;
    expect(result.records.map((r) => [r.id, r.provenance, r.utcOffsetMinutes])).toEqual([
      ['asset-1', 'camera', 540], ['asset-2', 'unknown', null], ['asset-3', 'unknown', null], ['asset-4', 'unknown', null], ['asset-5', 'camera', 540],
    ]);
    expect(result.unreadable).toEqual({ MEDIA_DECODE: 1, UNKNOWN: 1, MEDIA_SCHEMA: 1 });
    expect(events.map((e) => [e.reasonCode, e.durableOutcome])).toEqual([
      ['MEDIA_DECODE', 'complete'], ['UNKNOWN', 'unknown'], ['MEDIA_SCHEMA', 'complete'], ['COMPLETE', 'complete'],
    ]);
    expect(events.every((e) => e.correlationId === 'c2' && e.stage === 'CAPTURE_METADATA_READ')).toBe(true);
  });

  it('stops on access loss rather than returning a partial library', async () => {
    const { events, record } = collect();
    const read = jest.fn(async (uri: string) => {
      if (uri.endsWith('IMG_2.jpg')) throw nativeError('ERR_CAPTURE_ACCESS');
      return { relativeDirectory: 'DCIM/Camera/' };
    });
    await expect(scanCaptureMetadata(read, [1, 2, 3].map(asset), { correlationId: 'c3', record })).resolves.toEqual({ status: 'blocked', reasonCode: 'MEDIA_ACCESS' });
    expect(read).toHaveBeenCalledTimes(2);
    expect(events).toEqual([{ operation: 'TRAVEL_WINDOW_SCAN', reasonCode: 'MEDIA_ACCESS', stage: 'CAPTURE_METADATA_READ', retryable: true, durableOutcome: 'blocked', correlationId: 'c3' }]);
  });

  it('treats cancellation as a fixed lifecycle outcome', async () => {
    const { events, record } = collect();
    const controller = new AbortController();
    const read = jest.fn(async () => { controller.abort(); return { relativeDirectory: 'DCIM/Camera/' }; });
    await expect(scanCaptureMetadata(read, [1, 2].map(asset), { correlationId: 'c4', record, signal: controller.signal })).resolves.toEqual({ status: 'cancelled', reasonCode: 'SKIPPED' });
    expect(events.map((e) => [e.reasonCode, e.durableOutcome])).toEqual([['SKIPPED', 'skipped']]);
  });

  it('never puts native messages, paths, ids or offsets into diagnostics', async () => {
    const { events, record } = collect();
    const read = jest.fn(async (uri: string) => {
      if (uri.endsWith('IMG_1.jpg')) throw nativeError('ERR_CAPTURE_DECODE');
      return { offsetTimeOriginal: '+09:00', relativeDirectory: 'Pictures/Zalo/' };
    });
    await scanCaptureMetadata(read, [1, 2].map(asset), { correlationId: 'c5', record });
    const serialized = JSON.stringify(events);
    for (const secret of ['storage', 'DCIM', 'IMG_', 'asset-', 'Zalo', '+09:00', '540', 'native detail']) expect(serialized).not.toContain(secret);
    for (const event of events) expect(Object.keys(event).sort()).toEqual(['correlationId', 'durableOutcome', 'operation', 'reasonCode', 'retryable', 'stage']);
  });
});
