import { useLocalSearchParams, useRouter } from 'expo-router';
import { JourneyEditHub } from '@/components/journey-edit';
import { usePhotoAccess } from '@/photo-access/provider';
import { appRoutes, openRoute } from '@/navigation/app-contract';

export default function JourneyEditRoute() {
  const router = useRouter(); const { id, fromAtlas } = useLocalSearchParams<{ id?: string; fromAtlas?: string }>(); const journeyId = typeof id === 'string' ? id : '';
  const { loadJourneyDetail } = usePhotoAccess();
  return <JourneyEditHub id={journeyId} load={loadJourneyDetail} onBack={() => fromAtlas === '1' ? openRoute(router, appRoutes.atlas, 'replace') : router.replace({ pathname: '/journey/[id]' as never, params: { id: journeyId } })} onTask={(task) => router.push({ pathname: '/journey/[id]/edit/[task]' as never, params: { id: journeyId, task, fromAtlas } })} />;
}
