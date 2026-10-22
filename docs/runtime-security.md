# Runtime security status — 2026-10-22

This source release does not include a desktop installer. The already installed private development app is outside this public-source staging directory and was not modified.

## Verified upstream information

- [Node.js 2026-10-21 security advisory](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases): patched releases include 22.23.4, 24.22.1 and 26.12.1. The official [release index](https://nodejs.org/dist/index.json) identifies 24.22.1 as the newest LTS patch at the time of this check.
- Build/desktop-logic validation uses the official **Node 24.22.1 arm64** distribution; its archive was checked against official SHA-256 sums. The unrelated host default Node 26.3.0 was identified as outdated and was not used for these builds. Other projects' global runtime was not changed.
- [Electron release metadata](https://releases.electronjs.org/releases.json): the latest stable 45.0.0 and maintained 44.x patch 44.9.3 both report embedded Node **24.22.0**. The source is pinned to 44.9.3 to avoid an unrelated major API migration.
- We do not infer that every Node vulnerability is reachable through this PDF app. However, the strict release policy requires verified patched runtime coverage; we lack evidence of the needed fixes in those Electron builds.

## Gate behavior

`npm start` and `npm run package` first query official Electron release metadata and reject an unverified or below-baseline embedded Node version. No affected desktop runtime was launched during this release check. A network error also prevents this verification.

Frontend build, Python engine tests and Node-only batch-conversion tests remain available. Previous UI screenshots demonstrate the private 0.1.13 implementation; they are not evidence that the new Electron pin passed a fresh UI regression.

## Unblocking a desktop release

1. Check official Node and Electron advisories again, not only this dated minimum table.
2. Choose a supported Electron stable patch that includes the fixes. Update `devDependencies.electron` and the lockfile together; the packager uses the same pin.
3. Run the metadata gate, then inspect actual `process.versions` in the installed runtime and the packaged app.
4. Run engine, desktop logic, Chinese/English UI, save/reopen and package portability regressions.
5. Complete transitive license notices, signing/notarization decisions and source-offer checks before adding binary downloads.

The version gate records a dated floor, not a claim that later versions have no unknown vulnerabilities. No Docker image, cloud application server or PHP runtime is part of this source release. The project website is static HTML/CSS and uses no Node service in production.
