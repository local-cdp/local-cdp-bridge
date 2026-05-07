const logEl = document.querySelector('#log');
const debugEl = document.querySelector('#debug');
let ws;
let sequence = 0;

function log(message, level = 'info') {
  logEl.textContent += `[${level}] ${message}\n`;
}

function debug(value) {
  debugEl.textContent += `${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`;
}

async function command(method, params) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error('WebSocket is not connected.');
  }
  const id = `cmd_${++sequence}_${Date.now()}`;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    const handler = (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== id) return;
      ws.removeEventListener('message', handler);
      debug(message);
      if (message.ok) resolve(message.result);
      else reject(new Error(message.error?.message || 'Bridge command failed.'));
    };
    ws.addEventListener('message', handler);
  });
}

document.querySelector('#openBridge').addEventListener('click', () => {
  location.href = 'local-cdp-bridge://open';
  log('Requested Browser Bridge to open.');
});

document.querySelector('#startChrome').addEventListener('click', () => {
  location.href = 'local-cdp-bridge://start-browser?browser=chrome';
  log('Requested Chrome debug mode.');
});

document.querySelector('#health').addEventListener('click', async () => {
  try {
    const result = await fetch('http://127.0.0.1:17321/health').then((response) => response.json());
    debug(result);
    log(result.ok ? 'Bridge is running.' : 'Bridge health check returned an unexpected response.', result.ok ? 'info' : 'warning');
  } catch (error) {
    log(`Bridge is not reachable: ${error.message}`, 'error');
  }
});

document.querySelector('#connect').addEventListener('click', async () => {
  ws = new WebSocket('ws://127.0.0.1:17321/session');
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    debug(message);
    if (message.type === 'ready') log('Bridge session is ready.');
    if (message.error?.code === 'AUTHORIZATION_REQUIRED') {
      log('Browser Bridge is waiting for local approval. Approve this site in Bridge, then connect again.', 'warning');
    } else if (message.ok === false) {
      log(message.error?.message || 'Bridge command failed.', 'error');
    }
  });
  await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
  ws.send(JSON.stringify({
    type: 'hello',
    client: {
      name: 'web-demo',
      origin: location.origin,
      version: '0.1.0'
    },
    allowedOrigins: [location.origin]
  }));
  log('Sent hello handshake.');
});

document.querySelector('#openPage').addEventListener('click', async () => {
  try {
    await command('pages.open', {
      url: `${location.origin}${location.pathname}`
    });
    log('Opened this demo page through Browser Bridge.');
  } catch (error) {
    log(error.message, 'error');
  }
});
