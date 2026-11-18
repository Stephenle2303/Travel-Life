import { useEffect } from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { createAccountController, type AccountAuth, type AccountController } from '@/account/controller';
import { PrivateRecordProvider } from '@/account/root-provider';
import { recordContext } from '@/account/record-context';
import { AccountScreen } from '@/components/account-screen';
import { usePhotoAccess } from '@/photo-access/provider';

let mockController: AccountController;
const mockDisposeMedia = jest.fn();
const mockMounted = jest.fn();
const mockUnmounted = jest.fn();
const mockAdapter = {
  inspect: async () => null, request: async () => null, readPage: async () => 0,
  readMetadataPage: async () => [], readSelectedMetadata: async () => [],
  manageLimited: async () => {}, select: async () => ({ canceled: true }),
};
const mockAccountAdapter = { ...mockAdapter, accountAuthorized: async () => true };
const mockLocalAreas = jest.fn(async () => [{ id: 'local-home', label: 'Synthetic local home', origin: 'observed-area', effectiveStartDay: null, effectiveEndDay: null, radiusMeters: 100 }]);
const mockAccountAreas = jest.fn(async () => [{ id: 'account-home', label: 'Synthetic account home', origin: 'observed-area', effectiveStartDay: null, effectiveEndDay: null, radiusMeters: 100 }]);
const mockRepository = (areas: typeof mockLocalAreas) => ({
  getCheckpoint: async () => null, loadCoverage: async () => null, commitPage: async () => {},
  getPrivateRecordLifecycle: async () => ({ state: 'connected' }), connectPrivateRecord: async () => {},
  disconnectPrivateRecord: async () => {}, deleteLocalHistory: async () => {},
  saveCorrectionOverlay: async () => {}, loadConfiguredHomeAreas: areas,
});

jest.mock('@/account/service', () => ({ getAccountService: () => mockController }));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }),useFocusEffect:jest.requireActual('react').useEffect }));
jest.mock('@/account/history-service', () => ({ historyService: { lock: jest.fn(), catchUp: jest.fn() } }));
jest.mock('@/account/private-media-service', () => ({ privateMediaService: { checkOwner: jest.fn() } }));
jest.mock('@/account/history-sync-native', () => ({ accountSyncEnabled: false }));
jest.mock('@/account/history-store', () => ({
  saveAtlasAccountPreference: async () => {},
  loadReplica: async () => ({ database_name: 'travel-life-account-00000000-0000-4000-8000-000000000001.db', snapshot_id: 'synthetic-snapshot' }),
  replicaBlocked: async () => false,
}));
jest.mock('@/account/media-native', () => ({ createNativeAccountMedia: () => ({ adapter: mockAccountAdapter, dispose: mockDisposeMedia }) }));
jest.mock('@/photo-access/native-adapter', () => ({ get nativePhotoAccess() { return mockAdapter; } }));
jest.mock('@/import-record/repository', () => ({
  createNativeImportRepository: (options?: { databaseName: string }) => mockRepository(options ? mockAccountAreas : mockLocalAreas),
}));
jest.mock('@/reconstruction/repository', () => ({
  ...jest.requireActual('@/reconstruction/repository'),
  createNativeReconstructionRepository: () => ({
    loadDurableReveal: async () => ({ journeys: [] }),
    loadJourneyDetail: async () => ({ detail: null, previewSourceRefs: [], snapshotToken: 1 }),
    loadJourneyMediaPage: async () => ({ items: [], previewSourceRefs: [], hasMore: false }),
    loadUncertainMemories: async () => ({ memories: [], hasMore: false }),
    rebuild: async () => ({}), reconcileQueued: async () => ({}),
  }),
}));
// Keep the real screen's restore/cancel effect and real context/provider ownership.
// Panel presentation and sync jobs are outside this remount regression's scope.
jest.mock('@/components/account-history-panel', () => ({
  AccountHistoryPanel: () => {
    const { Pressable, Text: Label } = jest.requireActual('react-native');
    const { recordContext: context } = jest.requireActual('@/account/record-context');
    return <Pressable accessibilityLabel="View account history" onPress={() => { void context.openAccount(); }}><Label>View</Label></Pressable>;
  },
}));
jest.mock('@/components/account-deletion-panel', () => ({ AccountDeletionPanel: () => null }));
jest.mock('@/components/account-media-panel', () => ({ AccountMediaPanel: () => null }));

