const launchChrome = document.querySelector('#launchChrome');
const launchEdge = document.querySelector('#launchEdge');
const browserStatus = document.querySelector('#browserStatus');
const updateStatus = document.querySelector('#updateStatus');
const checkUpdates = document.querySelector('#checkUpdates');
const installUpdate = document.querySelector('#installUpdate');

async function initHome() {
  const status = await requireAgreement();
  if (!status) return;
  renderHomeBrowsers(status);
  renderUpdateStatus(status.update);
}

function renderHomeBrowsers(status) {
  const labels = status.browsers.map((item) => (item.browser === 'chrome' ? 'Chrome' : 'Edge'));
  browserStatus.textContent = labels.length
    ? t('browserAvailable', { browsers: labels.join(currentLocale === 'zh-CN' ? '、' : ' and ') })
    : t('noBrowser');
}

async function launch(browser) {
  browserStatus.textContent = t('launching', { browser: browserLabel(browser) });
  try {
    const result = await window.bridgeDesktop.launchBrowser(browser);
    browserStatus.textContent = t('launched', { browser: browserLabel(browser), url: result.cdpUrl });
  } catch (error) {
    browserStatus.textContent = error instanceof Error ? error.message : String(error);
  }
}

async function checkForUpdates() {
  checkUpdates.disabled = true;
  updateStatus.textContent = t('updateChecking');
  try {
    const status = await window.bridgeDesktop.checkForUpdates();
    renderUpdateStatus(status);
  } catch (error) {
    updateStatus.textContent = error instanceof Error ? error.message : String(error);
    checkUpdates.disabled = false;
  }
}

function renderUpdateStatus(status) {
  if (!status) {
    updateStatus.textContent = t('updateIdle');
    installUpdate.classList.add('hidden');
    return;
  }

  const message = localizeUpdateStatus(status);
  updateStatus.textContent = status.error ? `${message} ${status.error}` : message;
  installUpdate.classList.toggle('hidden', status.state !== 'downloaded');
  checkUpdates.disabled = status.state === 'checking' || status.state === 'downloading';
}

function localizeUpdateStatus(status) {
  if (status.state === 'checking') return t('updateChecking');
  if (status.state === 'available') return t('updateAvailable', { version: status.version || '' });
  if (status.state === 'downloading') return t('updateDownloading', { progress: Math.round(status.progress || 0) });
  if (status.state === 'downloaded') return t('updateDownloaded', { version: status.version || '' });
  if (status.state === 'not-available') return t('updateCurrent', { version: status.version || '' });
  if (status.state === 'error') return t('updateFailed');
  return t('updateIdle');
}

launchChrome.addEventListener('click', () => launch('chrome'));
launchEdge.addEventListener('click', () => launch('edge'));
checkUpdates.addEventListener('click', () => checkForUpdates());
installUpdate.addEventListener('click', () => window.bridgeDesktop.installUpdate());
window.bridgeDesktop.onLaunchBrowser((browser) => launch(browser));
window.bridgeDesktop.onUpdateStatus((status) => renderUpdateStatus(status));
initHome().catch((error) => {
  browserStatus.textContent = error instanceof Error ? error.message : String(error);
});
