const launchChrome = document.querySelector('#launchChrome');
const launchEdge = document.querySelector('#launchEdge');
const browserStatus = document.querySelector('#browserStatus');

async function initHome() {
  const status = await requireAgreement();
  if (!status) return;
  renderHomeBrowsers(status);
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

launchChrome.addEventListener('click', () => launch('chrome'));
launchEdge.addEventListener('click', () => launch('edge'));
window.bridgeDesktop.onLaunchBrowser((browser) => launch(browser));
initHome().catch((error) => {
  browserStatus.textContent = error instanceof Error ? error.message : String(error);
});