function RepositoryProbe() {
  const access = usePhotoAccess();
  useEffect(() => { mockMounted(); return () => { mockUnmounted(); }; }, []);
  return <Text>{access.homeBases.map(area => area.label).join(',')}</Text>;
}

afterEach(() => {
  recordContext.local();
  mockController.dispose();
  jest.clearAllMocks();
});

it('retains the signed-in owner through View remount, but disposes the account view on explicit signout', async () => {
  const session = {
    access_token: 'SYNTHETIC_PRIVATE_TOKEN', expires_at: Date.now() / 1000 + 3600,
    user: { id: 'synthetic-owner', is_anonymous: false, email_confirmed_at: '2026-11-07' },
  } as Session;
  const auth = {
    getSession: jest.fn(async () => ({ data: { session }, error: null })),
    getUser: jest.fn(async () => ({ data: { user: session.user }, error: null })),
    signInWithOtp: jest.fn(async () => ({ error: null })),
    verifyOtp: jest.fn(async () => ({ data: { session }, error: null })),
    signOut: jest.fn(async () => ({ error: null })),
    invalidate: jest.fn(), startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn(),
  } satisfies AccountAuth;
  const storage = { block: jest.fn(async () => {}), allow: jest.fn(async () => {}), removeItem: jest.fn(async () => {}) };
  const sink = jest.fn();
  mockController = createAccountController(auth, storage, sink);
  const screen = await render(<PrivateRecordProvider><AccountScreen /><RepositoryProbe /></PrivateRecordProvider>);
  await waitFor(() => expect(screen.getByText('Synthetic local home')).toBeTruthy());
  await waitFor(() => expect(screen.getByLabelText('Account sync details')).toBeTruthy());
  await fireEvent.press(screen.getByLabelText('Account sync details'));
  await waitFor(() => expect(screen.getByLabelText('View account history')).toBeTruthy());
  expect(auth.getSession).toHaveBeenCalledTimes(1);
  const observedOwners: (string | null)[] = [];
  const unsubscribe = mockController.subscribe(() => observedOwners.push(mockController.getLocalOwner()));

  await fireEvent.press(screen.getByLabelText('View account history'));
  await waitFor(() => expect(screen.getByText('Synthetic account home')).toBeTruthy());
  // Drain the restore queued by the newly mounted AccountScreen before asserting.
  await act(async () => { await mockController.restore(); });
  expect(mockMounted).toHaveBeenCalledTimes(2);
  expect(mockUnmounted).toHaveBeenCalledTimes(1);
  expect(recordContext.isAccount()).toBe(true);
  expect(mockController.getLocalOwner()).toBe('synthetic-owner');
  expect(mockController.getSnapshot()).toMatchObject({ status: 'signed-in', signedIn: true, busy: false });
  expect(observedOwners).not.toContain(null);
  expect(screen.queryByLabelText('Account email')).toBeNull();
  expect(auth.getSession).toHaveBeenCalledTimes(1);
  expect(auth.invalidate).not.toHaveBeenCalled();
  expect(storage.block).not.toHaveBeenCalled();
  expect(mockDisposeMedia).not.toHaveBeenCalled();
  expect(sink.mock.calls.at(-1)![0]).toMatchObject({ operation: 'ACCOUNT_RESTORE', reasonCode: 'SKIPPED', durableOutcome: 'skipped' });
  expect(JSON.stringify(sink.mock.calls)).not.toContain('SYNTHETIC_PRIVATE_TOKEN');

  await fireEvent.press(screen.getByLabelText('Sign out of this phone'));
  await waitFor(() => expect(screen.getByText('Synthetic local home')).toBeTruthy());
  await waitFor(() => expect(mockController.getSnapshot().busy).toBe(false));
  expect(recordContext.isAccount()).toBe(false);
  expect(recordContext.getRepositories()).toBeNull();
  expect(mockController.getLocalOwner()).toBeNull();
  expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  expect(auth.invalidate).toHaveBeenCalledTimes(1);
  expect(storage.block).toHaveBeenCalledTimes(1);
  expect(storage.removeItem).toHaveBeenCalledWith('travel-life-account-v1');
  expect(mockDisposeMedia).toHaveBeenCalledTimes(1);
  unsubscribe();
});
