import { useCallback, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';

import { appRoutes, openRoute } from '@/navigation/app-contract';
import { ActionButton, Body, Eyebrow, InsetPanel, Screen, Title } from '@/components/ui';
import { AtlasReveal } from '@/components/atlas-reveal';
import { usePhotoAccess } from '@/photo-access/provider';
import { projectReveal } from '@/reveal/projection';
import { consumeAtlasPreviewContext, saveAtlasPreviewContext } from '@/atlas/preview-context';
import type { JourneyDetail } from '@/reveal/types';
import type { OwnerPreview } from '@/photo-access/types';

export function TrustScreen() {
  const router = useRouter();
  return (
    <Screen>
      <Eyebrow>Private from the first step</Eyebrow>
      <Title>Your travel life, held with care.</Title>
      <InsetPanel>
        <Body>Travel Life will help you shape a private, on-device-first history from the evidence you choose to connect.</Body>
        <Body>There is no account to create here, and nothing is being scanned on this screen.</Body>
      </InsetPanel>
      <ActionButton accessibilityLabel="Continue to import" onPress={() => openRoute(router, appRoutes.import)}>Continue</ActionButton>
      <ActionButton accessibilityLabel="View empty Atlas" onPress={() => openRoute(router, appRoutes.atlas)} variant="secondary">View Atlas</ActionButton>
    </Screen>
  );
}

export function ImportScreen() {
  const router = useRouter();
  const { snapshot, controller, importCoverage } = usePhotoAccess();
  const hasLibraryScope = snapshot.scope === 'full' || snapshot.scope === 'limited';
  const canResume = importCoverage.status === 'paused' || importCoverage.status === 'blocked';
  return (
    <Screen>
      <Eyebrow>Private photo access</Eyebrow>
      <Title>Choose what this device can share.</Title>
      <InsetPanel>
        <Body>Allow access to the photos and videos visible to this device. A count begins only after you choose. Your original media stays in its source; this step does not create a travel history or send media to cloud AI.</Body>
        <Body>Device-visible items may omit cloud-only media or parts of your history. Photo location alone never proves you were there.</Body>
      </InsetPanel>
      {snapshot.scope === 'unasked' && snapshot.canAskAgain && <ActionButton accessibilityLabel="Allow full photo library" onPress={() => void controller.requestBroad()}>
        Allow full photo library
      </ActionButton>}
      {snapshot.scope !== 'unavailable' && <ActionButton accessibilityLabel="Select photos and videos" onPress={() => void controller.selectPhotos()} variant="secondary">
        Select photos and videos
      </ActionButton>}
      <InsetPanel>
        <Body>{snapshot.scope === 'unasked' && !snapshot.canAskAgain ? 'Photo access cannot be requested here. Check device Settings or select photos and videos explicitly.' : scopeDescription(snapshot.scope)}</Body>
        {snapshot.countStatus === 'counting' && <Body>Counting device-visible photos and videos: {snapshot.count} so far. This is incomplete.</Body>}
        {snapshot.countStatus === 'complete' && <Body>{snapshot.count} device-visible photos and videos observed in a finished scan of the current {snapshot.scope} access scope. The library can change, so this is not lifetime coverage.</Body>}
        {snapshot.countStatus === 'incomplete' && <Body>Incomplete count: {snapshot.count} device-visible items observed before the scan stopped.</Body>}
        {snapshot.selectedCount !== null && <Body>{snapshot.selectedCount} items returned by your selection. This is only the selected set, not a library count; no evidence has been imported yet.</Body>}
        {snapshot.selectedMissingIds > 0 && <Body>{snapshot.selectedMissingIds} selected items have no stable library ID. Their later import may be limited.</Body>}
        {snapshot.message && <Body>{snapshot.message}</Body>}
      </InsetPanel>
      {hasLibraryScope && <InsetPanel>
        <Body>Current accessible scope: {importCoverage.accessible === null ? 'not counted for this import' : importCoverage.accessible}. Scanned: {importCoverage.scanned}. Geotagged metadata available: {importCoverage.geotagged}. Unavailable: {importCoverage.unavailable}.</Body>
        <Body>{importCoverage.status === 'complete' ? 'Metadata import completed for the current accessible scope. This is not lifetime coverage.' : importCoverage.status === 'running' ? 'Importing normalized metadata locally. You can pause safely after a committed page.' : importCoverage.status === 'paused' ? 'Import is paused. Resume only reads the current accessible scope.' : importCoverage.status === 'blocked' ? 'Import stopped because access changed. Recheck access before resuming.' : 'Start imports metadata only into this device-local index.'}</Body>
        {importCoverage.message && <Body>{importCoverage.message}</Body>}
      </InsetPanel>}
      {hasLibraryScope && importCoverage.status !== 'running' && <ActionButton accessibilityLabel={canResume ? 'Resume metadata import' : 'Start metadata import'} onPress={() => void controller.startImport()}>
        {canResume ? 'Resume metadata import' : 'Start metadata import'}
      </ActionButton>}
      {hasLibraryScope && importCoverage.status === 'running' && <ActionButton accessibilityLabel="Cancel metadata import" onPress={() => controller.cancelImport()} variant="secondary">Cancel metadata import</ActionButton>}
      {snapshot.selectedCount !== null && <ActionButton accessibilityLabel="Import selected metadata" onPress={() => void controller.importSelected()} variant="secondary">Import selected metadata</ActionButton>}
      {hasLibraryScope && snapshot.countStatus !== 'counting' && <ActionButton accessibilityLabel="Recheck accessible photos" onPress={() => void controller.countAccessible()} variant="secondary">Recheck accessible photos</ActionButton>}
      {snapshot.scope === 'limited' && snapshot.countStatus !== 'counting' && <ActionButton accessibilityLabel="Manage limited selection" onPress={() => void controller.manageLimited()} variant="secondary">Manage limited selection</ActionButton>}
      <ActionButton accessibilityLabel="View empty Atlas" onPress={() => openRoute(router, appRoutes.atlas)}>View Atlas</ActionButton>
      <ActionButton accessibilityLabel="Return to Trust" onPress={() => openRoute(router, appRoutes.trust, 'replace')} variant="secondary">Back</ActionButton>
    </Screen>
  );
}

export function EmptyAtlasScreen() {
  const router = useRouter();
  const { snapshot, importCoverage, reconciliation, catchUpHistory, reconstruction, reconstructionController, durableReveal, loadJourneyDetail, loadJourneyMediaPage } = usePhotoAccess();
  const [initialAtlasContext] = useState(() => consumeAtlasPreviewContext());
  const [atlasGestureActive, setAtlasGestureActive] = useState(false);
  const reveal = projectReveal({
    graph: reconstruction.graph,
    durableRecord: durableReveal,
    reconstructionStatus: reconstruction.status,
    reconciliationStatus: reconciliation.status,
    pendingCount: reconciliation.pendingCount,
    sourceScope: snapshot.scope,
    importedCount: importCoverage.scanned,
  });
  const loadPreview = useCallback(async (id: string) => {
    const result = await loadJourneyDetail(id);
    return { detail: result.detail, previews: result.previews, snapshotToken: result.snapshotToken };
  }, [loadJourneyDetail]);
  return (
    <Screen scrollEnabled={!atlasGestureActive}>
      <Eyebrow>Private Atlas</Eyebrow>
      <AtlasReveal
        model={reveal}
        initialExploration={initialAtlasContext}
        onImport={() => openRoute(router, appRoutes.import)}
        onRetry={() => void reconstructionController.rebuild()}
        onCatchUp={() => void catchUpHistory()}
        onManualEntry={() => openRoute(router, appRoutes.settings)}
        onReplay={() => openRoute(router, appRoutes.replay)}
        onSettings={() => openRoute(router, appRoutes.settings)}
        onOpenJourney={(id) => router.push({ pathname: appRoutes.journey as never, params: { id } })}
        loadJourneyPreview={loadPreview}
        loadJourneyMediaPage={loadJourneyMediaPage}
        onMapGestureChange={setAtlasGestureActive}
        onEditJourney={(id, context) => {
          saveAtlasPreviewContext(context);
          router.push({ pathname: '/journey/[id]/edit' as never, params: { id, fromAtlas: '1' } });
        }}
      />
      <ActionButton accessibilityLabel="Open private record settings" onPress={() => openRoute(router, appRoutes.settings)} variant="secondary">Private record settings</ActionButton>
      <ActionButton accessibilityLabel="Return to Trust" onPress={() => openRoute(router, appRoutes.trust, 'replace')} variant="secondary">Back</ActionButton>
    </Screen>
  );
}

export function ReplayAvailabilityScreen() {
  const router = useRouter();
  const { snapshot, importCoverage, reconciliation, reconstruction, durableReveal } = usePhotoAccess();
  const reveal = projectReveal({ graph: reconstruction.graph, durableRecord: durableReveal, reconstructionStatus: reconstruction.status, reconciliationStatus: reconciliation.status, pendingCount: reconciliation.pendingCount, sourceScope: snapshot.scope, importedCount: importCoverage.scanned });
  if (!reveal.replay.eligible) return <Screen>
    <Eyebrow>Private Replay</Eyebrow>
    <Title>Replay is unavailable.</Title>
    <InsetPanel><Body>{reveal.replay.reason}</Body><Body>Your private Atlas remains available while you recover or add supported local evidence.</Body></InsetPanel>
    <ActionButton accessibilityLabel="Return to private Atlas" onPress={() => openRoute(router, appRoutes.atlas, 'replace')}>Return to Atlas</ActionButton>
  </Screen>;
  return <Screen>
    <Eyebrow>Private Replay</Eyebrow>
    <Title>Replay is preparing.</Title>
    <InsetPanel>
      <Body>Replay can use observed destinations from your private revealed record. It does not draw a travelled route or export anything from this screen.</Body>
      <Body>The renderer and export controls arrive in the Replay story. Nothing is published or shared here.</Body>
    </InsetPanel>
    <ActionButton accessibilityLabel="Return to private Atlas" onPress={() => openRoute(router, appRoutes.atlas, 'replace')}>Return to Atlas</ActionButton>
  </Screen>;
}

export function PrivacySettingsScreen() {
  const router = useRouter();
  const { privateRecord, privateRecordController, maintenance, maintenanceController, reconciliation, durableReveal, homeBases, loadJourneyDetail, saveConfiguredHomeArea, renameConfiguredHomeArea, removeConfiguredHomeArea } = usePhotoAccess();
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

  return (
    <Screen>
      <Eyebrow>Private record</Eyebrow>
      <Title>Private record controls</Title>
      <InsetPanel>
        <Body>Normal device backups may restore this private record under the protections of your device and backup account. This app does not claim SQLite encryption.</Body>
        <Body>{privateRecord.state === 'connected' ? 'Photo-source reads are available when you choose to import.' : privateRecord.state === 'disconnected' ? 'Photo-source reads and maintenance are stopped. Your private local record remains on this device.' : 'No local private record is available. Original photos remain in their source.'}</Body>
        {privateRecord.message && <Body>{privateRecord.message}</Body>}
      </InsetPanel>
      <InsetPanel>
        <Title>Home bases</Title>
        <Body>Choose a private journey, review its photos and videos, then select the observed area you want to use. Home photos remain local return context and never create automatic journeys.</Body>
        {homeBases.map((home) => <InsetPanel key={home.id}>
          {editingHomeId === home.id ? <>
            <TextInput accessibilityLabel="Home base name" value={homeLabel} onChangeText={setHomeLabel} placeholder="Name this Home base" placeholderTextColor="#B4C6B5" style={{ color: '#F3EEDD', borderColor: '#B4C6B5', borderWidth: 1, borderRadius: 10, padding: 10 }} />
            <ActionButton accessibilityLabel="Save Home base name" onPress={() => void saveExistingHomeName(home.id)} disabled={savingHome || !homeLabel.trim()}>Save name</ActionButton>
            <ActionButton accessibilityLabel="Cancel Home base rename" onPress={() => { setEditingHomeId(null); setHomeLabel(''); }} variant="secondary">Cancel</ActionButton>
          </> : <>
            <Title>{home.label ?? 'Unnamed home base'}</Title>
            <Body>{home.effectiveStartDay || home.effectiveEndDay ? `Active ${home.effectiveStartDay ?? 'from earliest available'} to ${home.effectiveEndDay ?? 'ongoing'}` : 'All available history'} · Within {Math.round(home.radiusMeters / 1_000)} km</Body>
            {home.origin === 'legacy' && <Body>This existing Home base has no saved name. You can name it without changing its area.</Body>}
            {pendingHomeRemoval === home.id ? <><Body>Remove this Home base? Original photos and your private history remain.</Body><ActionButton accessibilityLabel="Confirm remove Home base" onPress={() => void confirmHomeRemoval(home.id)} disabled={savingHome}>Remove Home base</ActionButton><ActionButton accessibilityLabel="Cancel remove Home base" onPress={() => setPendingHomeRemoval(null)} variant="secondary">Cancel</ActionButton></> : <View style={{ flexDirection: 'row', gap: 8 }}><ActionButton accessibilityLabel={`Rename ${home.label ?? 'unnamed Home base'}`} onPress={() => { setEditingHomeId(home.id); setHomeLabel(home.label ?? ''); }} variant="secondary">Rename</ActionButton><ActionButton accessibilityLabel={`Remove ${home.label ?? 'unnamed Home base'}`} onPress={() => setPendingHomeRemoval(home.id)} variant="secondary">Remove</ActionButton></View>}
          </>}
        </InsetPanel>)}
        {(durableReveal?.journeys ?? []).filter((journey) => journey.anchor !== null).map((journey) => <ActionButton key={journey.displayId} accessibilityLabel={`Review ${journey.label ?? journey.periodLabel} for a home base`} onPress={() => void chooseHomeJourney(journey.displayId)} variant={selectedHome === journey.displayId ? 'primary' : 'secondary'}>{journey.label ?? 'Private journey'} · {journey.periodLabel}</ActionButton>)}
        {!durableReveal?.journeys.some((journey) => journey.anchor !== null) && <Body>Import or rebuild an observed private journey before choosing a home base.</Body>}
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
      </InsetPanel>
      <InsetPanel>
        <Title>Automatic maintenance</Title>
        <Body>{maintenance.enabled ? 'On. Your device chooses when to check for permitted library changes; it does not promise an exact schedule.' : 'Off. Turn this on only after a completed import to let supported device scheduling check permitted metadata locally.'}</Body>
        <Body>{maintenance.status === 'checked' ? 'Last check completed locally.' : maintenance.status === 'pending' ? 'Waiting for your device to run the task.' : maintenance.status === 'restricted' ? 'Maintenance is restricted until access, import, or scheduling is available.' : maintenance.status === 'paused' ? 'Maintenance paused safely and can resume later.' : maintenance.status === 'running' ? 'Checking currently permitted metadata.' : 'No automatic check has completed yet.'}</Body>
        {maintenance.lastCheckedAtMillis !== null && <Body>Last successful check: {new Date(maintenance.lastCheckedAtMillis).toLocaleString()}.</Body>}
        {maintenance.lastUpdatedAtMillis !== null && <Body>Last local metadata update: {new Date(maintenance.lastUpdatedAtMillis).toLocaleString()}.</Body>}
        {maintenance.message && <Body>{maintenance.message}</Body>}
        <Body>{reconciliation.pendingCount > 0 ? `${reconciliation.pendingCount} local change${reconciliation.pendingCount === 1 ? '' : 's'} await journey reconciliation.` : reconciliation.status === 'complete' ? 'Journey history is caught up locally. Changes remain private and unpublished.' : 'No completed journey reconciliation is recorded yet.'}</Body>
        {reconciliation.lastUpdatedAtMillis !== null && <Body>Journey history last updated locally: {new Date(reconciliation.lastUpdatedAtMillis).toLocaleString()}.</Body>}
        {reconciliation.message && <Body>{reconciliation.message}</Body>}
        <ActionButton accessibilityLabel={maintenance.enabled ? 'Turn off automatic maintenance' : 'Turn on automatic maintenance'} onPress={() => void maintenanceController.setEnabled(!maintenance.enabled)} variant="secondary">
          {maintenance.enabled ? 'Turn off automatic maintenance' : 'Turn on automatic maintenance'}
        </ActionButton>
      </InsetPanel>
      {privateRecord.state === 'connected' && <ActionButton accessibilityLabel="Disconnect photo source" onPress={() => void privateRecordController.disconnect()} variant="secondary">Disconnect photo source</ActionButton>}
      {privateRecord.state === 'disconnected' && <ActionButton accessibilityLabel="Reconnect private record" onPress={() => void privateRecordController.reconnect()} variant="secondary">Reconnect private record</ActionButton>}
      {privateRecord.state === 'deleted' && <ActionButton accessibilityLabel="Start a new private record" onPress={() => void privateRecordController.reconnect()}>Start a new private record</ActionButton>}
      {!confirmingDelete && privateRecord.state !== 'deleted' && <ActionButton accessibilityLabel="Delete local history" onPress={() => setConfirmingDelete(true)} variant="secondary">Delete local history</ActionButton>}
      {confirmingDelete && <InsetPanel>
        <Title>Delete private history from this device?</Title>
        <Body>This removes the local record, source references, checkpoints, correction overlays, and covered caches. It does not delete original photos or remote copies.</Body>
        <ActionButton accessibilityLabel="Confirm delete local history" onPress={() => { setConfirmingDelete(false); void privateRecordController.delete(); }}>Delete local history</ActionButton>
        <ActionButton accessibilityLabel="Cancel delete local history" onPress={() => setConfirmingDelete(false)} variant="secondary">Cancel</ActionButton>
      </InsetPanel>}
      <ActionButton accessibilityLabel="Return to Atlas" onPress={() => openRoute(router, appRoutes.atlas, 'replace')} variant="secondary">Back</ActionButton>
    </Screen>
  );
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
      <ActionButton accessibilityLabel="Return home" onPress={() => openRoute(router, appRoutes.welcome, 'dismissTo')}>Return home</ActionButton>
    </Screen>
  );
}
