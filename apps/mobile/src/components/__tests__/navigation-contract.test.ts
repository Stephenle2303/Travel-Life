import type { Href } from 'expo-router';

import { appRoutes, openRoute } from '@/navigation/app-contract';

describe('navigation contract', () => {
  it('keeps each owner-facing destination in the typed route contract', () => {
    const visited: string[] = [];
    const router = {
      push: (route: Href) => { visited.push(`push:${String(route)}`); },
      replace: (route: Href) => { visited.push(`replace:${String(route)}`); },
      dismissTo: (route: Href) => { visited.push(`dismissTo:${String(route)}`); },
    };

    openRoute(router, appRoutes.welcome);
    openRoute(router, appRoutes.trust);
    openRoute(router, appRoutes.import);
    openRoute(router, appRoutes.atlas, 'replace');
    openRoute(router, appRoutes.settings);
    openRoute(router, appRoutes.trust, 'dismissTo');

    expect(visited).toEqual(['push:/', 'push:/trust', 'push:/import', 'replace:/history', 'push:/settings', 'dismissTo:/trust']);
  });
});
