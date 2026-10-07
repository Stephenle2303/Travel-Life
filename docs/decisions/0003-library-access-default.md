# Decision 0003: Broad photo-library access by default

Date: 2026-10-07 (Asia/Bangkok).
Status: accepted from the user's explicit direction.

## Context and options

The user considered a web app with local/mobile storage access, then clarified
that selecting many photos should not be the normal import experience. Selected
photos should remain available for users who do not want to grant broad access.

The options were selection-first import or permission-based library import with
selection as an alternative. The user chose the latter experience.

## Decision

- Make permission-based broad photo-library access the primary import path.
  After permission is granted, enumerate accessible assets without requiring
  the user to select individual photos.
- Offer limited/selected-photo import as an optional path for users who decline
  broad access. Respect denial, revocation and the scope actually granted;
  do not repeatedly pressure the user to expand access.
- Show that reconstruction covers the accessible evidence only. Broad permission
  does not establish complete lifetime coverage or availability of every original.
- Keep photo access separate from cloud AI consent. Library permission alone
  does not authorize sending photos or private evidence to a model provider.
- Retain the existing Expo / React Native iOS and Android implementation default.
  This discussion did not select a browser-only app or a different framework.

## Consequences and verification

Update M1.2 to make the primary and alternative paths explicit. Verify both
paths, metadata availability, denial and revocation on each platform during
delivery. Current planning already requires foreground import/rescan; this
decision does not introduce background scanning.

If platform capability or distribution rules prevent broad access, record that
limitation and provide the supported selection flow with honest reduced coverage.
Reconsider the import approach if device/distribution checks reveal such a blocker
or the user later changes the desired experience. No device checks were performed
as part of this decision.
