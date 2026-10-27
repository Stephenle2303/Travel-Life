import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { SelectedShareScreen } from '@/components/selected-share-screen';
import { ownerRequest, confirmShareJob } from '@/share/owner-service';
const mockAccess = { snapshot: { scope: 'full' }, durableReveal: {}, reconstruction: { graph: null, status: 'complete' }, reconciliation: { status: 'complete', pendingCount: 0 }, importCoverage: { scanned: 1 }, loadJourneyDetail: jest.fn(), loadJourneyMediaPage: jest.fn(), loadJourneyEligibility: jest.fn() };
const mockModel = { journeys: [{ id: 'private1', label: 'Synthetic place', periodLabel: '2024', years: [2024], status: 'Inferred' }] };
jest.mock('@/photo-access/provider', () => ({ usePhotoAccess: () => mockAccess }));
jest.mock('@/reveal/projection', () => ({ projectReveal: () => mockModel }));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }), useLocalSearchParams: () => ({}) }));
jest.mock('@/share/owner-service', () => ({ loadShareJob: async () => null, viewerReady: async () => false, ownerRequest: jest.fn(), publishShareJob: jest.fn(), confirmShareJob: jest.fn(), ShareOwnerError: class extends Error {}, reconcileRemoteRemoval: async () => 'complete', shareLink: async () => null }));
jest.mock('@/share/derivative', () => ({ prepareSelectedDerivative: jest.fn() }));
jest.mock('@/share/public-place', () => ({ namedPlaceCentroid: () => ({ country: '', centroid: null }) }));
jest.mock('@/components/local-trip-media-cover', () => ({ LocalTripMediaCover: () => null }));
jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000001' }));
jest.mock('expo-video', () => ({ useVideoPlayer: () => ({}), VideoView: () => null }));
jest.mock('@/components/ui', () => {
  const { Text, View, Pressable } = jest.requireActual('react-native');
  return { palette: { citrus: '#d8ef69' }, Screen: View, Eyebrow: Text, Body: Text, Title: Text, InsetPanel: View, ActionButton: ({ children, accessibilityLabel, disabled, onPress }: { children: React.ReactNode; accessibilityLabel: string; disabled: boolean; onPress(): void }) => <Pressable accessibilityLabel={accessibilityLabel} disabled={disabled} onPress={onPress}><Text>{children}</Text></Pressable> };
});
describe('selected highlight owner surface', () => {
  beforeEach(() => { jest.clearAllMocks(); mockAccess.loadJourneyDetail.mockResolvedValue({ snapshotToken: 1, detail: { id: 'private1', title: 'Synthetic place', visits: [], memories: [], uncertainty: [] }, previews: [] }); mockAccess.loadJourneyEligibility.mockResolvedValue({ eligible: true, privacyRevision: 1 }); mockAccess.loadJourneyMediaPage.mockResolvedValue({ page: { items: [], hasMore: false }, previews: [] }); });
  it('starts empty and previews facts only after explicit selection, without publishing', async () => {
    await render(<SelectedShareScreen />);
    await screen.findByLabelText('Include Synthetic place'); expect(screen.getByText(/0 trips · 0 memories selected/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Include Synthetic place'));
    await fireEvent.press(screen.getByLabelText('Preview exact selected highlight'));
    await screen.findByText('Review your exact highlight'); expect(screen.getByText(/1 selected destinations · 0 selected memories/)).toBeTruthy();
    expect(ownerRequest).not.toHaveBeenCalled(); expect(confirmShareJob).not.toHaveBeenCalled();
    expect(screen.getByText(/Anyone with this link/)).toBeTruthy(); expect(screen.getByText(/2024 · year precision · inferred/)).toBeTruthy();
  });
  it('independently selects all eligible trip facts and clears selection', async () => {
    await render(<SelectedShareScreen />); await screen.findByLabelText('Include Synthetic place');
    await fireEvent.press(screen.getByLabelText('Select all share trips')); expect(screen.getByText(/1 trips · 0 memories selected/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Clear highlight selection')); expect(screen.getByText(/0 trips · 0 memories selected/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Choose memories for Synthetic place')); await waitFor(() => expect(mockAccess.loadJourneyMediaPage).toHaveBeenCalledWith('private1', 1, 0));
  });
});

