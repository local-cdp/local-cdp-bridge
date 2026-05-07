# Release Signing

Installers are published from GitHub Releases after a `vX.Y.Z` tag.

## Windows

Public Windows builds should be code signed before distribution.

Recommended GitHub Actions secrets:

- `WINDOWS_CERTIFICATE_BASE64`
- `WINDOWS_CERTIFICATE_PASSWORD`

Unsigned builds may be used for local development only and should be clearly labeled.

## macOS

Public macOS builds should be signed and notarized.

Recommended GitHub Actions secrets:

- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`
- `MACOS_CERTIFICATE_BASE64`
- `MACOS_CERTIFICATE_PASSWORD`

Unsigned or unnotarized builds may trigger Gatekeeper warnings.
