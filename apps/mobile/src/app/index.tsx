import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { WelcomeScreen } from '@/components/welcome-screen';
import { ActionButton, Body, Screen, Title } from '@/components/ui';
import { usePhotoAccess } from '@/photo-access/provider';
import { appRoutes, openRoute } from '@/navigation/app-contract';

export default function EntryScreen() {
  const { controller } = usePhotoAccess();
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'welcome' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void controller.resolveEntry().then((destination) => {
      if (!active) return;
      if (destination === 'welcome') setState('welcome');
      else openRoute(router, destination === 'atlas' ? appRoutes.atlas : appRoutes.import, 'replace');
    }).catch(() => { if (active) setState('error'); });
    return () => { active = false; };
  }, [controller, router, attempt]);
  if (state === 'welcome') return <WelcomeScreen />;
  return <Screen><Title>{state === 'error' ? "Couldn't open your Atlas." : 'Opening your Atlas…'}</Title>{state === 'error' ? <ActionButton onPress={() => { setState('loading'); setAttempt((n) => n + 1); }}>Try again</ActionButton> : <Body>Your private history stays on this device.</Body>}</Screen>;
}
