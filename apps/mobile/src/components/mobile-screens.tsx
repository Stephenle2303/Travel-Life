import { useState } from 'react';
import { useRouter } from 'expo-router';

import { appRoutes, openRoute } from '@/navigation/app-contract';
import { ActionButton, Body, Eyebrow, InsetPanel, Screen, Title } from '@/components/ui';
import { usePhotoAccess } from '@/photo-access/provider';

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
  const { snapshot, importCoverage, privateRecord, maintenanceController, reconciliation, catchUpHistory, reconstruction, reconstructionController, aiReview, aiProposalController } = usePhotoAccess();
  return (
    <Screen>
      <Eyebrow>Private Atlas</Eyebrow>
      <Title>No private record yet.</Title>
      <InsetPanel>
        <Body>After you choose to import, your available record can begin to take shape here. Until then, Atlas has no journeys to show.</Body>
        <Body>Nothing on this screen is a travel claim, map, or inferred history.</Body>
        {snapshot.countStatus !== 'none' && <Body>The last device-visible photo count is {snapshot.countStatus === 'complete' ? 'from a finished scoped scan, though the library can change' : 'incomplete'}. Counting does not create journeys.</Body>}
        {importCoverage.status === 'complete' && <Body>{importCoverage.scanned} metadata records are private and local to this device. Atlas still makes no journey or travel conclusion.</Body>}
        {reconstruction.status === 'running' && <Body>Preparing an inferred local draft from the current private record.</Body>}
        {reconstruction.status === 'complete' && <Body>{reconstruction.graph?.journeys.length ?? 0} inferred journey drafts and {reconstruction.graph?.places.length ?? 0} local places are ready for review. Photo metadata is evidence, not proof of presence.</Body>}
        {reconstruction.message && reconstruction.status !== 'complete' && <Body>{reconstruction.message}</Body>}
        {reconciliation.pendingCount > 0 && <Body>{reconciliation.pendingCount} local change or unresolved correction target{reconciliation.pendingCount === 1 ? '' : 's'} needs review. Your last completed draft remains available.</Body>}
        {reconciliation.status === 'restricted' && <Body>Journey updates are waiting for connected, permitted local access.</Body>}
        {aiReview.status !== 'idle' && <Body>{aiReview.message}</Body>}
        {aiReview.proposals.map((proposal, index) => <Body key={`${proposal.label}-${index}`}>Inferred: {proposal.label}. It references {proposal.candidateIds.length} existing local draft item{proposal.candidateIds.length === 1 ? '' : 's'} and has not changed your history.</Body>)}
        {snapshot.selectedCount !== null && importCoverage.status !== 'complete' && <Body>You selected {snapshot.selectedCount} items for this session; they have not been imported into a private record.</Body>}
        {(snapshot.scope === 'limited' || snapshot.scope === 'denied' || snapshot.scope === 'revoked') && <Body>{scopeDescription(snapshot.scope)}</Body>}
      </InsetPanel>
      <ActionButton accessibilityLabel="Import photos" onPress={() => openRoute(router, appRoutes.import)}>Import photos</ActionButton>
      {privateRecord.state === 'connected' && <ActionButton accessibilityLabel="Rebuild local draft" onPress={() => void reconstructionController.rebuild()} variant="secondary">Rebuild local draft</ActionButton>}
      {privateRecord.state === 'connected' && reconciliation.pendingCount > 0 && <ActionButton accessibilityLabel="Catch up local journey history" onPress={() => void catchUpHistory()} variant="secondary">Catch up local journey history</ActionButton>}
      {privateRecord.state === 'connected' && <ActionButton accessibilityLabel="Rescan permitted library locally" onPress={() => void maintenanceController.rescan()} variant="secondary">Rescan permitted library locally</ActionButton>}
      {reconstruction.status === 'error' && <Body>Retry a local rebuild when ready. It keeps your last completed local draft and corrections.</Body>}
      {privateRecord.state === 'connected' && <ActionButton accessibilityLabel="Request optional AI suggestion" onPress={() => aiProposalController.showDisabledPreview()} variant="secondary">Request optional AI suggestion</ActionButton>}
      {aiReview.status === 'requesting' && <ActionButton accessibilityLabel="Cancel optional AI suggestion" onPress={() => aiProposalController.cancel()} variant="secondary">Cancel optional AI suggestion</ActionButton>}
      <ActionButton accessibilityLabel="Open private record settings" onPress={() => openRoute(router, appRoutes.settings)} variant="secondary">Private record settings</ActionButton>
      <ActionButton accessibilityLabel="Return to Trust" onPress={() => openRoute(router, appRoutes.trust, 'replace')} variant="secondary">Back</ActionButton>
    </Screen>
  );
}

export function PrivacySettingsScreen() {
  const router = useRouter();
  const { privateRecord, privateRecordController, maintenance, maintenanceController, reconciliation } = usePhotoAccess();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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
