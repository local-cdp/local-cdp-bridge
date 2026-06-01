# Security Policy

`local-cdp-bridge` controls a local browser session and treats user consent, origin authorization, and data minimization as core security requirements.

For the detailed security model, see [docs/security.md](docs/security.md).

## Supported Versions

Security fixes are provided for the latest released version.

## Reporting a Vulnerability

Please report suspected vulnerabilities through GitHub Security Advisories for this repository. If that is not available, open a GitHub issue with a minimal description and avoid including secrets, tokens, cookies, or private browser data.

Useful reports include:

- the affected version
- the operating system and browser
- the authorization state and origin involved
- reproduction steps that avoid exposing private data

## Security Principles

- The URL scheme can launch the app, but it must not grant browser control by itself.
- Browser automation requires explicit local user consent.
- Web origins must be authorized locally before using the WebSocket API.
- Cookies, tokens, local storage, browser profile files, and full page HTML are not exposed by default.
- Website-specific publishing, scraping, messaging, payment, or account workflows must stay outside this bridge.
