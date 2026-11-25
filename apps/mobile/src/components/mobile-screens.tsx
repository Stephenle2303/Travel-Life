import { JourneyPrivacyManager } from './journey-privacy';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Keyboard, Linking, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import { readPresentation, savePresentation } from '@/onboarding/presentation';
import { classifyAppDiagnosticError, createDiagnosticCorrelationId, recordAppDiagnostic } from '@/diagnostics/app-diagnostics';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { randomUUID } from 'expo-crypto';
import type { ConfiguredHomeArea } from '@/import-record/types';
import { HomePlaceIndexError, searchHomePlaces, type HomeSearchPlace } from '@/reconstruction/home-place-search';
import { MAX_HOME_RADIUS_METERS } from '@/reconstruction/types';

import { appRoutes, isRecognizableRevealEnabled, isReconstructionPreviewEnabled, openRoute } from '@/navigation/app-contract';
import { ActionButton, Body, Eyebrow, InsetPanel, Screen, Title, useReducedMotion } from '@/components/ui';
import { AtlasActionButton, AtlasReveal } from '@/components/atlas-reveal';
import { RecognizableAtlasExperience } from '@/components/recognizable-atlas-experience';
import { VisualDiscoverySetting, VisualPlaceRecovery } from '@/components/visual-place-recovery';
import { TravelWindowRecovery } from '@/components/travel-window-recovery';
import { HiddenOutingsV13Section } from '@/components/hidden-outings-v13';
import { PossibleTripsV12Section } from '@/components/possible-trips-v12';
import { ClueReviewCardsSection, CluePassNoticeBanner } from '@/components/clue-review-cards';
import { personalRuleSentence } from '@/clues/personal-rule-copy';
import { usePhotoAccess } from '@/photo-access/provider';
import { projectReveal } from '@/reveal/projection';
import { consumeAtlasPreviewContext, saveAtlasPreviewContext } from '@/atlas/preview-context';
import type { AtlasExploration, JourneyDetail } from '@/reveal/types';
import type { OwnerPreview } from '@/photo-access/types';
import { accountSyncEnabled } from '@/account/history-sync-native';
import { recordContext } from '@/account/record-context';
import { getAccountService } from '@/account/service';

function PreparationStatus() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const { controller, importCoverage, snapshot } = usePhotoAccess();
  const [details, setDetails] = useState(false);
  const phase = controller.preparation;
  if (phase === 'idle' || phase === 'complete') return null;
  const active = ['queued', 'importing', 'building', 'publishing'].includes(phase);
  const percent = phase === 'importing' && importCoverage.accessible !== null && importCoverage.accessible > 0 && importCoverage.scanned <= importCoverage.accessible ? Math.floor(importCoverage.scanned * 100 / importCoverage.accessible) : null;
  const label = phase === 'building' ? 'Building your Atlas…' : phase === 'publishing' ? 'Finishing your Atlas…' : phase === 'paused' ? 'Atlas preparation is paused.' : phase === 'checking' ? 'Checking your saved progress…' : active ? 'Finding your journeys…' : snapshot.message ?? "Couldn't finish your Atlas. Your saved history is kept.";
  return <InsetPanel>
    <View accessibilityLiveRegion="polite"><Body>{label}{percent === null ? '' : ` Reading photos · ${percent}%`}</Body></View>
    {active && (percent === null ? <ActivityIndicator accessible accessibilityRole="progressbar" accessibilityLabel={label} animating={!reducedMotion} hidesWhenStopped={false} color="#D8EF69" /> : <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: percent }} style={{ height: 6, backgroundColor: '#21483B', borderRadius: 3 }}><View style={{ height: 6, width: `${percent}%`, backgroundColor: '#D8EF69', borderRadius: 3 }} /></View>)}
    <ActionButton onPress={() => setDetails(!details)} variant="secondary">Details</ActionButton>
    {!active && (phase === 'blocked' ? <ActionButton onPress={() => openRoute(router, controller.isAccountRecord ? appRoutes.account : appRoutes.import)}>Choose photos</ActionButton> : <ActionButton onPress={() => void controller.resumePreparation(true)}>{phase === 'paused' ? 'Continue' : phase === 'checking' ? 'Check again' : 'Try again'}</ActionButton>)}
    {details && <><Body>Photos read: {importCoverage.scanned}. Metadata with location: {importCoverage.geotagged}. Unavailable: {importCoverage.unavailable}. Only your chosen accessible photos are used.</Body>{active && <ActionButton onPress={() => void controller.pausePreparation()} variant="secondary">Pause</ActionButton>}</>}
  </InsetPanel>;
}

function UpdatesInvitation({ eligible, enable }: { eligible: boolean; enable(): Promise<void> }) {
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (eligible) void readPresentation().then((marker) => { if (active) setVisible(!marker?.updatesOffer); }).catch((error) => {
      if (!active) return;
      setVisible(false);
      recordAppDiagnostic({ operation: 'ONBOARDING_UPDATES', stage: 'UPDATE_OFFER_READ', reasonCode: classifyAppDiagnosticError(error), retryable: true, durableOutcome: 'unchanged', correlationId: createDiagnosticCorrelationId() });
    });
    return () => { active = false; };
  }, [eligible]);
  const choose = async (turnOn: boolean) => {
    if (pending) return;
    setPending(true);
    try { await savePresentation(undefined, true); if (turnOn) await enable(); setVisible(false); }
    catch { setMessage("Couldn't save your choice. Try again."); }
    finally { setPending(false); }
  };
  if (!eligible || !visible) return null;
  return <InsetPanel><Body>Keep your Atlas up to date</Body><Body>Check for new photos when your device allows.</Body><ActionButton disabled={pending} onPress={() => void choose(true)} variant="secondary">Turn on</ActionButton><ActionButton disabled={pending} onPress={() => void choose(false)} variant="secondary">Later</ActionButton>{message && <Body>{message}</Body>}</InsetPanel>;
}

export function TrustScreen() { return <ImportScreen />; }

function homeDate(value: string, end: boolean) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const day = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === value ? value : null;
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  if (!end) return `${value}-01`;
  const first = new Date(`${value}-01T00:00:00Z`);
  first.setUTCMonth(first.getUTCMonth() + 1, 0);
  return first.toISOString().slice(0, 10);
}

type SavedHomeSetup = { id: string; label: string | null; radiusMeters: number; effectiveStartDay: string | null; effectiveEndDay: string | null };

const HOME_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthYearLabel(day: string) {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(day);
  return match ? `${HOME_MONTH_NAMES[Number(match[2]) - 1]} ${match[1]}` : day;
}

/** Decision 0021 (H-2): no start/end is Forever; a dated Home shows only the saved month and year. */
export function homePeriodLabel(startDay: string | null, endDay: string | null) {
  if (!startDay && !endDay) return 'Forever';
  if (startDay && !endDay) return `From ${monthYearLabel(startDay)}`;
  if (!startDay && endDay) return `Until ${monthYearLabel(endDay)}`;
  return `${monthYearLabel(startDay!)} – ${monthYearLabel(endDay!)}`;
}

