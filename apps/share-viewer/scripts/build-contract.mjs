import { mkdir, writeFile } from 'node:fs/promises';
const endpoint = process.env.VITE_SHARE_READ_ENDPOINT;
// An absent endpoint yields an intentionally unavailable readiness descriptor.
// The browser bundle can still be built and reviewed before deployment.
if (endpoint && !/^https:\/\/[A-Za-z0-9.-]+\/functions\/v1\/travel-life-share-read$/.test(endpoint)) throw new Error('Invalid share endpoint configuration.');
await mkdir(new URL('../public/', import.meta.url), { recursive: true });
await writeFile(new URL('../public/share-contract.json', import.meta.url), JSON.stringify({ contractVersion: 'travel-life-share-v1', endpoint: endpoint ?? null, mediaPublication: 'disabled' }));
