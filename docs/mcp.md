# MCP Interface

`local-cdp-bridge` includes a local MCP stdio server for AI/agent tools that run on the user's machine.

The MCP interface is generic infrastructure. It does not include website-specific publishing, scraping, messaging, payment, or account workflows.

## Start

```bash
local-cdp-bridge-mcp --cdp-url http://127.0.0.1:9222
```

For local development tests only:

```bash
local-cdp-bridge-mcp --cdp-url http://127.0.0.1:9222 --no-consent-check
```

Restrict page opening to known origins:

```bash
local-cdp-bridge-mcp \
  --cdp-url http://127.0.0.1:9222 \
  --allowed-origin https://example.com
```

If no `--allowed-origin` is provided, origin restrictions are left to the MCP client and local user policy.

## Tools

- `browser_status`
- `pages_open`
- `pages_screenshot`
- `dom_text`
- `dom_click`
- `dom_fill`
- `files_upload`

Risky clicks are blocked by default when the visible text looks like a publish, submit, delete, pay, or send action.

## Notes

- The MCP server communicates over stdio using JSON-RPC messages.
- The user agreement is required by default.
- Cookies, tokens, local storage, and full page HTML are not exposed by default.