/** Month/year picker (year list, then a 12-month grid); no typed date format (home-setup.md). */
function MonthYearField({ label, clearLabel, resolvedDay, onPick, onClear }: {
  label: string; clearLabel: string; resolvedDay: string | null;
  onPick: (monthValue: string) => void; onClear: () => void;
}) {
  const [stage, setStage] = useState<'closed' | 'year' | 'month'>('closed');
  const [year, setYear] = useState<number | null>(null);
  if (stage === 'year') {
    const thisYear = new Date().getUTCFullYear();
    const years = Array.from({ length: 101 }, (_, index) => thisYear - index);
    return <InsetPanel>
      <Body>{label}</Body>
      <ActionButton variant="secondary" onPress={() => { onClear(); setStage('closed'); }}>{clearLabel}</ActionButton>
      <ScrollView style={{ maxHeight: 260 }}><View style={{ gap: 8 }}>
        {years.map((candidate) => <ActionButton key={candidate} variant="secondary" onPress={() => { setYear(candidate); setStage('month'); }}>{candidate}</ActionButton>)}
      </View></ScrollView>
      <ActionButton variant="secondary" onPress={() => setStage('closed')}>Cancel</ActionButton>
    </InsetPanel>;
  }
  if (stage === 'month' && year !== null) return <InsetPanel>
    <Body>{label} · {year}</Body>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {HOME_MONTH_NAMES.map((month, index) => <ActionButton key={month} variant="secondary"
        onPress={() => { onPick(`${year}-${String(index + 1).padStart(2, '0')}`); setStage('closed'); }}>{month}</ActionButton>)}
    </View>
    <ActionButton variant="secondary" onPress={() => setStage('year')}>Back to years</ActionButton>
  </InsetPanel>;
  return <ActionButton variant="secondary" onPress={() => { setYear(null); setStage('year'); }}>
    {label} · {resolvedDay ? monthYearLabel(resolvedDay) : clearLabel}
  </ActionButton>;
}

