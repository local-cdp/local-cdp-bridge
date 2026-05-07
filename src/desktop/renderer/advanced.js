const localEndpoint = document.querySelector('#localEndpoint');
const protocolUrl = document.querySelector('#protocolUrl');
const originList = document.querySelector('#originList');
const languageSelect = document.querySelector('#languageSelect');

async function initAdvanced() {
  const status = await requireAgreement();
  if (!status) return;
  renderAdvanced(status);
}

function renderAdvanced(status) {
  localEndpoint.textContent = status.serverPort ? `http://127.0.0.1:${status.serverPort}` : '-';
  languageSelect.value = status.browserPaths.language ?? 'system';
  renderOrigins(status.permissions);
}

function renderOrigins(permissions) {
  originList.innerHTML = '';
  for (const permission of permissions) {
    const item = document.createElement('li');
    const text = document.createElement('span');
    text.textContent = permission.origin;
    const revoke = document.createElement('button');
    revoke.type = 'button';
    revoke.textContent = t('revoke');
    revoke.addEventListener('click', async () => {
      await window.bridgeDesktop.revokeOrigin(permission.origin);
      const status = await window.bridgeDesktop.getStatus();
      renderOrigins(status.permissions);
    });
    item.append(text, revoke);
    originList.append(item);
  }
}

languageSelect.addEventListener('change', async () => {
  await window.bridgeDesktop.saveLanguage(languageSelect.value);
  const status = await getLocalizedStatus();
  renderAdvanced(status);
});

window.bridgeDesktop.onProtocolUrl((url) => {
  protocolUrl.textContent = url;
});

window.bridgeDesktop.onAuthorizationUpdated(async () => {
  renderAdvanced(await window.bridgeDesktop.getStatus());
});

initAdvanced().catch(() => {});
