# Web API

This document is the integration contract for web applications that use Browser Bridge.

Browser Bridge is a local infrastructure app. Business workflows should live in the calling web application, not in this repository.

## Endpoints

Default local base URL:

```text
http://127.0.0.1:17321
```

WebSocket session endpoint:

```text
ws://127.0.0.1:17321/session
```

## Scheme Launch

Open the desktop app:

```text
local-cdp-bridge://open
```

Start Chrome debug mode:

```text
local-cdp-bridge://start-browser?browser=chrome
```

Start Edge debug mode:

```text
local-cdp-bridge://start-browser?browser=edge
```

Optional browser launch query parameters:

| Parameter | Required | Example | Notes |
| --- | --- | --- | --- |
| `browser` | yes | `chrome` | `chrome` or `edge`. |
| `startUrl` | no | `https%3A%2F%2Fexample.com` | If omitted, the browser opens `about:blank`. |
| `profileDir` | no | `D%3A%5CBridgeProfile` | If omitted, Browser Bridge uses a managed default profile. |
| `cdpPort` | no | `9222` | Defaults to `9222`. |

`nonce` and `session` are not required for launching browser debug mode. They are optional correlation fields for applications that want to match a scheme launch with a later WebSocket session.

## HTTP

### Health

```text
GET /health
```

Response:

```json
{
  "ok": true,
  "name": "local-cdp-bridge"
}
```

### Origin Authorization

Web applications must not silently authorize themselves and do not need a separate authorization API. A web page should open the WebSocket session and send `hello`.

If Browser Bridge has not authorized the origin yet, the `hello` response is:

```json
{
  "id": "hello",
  "ok": false,
  "error": {
    "code": "AUTHORIZATION_REQUIRED",
    "message": "Authorize this web origin in Browser Bridge.",
    "recoverable": true
  }
}
```

At the same time, Browser Bridge opens its local desktop UI and shows a pending authorization card. The user must click Allow in Browser Bridge before commands can run. After approval, the web page should reconnect and send `hello` again.

The optional scheme route below can also open Browser Bridge with a pending origin, but normal WebSocket `hello` is enough:

```text
local-cdp-bridge://connect?origin=https%3A%2F%2Fexample.com
```

## WebSocket Handshake

Send this message first:

```json
{
  "type": "hello",
  "client": {
    "name": "example-webapp",
    "origin": "https://example.com",
    "version": "1.0.0"
  },
  "allowedOrigins": ["https://example.com"],
  "requestedCapabilities": ["pages.open", "dom.click"]
}
```

Successful response:

```json
{
  "type": "ready",
  "bridgeVersion": "0.1.0",
  "capabilities": ["pages.open", "dom.click"]
}
```

## Command Envelope

Request:

```json
{
  "id": "cmd_1",
  "method": "dom.click",
  "params": {
    "pageId": "page_1",
    "selector": "button[type=submit]",
    "timeoutMs": 1500
  }
}
```

Success:

```json
{
  "id": "cmd_1",
  "ok": true,
  "result": {
    "clicked": true
  }
}
```

Failure:

```json
{
  "id": "cmd_1",
  "ok": false,
  "error": {
    "code": "COMMAND_FAILED",
    "message": "locator.waitFor: Timeout 1500ms exceeded.",
    "recoverable": true
  }
}
```

## Methods

### `pages.open`

```json
{
  "url": "https://example.com/editor",
  "reuse": {
    "urlIncludes": "example.com"
  }
}
```

Returns:

```json
{
  "pageId": "page_1",
  "url": "https://example.com/editor"
}
```

### `dom.click`

```json
{
  "pageId": "page_1",
  "selector": "text=Continue",
  "timeoutMs": 1500
}
```

`timeoutMs` controls selector lookup and click fallback attempts. Missing selectors should use short timeouts when the caller is probing multiple candidates.

### `dom.fill`

```json
{
  "pageId": "page_1",
  "selector": "input[name=title]",
  "text": "Hello",
  "timeoutMs": 3000
}
```

### `files.upload`

```json
{
  "pageId": "page_1",
  "selector": "input[type=file]",
  "files": ["D:/path/image-01.png"],
  "timeoutMs": 10000
}
```

File paths are local user-machine paths.

## Logging Guidance

Web applications should distinguish user-visible logs from debug logs.

- Show successful milestones to users.
- Hide selector fallback failures by default.
- Show a warning only after all fallback selectors for one step have failed.
- Keep raw Bridge responses in a debug panel or downloadable log.

Recommended fallback timeout values:

| Scenario | Suggested `timeoutMs` |
| --- | ---: |
| Probing optional UI selectors | `800-1500` |
| Required visible controls | `3000-5000` |
| File inputs and upload controls | `10000` |
| Page navigation | command-specific |
