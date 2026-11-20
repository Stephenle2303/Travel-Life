/*
 * M10.1 lifetime benchmark (SPEC-trip-recognition-repair, CAP-1).
 * Synthetic, deterministic, public. No owner evidence is read.
 *
 * Generates the scenarios in
 * _bmad-output/specs/spec-trip-recognition-repair/lifetime-benchmark.md plus
 * the probe cases in review-findings.md, runs them through the CURRENT
 * (unmodified) production engine via projectCanonicalCandidateHistory, scores
 * Atlas/Possible/hidden outcomes against the authored labels, and writes a
 * frozen baseline report. This measures; it does not change engine behavior.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};

const reconstructionRoot = path.join(__dirname, '../src/reconstruction');
const { projectCanonicalCandidateHistory } = require(path.join(reconstructionRoot, 'candidate-projection.ts'));
const { qualifyGraphJourneyV11 } = require(path.join(reconstructionRoot, 'canonical-core.ts'));
const { qualifyGraphJourneyV12, buildFrequentPlaceContext, graphJourneyEpisodeMarkers } = require(path.join(reconstructionRoot, 'outcome-v1-2.ts'));

const DAY_MS = 86_400_000;
const HOME = { lat: 10.776, lon: 106.700 }; // synthetic city centre, not a real address
let evidenceSeq = 0;

function resetSeq() { evidenceSeq = 0; }
function nextId() { evidenceSeq += 1; return `e${String(evidenceSeq).padStart(6, '0')}`; }

/** One capture row at a given civil day/hour/place, with optional accuracy. */
function row(day, hour, lat, lon, accuracyMeters = 10, options = {}) {
  const id = options.id ?? nextId();
  const capturedAtMillis = options.capturedAtMillis !== undefined ? options.capturedAtMillis
    : Date.parse(`${day}T${String(hour).padStart(2, '0')}:00:00Z`);
  return {
    evidence_id: id,
    media_type: 'image',
    captured_at_millis: capturedAtMillis,
    captured_day: day,
    has_precise_offset: options.hasPreciseOffset ?? 0,
    availability: 'available',
    latitude: lat,
    longitude: lon,
    reported_accuracy_meters: accuracyMeters,
    source_origin: options.sourceOrigin ?? null,
  };
}

function daysFrom(start, count, stepDays = 1) {
  const startMillis = Date.parse(`${start}T00:00:00Z`);
  return Array.from({ length: count }, (_, index) => new Date(startMillis + index * stepDays * DAY_MS).toISOString().slice(0, 10));
}

/** 40 home-pattern days spread across a year: morning and evening at two
 * spots ~1 km apart, inside any 20 km Home radius. Used so the UNMODIFIED
 * current engine's old learned-base logic (>=12 support days) can also
 * qualify a "learned Home" in the no-configured-Home variant. */
function homeLifeRows(count = 40, startDay = '2025-01-05', stepDays = 9) {
  return daysFrom(startDay, count, stepDays).flatMap((day) => [
    row(day, 3, HOME.lat, HOME.lon),
    row(day, 9, HOME.lat + 0.009, HOME.lon), // ~1 km north
  ]);
}

/** Rows for a trip: `places` cycle across `perDay` captures on each of
 * `days` consecutive civil days starting at `start`. `hourStep` spaces
 * captures within a day for session/elapsed-time evidence. */
function tripRows(start, dayCount, perDay, places, options = {}) {
  const hourStep = options.hourStep ?? 1;
  const startHour = options.startHour ?? 1;
  const hasPreciseOffset = options.hasPreciseOffset ?? 0;
  const accuracy = options.accuracyMeters ?? 10;
  const sourceOrigin = options.sourceOrigin ?? null;
  return daysFrom(start, dayCount).flatMap((day) => Array.from({ length: perDay }, (_, index) => {
    const place = places[index % places.length];
    return row(day, startHour + index * hourStep, place.lat, place.lon, accuracy, { hasPreciseOffset, sourceOrigin });
  }));
}

function configuredHome(options = {}) {
  return [{
    area_id: 'home-1', latitude: HOME.lat, longitude: HOME.lon, radius_meters: 20_000,
    effective_start_day: options.effectiveStartDay ?? null, effective_end_day: options.effectiveEndDay ?? null,
  }];
}

/** Runs one scenario's rows through the unmodified production engine and
 * returns the classification + support reasons for every journey whose
 * support overlaps the scenario's own trip rows (home-life rows excluded). */
