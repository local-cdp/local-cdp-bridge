import http from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { launchDefaultBrowser } from '../browser/launcher.js';
import { CdpBrowser } from '../cdp/browser.js';
import type {
  BridgeCommand,
  BridgeFailure,
  BridgeHello,
  BridgeResponse,
  BrowserEnsureReadyParams,
  BrowserEnsureReadyResult,
  BrowserLaunchOptions,
  BrowserName
} from '../protocol/types.js';
import { hasCurrentConsent } from '../security/consent.js';
import { getPermission } from '../security/permissions.js';
import { assertAllowedUrl, assertCapability, type SessionPolicy } from '../security/policy.js';

const BRIDGE_VERSION = '0.1.6';

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
  onLaunchDefaultBrowser?: (
    options?: Omit<BrowserLaunchOptions, 'browser'>
  ) => Promise<{ browser: BrowserName; cdpUrl: string; pid?: number }>;
}

export function attachSessionServer(options: SessionServerOptions): WebSocketServer {
  const wss = new WebSocketServer({ server: options.server, path: '/session' });
  const cdp = new CdpBrowser();
  let connectPromise: Promise<void> | null = null;

  async function ensureCdp(): Promise<CdpBrowser> {
    if (cdp.isConnected()) {
      await cdp.ensureUsable();
      return cdp;
    }
    if (!options.cdpUrl) throw new Error('CDP URL is not configured.');
    connectPromise ??= cdp.connect(options.cdpUrl);
    try {
      await connectPromise;
    } catch (error) {
      connectPromise = null;
      throw error;
    }
    return cdp;
  }

  async function ensureReady(params: BrowserEnsureReadyParams = {}): Promise<BrowserEnsureReadyResult> {
    try {
      const browser = await ensureCdp();
      return { ...(await browser.browserStatus()), launched: false, cdpUrl: options.cdpUrl };
    } catch {
      const launched = await (options.onLaunchDefaultBrowser ?? launchDefaultBrowser)(params);
      connectPromise = cdp.connect(launched.cdpUrl);
      try {
        await connectPromise;
      } catch (error) {
        connectPromise = null;
        throw error;
      }
      return {
        ...(await cdp.browserStatus()),
        launched: true,
        browser: launched.browser,
        cdpUrl: launched.cdpUrl,
        pid: launched.pid
      };
    }
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
            bridgeVersion: BRIDGE_VERSION,
            capabilities: [
              'browser.status',
              'browser.launchDefault',
              'browser.ensureReady',
              'browser.close',
              'pages.list',
              'pages.open',
              'pages.focus',
              'pages.focusByUrl',
              'pages.reload',
              'pages.screenshot',
              'dom.text',
              'dom.attribute',
              'dom.list',
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
              'dom.scrollState',
              'network.fetch',
              'network.waitResponse',
              'files.upload',
              'files.uploadData'
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

        const result = await dispatch({
          cdp: message.method === 'browser.launchDefault' || message.method === 'browser.ensureReady' ? null : await ensureCdp(),
          command: message,
          policy,
          launchDefault: options.onLaunchDefaultBrowser ?? launchDefaultBrowser,
          ensureReady
        });
        send(socket, { id: message.id, ok: true, result } satisfies BridgeResponse);
      } catch (error) {
        const id = safeCommandId(raw);
        send(socket, failure(id, 'COMMAND_FAILED', error instanceof Error ? error.message : String(error)));
      }
    });
  });

  return wss;
}

async function dispatch(input: {
  cdp: CdpBrowser | null;
  command: BridgeCommand;
  policy: SessionPolicy;
  launchDefault: (options?: Omit<BrowserLaunchOptions, 'browser'>) => Promise<{ browser: BrowserName; cdpUrl: string; pid?: number }>;
  ensureReady: (params?: BrowserEnsureReadyParams) => Promise<BrowserEnsureReadyResult>;
}): Promise<unknown> {
  const { cdp, command, policy, launchDefault, ensureReady } = input;
  assertCapability(command.method, policy);
  switch (command.method) {
    case 'browser.launchDefault':
      return launchDefault(command.params as never);
    case 'browser.ensureReady':
      return ensureReady(command.params as never);
    case 'browser.close':
      return requireCdp(cdp).closeBrowser();
    case 'browser.status':
    case 'pages.list':
      return requireCdp(cdp).browserStatus();
    case 'pages.open': {
      const params = command.params as { url: string };
      assertAllowedUrl(params.url, policy);
      return requireCdp(cdp).openPage(command.params as never);
    }
    case 'pages.focus':
      return requireCdp(cdp).focusPage(command.params as never);
    case 'pages.focusByUrl':
      return requireCdp(cdp).focusPageByUrl(command.params as never);
    case 'pages.reload':
      return requireCdp(cdp).reloadPage(command.params as never);
    case 'pages.screenshot':
      return requireCdp(cdp).screenshot(command.params as never);
    case 'dom.text':
      return requireCdp(cdp).text(command.params as never);
    case 'dom.attribute':
      return requireCdp(cdp).attribute(command.params as never);
    case 'dom.list':
      return requireCdp(cdp).list(command.params as never);
    case 'dom.waitText':
      return requireCdp(cdp).waitText(command.params as never);
    case 'dom.waitSelector':
      return requireCdp(cdp).waitSelector(command.params as never);
    case 'dom.click':
      return requireCdp(cdp).click(command.params as never);
    case 'dom.clickText':
      return requireCdp(cdp).clickText(command.params as never);
    case 'dom.clickSelectorText':
      return requireCdp(cdp).clickSelectorText(command.params as never);
    case 'dom.scrollIntoView':
      return requireCdp(cdp).scrollIntoView(command.params as never);
    case 'dom.hover':
      return requireCdp(cdp).hover(command.params as never);
    case 'dom.fill':
      return requireCdp(cdp).fill(command.params as never);
    case 'dom.press':
      return requireCdp(cdp).press(command.params as never);
    case 'dom.scroll':
      return requireCdp(cdp).scroll(command.params as never);
    case 'dom.scrollState':
      return requireCdp(cdp).scrollState(command.params as never);
    case 'network.fetch': {
      const params = command.params as { url: string };
      assertAllowedUrl(params.url, policy);
      return requireCdp(cdp).fetch(command.params as never);
    }
    case 'network.waitResponse':
      return requireCdp(cdp).waitResponse(command.params as never);
    case 'files.upload':
      return requireCdp(cdp).uploadFiles(command.params as never);
    case 'files.uploadData':
      return requireCdp(cdp).uploadFileData(command.params as never);
    default:
      throw new Error(`Unsupported method: ${command.method}`);
  }
}

function requireCdp(cdp: CdpBrowser | null): CdpBrowser {
  if (!cdp) throw new Error('CDP browser is not connected.');
  return cdp;
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
