import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { AssetField, MediaType, Query, requestPermissionsAsync } from 'expo-media-library';

import {
  assessWindow, classifyCaptureMetadataError, findCandidateWindows, inferHomeOffsetMinutes, inferOffsetFromLocalClock,
  parseExifLocalTimestampMillis, toCaptureRecord,
  type CaptureAsset, type CaptureMetadataReason, type CaptureRecord,
} from '@/travel-window';
import { nativeCaptureMetadataReader } from '@/travel-window/native-capture-metadata';
import { createDiagnosticCorrelationId, recordAppDiagnostic } from '@/diagnostics/app-diagnostics';

/**
 * Story 1 evidence harness (SPEC-gps-less-trip-discovery). Dev build only,
 * not linked from any navigation. Answers questions 1 and 2: does the owner's
 * library carry capture-time offset tags, and does a travel-looking window
 * with an offset-shift clue appear. Reads only offset tags and storage
 * folders (never GPS, filenames, image bytes or place data) and reports only
 * counts, offset-minute buckets and window summaries, on-device, to a single
 * JSON file. Nothing here is production code; it exists to produce the
 * evidence the spec's Story 1 requires before any threshold is frozen.
 */

const SCAN_LIMIT = 20_000;

type WindowReport = {
  startDate: string;
  endDate: string;
  days: number;
  cameraCount: number;
  shiftMinutes: number | null;
  travelLooking: boolean;
  reason: string;
  clueKinds: string[];
};

type Report = {
  generatedAt: string;
  scanStatus: string;
  scanned: number;
  offsetPresence: { withOffset: number; withoutOffset: number };
  offsetBucketsMinutes: Record<string, number>;
  /** Story 1 Q2: inferred only for records with no explicit offset tag, from the camera's local clock vs a true UTC instant. */
  inferredOffsetPresence: { inferred: number; unavailable: number };
  inferredOffsetBucketsMinutes: Record<string, number>;
  provenanceCounts: Record<string, number>;
  homeOffsetMinutes: number | null;
  windows: WindowReport[];
  unreadable: Record<string, number>;
  debug: {
    nativeReaderAvailable: boolean; permissionGranted: boolean | null; accessPrivileges: string | null;
    rawPageLength: number; rawCreationTimeNullCount: number; rawModificationTimeNullCount: number;
  };
};

function emptyReport(status: string, debug: Report['debug'] = { nativeReaderAvailable: false, permissionGranted: null, accessPrivileges: null, rawPageLength: 0, rawCreationTimeNullCount: 0, rawModificationTimeNullCount: 0 }): Report {
  return {
    generatedAt: new Date().toISOString(), scanStatus: status, scanned: 0,
    offsetPresence: { withOffset: 0, withoutOffset: 0 }, offsetBucketsMinutes: {},
    inferredOffsetPresence: { inferred: 0, unavailable: 0 }, inferredOffsetBucketsMinutes: {},
    provenanceCounts: {}, homeOffsetMinutes: null, windows: [], unreadable: {}, debug,
  };
}