async function runScenario({ homeRows, tripRowsList, configuredHomeAreas }) {
  const tripIds = new Set(tripRowsList.map((r) => r.evidence_id));
  const rows = [...homeRows, ...tripRowsList];
  const input = {
    rows, excluded: new Set(), privateFilter: { excluded: new Set() },
    configuredHomeAreas: configuredHomeAreas ?? [],
    storedCorrections: [], storedMemoryCorrections: [],
  };
  const media = new Map(rows.map((r) => [r.evidence_id, 'image']));
  const { baseline, candidate } = await projectCanonicalCandidateHistory(input);
  const visitById = new Map(baseline.graph.visits.map((v) => [v.id, v]));

  const touchedJourneyIds = new Set(baseline.graph.journeys
    .filter((journey) => journey.visitIds.some((visitId) => (visitById.get(visitId)?.evidenceIds ?? []).some((id) => tripIds.has(id))))
    .map((journey) => journey.id));

  // v1.1 baseline: the Atlas qualifier (production, unmodified) plus the
  // separate "recognizable-travel-shadow-v1" Possible-trips feed.
  const atlasOutcomesV11 = [];
  for (const journeyId of touchedJourneyIds) {
    const q = qualifyGraphJourneyV11(baseline.graph, journeyId, baseline.evidence, media, baseline.homeAreas);
    atlasOutcomesV11.push({ journeyId, classification: q.classification, score: q.score, reasons: q.reasons, supportCount: q.supportIds.length });
  }
  const possibleOutcomesV11 = candidate.trips
    .filter((trip) => trip.supportIds.some((id) => tripIds.has(id)))
    .map((trip) => ({ state: trip.state, reasons: trip.reasons, supportCount: trip.supportIds.length }));

  // v1.2 (CAP-3/CAP-4/CAP-5): one outcome rule, the same production function
  // reconstruction/repository.ts now calls. Possible trips is read directly
  // from its SUGGESTED classification (CAP-7's remaining UI consolidation is
  // not yet wired; see consolidation.md).
  const frequentPlaceContext = buildFrequentPlaceContext(graphJourneyEpisodeMarkers(baseline.graph, new Map(baseline.evidence.map((e) => [e.id, e]))));
  const outcomesV12 = [];
  for (const journeyId of touchedJourneyIds) {
    const o = qualifyGraphJourneyV12(baseline.graph, journeyId, baseline.evidence, media, baseline.homeAreas, frequentPlaceContext);
    outcomesV12.push({ journeyId, classification: o.classification, score: o.diagnosticScore, reasons: o.reasons, supportCount: o.supportIds.length });
  }

  return { atlasOutcomesV11, possibleOutcomesV11, outcomesV12, tripUnitCount: tripIds.size };
}

const onAtlasV11 = (result) => result.atlasOutcomesV11.some((o) => o.classification === 'AUTO_CONFIRMED' || o.classification === 'USER_CONFIRMED');
const onPossibleV11 = (result) => result.possibleOutcomesV11.length > 0 || result.atlasOutcomesV11.some((o) => o.classification === 'SUGGESTED');
const silentDropV11 = (result) => result.atlasOutcomesV11.some((o) => !onAtlasV11(result) && o.classification !== 'SUGGESTED' && o.reasons.length === 0);

const onAtlasV12 = (result) => result.outcomesV12.some((o) => o.classification === 'AUTO_CONFIRMED' || o.classification === 'USER_CONFIRMED');
const onPossibleV12 = (result) => result.outcomesV12.some((o) => o.classification === 'SUGGESTED');
const silentDropV12 = (result) => result.outcomesV12.some((o) => o.classification === 'NOT_TRIP' && o.reasons.length === 0);

/* ---- Scenario definitions (lifetime-benchmark.md S1-S20) ---- */

const vungTau = [{ lat: 10.346, lon: 107.084 }, { lat: 10.370, lon: 107.070 }]; // ~65 km from HOME
const daLat2km = [{ lat: 11.940, lon: 108.440 }, { lat: 11.942, lon: 108.442 }]; // ~230 km, 2 spots ~0.3 km apart
const daLat20km = [{ lat: 11.940, lon: 108.440 }, { lat: 11.760, lon: 108.360 }]; // ~230 km, 2 spots ~20 km apart
const near30km = [{ lat: 11.040, lon: 106.700 }]; // ~29 km, just inside a 20km-radius Home band's "near" zone
const bangkok = [{ lat: 13.750, lon: 100.500 }];
const seoul = [{ lat: 37.570, lon: 126.980 }, { lat: 37.550, lon: 126.990 }];
const hometown200km = [{ lat: 8.980, lon: 105.730 }, { lat: 9.004, lon: 105.744 }]; // ~200 km, 2 spots ~3 km apart

