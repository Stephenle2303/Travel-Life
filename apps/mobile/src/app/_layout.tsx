import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { palette, useReducedMotion } from '@/components/ui';
import { PhotoAccessProvider } from '@/photo-access/provider';
import '@/maintenance/task';

export function getRootStackOptions(reducedMotion: boolean) {
  return {
    headerShown: false,
    animation: reducedMotion ? 'none' as const : 'fade' as const,
    contentStyle: { backgroundColor: palette.rainforest },
  };
}

export default function RootLayout() {
  const reducedMotion = useReducedMotion();
  return (
    <PhotoAccessProvider>
      <StatusBar style="light" />
      <Stack screenOptions={getRootStackOptions(reducedMotion)} />
    </PhotoAccessProvider>
  );
}