function InitialHomeSetup({ save, settings, existing, previewHomeAreaRadius }: {
  save(command: string, areas: readonly ConfiguredHomeArea[]): Promise<void>;
  settings?: () => void;
  existing?: SavedHomeSetup;
  /** M10.10: the dry-run preview, shown only when editing an existing Home
   * (there is nothing yet to preview against when adding a brand-new one). */
  previewHomeAreaRadius?(areaId: string, radiusMeters: number): Promise<import('@/reconstruction/types').HomeRadiusPreview | null>;
}) {
  const [radiusKm, setRadiusKm] = useState(String(Math.round((existing?.radiusMeters ?? 20_000) / 1_000)));
  const radiusMetersParsed = Math.round(Number(radiusKm) * 1_000);
  const radiusValid = radiusKm.trim().length > 0 && Number.isFinite(radiusMetersParsed) && radiusMetersParsed > 0 && radiusMetersParsed <= MAX_HOME_RADIUS_METERS;
  const radiusMeters = radiusValid ? radiusMetersParsed : (existing?.radiusMeters ?? 20_000);
  // Debounced (300ms) so typing each digit of a radius doesn't each trigger
  // previewHomeAreaRadius's own full canonical projection — only the last
  // keystroke's timer survives to actually fire (code-review finding,
  // 2026-11-23). The `active` flag (same convention as loadPossibleTrips/
  // loadHiddenOutings above) discards a response that resolves after this
  // effect's own inputs have already moved on, same job the earlier
  // request-counter did, with no state set synchronously in the effect body.
  const [preview, setPreview] = useState<import('@/reconstruction/types').HomeRadiusPreview | null>(null);
  useEffect(() => {
    if (!existing || !previewHomeAreaRadius || !radiusValid) return;
    let active = true;
    const timer = setTimeout(() => {
      void previewHomeAreaRadius(existing.id, radiusMetersParsed).then((result) => { if (active) setPreview(result); })
        .catch(() => { if (active) setPreview(null); });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [existing, previewHomeAreaRadius, radiusValid, radiusMetersParsed]);
  const [areas, setAreas] = useState<ConfiguredHomeArea[]>([]);
  const [editing, setEditing] = useState(true);
  const [query, setQuery] = useState(existing?.label ?? '');
  const [place, setPlace] = useState<HomeSearchPlace | null>(null);
  // H-2: the period defaults to Forever — the owner can save after only picking a place.
  const [period, setPeriod] = useState<'all' | 'dates'>(existing?.effectiveStartDay || existing?.effectiveEndDay ? 'dates' : 'all');
  const [from, setFrom] = useState(existing?.effectiveStartDay ?? '');
  const [until, setUntil] = useState(existing?.effectiveEndDay ?? '');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const command = useRef<{ key: string; areas: readonly ConfiguredHomeArea[] } | null>(null);
  const inFlight = useRef(false);
  const start = from ? homeDate(from, false) : null;
  const end = until ? homeDate(until, true) : null;
  const validDates = period === 'all' || !start || !end || start <= end;
  const search = useMemo(() => {
    try { return { places: place || !editing ? [] : searchHomePlaces(query), failure: null }; }
    catch (error) { return { places: [], failure: error instanceof HomePlaceIndexError ? 'SCHEMA' as const : classifyAppDiagnosticError(error) }; }
  }, [editing, place, query]);
  const loggedSearchFailure = useRef(false);
  useEffect(() => {
    if (!search.failure || loggedSearchFailure.current) return;
    loggedSearchFailure.current = true;
    recordAppDiagnostic({ operation: 'ONBOARDING_SETUP', stage: 'HOME_SEARCH_INDEX', reasonCode: search.failure,
      retryable: false, durableOutcome: 'unchanged', correlationId: createDiagnosticCorrelationId() });
  }, [search.failure]);
  const submit = async (selected: readonly ConfiguredHomeArea[]) => {
    if (inFlight.current) return;
    inFlight.current = true;
    const request = command.current ?? { key: randomUUID(), areas: selected };
    command.current = request;
    setSubmitted(true); setPending(true); setMessage(null);
    try { await save(request.key, request.areas); }
    catch (error) { setMessage(error instanceof Error && error.message === 'Home saved. Retry the Atlas rebuild.'
      ? error.message : "Couldn't verify your Home setup. Check again."); }
    finally { inFlight.current = false; setPending(false); }
  };
  const reset = () => { setEditing(false); setQuery(''); setPlace(null); setFrom(''); setUntil(''); setPeriod('all'); };
  return <Screen>
    <Title>{settings ? (existing ? 'Edit Home base' : 'Add Home base') : 'Where do you live?'}</Title>
    <Body>Photos taken near your Home bases are left out of automatic trips. Your photos stay in your library.</Body>
    <Body>Home bases selected here apply to Local history on this device.</Body>
    {!settings && <Body>Add at least one Home base to continue. Nothing here is learned automatically.</Body>}
    {areas.map((area) => <InsetPanel key={area.id}><Body>{area.label} · Within {Math.round(area.radiusMeters / 1_000)} km</Body>
      <Body>{homePeriodLabel(area.effectiveStartDay, area.effectiveEndDay)}</Body>
      {!submitted && <ActionButton variant="secondary" onPress={() => setAreas((current) => current.filter((candidate) => candidate.id !== area.id))}>Remove {area.label}</ActionButton>}
    </InsetPanel>)}
    {editing && !submitted && <InsetPanel>
      <TextInput accessibilityLabel="Search for a city, province, district, ward or commune" placeholder="Search for a city, province, district, ward or commune" placeholderTextColor="#B4C6B5" value={query}
        onChangeText={(value) => { setQuery(value); setPlace(null); }} style={{ color: '#F3EEDD', borderColor: '#B4C6B5', borderWidth: 1, borderRadius: 10, padding: 10 }} />
      {search.failure ? <Body>Offline place search is unavailable.</Body>
        : !place && query.trim().length >= 2 && !search.places.length ? <Body>No offline matches. Try a nearby city or include the province.</Body> : null}
      {search.places.map((result) => <ActionButton key={result.id} variant="secondary"
        onPress={() => { setPlace(result); setQuery(result.name); }}>
        {result.name} · {result.level} · {result.context}
      </ActionButton>)}
      {place && <>
        <Body>{place.name} · {place.level} · {place.context}</Body>
        {settings ? <>
          <TextInput accessibilityLabel="Home radius in kilometers" keyboardType="numeric" value={radiusKm} onChangeText={setRadiusKm}
            placeholder="20" placeholderTextColor="#B4C6B5" style={{ color: '#F3EEDD', borderColor: '#B4C6B5', borderWidth: 1, borderRadius: 10, padding: 10, width: 120 }} />
          <Body>Photos within this radius (in km) of the selected place point will count as near Home during this period.</Body>
          {!radiusValid && <Body>Radius must be a number above 0 and at most 300 km.</Body>}
        </> : <Body>Photos within {Math.round(radiusMeters / 1_000)} km of the selected place point will count as near Home during this period.</Body>}
        <ActionButton variant={period === 'all' ? 'primary' : 'secondary'} onPress={() => setPeriod('all')}>Forever</ActionButton>
        <ActionButton variant={period === 'dates' ? 'primary' : 'secondary'} onPress={() => setPeriod('dates')}>Choose dates</ActionButton>
        {period === 'dates' && <>
          <MonthYearField label="From" clearLabel="Any time" resolvedDay={start} onPick={setFrom} onClear={() => setFrom('')} />
          <MonthYearField label="Until" clearLabel="Now" resolvedDay={end} onPick={setUntil} onClear={() => setUntil('')} />
          {!validDates && <Body>Until must be on or after From.</Body>}
        </>}
        {/* Gated on radiusValid too (code-review finding, 2026-11-23): without it, a
          * preview fetched for a previous, valid radius kept showing underneath the
          * "Radius must be..." message once the owner typed an out-of-range value. */}
        {existing && previewHomeAreaRadius && preview && radiusValid && <Body>{preview.atlasCount} trips on Atlas · {preview.reviewCount} to review · {preview.hiddenCount} hidden</Body>}
        <ActionButton disabled={!validDates || !radiusValid} onPress={() => {
          if (!validDates || !radiusValid) return;
          const area: ConfiguredHomeArea = { id: existing?.id ?? randomUUID(), label: place.name, origin: 'manual-pin',
            latitude: place.latitude, longitude: place.longitude, radiusMeters,
            effectiveStartDay: period === 'dates' ? start : null, effectiveEndDay: period === 'dates' ? end : null };
          if (settings) { void submit([area]); return; }
          setAreas((current) => [...current, area]);
          reset();
        }}>{settings ? 'Save Home base' : 'Add this Home base'}</ActionButton>
      </>}
      <ActionButton variant="secondary" onPress={settings ?? reset}>Cancel</ActionButton>
    </InsetPanel>}
    {!editing && !submitted && <ActionButton variant={areas.length ? 'secondary' : 'primary'} onPress={() => setEditing(true)}>Add Home base</ActionButton>}
    {!editing && !submitted && areas.length > 0 && <ActionButton onPress={() => void submit(areas)}>Continue</ActionButton>}
    {pending && <Body>Saving your Home setup…</Body>}
    {message && <><Body>{message}</Body><ActionButton disabled={pending} onPress={() => void submit(areas)}>Check again</ActionButton>
      {settings && <ActionButton variant="secondary" onPress={settings}>Back</ActionButton>}</>}
  </Screen>;
}

export function ImportScreen() {
  const router = useRouter();
  const { snapshot, controller } = usePhotoAccess();
  const [details, setDetails] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [homeStep, setHomeStep] = useState<'checking' | 'required' | 'done' | 'error'>('checking');
  const [homeRetry, setHomeRetry] = useState(0);
  useEffect(() => {
    let active = true;
    void Promise.resolve(controller.requiresHomeSetup?.()).then((required) => {
      if (active) setHomeStep(required ? 'required' : 'done');
    }).catch(() => { if (active) setHomeStep('error'); });
    return () => { active = false; };
  }, [controller, homeRetry]);
  const choose = async (mode: 'library' | 'selected') => {
    if (pending) return;
    setPending(true); setMessage(null);
    try { if (await controller.choosePhotos(mode)) openRoute(router, appRoutes.atlas, 'dismissTo'); }
    finally { setPending(false); }
  };
  const skip = async () => {
    if (pending) return;
    setPending(true);
    try { await savePresentation('atlas'); openRoute(router, appRoutes.atlas, 'dismissTo'); }
    catch { setMessage("Couldn't save your progress. Try again."); }
    finally { setPending(false); }
  };
  if (homeStep === 'checking') return <Screen><Body>Opening photo setup…</Body></Screen>;
  if (homeStep === 'error') return <Screen><Title>Couldn’t check your Home setup</Title>
    <ActionButton onPress={() => { setHomeStep('checking'); setHomeRetry((current) => current + 1); }}>Try again</ActionButton></Screen>;
  if (homeStep === 'required') return <InitialHomeSetup save={async (command, areas) => {
    await controller.saveInitialHomes(command, areas);
    setHomeStep('done');
  }} />;
  return <Screen>
    <Title>{controller.isAccountRecord ? 'Account & sources' : 'Find your journeys in your photos'}</Title>
    {controller.isAccountRecord ? <><Body>Add a source through your account&apos;s explicit consent controls, or switch to your separate local history.</Body><ActionButton onPress={() => openRoute(router, appRoutes.account)}>Open account & sources</ActionButton></> : <>
      <Body>Choose the photos Travel Life can read. We&apos;ll build your Atlas on this device.</Body>
      {snapshot.scope !== 'unavailable' && snapshot.scope !== 'denied' && snapshot.scope !== 'revoked' && <ActionButton accessibilityLabel="Use photo library" disabled={pending} onPress={() => void choose('library')}>Use photo library</ActionButton>}
      <ActionButton accessibilityLabel="Choose some photos" disabled={pending} onPress={() => void choose('selected')} variant="secondary">Choose some photos</ActionButton>
      {snapshot.scope === 'unavailable' && <ActionButton disabled={pending} onPress={() => void controller.refresh()} variant="secondary">Recheck photo access</ActionButton>}
      {(snapshot.scope === 'denied' || snapshot.scope === 'revoked') && <ActionButton onPress={() => void (async () => {
        const correlationId = createDiagnosticCorrelationId();
        try { await Linking.openSettings(); }
        catch (error) {
          recordAppDiagnostic({ operation: 'ONBOARDING_SETUP', stage: 'ACCESS_SETTINGS', reasonCode: classifyAppDiagnosticError(error), retryable: true, durableOutcome: 'unchanged', correlationId });
          setMessage('Device settings are unavailable.');
        }
      })()} variant="secondary">Open settings</ActionButton>}
    </>}
    {pending && <Body>Preparing your photo choice…</Body>}
    {(message || snapshot.message) && <Body>{message ?? snapshot.message}</Body>}
    <ActionButton accessibilityLabel="Not now" disabled={pending} onPress={() => void skip()} variant="secondary">Not now</ActionButton>
    <ActionButton accessibilityLabel="Privacy & details" onPress={() => setDetails(!details)} variant="secondary">Privacy & details</ActionButton>
    {details && <InsetPanel><Body>Originals stay at source. Accessible metadata is processed on this device. Photo location alone does not prove presence. Cloud-only media and inaccessible photos may be missing. This choice does not authorize upload, cloud AI or sharing.</Body><Body>{scopeDescription(snapshot.scope)}</Body></InsetPanel>}
  </Screen>;
}

export function EmptyAtlasScreen() {
  const router = useRouter();
  const { snapshot, controller, importCoverage, maintenance, maintenanceController, reconciliation, catchUpHistory, reconstruction, retryJourneyCorrectionProjection, visualDiscovery, travelWindowDiscovery, durableReveal, loadJourneyDetail, loadJourneyMediaPage, inspectJourneyMedia, confirmTimelineMerge, privateRecord, privateRecordController, loadPossibleTrips, loadHiddenOutings, loadPendingClueReviewCards, reviewClueCard, loadCluePassNotice, dismissCluePassNotice } = usePhotoAccess();
  const AtlasContent = isRecognizableRevealEnabled() ? RecognizableAtlasExperience : AtlasReveal;
  const [initialAtlasContext] = useState(() => consumeAtlasPreviewContext(controller));
  const exploration = useRef<AtlasExploration | null>(initialAtlasContext);
  const scrollY = useRef(initialAtlasContext?.scrollY ?? 0);
  const saveExploration = (context: AtlasExploration) => saveAtlasPreviewContext({ ...context, scrollY: scrollY.current }, controller);
  const onExplorationChange = useCallback((context: AtlasExploration) => { exploration.current = context; }, []);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const { width, fontScale } = useWindowDimensions();
  const [atlasGestureActive, setAtlasGestureActive] = useState(false);
  const [manualEntryRecovery, setManualEntryRecovery] = useState<AtlasExploration | null>(null);
  const [openingAccount, setOpeningAccount] = useState(false);
  const [accountSourceError, setAccountSourceError] = useState(false);
  const manualRecoveryRequest = useRef(0);
  // CAP-3 (detector-v1-2.md): reloads whenever the completed rebuild changes,
  // same lifecycle as the rest of this screen's reveal data.
  const [possibleTrips, setPossibleTrips] = useState<import('@/reconstruction/types').PossibleTripSummary[]>([]);
  useEffect(() => {
    let active = true;
    void loadPossibleTrips().then((result) => { if (active) setPossibleTrips(result); }).catch(() => { if (active) setPossibleTrips([]); });
    return () => { active = false; };
  }, [durableReveal, loadPossibleTrips]);
  // M10.11 (decision 0023/detector-v1-3.md): same reload lifecycle as
  // possibleTrips above; empty today since v1.3 is not yet activated
  // (M10.12) — see loadHiddenOutings' own doc comment.
  const [hiddenOutings, setHiddenOutings] = useState<import('@/reconstruction/types').HiddenOutingSummary[]>([]);
  useEffect(() => {
    let active = true;
    void loadHiddenOutings().then((result) => { if (active) setHiddenOutings(result); }).catch(() => { if (active) setHiddenOutings([]); });
    return () => { active = false; };
  }, [durableReveal, loadHiddenOutings]);
  // CAP-3's owner-facing surfaces: clues the background pass held back,
  // and the one-time "trips updated" note. Both reload whenever the
  // completed rebuild changes, same lifecycle as possibleTrips above.
  const [reviewCards, setReviewCards] = useState<import('@/components/clue-review-cards').PendingClueReviewCard[]>([]);
  const refreshReviewCards = useCallback(() => {
    void loadPendingClueReviewCards().then(setReviewCards).catch(() => setReviewCards([]));
  }, [loadPendingClueReviewCards]);
  useEffect(() => { refreshReviewCards(); }, [durableReveal, refreshReviewCards]);
  const [cluePassNotice, setCluePassNotice] = useState<{ message: string } | null>(null);
  useEffect(() => {
    let active = true;
    void loadCluePassNotice().then((result) => { if (active) setCluePassNotice(result); }).catch(() => { if (active) setCluePassNotice(null); });
    return () => { active = false; };
  }, [durableReveal, loadCluePassNotice]);
  const reveal = projectReveal({
    graph: reconstruction.graph,
    durableRecord: durableReveal,
    privacyReady: durableReveal !== null,
    reconstructionStatus: reconstruction.status,
    reconstructionMessage: reconstruction.message,
    reconciliationStatus: reconciliation.status,
    pendingCount: reconciliation.pendingCount,
    queuedChangeCount: reconciliation.queuedChangeCount,
    unresolvedRemapCount: reconciliation.unresolvedRemapCount,
    sourceScope: snapshot.scope,
    importedCount: importCoverage.scanned,
  });
  const loadPreview = useCallback(async (id: string) => {
    const result = await loadJourneyDetail(id);
    return { detail: result.detail, previews: result.previews, snapshotToken: result.snapshotToken };
  }, [loadJourneyDetail]);
  // Shared by the Possible-trips and Hidden outings cards (code-review
  // finding, 2026-11-22): "Review outing" always opens the same journey
  // detail screen — see PossibleTripsV12Section's own comment for why it
  // must not jump to the Edit hub.
  const reviewOuting = (id: string) => {
    if (exploration.current) saveExploration(exploration.current);
    router.push({ pathname: appRoutes.journey as never, params: { id } });
  };
  const sourceControls = accountSyncEnabled ? <View style={{ gap: 8 }}>
    <Body>{controller.isAccountRecord ? 'Showing account history' : 'Showing this device history'}</Body>
    {controller.isAccountRecord
      ? <ActionButton variant="secondary" onPress={() => recordContext.local()}>View this device history</ActionButton>
      : <ActionButton variant="secondary" disabled={openingAccount} onPress={() => {
        setOpeningAccount(true);
        setAccountSourceError(false);
        const account = getAccountService();
        const restore = account.getLocalOwner() ? Promise.resolve() : account.restore();
        void restore.then(() => recordContext.openAccount())
          .catch(() => setAccountSourceError(true))
          .finally(() => setOpeningAccount(false));
      }}>{openingAccount ? 'Opening account history…' : 'View account history'}</ActionButton>}
    {accountSourceError && <>
      <Body>Open Account to sign in or restore your saved history.</Body>
      <ActionButton variant="secondary" onPress={() => openRoute(router, appRoutes.account)}>Open Account</ActionButton>
    </>}
  </View> : null;
  if (controller.isAccountRecord && privateRecord.state === 'disconnected') {
    return <Screen>
      <Title>Your Atlas</Title>
      {sourceControls}
      <InsetPanel>
        <Body>Your account history is saved on this phone. Reconnect the private record to view it.</Body>
        {privateRecord.message && <Body>{privateRecord.message}</Body>}
        <ActionButton disabled={privateRecord.pendingAction !== null} onPress={() => void privateRecordController.reconnect()}>
          {privateRecord.pendingAction === 'reconnect' ? 'Reconnecting private record…' : 'Reconnect private record'}
        </ActionButton>
      </InsetPanel>
      <ActionButton variant="secondary" onPress={() => openRoute(router, appRoutes.settings)}>Settings</ActionButton>
    </Screen>;
  }
  return (
    <Screen maxContentWidth={width / Math.max(1, fontScale) >= 768 ? 1200 : undefined} scrollEnabled={!atlasGestureActive} initialScrollY={initialAtlasContext?.scrollY} onScrollY={(offset) => { scrollY.current = Math.max(0, offset); }} footer={reveal.replay.eligible && !keyboardVisible ? <View style={{ backgroundColor: '#0B132B', paddingHorizontal: 16, paddingVertical: 8 }}>
      <AtlasActionButton accessibilityLabel="Replay" onPress={() => {
        if (exploration.current) saveExploration(exploration.current);
        openRoute(router, appRoutes.replay);
      }}>Replay</AtlasActionButton>
    </View> : null}>
      <AtlasContent
        sourceControls={sourceControls}
        visualRecovery={<>
          {visualDiscovery?.enabled && durableReveal && privateRecord.state === 'connected' && snapshot.scope === 'full'
            && reconstruction.status !== 'running' && ['idle', 'complete'].includes(controller.preparation)
            ? <VisualPlaceRecovery discovery={visualDiscovery} version={durableReveal} /> : null}
          {travelWindowDiscovery?.enabled && privateRecord.state === 'connected' && snapshot.scope === 'full'
            ? <TravelWindowRecovery discovery={travelWindowDiscovery} /> : null}
        </>}
        preparing={!['idle', 'complete'].includes(controller.preparation)}
        preparationStatus={<PreparationStatus />}
        model={reveal}
        initialExploration={initialAtlasContext}
        onExplorationChange={onExplorationChange}
        externalReplay
        onImport={() => openRoute(router, controller.isAccountRecord ? appRoutes.account : appRoutes.import)}
        onRetry={() => { void retryJourneyCorrectionProjection().catch(() => {}); }}
        onCatchUp={() => { void catchUpHistory().catch(() => {}); }}
        onManualEntry={(context) => {
          if (privateRecord.state === 'connected') { saveExploration(context); openRoute(router, appRoutes.manualJourney); }
          else { manualRecoveryRequest.current += 1; setManualEntryRecovery(context); }
        }}
        onReplay={(context) => { saveExploration(context); openRoute(router, appRoutes.replay); }}
        onSettings={(context) => { saveExploration(context); openRoute(router, appRoutes.settings); }}
        onHome={(context) => { saveExploration(context); openRoute(router, appRoutes.landing); }}
        onOpenJourney={(id) => router.push({ pathname: appRoutes.journey as never, params: { id } })}
        loadJourneyPreview={loadPreview}
        confirmTimelineMerge={snapshot.scope === 'full' && !controller.isAccountRecord ? confirmTimelineMerge : undefined}
        loadJourneyMediaPage={loadJourneyMediaPage}
        inspectJourneyMedia={inspectJourneyMedia}
        onMapGestureChange={setAtlasGestureActive}
        onEditJourney={(id, context) => {
          saveExploration(context);
          router.push({ pathname: '/journey/[id]/edit' as never, params: { id, fromAtlas: '1' } });
        }}
        possibleTrips={<>
          <CluePassNoticeBanner notice={cluePassNotice} onDismiss={() => { setCluePassNotice(null); void dismissCluePassNotice(); }} />
          <ClueReviewCardsSection cards={reviewCards} onResolve={async (cardId, decision) => {
            const result = await reviewClueCard(cardId, decision);
            if (result !== 'stale') refreshReviewCards();
            return result;
          }} />
          <PossibleTripsV12Section trips={possibleTrips}
            onReviewOuting={reviewOuting}
            onSetHome={() => { if (exploration.current) saveExploration(exploration.current); openRoute(router, appRoutes.settings); }} />
          <HiddenOutingsV13Section outings={hiddenOutings} onReviewOuting={reviewOuting} />
        </>}
      />
      <UpdatesInvitation eligible={controller.preparation === 'complete' && controller.preparationScope !== 'selected' && controller.preparationScope !== null && !maintenance.enabled} enable={() => maintenanceController.setEnabled(true)} />
      {manualEntryRecovery && <InsetPanel>
        <Title>{privateRecord.state === 'deleted' ? 'Create a private record first' : 'Reconnect your private record first'}</Title>
        <Body>{privateRecord.state === 'deleted' ? 'A private record is needed before adding a journey. Creating it establishes local storage only; it does not scan or change your photos.' : 'Reconnect the private record on this device before adding a journey. Your Atlas view will stay here.'}</Body>
        {privateRecord.message && <Body>{privateRecord.message}</Body>}
        {privateRecord.state === 'connected' ? <ActionButton accessibilityLabel="Continue to manual journey" onPress={() => { saveExploration(manualEntryRecovery); setManualEntryRecovery(null); openRoute(router, appRoutes.manualJourney); }}>Continue to add journey</ActionButton> : <ActionButton accessibilityLabel={privateRecord.state === 'deleted' ? 'Create private record and add journey' : 'Reconnect private record and add journey'} disabled={privateRecord.pendingAction === 'reconnect'} onPress={() => void (async () => {
          const request = manualRecoveryRequest.current + 1;
          manualRecoveryRequest.current = request;
          const connected = await privateRecordController.reconnect();
          if (connected && request === manualRecoveryRequest.current) { saveExploration(manualEntryRecovery); setManualEntryRecovery(null); openRoute(router, appRoutes.manualJourney); }
        })()}>{privateRecord.pendingAction === 'reconnect' ? 'Preparing private record…' : privateRecord.state === 'deleted' ? 'Create private record' : 'Reconnect private record'}</ActionButton>}
        <ActionButton accessibilityLabel="Cancel private record recovery" onPress={() => { manualRecoveryRequest.current += 1; setManualEntryRecovery(null); }} variant="secondary">Stay in Atlas</ActionButton>
      </InsetPanel>}


    </Screen>
  );
}

export function ReplayAvailabilityScreen() {
  const router = useRouter();
  const { snapshot, importCoverage, reconciliation, reconstruction, durableReveal } = usePhotoAccess();
  const reveal = projectReveal({ graph: reconstruction.graph, privacyReady: durableReveal !== null, durableRecord: durableReveal, reconstructionStatus: reconstruction.status, reconstructionMessage: reconstruction.message, reconciliationStatus: reconciliation.status, pendingCount: reconciliation.pendingCount, queuedChangeCount: reconciliation.queuedChangeCount, unresolvedRemapCount: reconciliation.unresolvedRemapCount, sourceScope: snapshot.scope, importedCount: importCoverage.scanned });
  if (!reveal.replay.eligible) return <Screen>
    <Eyebrow>Private Replay</Eyebrow>
    <Title>Replay is unavailable.</Title>
    <InsetPanel><Body>{reveal.replay.reason}</Body><Body>Your private Atlas remains available while you recover or add supported local evidence.</Body></InsetPanel>
    <ActionButton accessibilityLabel="Return to private Atlas" onPress={() => openRoute(router, appRoutes.atlas, 'replace')}>Return to Atlas</ActionButton>
  </Screen>;
  return <Screen>
    <Eyebrow>Private Replay</Eyebrow>
    <Title>Replay needs its local renderer.</Title>
    <InsetPanel>
      <Body>Replay can use observed destinations from your private revealed record. It does not draw a travelled route or export anything from this screen.</Body>
      <Body>Local video rendering has not yet passed the required device checks. Nothing is prepared, published, or shared here.</Body>
    </InsetPanel>
    <ActionButton accessibilityLabel="Return to private Atlas" onPress={() => openRoute(router, appRoutes.atlas, 'replace')}>Return to Atlas</ActionButton>
  </Screen>;
}

export function PrivacySettingsScreen() {
  const router = useRouter();
  const { controller, privateRecord, privateRecordController, maintenance, maintenanceController, reconciliation, durableReveal, homeBases, loadJourneyPrivacyPolicies, restoreJourneyPrivacy, loadJourneyDetail, saveConfiguredHomeArea, saveDirectHome, renameConfiguredHomeArea, removeConfiguredHomeArea, previewHomeAreaRadius, compareDetectorPolicy, setDetectorPolicy, visualDiscovery, loadPersonalRules, removePersonalRule } = usePhotoAccess();
  const [task, setTask] = useState<'account' | 'homes' | 'updates' | 'privacy' | 'learned' | 'detection' | null>(null);
  // M10.12 (decision 0023): the owner-facing v1.2/v1.3 comparison and
  // switch/rollback, loaded only while this task is open — same lifecycle
  // as the "learned" task's personalRules load below.
  const [detectorComparison, setDetectorComparison] = useState<import('@/reconstruction/types').DetectorPolicyComparison | null>(null);
  const [switchingDetector, setSwitchingDetector] = useState(false);
  const [detectorMessage, setDetectorMessage] = useState<string | null>(null);
  useEffect(() => {
    if (task !== 'detection') return;
    let active = true;
    void compareDetectorPolicy().then((result) => { if (active) setDetectorComparison(result); }).catch(() => { if (active) setDetectorComparison(null); });
    return () => { active = false; };
  }, [task, compareDetectorPolicy]);
  const switchDetectorPolicy = async () => {
    if (!detectorComparison || switchingDetector) return;
    setSwitchingDetector(true);
    setDetectorMessage('Switching trip rules and rebuilding your local history. This can take a moment.');
    const priorComparison = detectorComparison;
    try {
      await setDetectorPolicy(priorComparison.candidatePolicy);
      setDetectorMessage(null);
      // Nothing else changed between the dry run and this successful
      // switch, so the two sides just swap rather than paying for a
      // second full comparison read right after the rebuild already did
      // one (code-review finding, 2026-11-23).
      setDetectorComparison({
        activePolicy: priorComparison.candidatePolicy, candidatePolicy: priorComparison.activePolicy,
        active: priorComparison.candidate, candidate: priorComparison.active,
        gainedCount: priorComparison.lostCount, lostCount: priorComparison.gainedCount,
        changedCount: priorComparison.changedCount, unchangedCount: priorComparison.unchangedCount,
      });
    } catch {
      setDetectorMessage('Switching trip rules did not complete. Try again.');
      // The switch may have partially applied (provider.tsx's own
      // setDetectorPolicy reverts the stored policy on a failed rebuild,
      // but never assume that from here) — re-read rather than leave a
      // comparison on screen that might not match what is actually stored
      // (code-review finding, 2026-11-23).
      setDetectorComparison(await compareDetectorPolicy().catch(() => null));
    } finally {
      setSwitchingDetector(false);
    }
  };
  const [personalRules, setPersonalRules] = useState<{ ruleId: string; kind: string; scope: Record<string, unknown>; createdAtMillis: number }[]>([]);
  const [removingRuleId, setRemovingRuleId] = useState<string | null>(null);
  useEffect(() => {
    if (task !== 'learned') return;
    let active = true;
    void loadPersonalRules().then((rules) => { if (active) setPersonalRules(rules); }).catch(() => { if (active) setPersonalRules([]); });
    return () => { active = false; };
  }, [task, loadPersonalRules]);
  const removeRule = async (ruleId: string) => {
    setRemovingRuleId(ruleId);
    try { await removePersonalRule(ruleId); setPersonalRules((previous) => previous.filter((rule) => rule.ruleId !== ruleId)); }
    finally { setRemovingRuleId(null); }
  };
  const [directHome, setDirectHome] = useState<{ existing?: SavedHomeSetup } | null>(null);
  useEffect(() => {
    if (!task) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (directHome) setDirectHome(null);
      else setTask(null);
      return true;
    });
    return () => subscription.remove();
  }, [task, directHome]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [selectedHome, setSelectedHome] = useState<string | null>(null);
  const [selectedHomeVisit, setSelectedHomeVisit] = useState<string | null>(null);
  const [homePreview, setHomePreview] = useState<{ detail: JourneyDetail; previews: OwnerPreview[] } | null>(null);
  const [homeStart, setHomeStart] = useState('');
  const [homeEnd, setHomeEnd] = useState('');
  const [homeLabel, setHomeLabel] = useState('');
  const [editingHomeId, setEditingHomeId] = useState<string | null>(null);
  const [pendingHomeRemoval, setPendingHomeRemoval] = useState<string | null>(null);
  const [homeMessage, setHomeMessage] = useState<string | null>(null);
  const [savingHome, setSavingHome] = useState(false);
  const selectedHomeRequest = useRef(0);
  const saveHome = async () => {
    if (!selectedHome || !selectedHomeVisit || savingHome || !homeLabel.trim()) return;
    setSavingHome(true);
    setHomeMessage('Saving your home base and rebuilding local history. This can take a moment.');
    try {
      await saveConfiguredHomeArea(selectedHome, selectedHomeVisit, homeLabel, homeStart || null, homeEnd || null);
      setHomeMessage('Home base saved. Your updated local history is ready in Atlas.');
    } catch (error) {
      const detail = error instanceof Error && error.message.includes('rebuild')
        ? 'Home base saved, but local history could not rebuild. Return to Atlas and choose Rebuild local journey history.'
        : 'Home base could not be saved. Check the dates and selected journey, then try again.';
      setHomeMessage(detail);
    } finally {
      setSavingHome(false);
    }
  };
  const saveExistingHomeName = async (id: string) => {
    if (savingHome || !homeLabel.trim()) return;
    setSavingHome(true); setHomeMessage('Saving your Home base name.');
    try { await renameConfiguredHomeArea(id, homeLabel); setEditingHomeId(null); setHomeMessage('Home base name saved. Your local history is refreshed.'); }
    catch (error) { setHomeMessage(error instanceof Error && error.message.includes('rebuild') ? 'Home base name saved, but local history could not rebuild. Return to Atlas and choose Rebuild local journey history.' : 'Home base name could not be saved. Try again.'); }
    finally { setSavingHome(false); }
  };
  const confirmHomeRemoval = async (id: string) => {
    if (savingHome) return;
    setSavingHome(true); setHomeMessage('Removing this Home base and refreshing local history.');
    try { await removeConfiguredHomeArea(id); setPendingHomeRemoval(null); setHomeMessage('Home base removed. Your original photos remain in your library.'); }
    catch (error) { setHomeMessage(error instanceof Error && error.message.includes('rebuild') ? 'Home base removed, but local history could not rebuild. Return to Atlas and choose Rebuild local journey history.' : 'Home base could not be removed. Try again.'); }
    finally { setSavingHome(false); }
  };
  const chooseHomeJourney = async (displayId: string) => {
    const request = selectedHomeRequest.current + 1;
    selectedHomeRequest.current = request;
    setSelectedHome(displayId);
    setSelectedHomeVisit(null);
    setHomePreview(null);
    setHomeLabel('');
    setHomeMessage('Opening this journey so you can review its photos and observed areas.');
    try {
      const result = await loadJourneyDetail(displayId);
      if (selectedHomeRequest.current !== request) return;
      setHomePreview({ detail: result.detail, previews: result.previews });
      setHomeMessage(null);
    } catch {
      if (selectedHomeRequest.current !== request) return;
      setHomeMessage('This journey is no longer available. Return to Atlas and choose another available journey.');
    }
  };

  if (directHome && saveDirectHome && !controller.isAccountRecord) return <InitialHomeSetup
    existing={directHome.existing} settings={() => setDirectHome(null)} previewHomeAreaRadius={previewHomeAreaRadius}
    save={async (_command, areas) => {
      const area = areas[0];
      if (!area) return;
      await saveDirectHome(area, directHome.existing?.id);
      setDirectHome(null);
      setHomeMessage('Home base saved. Your updated local history is ready in Atlas.');
    }} />;

  return (
    <Screen>
      <Eyebrow>Private record</Eyebrow>
      <Title>{task === 'homes' ? 'Home bases' : task === 'updates' ? 'Updates' : task === 'privacy' ? 'Privacy & data' : task === 'account' ? 'Account & sources' : task === 'learned' ? 'What Travel Life learned' : task === 'detection' ? 'Trip detection' : 'Settings'}</Title>
      {!task && <>
        <ActionButton onPress={() => setTask('account')} variant="secondary">Account & sources</ActionButton>
        <ActionButton onPress={() => setTask('homes')} variant="secondary">Home bases</ActionButton>
        <ActionButton onPress={() => setTask('updates')} variant="secondary">Updates</ActionButton>
        <ActionButton onPress={() => setTask('privacy')} variant="secondary">Privacy & data</ActionButton>
        <ActionButton onPress={() => setTask('learned')} variant="secondary">What Travel Life learned</ActionButton>
        <ActionButton onPress={() => setTask('detection')} variant="secondary">Trip detection</ActionButton>
        {isReconstructionPreviewEnabled() && !controller.isAccountRecord && privateRecord.state === 'connected'
          && <ActionButton variant="secondary" onPress={() => openRoute(router, appRoutes.atlasPreview)}>Reconstruction preview</ActionButton>}
      </>}
      {task === 'account' && <><ActionButton accessibilityLabel="Open account and sources" onPress={() => openRoute(router, appRoutes.account)} variant="secondary">Open account & sources</ActionButton><ActionButton onPress={() => openRoute(router, appRoutes.import)} variant="secondary">Add photos</ActionButton></>}
      {task === 'privacy' && <>
      <InsetPanel>
        <Body>Normal device backups may restore this private record under the protections of your device and backup account. This app does not claim SQLite encryption.</Body>
        <Body>{privateRecord.state === 'connected' ? 'Photo-source reads are available when you choose to import.' : privateRecord.state === 'disconnected' ? 'Photo-source reads and maintenance are stopped. Your private local record remains on this device.' : 'No local private record is available. Original photos remain in their source.'}</Body>
      </InsetPanel>
      <JourneyPrivacyManager load={loadJourneyPrivacyPolicies} restore={restoreJourneyPrivacy} />
      {visualDiscovery && privateRecord.state === 'connected' && <VisualDiscoverySetting discovery={visualDiscovery} />}
      </>}
      {task === 'homes' && <InsetPanel>
        <Body>{controller.isAccountRecord ? 'Account history' : 'Local history on this device'}</Body>
        {saveDirectHome && !controller.isAccountRecord && <ActionButton onPress={() => setDirectHome({})}>Search for a Home base</ActionButton>}
        <Body>Choose a private journey, review its photos and videos, then select the observed area you want to use. Home photos remain local return context and never create automatic journeys.</Body>
        {homeBases.map((home) => <InsetPanel key={home.id}>
          {editingHomeId === home.id ? <>
            <TextInput accessibilityLabel="Home base name" value={homeLabel} onChangeText={setHomeLabel} placeholder="Name this Home base" placeholderTextColor="#B4C6B5" style={{ color: '#F3EEDD', borderColor: '#B4C6B5', borderWidth: 1, borderRadius: 10, padding: 10 }} />
            <ActionButton accessibilityLabel="Save Home base name" onPress={() => void saveExistingHomeName(home.id)} disabled={savingHome || !homeLabel.trim()}>Save name</ActionButton>
            <ActionButton accessibilityLabel="Cancel Home base rename" onPress={() => { setEditingHomeId(null); setHomeLabel(''); }} variant="secondary">Cancel</ActionButton>
          </> : <>
            <Title>{home.label ?? 'Unnamed home base'}</Title>
            <Body>{homePeriodLabel(home.effectiveStartDay, home.effectiveEndDay)} · Within {Math.round(home.radiusMeters / 1_000)} km</Body>
            {home.origin === 'legacy' && <Body>This existing Home base has no saved name. You can name it without changing its area.</Body>}
            {saveDirectHome && !controller.isAccountRecord && <ActionButton accessibilityLabel={`Edit area for ${home.label ?? 'unnamed Home base'}`}
              variant="secondary" onPress={() => setDirectHome({ existing: home })}>Edit area and dates</ActionButton>}
            {pendingHomeRemoval === home.id ? <><Body>Remove this Home base? Original photos and your private history remain.</Body><ActionButton accessibilityLabel="Confirm remove Home base" onPress={() => void confirmHomeRemoval(home.id)} disabled={savingHome}>Remove Home base</ActionButton><ActionButton accessibilityLabel="Cancel remove Home base" onPress={() => setPendingHomeRemoval(null)} variant="secondary">Cancel</ActionButton></> : <View style={{ flexDirection: 'row', gap: 8 }}><ActionButton accessibilityLabel={`Rename ${home.label ?? 'unnamed Home base'}`} onPress={() => { setEditingHomeId(home.id); setHomeLabel(home.label ?? ''); }} variant="secondary">Rename</ActionButton><ActionButton accessibilityLabel={`Remove ${home.label ?? 'unnamed Home base'}`} onPress={() => homeBases.length > 1 ? setPendingHomeRemoval(home.id) : setHomeMessage('Add another Home base before removing this one. At least one is required.')} variant="secondary">Remove</ActionButton></View>}
          </>}
        </InsetPanel>)}
        {(durableReveal?.journeys ?? []).filter((journey) => journey.anchor !== null && journey.state !== 'owner-entered').map((journey) => <ActionButton key={journey.displayId} accessibilityLabel={`Review ${journey.label ?? journey.periodLabel} for a home base`} onPress={() => void chooseHomeJourney(journey.displayId)} variant={selectedHome === journey.displayId ? 'primary' : 'secondary'}>{journey.label ?? 'Private journey'} · {journey.periodLabel}</ActionButton>)}
        {!durableReveal?.journeys.some((journey) => journey.anchor !== null) && !saveDirectHome && <Body>Import or rebuild an observed private journey before choosing a home base.</Body>}
        {selectedHome && !homePreview && <Body>Opening local journey details…</Body>}
        {homePreview && <View style={{ gap: 10 }}>
          <Title>Review this journey</Title>
          <Body>{homePreview.detail.title} · {homePreview.detail.observedSpan}</Body>
          <Body>Choose the observed area that represents home. A journey may include more than one city.</Body>
          {homePreview.detail.visits.map((visit) => <ActionButton key={visit.id} accessibilityLabel={`Choose observed area ${visit.label}`} onPress={() => setSelectedHomeVisit(visit.id)} accessibilityState={{ selected: selectedHomeVisit === visit.id }} variant={selectedHomeVisit === visit.id ? 'primary' : 'secondary'}>{visit.label} · {visit.precision}</ActionButton>)}
          <Body>{homePreview.detail.memories.length ? 'Photos and videos in this journey' : 'No associated local media is available for this journey.'}</Body>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{homePreview.detail.memories.slice(0, 9).map((memory, index) => {
            const preview = homePreview.previews[index];
            return preview?.uri ? <Image key={memory.id} source={{ uri: preview.uri }} style={{ width: 88, height: 88, borderRadius: 10 }} accessibilityLabel={`Associated ${preview.kind} preview`} cachePolicy="memory" allowDownscaling /> : <View key={memory.id} style={{ width: 88, height: 88, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#B4C6B5' }}><Body>{memory.availability === 'unknown' ? 'Checking' : 'Unavailable'}</Body></View>;
          })}</View>
        </View>}
        {selectedHome && homePreview && <View style={{ gap: 8 }}>
          <TextInput accessibilityLabel="New Home base name" value={homeLabel} onChangeText={setHomeLabel} placeholder="Name this Home base, e.g. Sa Dec, Dong Thap" placeholderTextColor="#B4C6B5" style={{ color: '#F3EEDD', borderColor: '#B4C6B5', borderWidth: 1, borderRadius: 10, padding: 10 }} />
          <TextInput accessibilityLabel="Home base start date" value={homeStart} onChangeText={setHomeStart} placeholder="Start date YYYY-MM-DD (optional)" placeholderTextColor="#B4C6B5" style={{ color: '#F3EEDD', borderColor: '#B4C6B5', borderWidth: 1, borderRadius: 10, padding: 10 }} />
          <TextInput accessibilityLabel="Home base end date" value={homeEnd} onChangeText={setHomeEnd} placeholder="End date YYYY-MM-DD (optional)" placeholderTextColor="#B4C6B5" style={{ color: '#F3EEDD', borderColor: '#B4C6B5', borderWidth: 1, borderRadius: 10, padding: 10 }} />
          <Body>New Home bases cover a 20 km area around your selected observed place. Leave dates blank only if you intend this to apply across your available history.</Body>
          <ActionButton accessibilityLabel="Save home base" onPress={() => void saveHome()} disabled={savingHome || !selectedHomeVisit || !homeLabel.trim()}>{savingHome ? 'Saving home base…' : 'Save home base'}</ActionButton>
        </View>}
        {homeMessage && <Body>{homeMessage}</Body>}
      </InsetPanel>}
      {task === 'updates' && <InsetPanel>
        <Title>Automatic maintenance</Title>
        {controller.preparationScope === 'selected' && <Body>Only the photos you selected are connected. Choose library access before enabling recurring library checks.</Body>}
        <Body>{maintenance.enabled ? 'On. Your device chooses when to check for permitted library changes; it does not promise an exact schedule.' : 'Off. Turn this on only after a completed import to let supported device scheduling check permitted metadata locally.'}</Body>
        <Body>{maintenance.status === 'checked' ? 'Last check completed locally.' : maintenance.status === 'pending' ? 'Waiting for your device to run the task.' : maintenance.status === 'restricted' ? 'Maintenance is restricted until access, import, or scheduling is available.' : maintenance.status === 'paused' ? 'Maintenance paused safely and can resume later.' : maintenance.status === 'running' ? 'Checking currently permitted metadata.' : 'No automatic check has completed yet.'}</Body>
        {maintenance.lastCheckedAtMillis !== null && <Body>Last successful check: {new Date(maintenance.lastCheckedAtMillis).toLocaleString()}.</Body>}
        {maintenance.lastUpdatedAtMillis !== null && <Body>Last local metadata update: {new Date(maintenance.lastUpdatedAtMillis).toLocaleString()}.</Body>}
        {maintenance.message && <Body>{maintenance.message}</Body>}
        <Body>{reconciliation.pendingCount > 0 ? `${reconciliation.pendingCount} local change${reconciliation.pendingCount === 1 ? '' : 's'} await journey reconciliation.` : reconciliation.status === 'complete' ? 'Journey history is caught up locally. Changes remain private and unpublished.' : 'No completed journey reconciliation is recorded yet.'}</Body>
        {reconciliation.lastUpdatedAtMillis !== null && <Body>Journey history last updated locally: {new Date(reconciliation.lastUpdatedAtMillis).toLocaleString()}.</Body>}
        {reconciliation.message && <Body>{reconciliation.message}</Body>}
        <ActionButton accessibilityLabel={maintenance.enabled ? 'Turn off automatic maintenance' : 'Turn on automatic maintenance'} disabled={!maintenance.enabled && controller.preparationScope === 'selected'} onPress={() => void maintenanceController.setEnabled(!maintenance.enabled)} variant="secondary">
          {maintenance.enabled ? 'Turn off automatic maintenance' : 'Turn on automatic maintenance'}
        </ActionButton>
        <ActionButton disabled={controller.preparationScope === 'selected'} onPress={() => void maintenanceController.rescan()} variant="secondary">Check now</ActionButton>
        {controller.preparationScope === 'selected' && <ActionButton onPress={() => openRoute(router, appRoutes.import)} variant="secondary">Choose library access</ActionButton>}
      </InsetPanel>}
      {task === 'privacy' && <>
      {privateRecord.state === 'connected' && <ActionButton accessibilityLabel="Disconnect photo source" disabled={privateRecord.pendingAction !== null} onPress={() => void privateRecordController.disconnect()} variant="secondary">{privateRecord.pendingAction === 'disconnect' ? 'Disconnecting photo source…' : 'Disconnect photo source'}</ActionButton>}
      {privateRecord.state === 'disconnected' && <ActionButton accessibilityLabel="Reconnect private record" disabled={privateRecord.pendingAction !== null} onPress={() => void privateRecordController.reconnect()} variant="secondary">{privateRecord.pendingAction === 'reconnect' ? 'Reconnecting private record…' : 'Reconnect private record'}</ActionButton>}
      {privateRecord.state === 'deleted' && <ActionButton accessibilityLabel="Start a new private record" disabled={privateRecord.pendingAction !== null} onPress={() => void privateRecordController.reconnect()}>{privateRecord.pendingAction === 'reconnect' ? 'Creating private record…' : 'Start a new private record'}</ActionButton>}
      {!confirmingDelete && privateRecord.state !== 'deleted' && <ActionButton accessibilityLabel="Delete local history" disabled={privateRecord.pendingAction !== null} onPress={() => setConfirmingDelete(true)} variant="secondary">Delete local history</ActionButton>}
      {confirmingDelete && <InsetPanel>
        <Title>Delete private history from this device?</Title>
        <Body>This removes the local record, source references, checkpoints, correction overlays, and covered caches. It does not delete original photos or remote copies.</Body>
        <ActionButton accessibilityLabel="Confirm delete local history" disabled={privateRecord.pendingAction !== null} onPress={() => { setConfirmingDelete(false); void privateRecordController.delete(); }}>Delete local history</ActionButton>
        <ActionButton accessibilityLabel="Cancel delete local history" disabled={privateRecord.pendingAction === 'delete'} onPress={() => setConfirmingDelete(false)} variant="secondary">Cancel</ActionButton>
      </InsetPanel>}
      {privateRecord.pendingAction === 'delete' && <Body>Deleting local history from this device…</Body>}
      {privateRecord.message && <InsetPanel><Body>{privateRecord.message}</Body></InsetPanel>}
      </>}
      {task === 'learned' && <>
        <Body>Decisions you make while reviewing your Atlas are remembered here. Remove any of them to let Travel Life suggest that again.</Body>
        {!personalRules.length && <Body>Travel Life hasn&apos;t learned any preferences yet.</Body>}
        {personalRules.map((rule) => <InsetPanel key={rule.ruleId}>
          <Body>{personalRuleSentence(rule.kind)}</Body>
          <ActionButton accessibilityLabel={`Remove this learned preference`} onPress={() => void removeRule(rule.ruleId)} disabled={removingRuleId === rule.ruleId} variant="secondary">{removingRuleId === rule.ruleId ? 'Removing…' : 'Remove'}</ActionButton>
        </InsetPanel>)}
      </>}
      {task === 'detection' && <>
        <Body>Try new rules for sorting trips onto Atlas, Possible trips and Hidden outings, and compare before switching.</Body>
        {!detectorComparison ? <Body>Rebuild your local history in Atlas first to compare trip rules.</Body> : <>
          <InsetPanel>
            <Body>Right now, with {detectorRuleLabel(detectorComparison.activePolicy)}: {detectorComparison.active.atlasCount} on Atlas · {detectorComparison.active.reviewCount} to review · {detectorComparison.active.hiddenCount} hidden</Body>
            <Body>With {detectorRuleLabel(detectorComparison.candidatePolicy)}: {detectorComparison.candidate.atlasCount} on Atlas · {detectorComparison.candidate.reviewCount} to review · {detectorComparison.candidate.hiddenCount} hidden</Body>
            <Body>{detectorComparison.gainedCount} trips would move onto Atlas, {detectorComparison.lostCount} would move off, {detectorComparison.changedCount} would otherwise change.</Body>
          </InsetPanel>
          <ActionButton accessibilityLabel={detectorComparison.activePolicy === 'trip-detector-v1.3' ? 'Switch back to the previous trip rules' : 'Switch to the new trip rules'}
            disabled={switchingDetector} onPress={() => void switchDetectorPolicy()}>
            {switchingDetector ? 'Switching…' : detectorComparison.activePolicy === 'trip-detector-v1.3' ? 'Switch back to the previous trip rules' : 'Switch to the new trip rules'}
          </ActionButton>
        </>}
        {detectorMessage && <Body>{detectorMessage}</Body>}
      </>}
      <ActionButton accessibilityLabel={task ? 'Back to Settings' : 'Return to Atlas'} onPress={() => task ? setTask(null) : openRoute(router, appRoutes.atlas, 'dismissTo')} variant="secondary">Back</ActionButton>
    </Screen>
  );
}

/** M10.12 (decision 0023): plain-language labels for the two detector
 * rules — the Settings UI never shows the internal `trip-detector-v1.x`
 * version string to the owner. v1.1 has no label here since this screen
 * only ever toggles between v1.2 and v1.3 (v1.1 rollback stays a
 * code-level-only selection, decision 0023/M10.8). */
function detectorRuleLabel(policy: string) {
  return policy === 'trip-detector-v1.3' ? 'the new trip rules' : 'the current trip rules';
}

function scopeDescription(scope: ReturnType<typeof usePhotoAccess>['snapshot']['scope']) {
  switch (scope) {
    case 'full': return 'Full device-library access granted. This still does not prove complete lifetime coverage.';
    case 'limited': return 'Limited photo-library access granted. Only the selected portion can be counted.';
    case 'denied': return 'Photo-library access was denied. Use Select photos and videos, or change access in device Settings.';
    case 'revoked': return 'Photo-library access was revoked. The earlier library count was cleared. Use device Settings or select items explicitly.';
    case 'unavailable': return 'Native photo-library access is unavailable here. Use a development build on iOS or Android.';
    default: return 'No photo-library permission has been requested yet.';
  }
}

export function NotFoundScreen() {
  const router = useRouter();
  return (
    <Screen>
      <Eyebrow>Travel Life</Eyebrow>
      <Title>Route not found.</Title>
      <InsetPanel><Body>This path is unavailable, but your private app remains ready to use.</Body></InsetPanel>
      <ActionButton accessibilityLabel="Back to Atlas" onPress={() => openRoute(router, appRoutes.atlas, 'dismissTo')}>Back to Atlas</ActionButton>
    </Screen>
  );
}
