# Security policy

OpenPDF Studio is an early source preview. Do not attach private PDFs or secrets to public issues. Use GitHub's private vulnerability reporting for sensitive reports when available; otherwise open an issue containing only a request for a private contact channel.

Maintained development line: current source branch. No binary security support or notarization is claimed for this preview. Runtime release status is tracked in [docs/runtime-security.md](docs/runtime-security.md).

Reports should include the affected commit, environment, minimal synthetic reproducer and observed impact. PDF processing executes complex native parsers; local-only processing is not a claim of malware resistance. Signed, encrypted and modification-restricted PDFs are rejected by the present engine.

Before each release, review Node, Electron, PyMuPDF and other dependency security advisories, inspect actual build/runtime versions, and run relevant regression tests. Static minimum version numbers do not replace future security review.
