import { getMockConfig } from 'expo-router/testing-library';

describe('Expo Router registration', () => {
  it('registers the production Trust, Import, Atlas, and not-found modules', () => {
    const routeTree = JSON.stringify(getMockConfig('src/app'));

    expect(routeTree).toContain('index');
    expect(routeTree).toContain('import');
    expect(routeTree).toContain('history');
    expect(routeTree).toContain('+not-found');
  });
});
