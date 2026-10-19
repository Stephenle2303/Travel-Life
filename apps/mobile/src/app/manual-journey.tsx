import { useRouter } from 'expo-router';
import { ManualJourneyScreen } from '@/components/manual-journey';
import { ActionButton, Body, InsetPanel, Screen, Title } from '@/components/ui';
import { usePhotoAccess } from '@/photo-access/provider';
import { appRoutes, openRoute } from '@/navigation/app-contract';

export default function ManualJourneyRoute() {
  const router = useRouter(); const { findManualJourneyOverlaps, createManualJourney, privateRecord, privateRecordController } = usePhotoAccess();
  if (privateRecord.state !== 'connected') return <Screen><Title>{privateRecord.state === 'deleted' ? 'Create a private record first' : 'Reconnect your private record first'}</Title><InsetPanel><Body>A private record is needed before adding a journey. Creating it establishes local storage only; it does not scan or change your photos.</Body>{privateRecord.message && <Body>{privateRecord.message}</Body>}</InsetPanel><ActionButton accessibilityLabel="Prepare private record for manual journey" disabled={privateRecord.pendingAction === 'reconnect'} onPress={() => void privateRecordController.reconnect()}>{privateRecord.pendingAction === 'reconnect' ? 'Preparing private record…' : privateRecord.state === 'deleted' ? 'Create private record' : 'Reconnect private record'}</ActionButton><ActionButton accessibilityLabel="Return to Atlas" onPress={() => openRoute(router, appRoutes.atlas, 'replace')} variant="secondary">Return to Atlas</ActionButton></Screen>;
  return <ManualJourneyScreen findOverlaps={findManualJourneyOverlaps} save={createManualJourney} onCancel={() => openRoute(router, appRoutes.atlas, 'replace')} onEditExisting={(id) => router.replace({ pathname: '/journey/[id]/edit' as never, params: { id } })} />;
}
