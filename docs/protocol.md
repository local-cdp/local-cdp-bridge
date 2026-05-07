# Bridge Protocol

The bridge exposes a local WebSocket endpoint:

```text
ws://127.0.0.1:17321/session
```

The endpoint is only usable after the user has accepted the local agreement and authorized the requesting web origin.

## URL Scheme

The URL scheme has separate routes for opening the local app, starting a debug browser, and connecting a web control session.

Open the local app only:

```text
local-cdp-bridge://open
```

Start a debug browser:

```text
local-cdp-bridge://start-browser?browser=chrome
local-cdp-bridge://start-browser?browser=edge
```

Optional debug browser parameters:

```text
cdpPort=9222
profileDir={absoluteProfilePath}
startUrl=about%3Ablank
```

`profileDir` is optional. If omitted, the bridge uses a default managed profile. Debug browser launch does not require `origin`, `nonce`, or `session`.

Connect a web control session:

```text
local-cdp-bridge://connect?origin=https%3A%2F%2Fexample.com
```

Optional connect parameters:

```text
nonce=RANDOM_NONCE
session=SESSION_ID
name=Example%20Tool
returnUrl=https%3A%2F%2Fexample.com%2Fconnected
lang=zh-CN
```

`nonce` and `session` are optional. They are useful for correlating a web page connection with a scheme launch, but they are not needed just to open the bridge or start debug mode.

## Handshake

```json
{
  "type": "hello",
  "client": {
    "name": "example-tool",
    "origin": "https://example.com",
    "version": "1.0.0"
  }
}
```

Optional fields:

```json
{
  "nonce": "RANDOM_NONCE",
  "session": "SESSION_ID",
  "allowedOrigins": ["https://example.com"],
  "requestedCapabilities": ["pages.open", "dom.click", "dom.fill"]
}
```

## Command Envelope

```json
{
  "id": "cmd_001",
  "method": "pages.open",
  "params": {
    "url": "https://example.com",
    "reuse": {
      "urlIncludes": "example.com"
    }
  }
}
```

## Local Permission API

The desktop app owns user authorization. Web pages must not silently grant themselves access.

```text
GET  http://127.0.0.1:17321/permissions
POST http://127.0.0.1:17321/permissions/revoke
```

To request access, open a WebSocket session and send `hello`. If the origin is unknown, Browser Bridge opens its local UI and displays a pending authorization request. The user must approve it before commands can run.

This optional scheme route can also open Browser Bridge with a pending origin:

```text
local-cdp-bridge://connect?origin=https%3A%2F%2Fexample.com
```

Revoke body:

```json
{
  "origin": "https://example.com"
}
```

Production clients should rely on the local desktop authorization UI instead of any silent permission grant.

## MVP Methods

- `browser.status`
- `browser.launch`
- `pages.list`
- `pages.open`
- `pages.focus`
- `pages.reload`
- `pages.screenshot`
- `dom.text`
- `dom.click`
- `dom.fill`
- `dom.press`
- `dom.scroll`
- `files.upload`

Remote arbitrary JavaScript evaluation is intentionally outside the MVP.
