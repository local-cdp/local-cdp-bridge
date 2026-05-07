import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const cdpPort = 19334;
const userDataDir = await mkdtemp(join(tmpdir(), 'local-cdp-bridge-mcp-e2e-'));
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
await waitForCdp(cdpUrl);

const mcp = spawn(process.execPath, ['dist/mcp/server.js', '--cdp-url', cdpUrl, '--no-consent-check'], {
  stdio: ['pipe', 'pipe', 'inherit']
});
await new Promise((resolve, reject) => {
  mcp.once('spawn', resolve);
  mcp.once('error', reject);
});
await new Promise((resolve) => setTimeout(resolve, 300));

const responses = [];
let stdoutBuffer = '';
let shuttingDown = false;
mcp.stdout.setEncoding('utf8');
mcp.stdout.on('data', (chunk) => {
  stdoutBuffer += chunk;
  const lines = stdoutBuffer.split('\n');
  stdoutBuffer = lines.pop() ?? '';
  for (const line of lines) {
    if (line.trim()) {
      const parsed = JSON.parse(line);
      responses.push(parsed);
    }
  }
});
mcp.on('exit', (code, signal) => {
  if (shuttingDown) return;
  if (code !== null && code !== 0) console.error(`mcp exited with code ${code}`);
  if (signal) console.error(`mcp exited with signal ${signal}`);
});

try {
  console.log('mcp initialize');
  await request('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'mcp-e2e', version: '0.0.0' }
  });
  console.log('mcp list tools');
  const list = await request('tools/list', {});
  assert(list.result.tools.some((tool) => tool.name === 'pages_open'), 'tools/list should include pages_open');

  const fixtureUrl = `data:text/html,${encodeURIComponent(`<!doctype html><html><body>
    <input id="name">
    <button id="copy" type="button">Copy</button>
    <p id="output">empty</p>
    <script>
      document.querySelector('#copy').addEventListener('click', () => {
        document.querySelector('#output').textContent = document.querySelector('#name').value;
      });
    </script>
  </body></html>`)}`;
  console.log('mcp open page');
  const opened = await callTool('pages_open', { url: fixtureUrl });
  const pageId = JSON.parse(opened.result.content[0].text).pageId;
  console.log('mcp fill');
  await callTool('dom_fill', { pageId, selector: '#name', text: 'MCP' });
  console.log('mcp click');
  await callTool('dom_click', { pageId, selector: '#copy' });
  console.log('mcp text');
  const text = await callTool('dom_text', { pageId, selector: '#output' });
  assert(JSON.parse(text.result.content[0].text).text === 'MCP', 'MCP DOM tools should update text');

  console.log('e2e-mcp passed');
} finally {
  shuttingDown = true;
  mcp.kill('SIGTERM');
  browserProcess.kill('SIGTERM');
  await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
}

function request(method, params) {
  const id = `req_${Math.random().toString(16).slice(2)}`;
  mcp.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  return waitFor(id);
}

function callTool(name, args) {
  return request('tools/call', { name, arguments: args });
}

function waitFor(id) {
  const deadline = Date.now() + 45000;
  return new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      const index = responses.findIndex((response) => response.id === id);
      if (index >= 0) {
        clearInterval(timer);
        const response = responses.splice(index, 1)[0];
        if (response.error) reject(new Error(response.error.message));
        else resolve(response);
      } else if (Date.now() > deadline) {
        clearInterval(timer);
        reject(new Error(`Timed out waiting for MCP response ${id}`));
      }
    }, 50);
  });
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
