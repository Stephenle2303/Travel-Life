import type { Href } from 'expo-router';

export const appRoutes = {
  welcome: '/',
  landing: '/welcome',
  trust: '/trust',
  import: '/import',
  atlas: '/history',
  atlasPreview: '/atlas-preview',
  manualJourney: '/manual-journey',
  journey: '/journey/[id]',
  replay: '/replay',
  replayS0: '/replay-s0',
  settings: '/settings',
  account: '/account',
} as const;

export type AppRoute = (typeof appRoutes)[keyof typeof appRoutes];

export function isReconstructionPreviewEnabled() {
  return __DEV__ && process.env.EXPO_PUBLIC_TRAVEL_LIFE_RECONSTRUCTION_PREVIEW === 'true';
}

export function isRecognizableRevealEnabled() {
  return __DEV__ && process.env.EXPO_PUBLIC_TRAVEL_LIFE_RECOGNIZABLE_REVEAL === 'true';
}

type RouteRouter = {
  push: (href: Href) => void;
  replace: (href: Href) => void;
  dismissTo: (href: Href) => void;
};

/** Keeps route strings at the navigation boundary instead of screen components. */
export function openRoute(
  router: RouteRouter,
  route: AppRoute,
  method: keyof Pick<RouteRouter, 'push' | 'replace' | 'dismissTo'> = 'push',
) {
  router[method](route as Href);
}
