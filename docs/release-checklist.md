# Release Checklist

Use this checklist before publishing a GitHub Release.

## Repository

- Default branch is `main`.
- `README.md`, `LICENSE`, `NOTICE`, and security documentation are present.
- No business automation code is included in this repository.
- Version in `package.json` matches the release tag.

## Local Validation

- `npm run typecheck`
- `npm run build`
- `npm run test:e2e`
- `npm run test:mcp`

## Windows Installer

- Installer artifact is generated under `release/`.
- Installed app name is `Browser Bridge`.
- Desktop app opens without a console window.
- Window icon, taskbar icon, and tray icon are consistent.
- Closing the window keeps the tray app alive.
- Opening the app again does not start a second HTTP server or show a port-in-use error.
- `local-cdp-bridge://open` opens the app.
- `local-cdp-bridge://start-browser?browser=chrome` starts Chrome debug mode.
- `local-cdp-bridge://start-browser?browser=edge` starts Edge debug mode when Edge is installed.
- Chrome and Edge custom path settings are saved and can be cleared.
- Language defaults to the system language and can be changed in Advanced settings.

## Web Integration

- `GET http://127.0.0.1:17321/health` returns `ok: true`.
- A web page can complete the WebSocket `hello` handshake after user authorization.
- `pages.open`, `dom.click`, `dom.fill`, and `files.upload` work from the web demo.
- Missing optional selectors fail within the caller-provided `timeoutMs`, not Playwright's default 30 seconds.
- User-visible logs show milestone status; raw selector fallback failures are kept in debug logs.

## GitHub Release

- Tag format is `vX.Y.Z`.
- Windows x64 installer is attached.
- macOS artifact is attached when available.
- Checksums are attached.
- Unsigned builds are clearly labeled as development builds.
