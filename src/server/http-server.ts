import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { attachSessionServer } from './session-server.js';
import { listPermissions, revokePermission } from '../security/permissions.js';
import type { BridgeMethod } from '../protocol/types.js';

export interface BridgeHttpServer {
  port: number;
  close(): Promise<void>;
}

export interface StartHttpServerOptions {
  port?: number;
  cdpUrl?: string;
  requireConsent?: boolean;
  requireAuthorization?: boolean;
  onAuthorizationRequest?: (request: {
    origin: string;
    displayName?: string;
    allowedOrigins: string[];
    capabilities?: BridgeMethod[];
  }) => void | Promise<void>;
}

export async function startHttpServer(options: StartHttpServerOptions | number = 17321): Promise<BridgeHttpServer> {
  const port = typeof options === 'number' ? options : options.port ?? 17321;
  const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders());
      res.end();
      return;
    }

    if (req.url === '/health') {
      res.writeHead(200, {
        'content-type': 'application/json',
        ...corsHeaders()
      });
      res.end(JSON.stringify({ ok: true, name: 'local-cdp-bridge' }));
      return;
    }

    if (req.url === '/permissions' && req.method === 'GET') {
      json(res, 200, { ok: true, origins: await listPermissions() });
      return;
    }

    if (req.url === '/permissions/revoke' && req.method === 'POST') {
      const body = (await readJson(req)) as { origin?: string };
      if (!body.origin) {
        json(res, 400, { ok: false, error: 'origin_required' });
        return;
      }
      await revokePermission(body.origin);
      json(res, 200, { ok: true });
      return;
    }

    json(res, 404, { ok: false, error: 'not_found' });
  });
  const wss = attachSessionServer({
    server,
    cdpUrl: typeof options === 'number' ? undefined : options.cdpUrl,
    requireConsent: typeof options === 'number' ? undefined : options.requireConsent,
    requireAuthorization: typeof options === 'number' ? undefined : options.requireAuthorization,
    onAuthorizationRequest: typeof options === 'number' ? undefined : options.onAuthorizationRequest
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });

  return {
    port: (server.address() as AddressInfo).port,
    close: async () => {
      for (const client of wss.clients) client.terminate();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  };
}

function json(res: http.ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, {
    'content-type': 'application/json',
    ...corsHeaders()
  });
  res.end(JSON.stringify(payload));
}

function corsHeaders(): Record<string, string> {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type'
  };
}

async function readJson(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
