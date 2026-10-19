import { useRouter } from 'expo-router';
import { ManualJourneyScreen } from '@/components/manual-journey';
import { usePhotoAccess } from '@/photo-access/provider';
import { appRoutes, openRoute } from '@/navigation/app-contract';

export default function ManualJourneyRoute() {
  const router = useRouter(); const { findManualJourneyOverlaps, createManualJourney } = usePhotoAccess();
  return <ManualJourneyScreen findOverlaps={findManualJourneyOverlaps} save={createManualJourney} onCancel={() => openRoute(router, appRoutes.atlas, 'replace')} onEditExisting={(id) => router.replace({ pathname: '/journey/[id]/edit' as never, params: { id } })} />;
}
