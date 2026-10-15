import { useLocalSearchParams, useRouter } from 'expo-router';

import { JourneyCorrectionScreen } from '@/components/journey-correction';
import { appRoutes, openRoute } from '@/navigation/app-contract';
import { usePhotoAccess } from '@/photo-access/provider';

export default function JourneyCorrectionRoute() {
  const router = useRouter();
  const { id, fromAtlas } = useLocalSearchParams<{ id?: string; fromAtlas?: string }>();
  const { loadJourneyDetail, loadUncertainMemories, saveJourneyCorrection, saveJourneyMemoryCorrection, discardJourneyCorrectionPending, retryJourneyCorrectionProjection } = usePhotoAccess();

  return <JourneyCorrectionScreen
    id={typeof id === 'string' ? id : ''}
    load={loadJourneyDetail}
    save={saveJourneyCorrection}
    saveMemory={saveJourneyMemoryCorrection}
    loadUncertainMemories={loadUncertainMemories}
    discardPendingRemap={discardJourneyCorrectionPending}
    retryProjection={retryJourneyCorrectionProjection}
    onBack={() => fromAtlas === '1' ? openRoute(router, appRoutes.atlas, 'replace') : router.replace({ pathname: '/journey/[id]' as never, params: { id } })}
    onRejected={() => openRoute(router, appRoutes.atlas, 'replace')}
  />;
}
