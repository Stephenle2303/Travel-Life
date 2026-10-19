import { useLocalSearchParams, useRouter } from 'expo-router';

import { JourneyLocationTask } from '@/components/journey-edit';
import { appRoutes, openRoute } from '@/navigation/app-contract';
import { usePhotoAccess } from '@/photo-access/provider';

export default function JourneyCorrectionRoute() {
  const router = useRouter();
  const { id, fromAtlas } = useLocalSearchParams<{ id?: string; fromAtlas?: string }>();
  const { loadJourneyDetail, saveJourneyCorrection, retryJourneyCorrectionProjection } = usePhotoAccess();

  return <JourneyLocationTask
    id={typeof id === 'string' ? id : ''}
    load={loadJourneyDetail}
    save={saveJourneyCorrection}
    retryProjection={retryJourneyCorrectionProjection}
    onBack={() => fromAtlas === '1' ? openRoute(router, appRoutes.atlas, 'replace') : router.replace({ pathname: '/journey/[id]' as never, params: { id } })}
    onApplied={() => openRoute(router, appRoutes.atlas, 'replace')}
  />;
}