function scenarios() {
  return [
    { id: 'S1', label: 'Home life only, two spots inside Home area', expected: 'hidden',
      build: () => ({ tripRowsList: [] }) },
    { id: 'S2', label: 'Weekday commute 60 km, 3x/week, 6 months', expected: 'possible',
      build: () => {
        const commuteDays = daysFrom('2025-02-03', 180).filter((_, i) => i % 7 < 3); // Mon/Tue/Wed-like cadence
        const rows2 = commuteDays.flatMap((day) => [row(day, 9, 11.040, 106.700, 10), row(day, 18, 11.045, 106.705, 10)]);
        return { tripRowsList: rows2 };
      } },
    { id: 'S3', label: 'One-day outing 65 km, 12 photos, 2 places 3 km apart, day-only', expected: 'atlas',
      build: () => ({ tripRowsList: tripRows('2025-06-07', 1, 12, vungTau) }) },
    { id: 'S4', label: 'One-day outing 65 km, 12 photos, one spot within 20 minutes', expected: 'possible',
      build: () => ({ tripRowsList: tripRows('2025-06-09', 1, 12, [vungTau[0]], { hourStep: 0 }) }) },
    { id: 'S5', label: 'Weekends at 65 km and 230 km, 2 places 3 km apart', expected: 'atlas',
      build: () => ({ tripRowsList: [...tripRows('2025-06-14', 2, 6, vungTau), ...tripRows('2025-07-05', 2, 6, daLat2km)] }) },
    { id: 'S6', label: 'Outing 30 km away, outside the 20 km Home area', expected: 'possible',
      build: () => ({ tripRowsList: tripRows('2025-06-21', 1, 6, near30km) }) },
    { id: 'S7a', label: '4-day abroad trip', expected: 'atlas',
      build: () => ({ tripRowsList: tripRows('2025-09-10', 4, 5, seoul) }) },
    { id: 'S7b', label: '14-day abroad trip', expected: 'atlas',
      build: () => ({ tripRowsList: tripRows('2025-08-01', 14, 3, bangkok) }) },
    { id: 'S8', label: '4-day abroad trip with Home photos the day before and after', expected: 'atlas',
      build: () => ({ tripRowsList: [row('2025-09-09', 20, HOME.lat, HOME.lon), ...tripRows('2025-09-10', 4, 5, seoul), row('2025-09-15', 8, HOME.lat, HOME.lon)] }) },
    { id: 'S9', label: 'Multi-city abroad trip with a 5-day photo-silent gap', expected: 'atlas',
      build: () => ({ tripRowsList: [...tripRows('2025-10-01', 3, 4, seoul), ...tripRows('2025-10-09', 3, 4, bangkok)] }) },
    { id: 'S10', label: 'Two separate trips 3 days apart with a Home return between', expected: 'atlas',
      build: () => ({ tripRowsList: [...tripRows('2025-05-01', 2, 6, vungTau),
        row('2025-05-04', 8, HOME.lat, HOME.lon), row('2025-05-04', 20, HOME.lat, HOME.lon),
        ...tripRows('2025-05-08', 2, 6, daLat2km)] }) },
    { id: 'S12', label: 'Family hometown 200 km, visited 5x/year, not set as Home', expected: 'atlas',
      build: () => ({ tripRowsList: daysFrom('2025-01-15', 5, 70).flatMap((day) => tripRows(day, 1, 6, hometown200km)) }) },
    { id: 'S13', label: '3-week stay abroad in one city', expected: 'atlas',
      build: () => ({ tripRowsList: tripRows('2025-11-01', 21, 2, bangkok) }) },
    { id: 'S14', label: '3 photos 150 km away', expected: 'possible',
      build: () => ({ tripRowsList: tripRows('2025-04-10', 1, 3, [{ lat: 9.600, lon: 105.970 }]) }) },
    { id: 'S16', label: 'Away photos with accuracy 3-6 km only', expected: 'possible',
      build: () => ({ tripRowsList: tripRows('2025-04-20', 2, 6, vungTau, { accuracyMeters: 4_000 }) }) },
    { id: 'S18a', label: 'One far photo with nothing else', expected: 'hidden', isolate: true,
      build: () => ({ tripRowsList: tripRows('2025-03-01', 1, 1, daLat2km) }) },
    { id: 'S18b', label: 'Screenshots with foreign GPS', expected: 'hidden', isolate: true,
      build: () => ({ tripRowsList: tripRows('2025-03-05', 1, 6, seoul, { sourceOrigin: 'screenshot' }) }) },
    { id: 'S19', label: 'Trip dates outside the dated Home area', expected: 'possible',
      configuredHomeAreas: configuredHome({ effectiveStartDay: '2026-01-01' }), // Home starts after the trip
      build: () => ({ tripRowsList: tripRows('2025-06-07', 1, 12, vungTau) }) },
    { id: 'S11', label: "Moving house: revisiting the old Home's location after the move", expected: 'atlas', isolate: true,
      // Home A (the old Home) ends 2025-06-30; Home B (230 km away) starts 2025-07-01.
      // Visiting Home A's old location in September, after the move, is now travel.
      configuredHomeAreas: [
        { area_id: 'home-a', latitude: HOME.lat, longitude: HOME.lon, radius_meters: 20_000, effective_start_day: null, effective_end_day: '2025-06-30' },
        { area_id: 'home-b', latitude: daLat2km[0].lat, longitude: daLat2km[0].lon, radius_meters: 20_000, effective_start_day: '2025-07-01', effective_end_day: null },
      ],
      build: () => ({ tripRowsList: tripRows('2025-09-10', 1, 12, [{ lat: HOME.lat, lon: HOME.lon }, { lat: HOME.lat + 0.03, lon: HOME.lon }]) }) },
  ];
}

