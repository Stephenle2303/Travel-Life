import { getMockConfig } from 'expo-router/testing-library';

describe('Expo Router registration', () => {
  it('registers the production Welcome, Trust, Import, Atlas, Settings, and not-found modules', () => {
    const routeTree = JSON.stringify(getMockConfig('src/app'));

    expect(routeTree).toContain('index');
    expect(routeTree).toContain('trust');
    expect(routeTree).toContain('import');
    expect(routeTree).toContain('history');
    expect(routeTree).toContain('settings');
    expect(routeTree).toContain('+not-found');
  });
});
