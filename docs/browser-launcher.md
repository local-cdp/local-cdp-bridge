# Browser Launcher

The bridge can launch a local debugging browser for non-technical users.

Supported browsers:

- Google Chrome
- Microsoft Edge

Default CDP port:

```text
9222
```

Fallback range:

```text
9223-9230
```

Launch arguments:

```text
--remote-debugging-port={port}
--user-data-dir={bridgeManagedProfile}
--no-first-run
--no-default-browser-check
--new-window {startUrl}
```

## Launch Parameters

Required:

- `browser`: `chrome` or `edge`

Optional:

- `cdpPort`: defaults to `9222`
- `profileDir`: defaults to the bridge-managed profile directory
- `startUrl`: defaults to `about:blank`

`profileDir` is optional. If the caller does not choose one, the bridge uses a default managed profile:

Windows:

```text
%APPDATA%\local-cdp-bridge\browser-profiles\chrome
%APPDATA%\local-cdp-bridge\browser-profiles\edge
```

macOS:

```text
~/Library/Application Support/local-cdp-bridge/browser-profiles/chrome
~/Library/Application Support/local-cdp-bridge/browser-profiles/edge
```

Launching debug mode does not require `origin`, `nonce`, or `session`, because it does not grant a web page permission to control the browser.

If auto-detection fails, the desktop app should let the user choose the browser executable manually.
