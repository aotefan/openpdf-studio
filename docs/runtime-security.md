# Runtime security review — 2026-11-10

## 0.2.2 distribution review

Rechecked the official Node release index and Electron metadata on 2026-11-10. Node 26.13.0 remains the latest stable LTS, and Electron 45.2.3 embeds Node 24.22.2. Actual host and bundled Mac executables passed the version gate. The announced November 11 Node fixes are still pending; future distributions must recheck them.

The pre-distribution Python audit found known advisories affecting Pillow 12.3.0, pypdf 6.20.1 and setuptools 84.0.0. Version 0.2.2 pins **Pillow 13.0.0**, **pypdf 7.0.0** and **setuptools 84.2.1**, verified against current PyPI metadata and upstream release notes ([Pillow](https://pillow.readthedocs.io/en/stable/releasenotes/13.0.0.html), [pypdf](https://pypdf.readthedocs.io/en/stable/meta/CHANGELOG.html)). pypdf is used for independent test readback. `pip-audit --no-deps --disable-pip` found no known advisories in either the updated Windows lockfile or the actual local Python environment; full `npm audit` also reported zero vulnerabilities. These are dated database results, not a guarantee against unknown issues.

The Mac application's declared minimum and OCR deployment target are macOS 14. Every bundled Mach-O target is inspected; a native dependency requiring a newer system fails packaging. DMG files are verified before publication. This preview is ad-hoc signed, without Developer ID signing/notarization; the Windows portable executable is unsigned.

The [0.2.2 Windows native run](https://github.com/aotefan/openpdf-studio/actions/runs/42785432954) completed 109 engine, 16 desktop and 30 UI tests plus packaged-app readback. The Mac DMG was mounted read-only and its relocated app passed save/reopen, offline OCR and 600 DPI export checks. Both packages use the updated dependency pins.

## Prior 0.2.0/0.2.1 review (2026-11-09)


- Build runtime: **Node 26.13.0 LTS**, verified against the [official release index](https://nodejs.org/dist/index.json) and [release notes](https://nodejs.org/en/blog/release/v26.13.0). The local arm64 archive was SHA-256 checked against official SHASUMS; the actual binary reports 26.13.0. `.nvmrc` and Windows CI select this version. The unrelated host default remains 26.12.1 and was not used for the current build.
- Desktop runtime: **Electron 45.2.3**, the [official stable release](https://releases.electronjs.org/release/v45.2.3), with embedded **Node 24.22.2** and Chromium **156.0.8078.80**. Both official metadata and the installed executable were checked. This replaces the previously blocked 44.9.3 pin.
- `check-runtime.cjs --electron --installed` checks the host Node, queries official metadata, checks the installed Electron pin and runs that executable to inspect its real `process.versions`. `npm start`, UI tests and packaging use this gate. Packaged smoke tests check the shipped executable again.
- `glob` and `minimatch` overrides select patched versions for the packaging dependency tree; `undici` was patched through the lockfile. `npm audit` reports zero known vulnerabilities at this review. The build and packaging tests validate the updated tooling.
- The [November 11 Node security release announcement](https://nodejs.org/en/blog/vulnerability/november-2026-security-releases) is already published; those fixes are not yet available as of this review. Recheck official advisories and update the gate, `.nvmrc`, Electron pin and lockfile before distributing a later build. The dated gate cannot certify fixes that have not shipped.

The supported build lines are 24 (minimum reviewed 24.22.2) and 26 (minimum reviewed 26.13.0). The check is a dated release baseline, not an assurance against unknown vulnerabilities. Metadata/network failures block source launch and packaging verification. The packaged application itself does not need an internet connection or perform update checks.

This project has no PHP runtime, container base image or deployed Node service. [Native Windows CI](https://github.com/aotefan/openpdf-studio/actions/runs/42645629472) verified build Node 26.13.0 and the installed and packaged Electron 45.2.3 / Node 24.22.2 executables on Windows Server 2025. The Windows worker was built with uv-managed CPython 3.12.14 x64, also recorded in its `build-info.json`. Current Windows build/verification instructions are in [windows.md](windows.md).
