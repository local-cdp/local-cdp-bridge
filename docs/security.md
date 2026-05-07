# Security Model

`local-cdp-bridge` runs on the user's machine and controls a local browser only after explicit local consent.

## Consent Gate

Before consent is accepted, the bridge must not:

- connect to browser CDP
- open web pages
- click, type, upload, download, or screenshot
- read page text
- accept a remote automation session

Allowed before consent:

- show the local agreement
- choose language
- open app settings
- quit the app

## Origin Authorization

The URL scheme launches the app but does not grant control. A web origin must be approved locally before using the WebSocket API.

Origin grants are stored locally in:

```text
permissions.json
```

Each grant contains:

- the requesting web origin
- target origins it may open or control
- capabilities it may use
- timestamps for audit and revocation

## Data Minimization

The bridge must not expose cookies, tokens, local storage, browser profile files, or full page HTML by default.

## Risk Confirmation

Actions that may publish, submit, delete, pay, send, or otherwise commit user-visible changes should require local confirmation.

## Browser Profiles

The bridge launches Chrome or Edge with a bridge-managed profile directory.
