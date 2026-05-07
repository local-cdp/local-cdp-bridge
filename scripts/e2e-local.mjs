import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { WebSocket } from 'ws';
import { startHttpServer } from '../dist/server/http-server.js';

const cdpPort = 19333;
const userDataDir = await mkdtemp(join(tmpdir(), 'local-cdp-bridge-e2e-'));
const browserProcess = spawn(
  chromium.executablePath(),
  [
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${userDataDir}`,
    '--headless=new',
    '--no-sandbox',
    'about:blank'
  ],
  { stdio: 'ignore' }
);
const cdpUrl = `http://127.0.0.1:${cdpPort}`;
console.log(`starting chromium cdp at ${cdpUrl}`);
await waitForCdp(cdpUrl);
console.log('cdp ready');
let authorizationRequest = null;
const authBridge = await startHttpServer({
  port: 0,
  cdpUrl,
  requireConsent: false,
  onAuthorizationRequest: (request) => {
    authorizationRequest = request;
  }
});
console.log(`auth bridge ready at ${authBridge.port}`);

const bridge = await startHttpServer({
  port: 0,
  cdpUrl,
  requireConsent: false,
  requireAuthorization: false
});
console.log(`bridge ready at ${bridge.port}`);

try {
  const health = await fetch(`http://127.0.0.1:${bridge.port}/health`).then((response) => response.json());
  assert(health.ok === true, 'health endpoint should be ok');

  const unauthorized = await connect(`ws://127.0.0.1:${authBridge.port}/session`, 'http://unauthorized.local');
  unauthorized.send(
    JSON.stringify({
      type: 'hello',
      client: {
        name: 'unauthorized-e2e',
        origin: 'http://unauthorized.local',
        version: '0.0.0'
      },
      allowedOrigins: ['http://unauthorized.local']
    })
  );
  const denied = await nextMessage(unauthorized);
  assert(denied.error?.code === 'AUTHORIZATION_REQUIRED', 'unknown origin should require local authorization');
  assert(authorizationRequest?.origin === 'http://unauthorized.local', 'authorization request should include origin');
  unauthorized.close();
  unauthorized.terminate();
  console.log('authorization request ok');

  const ws = await connect(`ws://127.0.0.1:${bridge.port}/session`);
  console.log('ws connected');
  ws.send(
    JSON.stringify({
      type: 'hello',
      client: {
        name: 'local-e2e',
        origin: 'file://',
        version: '0.0.0'
      }
    })
  );
  const ready = await nextMessage(ws);
  console.log('hello response', ready.type ?? ready);
  assert(ready.type === 'ready', 'session should become ready');

  const fixtureUrl = `data:text/html,${encodeURIComponent(`<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>local-cdp-bridge e2e</title></head>
  <body>
    <input id="name">
    <button id="copy" type="button">Copy</button>
    <p id="output">empty</p>
    <script>
      document.querySelector('#copy').addEventListener('click', () => {
        document.querySelector('#output').textContent = document.querySelector('#name').value;
      });
    </script>
  </body>
</html>`)}`;
  console.log('opening fixture', fixtureUrl);
  const opened = await command(ws, 'pages.open', { url: fixtureUrl });
  console.log('opened', opened.result);
  assert(opened.result.pageId, 'pages.open should return pageId');

  await command(ws, 'dom.fill', {
    pageId: opened.result.pageId,
    selector: '#name',
    text: 'Bridge'
  });
  console.log('filled');
  await command(ws, 'dom.click', {
    pageId: opened.result.pageId,
    selector: '#copy'
  });
  console.log('clicked');
  const text = await command(ws, 'dom.text', {
    pageId: opened.result.pageId,
    selector: '#output'
  });
  assert(text.result.text === 'Bridge', 'dom actions should update visible text');
  console.log('text ok');

  const shot = await command(ws, 'pages.screenshot', {
    pageId: opened.result.pageId
  });
  assert(shot.result.mimeType === 'image/png', 'screenshot should return image/png');
  assert(shot.result.base64.length > 100, 'screenshot should contain bytes');
  console.log('screenshot ok');

  ws.close();
  ws.terminate();
  console.log('e2e-local passed');
} finally {
  await authBridge.close().catch(() => {});
  await bridge.close().catch(() => {});
  browserProcess.kill('SIGKILL');
  await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
}

function connect(url, origin = 'file://') {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { headers: { Origin: origin } });
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

function nextMessage(ws) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      throw new Error('Timed out waiting for WebSocket message');
    }, 10000);
    ws.once('message', (data) => {
      clearTimeout(timer);
      resolve(JSON.parse(String(data)));
    });
  });
}

async function command(ws, method, params) {
  const id = `cmd_${Math.random().toString(16).slice(2)}`;
  ws.send(JSON.stringify({ id, method, params }));
  const response = await nextMessage(ws);
  assert(response.id === id, `response id mismatch for ${method}`);
  if (!response.ok) throw new Error(`${method} failed: ${response.error.message}`);
  return response;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForCdp(url) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/json/version`);
      if (response.ok) return;
    } catch {
      // Retry until Chromium opens the debugging port.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`CDP endpoint did not become ready: ${url}`);
}
