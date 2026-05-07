# Desktop App

The desktop app is the primary product shape for non-technical users.

## Required UI

- User agreement screen
- Browser selection: Chrome or Edge
- Launch browser button
- Connection status
- Authorized web origins
- Grant/revoke origin controls
- Current task status
- Stop current session
- Export logs

## URL Scheme

The app registers:

```text
local-cdp-bridge://
```

Common routes:

```text
local-cdp-bridge://open
local-cdp-bridge://start-browser?browser=chrome
local-cdp-bridge://start-browser?browser=edge
local-cdp-bridge://connect?origin=https%3A%2F%2Fexample.com
local-cdp-bridge://status
```

The scheme only launches the app. It never grants control by itself.

## Packaging

Windows:

- `.exe` or `.msi`
- Windows 10 and Windows 11
- x64 first, arm64 later

macOS:

- `.dmg`
- macOS 12+
- universal build preferred
- signed and notarized for distribution

## Release Distribution

The GitHub repository should use `main` as the default branch.

Installers are distributed from GitHub Releases, not committed to the repository.

Recommended release trigger:

```text
vX.Y.Z tag
```

Recommended GitHub Release artifacts:

```text
local-cdp-bridge-vX.Y.Z-windows-x64.exe
local-cdp-bridge-vX.Y.Z-windows-x64.msi
local-cdp-bridge-vX.Y.Z-macos-universal.dmg
local-cdp-bridge-vX.Y.Z-checksums.txt
```

Signing and notarization:

- Windows code signing should be added before public distribution.
- macOS builds should be signed and notarized before public distribution.
- Unsigned development builds should be clearly labeled as development-only.
