# Travel Life recipient viewer

React/TypeScript/Vite implementation of the selected v1 browser highlight.
Run `npm ci`, then `npm run build` here. Copy `.env.example` into ignored local
configuration and supply the publishable key/checked recipient endpoint. The
build generates a public version/endpoint readiness descriptor. Missing endpoint
keeps mobile copy/share gated. No service key belongs in the browser.

Google Maps requires a restricted browser key and map ID; unconfigured/rejected
maps preserve the complete selectable chronological destination list. Fragment
capability is consumed and history-cleared before network/third-party loading.
Recipient payload strings render as text. Media uses authenticated body/header
requests and disposable blob URLs; no storage/signed URLs, analytics or workers.

Vercel configuration is prepared in `vercel.json`; `api/viewer.mjs` serves the
generic HTML shell with a fresh per-response script/style nonce so Google Maps
can load under a strict CSP without unsafe-inline or unsafe-eval. No recipient
capability or snapshot is sent to that shell endpoint. Choose this directory as the
project root, configure env values, and deploy only after authorization. Verify
actual no-store/no-index/no-referrer/CSP and host log redaction. Google loader
uses origin-only referrer to support origin-restricted keys; no capability/path
is included. A configured provider map has not been accepted on a real browser.

The local synthetic fixture is `node scripts/fixture-api.mjs` (port 4174), paired
with `VITE_SHARE_READ_ENDPOINT=http://127.0.0.1:4174/read npm run dev -- --port 5173`.
On PowerShell assign that environment variable before invoking npm. Fixture link
is `http://127.0.0.1:5173/#` followed by 43 `S` characters. Never deploy the fixture.

No public viewer has been deployed. Publication/media/deployed logging/device
acceptance gates remain in the existing M4.5 delivery record.
