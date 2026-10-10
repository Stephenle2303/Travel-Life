import type { Href } from 'expo-router';

export const appRoutes = {
  welcome: '/',
  trust: '/trust',
  import: '/import',
  atlas: '/history',
  settings: '/settings',
} as const;

export type AppRoute = (typeof appRoutes)[keyof typeof appRoutes];

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
