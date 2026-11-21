import { createAtlasPhaseProfile } from '@/diagnostics/atlas-phase-profile';

describe('opt-in Atlas phase profiling', () => {
  const originalFlag = process.env.EXPO_PUBLIC_ATLAS_PHASE_PROFILE;
  const originalDev = __DEV__;
  let log: jest.SpyInstance;
  beforeEach(() => {
    process.env.EXPO_PUBLIC_ATLAS_PHASE_PROFILE = '1';
    Object.assign(globalThis, { __DEV__: true });
    log = jest.spyOn(console, 'info').mockImplementation(() => {});
  });
  afterEach(() => {
    if (originalFlag === undefined) delete process.env.EXPO_PUBLIC_ATLAS_PHASE_PROFILE;
    else process.env.EXPO_PUBLIC_ATLAS_PHASE_PROFILE = originalFlag;
    Object.assign(globalThis, { __DEV__: originalDev });
    log.mockRestore();
  });

  it('pairs phases within one local correlation without claiming durable completion', () => {
    const profile = createAtlasPhaseProfile('ATLAS_REBUILD_PROFILE', 'REBUILD_OPEN');
    profile.next('REBUILD_INPUT');
    profile.finish(true);
    profile.finish(true);
    profile.next('REBUILD_COMMIT');
    const events = log.mock.calls.map((call) => call[1]);
    expect(events.map((event) => [event.stage, event.reasonCode])).toEqual([
      ['REBUILD_OPEN', 'START'], ['REBUILD_OPEN', 'COMPLETE'],
      ['REBUILD_INPUT', 'START'], ['REBUILD_INPUT', 'COMPLETE'],
    ]);
    expect(new Set(events.map((event) => event.correlationId)).size).toBe(1);
    for (const event of events) {
      expect(Object.keys(event).sort()).toEqual(['operation', 'reasonCode', 'stage', 'retryable', 'durableOutcome', 'correlationId'].sort());
      expect(event.durableOutcome).toBe('unchanged');
    }
  });

  it.each(['release', 'not opted in'])('does not emit in %s mode', (mode) => {
    if (mode === 'release') Object.assign(globalThis, { __DEV__: false });
    else delete process.env.EXPO_PUBLIC_ATLAS_PHASE_PROFILE;
    const profile = createAtlasPhaseProfile('ATLAS_DURABLE_READ_PROFILE', 'DURABLE_OPEN');
    profile.next('DURABLE_SCHEMA');
    profile.finish(true);
    expect(log).not.toHaveBeenCalled();
  });

  it('marks interrupted phases without accepting or exposing errors or results', () => {
    const profile = createAtlasPhaseProfile('ATLAS_DURABLE_READ_PROFILE', 'DURABLE_OPEN');
    profile.finish(false);
    expect(log.mock.calls[1][1]).toMatchObject({ reasonCode: 'UNKNOWN', durableOutcome: 'unchanged', retryable: false });
  });

  it('cannot turn a logging failure into a repository failure', () => {
    log.mockImplementation(() => { throw new Error('private-sentinel'); });
    expect(() => {
      const profile = createAtlasPhaseProfile('ATLAS_REBUILD_PROFILE', 'REBUILD_OPEN');
      profile.next('REBUILD_INPUT');
      profile.finish(false);
    }).not.toThrow();
  });

  it("emits one bucketed classification() event at REBUILD_QUALIFY_PROFILE without disturbing the current stage (M10.2)", () => {
    const profile = createAtlasPhaseProfile('ATLAS_REBUILD_PROFILE', 'REBUILD_OPEN');
    profile.next('REBUILD_QUALIFY');
    profile.classification('HOME_NOT_SET');
    profile.classification('COMPLETE');
    profile.next('REBUILD_ACK');
    profile.finish(true);
    const events = log.mock.calls.map((call) => call[1]);
    expect(events.map((event) => [event.stage, event.reasonCode])).toEqual([
      ['REBUILD_OPEN', 'START'], ['REBUILD_OPEN', 'COMPLETE'],
      ['REBUILD_QUALIFY', 'START'],
      ['REBUILD_QUALIFY_PROFILE', 'HOME_NOT_SET'], ['REBUILD_QUALIFY_PROFILE', 'COMPLETE'],
      ['REBUILD_QUALIFY', 'COMPLETE'],
      ['REBUILD_ACK', 'START'], ['REBUILD_ACK', 'COMPLETE'],
    ]);
    expect(new Set(events.map((event) => event.correlationId)).size).toBe(1);
    for (const event of events) expect(Object.keys(event).sort()).toEqual(['operation', 'reasonCode', 'stage', 'retryable', 'durableOutcome', 'correlationId'].sort());
  });

  it('never emits classification() in release or not-opted-in mode', () => {
    Object.assign(globalThis, { __DEV__: false });
    const profile = createAtlasPhaseProfile('ATLAS_REBUILD_PROFILE', 'REBUILD_OPEN');
    profile.classification('FEW_PHOTOS');
    expect(log).not.toHaveBeenCalled();
  });

  it('classification() cannot turn a logging failure into a repository failure', () => {
    log.mockImplementation(() => { throw new Error('private-sentinel'); });
    expect(() => {
      const profile = createAtlasPhaseProfile('ATLAS_REBUILD_PROFILE', 'REBUILD_OPEN');
      profile.classification('NON_CAPTURE_SOURCE');
    }).not.toThrow();
  });

  it('keeps overlapping repository calls in separate correlations', () => {
    const first = createAtlasPhaseProfile('ATLAS_DURABLE_READ_PROFILE', 'DURABLE_OPEN');
    const second = createAtlasPhaseProfile('ATLAS_DURABLE_READ_PROFILE', 'DURABLE_OPEN');
    first.finish(true);
    second.finish(false);
    expect(log.mock.calls[0][1].correlationId).not.toBe(log.mock.calls[1][1].correlationId);
  });
});
