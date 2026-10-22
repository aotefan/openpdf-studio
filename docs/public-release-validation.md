# Public source validation — 2026-10-22

Source preview 0.1.14 originates from the independently implemented private development snapshot `83b6675d36d3c49e873edcfe3838c5d1297e60a9`. Only selected independent source, synthetic fixtures and product screenshots were exported into a fresh public repository; private research inputs, binaries, raw decompilation material, local QA queues and prior Git history were not exported.

## Checks run for this source release

|Check|Actual result|
|---|---|
|Build runtime|Official Node 24.22.1 arm64, SHA-256 verified against upstream sums; actual version inspected|
|Frontend production build|PASS, TypeScript + Vite|
|PDF engine suite|86 passed; 5 third-party SWIG deprecation warnings|
|Node batch-conversion suite|8 passed|
|Runtime policy boundary tests|2 passed|
|npm audit|0 reported vulnerabilities in installed dependency tree at check time|
|Static site structure|4 pages passed title, description, canonical, H1, JSON-LD, alt text, local links and sitemap checks|
|Website browser checks|Desktop 1440×1000 and mobile 390×844: all 4 pages loaded, no horizontal overflow, images loaded, no page errors|
|Electron release gate|Expected BLOCK: pinned 44.9.3 reports embedded Node 24.22.0, below reviewed 24.22.1 floor|
|Fresh Electron UI / packaged app regression|NOT RUN for this release because of the runtime gate|

Screenshots show the pre-existing 0.1.13 local UI tested on 2026-10-15. They are synthetic-document captures, not new runtime-validation evidence. No binary installation package is published with this source preview. These checks do not constitute a comprehensive security audit, guarantee universal PDF fidelity, or prove search indexing.
