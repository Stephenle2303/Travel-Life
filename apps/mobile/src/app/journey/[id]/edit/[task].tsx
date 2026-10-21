import { JourneyPrivacyTask } from '@/components/journey-privacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { JourneyLocationTask, type JourneyEditTask } from '@/components/journey-edit';
import { JourneyCorrectionScreen } from '@/components/journey-correction';
import { usePhotoAccess } from '@/photo-access/provider';
import { appRoutes, openRoute } from '@/navigation/app-contract';

export default function JourneyEditTaskRoute() {
  const router = useRouter(); const { id, task, fromAtlas } = useLocalSearchParams<{ id?: string; task?: string; fromAtlas?: string }>(); const journeyId = typeof id === 'string' ? id : ''; const selectedTask = task as JourneyEditTask;
  const { reviewJourneyPrivacy, saveJourneyPrivacy, loadJourneyDetail, loadUncertainMemories, saveJourneyCorrection, saveJourneyMemoryCorrection, discardJourneyCorrectionPending, retryJourneyCorrectionProjection } = usePhotoAccess();
  const back = () => router.replace({ pathname: '/journey/[id]/edit' as never, params: { id: journeyId, fromAtlas } });
  if (selectedTask === 'privacy') return <JourneyPrivacyTask id={journeyId} review={reviewJourneyPrivacy} save={saveJourneyPrivacy} onBack={back} onApplied={() => openRoute(router, appRoutes.atlas, 'replace')} />;
  if (selectedTask === 'location') return <JourneyLocationTask id={journeyId} load={loadJourneyDetail} save={saveJourneyCorrection} retryProjection={retryJourneyCorrectionProjection} onBack={back} onApplied={() => router.replace('/history')} />;
  if (selectedTask === 'name-dates' || selectedTask === 'destinations' || selectedTask === 'photos' || selectedTask === 'accuracy') return <JourneyCorrectionScreen id={journeyId} task={selectedTask} load={loadJourneyDetail} save={saveJourneyCorrection} saveMemory={saveJourneyMemoryCorrection} loadUncertainMemories={loadUncertainMemories} discardPendingRemap={discardJourneyCorrectionPending} retryProjection={retryJourneyCorrectionProjection} onBack={back} onRejected={() => openRoute(router, appRoutes.atlas, 'replace')} />;
  return null;
}