async function runScan(): Promise<Report> {
  const read = nativeCaptureMetadataReader();
  const permission = await requestPermissionsAsync(false, ['photo']);
  const debugBase: Report['debug'] = {
    nativeReaderAvailable: read !== null, permissionGranted: permission.granted, accessPrivileges: permission.accessPrivileges ?? null,
    rawPageLength: 0, rawCreationTimeNullCount: 0, rawModificationTimeNullCount: 0,
  };
  if (!permission.granted) return emptyReport('permission-denied', debugBase);
  if (!read) {
    recordAppDiagnostic({ operation: 'TRAVEL_WINDOW_SCAN', reasonCode: 'MEDIA_UNAVAILABLE', stage: 'CAPTURE_METADATA_READ', retryable: false, durableOutcome: 'skipped', correlationId: createDiagnosticCorrelationId() });
    return emptyReport('MEDIA_UNAVAILABLE', debugBase);
  }

  const page = await new Query()
    .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
    .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
    .limit(SCAN_LIMIT)
    .exeForMetadata();
  debugBase.rawPageLength = page.length;
  debugBase.rawCreationTimeNullCount = page.filter((item) => item.creationTime === null).length;
  debugBase.rawModificationTimeNullCount = page.filter((item) => item.modificationTime === null).length;
  // Asset ids are already content:// URIs on Android; no extra native hop needed.
  // HyperOS/MediaStore sometimes leaves creationTime null; modificationTime is
  // the best available fallback rather than dropping the asset entirely.
  const assets: CaptureAsset[] = page
    .flatMap((item) => {
      const capturedAtMillis = item.creationTime ?? item.modificationTime;
      return capturedAtMillis === null ? [] : [{ id: item.id, uri: item.id, capturedAtMillis, located: false }];
    });

  // A single pass: toCaptureRecord gives the explicit-tag offset and
  // provenance, and the same native payload's DateTimeOriginal (the camera's
  // own local wall clock) lets Story 1's second, weaker clue be checked for
  // records that carry no explicit offset tag, without reading any asset twice.
  const correlationId = createDiagnosticCorrelationId();
  const records: CaptureRecord[] = [];
  const unreadable: Partial<Record<CaptureMetadataReason, number>> = {};
  const offsetBucketsMinutes: Record<string, number> = {};
  const inferredOffsetBucketsMinutes: Record<string, number> = {};
  const provenanceCounts: Record<string, number> = {};
  let withOffset = 0;
  let withoutOffset = 0;
  let inferredCount = 0;
  let inferredUnavailable = 0;
  for (const asset of assets) {
    let native: unknown;
    try {
      native = await read(asset.uri);
    } catch (error) {
      const reason = classifyCaptureMetadataError(error);
      if (reason === 'MEDIA_ACCESS') {
        recordAppDiagnostic({ operation: 'TRAVEL_WINDOW_SCAN', reasonCode: 'MEDIA_ACCESS', stage: 'CAPTURE_METADATA_READ', retryable: true, durableOutcome: 'blocked', correlationId });
        return emptyReport('MEDIA_ACCESS', debugBase);
      }
      unreadable[reason] = (unreadable[reason] ?? 0) + 1;
      records.push({ id: asset.id, capturedAtMillis: asset.capturedAtMillis, utcOffsetMinutes: null, provenance: 'unknown', located: false });
      continue;
    }
    let record: CaptureRecord;
    try {
      record = toCaptureRecord(asset, native);
    } catch {
      unreadable.MEDIA_SCHEMA = (unreadable.MEDIA_SCHEMA ?? 0) + 1;
      records.push({ id: asset.id, capturedAtMillis: asset.capturedAtMillis, utcOffsetMinutes: null, provenance: 'unknown', located: false });
      continue;
    }
    records.push(record);
    provenanceCounts[record.provenance] = (provenanceCounts[record.provenance] ?? 0) + 1;
    if (record.utcOffsetMinutes !== null) {
      withOffset += 1;
      offsetBucketsMinutes[String(record.utcOffsetMinutes)] = (offsetBucketsMinutes[String(record.utcOffsetMinutes)] ?? 0) + 1;
      continue;
    }
    withoutOffset += 1;
    const dateTimeOriginal = native && typeof native === 'object' && 'dateTimeOriginal' in native ? (native as Record<string, unknown>).dateTimeOriginal : undefined;
    const inferred = inferOffsetFromLocalClock(parseExifLocalTimestampMillis(dateTimeOriginal), record.capturedAtMillis);
    if (inferred === null) { inferredUnavailable += 1; continue; }
    inferredCount += 1;
    inferredOffsetBucketsMinutes[String(inferred)] = (inferredOffsetBucketsMinutes[String(inferred)] ?? 0) + 1;
  }
  for (const reason of Object.keys(unreadable) as CaptureMetadataReason[]) {
    recordAppDiagnostic({ operation: 'TRAVEL_WINDOW_SCAN', reasonCode: reason, stage: 'CAPTURE_METADATA_READ', retryable: false, durableOutcome: reason === 'UNKNOWN' ? 'unknown' : 'complete', correlationId });
  }
  recordAppDiagnostic({ operation: 'TRAVEL_WINDOW_SCAN', reasonCode: 'COMPLETE', stage: 'CAPTURE_METADATA_READ', retryable: false, durableOutcome: 'complete', correlationId });

  const home = { offsetMinutes: inferHomeOffsetMinutes(records) };
  const windows: WindowReport[] = findCandidateWindows(records, home).map((window) => {
    const assessment = assessWindow(window);
    return {
      startDate: new Date(window.startMillis).toISOString().slice(0, 10),
      endDate: new Date(window.endMillis).toISOString().slice(0, 10),
      days: Math.round((window.endMillis - window.startMillis) / 86_400_000),
      cameraCount: window.cameraCount,
      shiftMinutes: window.shiftMinutes,
      travelLooking: assessment.travelLooking,
      reason: assessment.reason,
      clueKinds: window.clues.map((clue) => clue.kind),
    };
  });

  return {
    generatedAt: new Date().toISOString(), scanStatus: 'complete', scanned: assets.length,
    offsetPresence: { withOffset, withoutOffset }, offsetBucketsMinutes,
    inferredOffsetPresence: { inferred: inferredCount, unavailable: inferredUnavailable }, inferredOffsetBucketsMinutes,
    provenanceCounts, homeOffsetMinutes: home.offsetMinutes, windows,
    unreadable: unreadable as Record<string, number>,
    debug: debugBase,
  };
}