/* ---- Review-findings probe cases A-I (frozen 2026-11-19 finding) ---- */

function probeCases() {
  return [
    { id: 'A', label: '1-day trip 65km, 12 photos, 2 places 3km apart', expected: 'atlas',
      build: () => ({ tripRowsList: tripRows('2025-06-07', 1, 12, vungTau) }) },
    { id: 'B', label: '2-day trip 65km, 2 places 3km apart', expected: 'atlas',
      build: () => ({ tripRowsList: tripRows('2025-06-14', 2, 6, vungTau) }) },
    { id: 'C', label: '2-day trip 230km, 2 places 3km apart', expected: 'atlas',
      build: () => ({ tripRowsList: tripRows('2025-07-05', 2, 6, daLat2km) }) },
    { id: 'D', label: '14-day abroad trip, one city', expected: 'atlas',
      build: () => ({ tripRowsList: tripRows('2025-08-01', 14, 3, bangkok) }) },
    { id: 'E', label: '4-day abroad trip, 2 places', expected: 'atlas',
      build: () => ({ tripRowsList: tripRows('2025-09-10', 4, 5, seoul) }) },
    { id: 'F', label: '2-day trip 230km, places 20km apart, isolated from Home rows', expected: 'atlas', isolate: true,
      build: () => ({ tripRowsList: tripRows('2025-07-08', 2, 6, daLat20km) }) },
    { id: 'G', label: '14-day abroad trip, isolated from Home rows', expected: 'atlas', isolate: true,
      build: () => ({ tripRowsList: tripRows('2025-07-17', 14, 3, bangkok) }) },
    { id: 'H', label: '1-day trip 65km, isolated from Home rows', expected: 'atlas', isolate: true,
      build: () => ({ tripRowsList: tripRows('2025-07-08', 1, 12, vungTau) }) },
  ];
}

function isolateHomeRows(allHomeRows, tripRowsList) {
  const tripDays = tripRowsList.map((r) => Date.parse(`${r.captured_day}T00:00:00Z`));
  const lo = Math.min(...tripDays) - 3 * DAY_MS;
  const hi = Math.max(...tripDays) + 3 * DAY_MS;
  return allHomeRows.filter((r) => { const t = Date.parse(`${r.captured_day}T00:00:00Z`); return t < lo || t > hi; });
}

// v1.2 has no learned Home (H-1): under 'learned' home mode (no Home areas
// configured at all), every v1.1 label of 'atlas' or 'possible' collapses to
// 'possible'/home-not-set, and 'hidden' stays 'hidden' (H-4/H-5).
function expectedV12For(expectedV11, homeMode) {
  if (homeMode !== 'learned') return expectedV11;
  return expectedV11 === 'hidden' ? 'hidden' : 'possible';
}

