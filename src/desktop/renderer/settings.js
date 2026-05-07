const browserControls = {
  chrome: {
    pathInput: document.querySelector('#chromePath'),
    settingsPath: document.querySelector('#chromeDetectedPath'),
    choose: document.querySelector('#chooseChrome'),
    save: document.querySelector('#saveChrome'),
    clear: document.querySelector('#clearChrome')
  },
  edge: {
    pathInput: document.querySelector('#edgePath'),
    settingsPath: document.querySelector('#edgeDetectedPath'),
    choose: document.querySelector('#chooseEdge'),
    save: document.querySelector('#saveEdge'),
    clear: document.querySelector('#clearEdge')
  }
};

async function initSettings() {
  const status = await requireAgreement();
  if (!status) return;
  renderSettings(status);
}

function renderSettings(status) {
  const detected = new Map(status.browsers.map((item) => [item.browser, item.path]));
  for (const browser of ['chrome', 'edge']) {
    const controls = browserControls[browser];
    const savedPath = status.browserPaths[browser] ?? '';
    const detectedPath = detected.get(browser) ?? '';
    const effectivePath = savedPath || detectedPath;
    controls.pathInput.value = savedPath;
    controls.settingsPath.textContent = effectivePath || t('notDetected');
    controls.settingsPath.title = effectivePath || '';
  }
}

async function refreshSettings() {
  const status = await window.bridgeDesktop.getStatus();
  renderSettings(status);
}

async function choosePath(browser) {
  const path = await window.bridgeDesktop.chooseBrowserPath(browser);
  if (!path) return;
  browserControls[browser].pathInput.value = path;
}

async function savePath(browser) {
  const path = browserControls[browser].pathInput.value.trim();
  if (!path) return;
  await window.bridgeDesktop.saveBrowserPath(browser, path);
  await refreshSettings();
}

async function clearPath(browser) {
  await window.bridgeDesktop.clearBrowserPath(browser);
  await refreshSettings();
}

browserControls.chrome.choose.addEventListener('click', () => choosePath('chrome'));
browserControls.edge.choose.addEventListener('click', () => choosePath('edge'));
browserControls.chrome.save.addEventListener('click', () => savePath('chrome'));
browserControls.edge.save.addEventListener('click', () => savePath('edge'));
browserControls.chrome.clear.addEventListener('click', () => clearPath('chrome'));
browserControls.edge.clear.addEventListener('click', () => clearPath('edge'));
initSettings().catch(() => {});
