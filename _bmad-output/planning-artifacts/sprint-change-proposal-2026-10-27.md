# Sprint Change Proposal — zero-cost local Replay sharing

## 1. Issue summary

The selected-share implementation proved that safe hosted photo/video links
need a trusted remote decoder/validator. The owner rejected an ongoing-cost
hosting solution. A nominally free host either cannot run the required native
decoder or is unsuitable for reliable private sharing. The owner instead
approved the smallest safe MLP: private Replay remains local and is deliberately
handed to the operating-system share sheet as a video file.

## 2. Impact analysis

- **M4.7 Replay:** remains in MLP scope. Its exact selected MP4 preview and
  deliberate Gmail/Messenger/Facebook-compatible OS-share handoff are retained.
  Availability depends on installed recipient apps; fresh Android/iOS recipient
  acceptance remains required.
- **M4.5/M4.6:** hosted snapshot/media publication, recipient capabilities,
  browser viewer, expiry/revoke and validator deployment are deferred. They
  cannot be described as complete, deployed, or accepted.
- **Privacy:** no selected derivative, original, storage URL, capability, or
  private evidence is transmitted to a new provider. Existing hard media gate
  remains enabled.
- **Architecture/UX:** remove the hosted-link promise from the MLP release
  narrative. The owner-facing sharing route is Replay → exact preview → system
  share sheet, with an explicit saved-copy/no-revoke warning.

## 3. Recommended approach

**MVP review / scope reduction.** Preserve local Replay sharing and defer M4.5
and M4.6 as a single later initiative, to resume only when the owner approves a
specific trusted-validator host, bounded processing, budget, logging and
deployment acceptance. This is a moderate change: it reorganizes the roadmap
and delivery records but does not require rollback of private/local work.

## 4. Detailed changes

### Epics — M4.5/M4.6

**OLD:** M4.5/M4.6 are P0 MLP requirements for selected snapshot publication
and a browser viewer.

**NEW:** M4.5/M4.6 are deferred post-MLP work. MLP owner sharing is an exact,
locally prepared Replay file handed to the platform share sheet; hosted links,
public recipient media and lifecycle controls are not offered.

**Rationale:** This maintains a useful owner-selected sharing loop without
turning private derivatives into a new hosted-data operation without a justified
operating budget.

### Product/UX

**OLD:** Share can imply a Travel Life-hosted recipient link.

**NEW:** The UI says “Share video”, previews the exact file, invokes the system
share sheet, and warns that Travel Life cannot verify recipient delivery or
remove a recipient’s saved copy.

**Rationale:** This is truthful about the operating-system handoff and keeps the
owner in control before external delivery.

### Delivery records

**OLD:** M4.5/M4.6 may progress toward validator/deployment enablement.

**NEW:** Preserve their current code and diagnostics as deferred, with the
remote media gate hard-disabled. Record the concrete re-entry decision: exact
validator endpoint, processing authorization, budget/alert, deployment
configuration and device/browser evidence.

## 5. Implementation handoff

**Scope:** Moderate. Product Owner/Developer should update `epics.md`,
`mvp-spec.md`, `docs/project-state.md`, and the M4.5 delivery record; then
remove the unneeded pending validator-adapter seam while retaining the safe
default denial. Verify focused Replay share tests, mobile typecheck/lint, and
root `npm run check`. Success is a local exact Replay share path with no hosted
media egress or hosted-link claim.
