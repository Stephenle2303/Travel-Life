# Android startup incident trace, 2026-10-23

This is a read-only runtime/source investigation plus correction of incident records. No builds, launches, dependency changes, or device mutations were performed during this audit. Times below use UTC+07:00.

## Verified sequence

1. Metro's append-only `.expo/dev/logs/start.log` records application diagnostics at 14:35:51, then rejects `src/components/atlas-reveal.tsx` at 14:50:57 and 14:51:05 because line one contains `<<<<<<< HEAD`. This is a concrete source compilation blocker. The log does not identify the writer or Git operation that introduced it. Current source has no diff for that file against HEAD; Git does not preserve transient uncommitted authorship.
2. Replay commit `7820f5d` at 14:50:33 added the FFmpeg/Nitro native integration, Replay source, provider/repository changes, and dependencies. Its timing alone does not establish that it wrote the conflict marker. FFmpeg/native integration increases the native build surface; its contribution to heap usage is not measured.
3. Worktree retirement commit `c1e8a2d` at 15:02 leaves the primary checkout as the only active checkout. The retirement report explicitly leaves loaded-JavaScript identity unverified. A clean checkout or matching APK hash was not proof that the phone executed that source.
4. Dependency commit `7d3f442` at 15:15 updates Expo 57.0.27 to 57.0.31, Router 57.0.25 to 57.0.29, Dev Client 57.0.19 to 57.0.20 and other patches. It is later than the first source failure, so cannot explain that first failure. Compatibility with the previously installed native client remains a separate unproven hypothesis.
5. Later isolated host Android bundle requests completed at 16:56:08 and 17:00:39. These prove compilation at those times, not device execution.
6. Recovery's tracked all-ABI Gradle build failed in `:app:packageDebug` with Java heap exhaustion after 4m05s. Arm64-only install succeeded after 1m13s. This identifies a build packaging failure, not the original white-screen cause.
7. Recovery added localhost Metro 8083, a proxy at IPv4 8084 forwarding to IPv6 8083, and USB reverse mappings. The inspected Expo manifest advertised its launch asset at device port 8083. A later arm64 APK was rebuilt with React Native resource defaults `127.0.0.1:8084`; APK resource inspection confirmed those values. The rebuild succeeded after 1m08s and replaced the same installed package.
8. Recovery removed its 8083/8084 servers and reverse mappings, then force-stopped the app. It did not reinstall the previous binary or restore the new binary's required endpoint. Closing the loading activity does not repair launchability. The earlier assertion that continued 8083 loading was proven to be a cached manifest is unsupported; that URL was also explicitly advertised by the live manifest during recovery.

## Isolation failure

Separate ports did not isolate the source tree, node_modules, Expo/Metro cache, Gradle outputs, package identity, or physical phone. The recovery reused all of them. The native reinstall replaced the shared device package despite preserving its data. Preserving another session's source edits and port 8081 alone did not preserve that session's runnable device environment.

The repository also records a prior live-reload isolation lesson: stop the connected app before schema-changing edits. The single-primary-checkout policy does not authorize concurrent sessions to mutate shared runtime resources without ownership and a restoration plan.

## What remains unknown

- Which tool/session introduced and removed the transient conflict marker.
- The initiating cause of the post-conflict device-loading failure.
- Whether dependency/native-client version drift contributed after 15:15.
- Whether the last launcher stall reflects bundle transport, request handling, or another lifecycle failure. Missing Metro completion output alone is insufficient to prove absence of a request.

## Recovery acceptance boundary

Use one designated source snapshot, one owned server and one matching manifest/bundle route for the shared phone. Record the prior binary/endpoint and restoration path before replacing it. Verify an Android manifest launch asset returns complete bytes, then correlate a fresh device process and visible Travel Life screen. Do not perform another port-specific rebuild based solely on generic error text mentioning port 8081. Keep the initial source failure, later build OOM, and recovery-induced endpoint changes as distinct incidents.
