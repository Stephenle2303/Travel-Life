import { useLocalSearchParams, useRouter } from 'expo-router';
import { JourneyDetailScreen } from '@/components/journey-detail';
import { usePhotoAccess } from '@/photo-access/provider';
import { appRoutes, openRoute } from '@/navigation/app-contract';

export default function JourneyRoute() {
  const router = useRouter(); const { id } = useLocalSearchParams<{ id?: string }>(); const { loadJourneyDetail } = usePhotoAccess();
  return <JourneyDetailScreen id={typeof id === 'string' ? id : ''} load={loadJourneyDetail} onBack={() => openRoute(router, appRoutes.atlas, 'replace')} onCorrect={() => openRoute(router, appRoutes.settings)} />;
}
