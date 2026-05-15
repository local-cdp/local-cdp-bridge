#!/usr/bin/env node
import { CdpBrowser } from '../cdp/browser.js';
import type { BridgeCommand } from '../protocol/types.js';
import { hasCurrentConsent } from '../security/consent.js';
import { assertAllowedUrl, type SessionPolicy } from '../security/policy.js';

type JsonRpcId = string | number | null;
const BRIDGE_VERSION = '0.1.4';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method: string;
  params?: unknown;
}

const args = parseArgs(process.argv.slice(2));
debug('started');
const cdp = new CdpBrowser();
let connectPromise: Promise<void> | null = null;
const policy: SessionPolicy = {
  clientOrigin: 'mcp://local',
  allowedOrigins: args.allowedOrigin
};

const tools = [
  {
    name: 'browser_status',
    description: 'Return the current CDP connection status and known pages.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'pages_open',
    description: 'Open a URL in the connected local browser.',
    inputSchema: {
      type: 'object',
      required: ['url'],
      properties: {
        url: { type: 'string' },
        reuseUrlIncludes: { type: 'string' }
      }
    }
  },
  {
    name: 'pages_screenshot',
    description: 'Take a PNG screenshot and return it as base64 text.',
    inputSchema: {
      type: 'object',
      required: ['pageId'],
      properties: {
        pageId: { type: 'string' },
        fullPage: { type: 'boolean' }
      }
    }
  },
  {
    name: 'dom_text',
    description: 'Read visible text from a selector.',
    inputSchema: {
      type: 'object',
      required: ['pageId', 'selector'],
      properties: {
        pageId: { type: 'string' },
        selector: { type: 'string' },
        timeoutMs: { type: 'number' }
      }
    }
  },
  {
    name: 'dom_click',
    description: 'Click a selector in the connected local browser.',
    inputSchema: {
      type: 'object',
      required: ['pageId', 'selector'],
      properties: {
        pageId: { type: 'string' },
        selector: { type: 'string' },
        timeoutMs: { type: 'number' }
      }
    }
  },
  {
    name: 'dom_fill',
    description: 'Fill a text field.',
    inputSchema: {
      type: 'object',
      required: ['pageId', 'selector', 'text'],
      properties: {
        pageId: { type: 'string' },
        selector: { type: 'string' },
        text: { type: 'string' },
        timeoutMs: { type: 'number' }
      }
    }
  },
  {
    name: 'files_upload',
    description: 'Upload local files into an input[type=file].',
    inputSchema: {
      type: 'object',
      required: ['pageId', 'selector', 'files'],
      properties: {
        pageId: { type: 'string' },
        selector: { type: 'string' },
        files: { type: 'array', items: { type: 'string' } },
        timeoutMs: { type: 'number' }
      }
    }
  }
];

let inputBuffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  debug(`stdin ${chunk.length} bytes`);
  inputBuffer += chunk;
  const lines = inputBuffer.split('\n');
  inputBuffer = lines.pop() ?? '';
  for (const line of lines) void handleLine(line);
});
process.stdin.resume();

async function handleLine(line: string): Promise<void> {
  debug(`line ${line}`);
  if (!line.trim()) return;
  let request: JsonRpcRequest;
  try {
    request = JSON.parse(line) as JsonRpcRequest;
    const result = await handleRequest(request);
    if (request.id !== undefined) send({ jsonrpc: '2.0', id: request.id, result });
  } catch (error) {
    const id = typeof requestIdFromLine(line) === 'undefined' ? null : requestIdFromLine(line);
    send({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32000,
        message: error instanceof Error ? error.message : String(error)
      }
    });
  }
}

function debug(message: string): void {
  if (process.env.LOCAL_CDP_BRIDGE_MCP_DEBUG === '1') {
    process.stderr.write(`[mcp] ${message}\n`);
  }
}

async function handleRequest(request: JsonRpcRequest): Promise<unknown> {
  switch (request.method) {
    case 'initialize':
      return {
        protocolVersion: '2024-11-05',
        serverInfo: {
          name: 'local-cdp-bridge',
          version: BRIDGE_VERSION
        },
        capabilities: {
          tools: {}
        }
      };
    case 'tools/list':
      return { tools };
    case 'tools/call': {
      const params = request.params as { name: string; arguments?: Record<string, unknown> };
      const result = await callTool(params.name, params.arguments ?? {});
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    }
    case 'notifications/initialized':
      return {};
    default:
      throw new Error(`Unsupported MCP method: ${request.method}`);
  }
}

async function callTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  const browser = await ensureCdp();
  switch (name) {
    case 'browser_status':
      return browser.browserStatus();
    case 'pages_open': {
      const url = stringArg(input, 'url');
      assertAllowedUrl(url, policy);
      return browser.openPage({
        url,
        reuse: typeof input.reuseUrlIncludes === 'string' ? { urlIncludes: input.reuseUrlIncludes } : undefined
      });
    }
    case 'pages_screenshot':
      return browser.screenshot({
        pageId: stringArg(input, 'pageId'),
        fullPage: Boolean(input.fullPage)
      });
    case 'dom_text':
      return browser.text(selectorArgs(input));
    case 'dom_click':
      return browser.click(selectorArgs(input));
    case 'dom_fill':
      return browser.fill({
        ...selectorArgs(input),
        text: stringArg(input, 'text')
      });
    case 'files_upload':
      return browser.uploadFiles({
        ...selectorArgs(input),
        files: arrayArg(input, 'files')
      });
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function ensureCdp(): Promise<CdpBrowser> {
  if (args.requireConsent && !(await hasCurrentConsent())) {
    throw new Error('The local user agreement must be accepted before MCP tools can run.');
  }
  if (!args.cdpUrl) throw new Error('Missing --cdp-url for MCP server.');
  if (!cdp.isConnected()) connectPromise ??= cdp.connect(args.cdpUrl);
  await connectPromise;
  return cdp;
}

function selectorArgs(input: Record<string, unknown>) {
  return {
    pageId: stringArg(input, 'pageId'),
    selector: stringArg(input, 'selector'),
    timeoutMs: typeof input.timeoutMs === 'number' ? input.timeoutMs : undefined
  };
}

function stringArg(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== 'string' || !value) throw new Error(`Missing string argument: ${key}`);
  return value;
}

function arrayArg(input: Record<string, unknown>, key: string): string[] {
  const value = input[key];
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error(`Missing string array argument: ${key}`);
  }
  return value;
}

function send(payload: unknown): void {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function requestIdFromLine(line: string): JsonRpcId | undefined {
  try {
    return (JSON.parse(line) as { id?: JsonRpcId }).id;
  } catch {
    return undefined;
  }
}

function parseArgs(argv: string[]) {
  const parsed = {
    cdpUrl: undefined as string | undefined,
    allowedOrigin: [] as string[],
    requireConsent: true
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--cdp-url') parsed.cdpUrl = argv[++index];
    else if (arg === '--allowed-origin') parsed.allowedOrigin.push(argv[++index]);
    else if (arg === '--no-consent-check') parsed.requireConsent = false;
  }
  return parsed;
}