const styles = {
  screen: { flex: 1, backgroundColor: '#111', padding: 24, gap: 12 },
  title: { color: '#fff', fontSize: 18, fontWeight: '600' as const },
  note: { color: '#9aa0a6' },
  button: (disabled: boolean) => ({ backgroundColor: disabled ? '#444' : '#2a6', padding: 14, borderRadius: 8, alignItems: 'center' as const }),
  buttonText: { color: '#fff', fontWeight: '600' as const },
  error: { color: '#f66' },
  report: { color: '#9f9', fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) },
};

export function DevTravelWindowScreen() {
  const [report, setReport] = useState<Report | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onRun = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const next = await runScan();
      setReport(next);
      if (FileSystem.documentDirectory) {
        await FileSystem.writeAsStringAsync(`${FileSystem.documentDirectory}story1-report.json`, JSON.stringify(next, null, 2));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Scan failed.');
    } finally {
      setRunning(false);
    }
  }, []);

  // Auto-run once so the harness can be driven over adb (deep link only, no
  // simulated taps). Deferred so the effect does not set state synchronously.
  // The button below still allows a manual re-run.
  useEffect(() => {
    if (!__DEV__) return;
    const timer = setTimeout(() => { void onRun(); }, 0);
    return () => clearTimeout(timer);
  }, [onRun]);

  if (!__DEV__) {
    return <View style={{ flex: 1, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff' }}>Unavailable</Text></View>;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ gap: 12, paddingBottom: 48 }}>
      <Text style={styles.title}>Story 1 evidence harness (dev only)</Text>
      <Text style={styles.note}>
        Reads EXIF capture-time offset tags and the storage folder of each photo only. No GPS, filenames,
        image bytes or place data are read. The report is written only to this device at
        {' '}{FileSystem.documentDirectory ?? '(unavailable)'}story1-report.json and shown below.
      </Text>
      <Pressable onPress={onRun} disabled={running} style={styles.button(running)}>
        <Text style={styles.buttonText}>{running ? 'Scanning…' : 'Run scan'}</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {report ? <Text selectable style={styles.report}>{JSON.stringify(report, null, 2)}</Text> : null}
    </ScrollView>
  );
}
