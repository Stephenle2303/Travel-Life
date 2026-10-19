import type { PrototypeRecord } from '@/types/prototype';

/** This fixture is invented for interface testing. It contains no person, library, or location evidence. */
export const syntheticRecord: PrototypeRecord = {
  label: 'Synthetic sample only', sourceCoverage: 'Three invented example journeys for a private interface walkthrough.',
  journeys: [
    { id: 'lantern-2014', title: 'Paper Lantern City', year: 2014, observedSpan: 'Synthetic sample: 14–16 April 2014', destinations: ['Paper Lantern City', 'North Paper Market'], status: 'inferred', sourceCoverage: 'Synthetic coverage: 4 fictional sample records', evidenceReason: 'Shown as an inferred example so the owner can test review language.', memories: [{ id: 'lantern-1', label: 'Illustrated lantern market memory', type: 'illustration' }], atlasAnchor: { latitude: 40.7128, longitude: -74.006, regionLabel: 'Public projection fixture near New York' }, image: { key: 'rainforest-river', fileName: 'rainforest-river.png', alt: 'Fictional rainforest river at dawn' } },
    { id: 'beacon-2018', title: 'Beacon Bay', year: 2018, observedSpan: 'Synthetic sample: 3–5 September 2018', destinations: ['Beacon Bay'], status: 'confirmed', sourceCoverage: 'Synthetic coverage: owner-reviewed demo record', evidenceReason: 'Marked confirmed only within this sample session.', memories: [{ id: 'beacon-1', label: 'Illustrated shoreline memory', type: 'illustration' }, { id: 'beacon-2', label: 'Sample caption: tide notes', type: 'caption' }], atlasAnchor: { latitude: 51.5072, longitude: -0.1276, regionLabel: 'Public projection fixture near London' }, image: { key: 'limestone-coast', fileName: 'limestone-coast.png', alt: 'Fictional limestone coast over still water' } },
    { id: 'cedar-2024', title: 'Cedar Isle', year: 2024, observedSpan: 'Synthetic sample: 19–20 November 2024', destinations: ['Cedar Isle', 'West Cedar Lookout'], status: 'inferred', sourceCoverage: 'Synthetic coverage: 3 fictional sample records', evidenceReason: 'A sample uncertain association; it does not establish a visit or route.', memories: [{ id: 'cedar-1', label: 'Illustrated cedar overlook memory', type: 'illustration' }], atlasAnchor: { latitude: 35.6762, longitude: 139.6503, regionLabel: 'Public projection fixture near Tokyo' }, image: { key: 'misty-highland', fileName: 'misty-highland.png', alt: 'Fictional misty highland landscape' } },
  ],
};

export const limitedStateCopy = {
  sparse: { title: 'A partial reveal is still honest', body: 'This example has only one uncertain destination. Travel Life would show what is available instead of inventing a lifetime story.', nextAction: 'Try a manual journey or return when more supported records are available.' },
  declined: { title: 'You can explore without access', body: 'This prototype never asks for access. In the product, declining access would leave the library private and offer a sample or manual journey.', nextAction: 'Explore the synthetic sample or add a manual journey in a future production story.' },
} as const;