async function runAll() {
  const results = [];
  for (const homeMode of ['configured', 'learned']) {
    // One monotonically increasing id counter per homeMode run. Resetting it
    // between home-row and trip-row generation previously produced colliding
    // evidence_id values that the engine's duplicate-family de-duplication
    // silently collapsed, dropping almost all synthetic trip photos. Logged
    // in docs/development/error-playbook.md.
    resetSeq();
    const allHomeRows = homeLifeRows();
    for (const scenario of [...scenarios(), ...probeCases()]) {
      const { tripRowsList } = scenario.build();
      const homeRows = scenario.isolate ? isolateHomeRows(allHomeRows, tripRowsList) : allHomeRows;
      const configuredHomeAreas = homeMode === 'configured' ? (scenario.configuredHomeAreas ?? configuredHome()) : [];
      const outcome = await runScenario({ homeRows, tripRowsList, configuredHomeAreas });
      const actualV11 = onAtlasV11(outcome) ? 'atlas' : onPossibleV11(outcome) ? 'possible' : 'hidden';
      const actualV12 = onAtlasV12(outcome) ? 'atlas' : onPossibleV12(outcome) ? 'possible' : 'hidden';
      const expectedV11 = scenario.expected;
      const expectedV12 = expectedV12For(expectedV11, homeMode);
      results.push({
        scenario: scenario.id, label: scenario.label, homeMode,
        expectedV11, actualV11, matchV11: actualV11 === expectedV11, silentDropV11: silentDropV11(outcome),
        expectedV12, actualV12, matchV12: actualV12 === expectedV12, silentDropV12: silentDropV12(outcome),
        outcomesV12: outcome.outcomesV12,
      });
    }
  }
  return results;
}

function summarize(results) {
  const total = results.length;
  const summarizeVersion = (key) => {
    const matches = results.filter((r) => r[`match${key}`]).length;
    const mismatches = results.filter((r) => !r[`match${key}`]);
    const silentDrops = results.filter((r) => r[`silentDrop${key}`]).length;
    const falseAtlas = results.filter((r) => r[`expected${key}`] !== 'atlas' && r[`actual${key}`] === 'atlas');
    return { matches, mismatchCount: mismatches.length, mismatches, silentDrops, falseAtlasCount: falseAtlas.length, falseAtlas };
  };
  return { total, v11: summarizeVersion('V11'), v12: summarizeVersion('V12') };
}

async function main() {
  const results = await runAll();
  const summary = summarize(results);
  const report = {
    dataset: 'lifetime-synthetic-v1', baselineCommit: 'fbfe8b8', generatedAt: new Date().toISOString(),
    v11RuleVersion: 'reconstruction-v1 + trip-detector-v1.1 (unmodified production baseline)',
    v12RuleVersion: 'reconstruction-v1 + trip-detector-v1.2 (qualifyGraphJourneyV12, the function reconstruction/repository.ts now calls)',
    summary, results,
  };
  const outDir = path.join(__dirname, '../../../evals/runs');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'lifetime-benchmark-fbfe8b8-v1.2-comparison.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  process.stdout.write(`Wrote ${outPath}\n`);
  process.stdout.write(`v1.1 (baseline, unmodified): ${summary.v11.matches}/${summary.total} matched; silent drops ${summary.v11.silentDrops}; false Atlas ${summary.v11.falseAtlasCount}\n`);
  process.stdout.write(`v1.2 (new outcome rule):     ${summary.v12.matches}/${summary.total} matched; silent drops ${summary.v12.silentDrops}; false Atlas ${summary.v12.falseAtlasCount}\n`);
  process.stdout.write(`v1.2 mismatches:\n`);
  for (const m of summary.v12.mismatches) process.stdout.write(`  [${m.scenario}/${m.homeMode}] expected ${m.expectedV12}, got ${m.actualV12} - ${m.label}\n`);
  // Regression gate (CAP-1/lifetime-benchmark.md): v1.2 must not mismatch,
  // silently drop, or show a false Atlas trip. v1.1's own (known) mismatches
  // never fail this script; they are the frozen baseline being compared against.
  if (summary.v12.mismatchCount > 0 || summary.v12.silentDrops > 0 || summary.v12.falseAtlasCount > 0) {
    process.stderr.write(`FAIL: v1.2 regressed against the lifetime benchmark.\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`PASS: v1.2 matches every labeled scenario with zero silent drops and zero false Atlas trips.\n`);
  }
}

main().catch((error) => { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1; });
