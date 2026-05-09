import http from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { CdpBrowser } from '../cdp/browser.js';
import type { BridgeCommand, BridgeFailure, BridgeHello, BridgeResponse } from '../protocol/types.js';
import { hasCurrentConsent } from '../security/consent.js';
import { getPermission } from '../security/permissions.js';
import { assertAllowedUrl, assertCapability, type SessionPolicy } from '../security/policy.js';

export interface SessionServerOptions {
  server: http.Server;
  cdpUrl?: string;
  requireConsent?: boolean;
  requireAuthorization?: boolean;
  onAuthorizationRequest?: (request: {
    origin: string;
    displayName?: string;
    allowedOrigins: string[];
    capabilities?: BridgeHello['requestedCapabilities'];
  }) => void | Promise<void>;
}

export function attachSessionServer(options: SessionServerOptions): WebSocketServer {
  const wss = new WebSocketServer({ server: options.server, path: '/session' });
  const cdp = new CdpBrowser();
  let connectPromise: Promise<void> | null = null;

  async function ensureCdp(): Promise<CdpBrowser> {
    if (!options.cdpUrl) throw new Error('CDP URL is not configured.');
    if (!cdp.isConnected()) connectPromise ??= cdp.connect(options.cdpUrl);
    await connectPromise;
    return cdp;
  }

  wss.on('connection', (socket, request) => {
    let policy: SessionPolicy | null = null;

    socket.on('message', async (raw) => {
      try {
        const message = JSON.parse(String(raw)) as BridgeHello | BridgeCommand;
        if ('type' in message && message.type === 'hello') {
          if (options.requireConsent !== false && !(await hasCurrentConsent())) {
            send(socket, failure('hello', 'CONSENT_REQUIRED', 'The local user agreement must be accepted first.'));
            return;
          }
          const origin = request.headers.origin ?? message.client.origin;
          if (origin !== message.client.origin) {
            send(socket, failure('hello', 'ORIGIN_MISMATCH', 'WebSocket origin does not match hello origin.'));
            return;
          }
          const permission = await getPermission(message.client.origin);
          if (!permission && options.requireAuthorization !== false) {
            await options.onAuthorizationRequest?.({
              origin: message.client.origin,
              displayName: message.client.displayName || message.client.name,
              allowedOrigins: message.allowedOrigins?.length ? message.allowedOrigins : [message.client.origin],
              capabilities: message.requestedCapabilities
            });
            send(socket, failure('hello', 'AUTHORIZATION_REQUIRED', 'Authorize this web origin in Browser Bridge.'));
            return;
          }
          policy = {
            clientOrigin: message.client.origin,
            allowedOrigins: message.allowedOrigins?.length
              ? message.allowedOrigins
              : permission?.allowedOrigins ?? [message.client.origin],
            capabilities: message.requestedCapabilities?.length
              ? message.requestedCapabilities
              : permission?.capabilities
          };
          send(socket, {
            type: 'ready',
            bridgeVersion: '0.1.0',
            capabilities: [
              'browser.status',
              'pages.list',
              'pages.open',
              'pages.focus',
              'pages.reload',
              'pages.screenshot',
              'dom.text',
              'dom.waitText',
              'dom.waitSelector',
              'dom.click',
              'dom.clickText',
              'dom.clickSelectorText',
              'dom.scrollIntoView',
              'dom.hover',
              'dom.fill',
              'dom.press',
              'dom.scroll',
              'files.upload'
            ]
          });
          return;
        }

        if (!isCommand(message)) {
          send(socket, failure('unknown', 'INVALID_MESSAGE', 'Expected a command message.'));
          return;
        }

        if (!policy) {
          send(socket, failure(message.id, 'SESSION_NOT_READY', 'Send hello before commands.'));
          return;
        }

        const result = await dispatch(await ensureCdp(), message, policy);
        send(socket, { id: message.id, ok: true, result } satisfies BridgeResponse);
      } catch (error) {
        const id = safeCommandId(raw);
        send(socket, failure(id, 'COMMAND_FAILED', error instanceof Error ? error.message : String(error)));
      }
    });
  });

  return wss;
}

async function dispatch(cdp: CdpBrowser, command: BridgeCommand, policy: SessionPolicy): Promise<unknown> {
  assertCapability(command.method, policy);
  switch (command.method) {
    case 'browser.status':
    case 'pages.list':
      return cdp.browserStatus();
    case 'pages.open': {
      const params = command.params as { url: string };
      assertAllowedUrl(params.url, policy);
      return cdp.openPage(command.params as never);
    }
    case 'pages.focus':
      return cdp.focusPage(command.params as never);
    case 'pages.reload':
      return cdp.reloadPage(command.params as never);
    case 'pages.screenshot':
      return cdp.screenshot(command.params as never);
    case 'dom.text':
      return cdp.text(command.params as never);
    case 'dom.waitText':
      return cdp.waitText(command.params as never);
    case 'dom.waitSelector':
      return cdp.waitSelector(command.params as never);
    case 'dom.click':
      return cdp.click(command.params as never);
    case 'dom.clickText':
      return cdp.clickText(command.params as never);
    case 'dom.clickSelectorText':
      return cdp.clickSelectorText(command.params as never);
    case 'dom.scrollIntoView':
      return cdp.scrollIntoView(command.params as never);
    case 'dom.hover':
      return cdp.hover(command.params as never);
    case 'dom.fill':
      return cdp.fill(command.params as never);
    case 'dom.press':
      return cdp.press(command.params as never);
    case 'dom.scroll':
      return cdp.scroll(command.params as never);
    case 'files.upload':
      return cdp.uploadFiles(command.params as never);
    default:
      throw new Error(`Unsupported method: ${command.method}`);
  }
}

function send(socket: WebSocket, payload: unknown): void {
  socket.send(JSON.stringify(payload));
}

function failure(id: string, code: string, message: string): BridgeFailure {
  return { id, ok: false, error: { code, message, recoverable: true } };
}

function safeCommandId(raw: unknown): string {
  try {
    const parsed = JSON.parse(String(raw)) as { id?: string };
    return parsed.id ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function isCommand(message: BridgeHello | BridgeCommand): message is BridgeCommand {
  return 'id' in message && 'method' in message;
}
