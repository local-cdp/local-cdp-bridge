const I18N = {
  en: {
    ready: 'Ready',
    home: 'Home',
    settings: 'Settings',
    advanced: 'Advanced',
    browserAutomation: 'Browser automation',
    startDebugBrowser: 'Start a debugging browser',
    homeIntro: 'Choose a browser to open a dedicated automation profile.',
    chromeDesc: 'Open Chrome with local debugging enabled.',
    edgeDesc: 'Open Edge with local debugging enabled.',
    launch: 'Launch',
    browserAvailable: '{browsers} available. Choose one to start.',
    noBrowser: 'No supported browser detected. Set a browser path in Settings.',
    launching: 'Launching {browser}...',
    launched: '{browser} launched at {url}',
    settingsEyebrow: 'Settings',
    browserPaths: 'Browser paths',
    pathHint: 'Leave a path empty to use automatic detection.',
    chromeExecutable: 'Chrome executable',
    edgeExecutable: 'Edge executable',
    notDetected: 'Not detected',
    autoDetect: 'Auto detect',
    browse: 'Browse',
    save: 'Save',
    auto: 'Auto',
    advancedEyebrow: 'Advanced',
    bridgeDetails: 'Bridge details',
    advancedHint: 'Technical details for web integrations and permissions.',
    language: 'Language',
    languageHint: 'Choose the display language for Browser Bridge.',
    systemLanguage: 'System default',
    english: 'English',
    chinese: '简体中文',
    localBridge: 'Local bridge',
    localEndpoint: 'Local endpoint',
    urlScheme: 'URL scheme',
    lastProtocolUrl: 'Last protocol URL',
    none: 'None',
    authorizedOrigins: 'Authorized origins',
    authorizedOriginsHint: 'New sites appear here only after they request access and you approve them in Browser Bridge.',
    authorize: 'Authorize',
    pendingAuthorization: 'Pending authorization',
    noPendingAuthorization: 'No pending authorization request.',
    pendingAuthorizationHint: 'A web app is requesting permission to control allowed browser pages through Browser Bridge.',
    authorizationDialogTitle: 'Allow web app access?',
    authorizationDialogBody: 'This web app wants to control allowed browser pages through Browser Bridge.',
    allowedOrigins: 'Allowed origins',
    allow: 'Allow',
    deny: 'Deny',
    revoke: 'Revoke',
    beforeContinue: 'Before you continue',
    userAgreement: 'User Agreement',
    welcomeText: 'Connect trusted web tools to a local browser you control.',
    agreementText1:
      'This app can launch Chrome or Edge in debugging mode and allow authorized web applications to request browser actions.',
    agreementText2:
      'It does not bypass logins, verification, or site security controls. You can disconnect, revoke access, or quit this app at any time.',
    acceptContinue: 'Accept and Continue'
  },
  'zh-CN': {
    ready: '就绪',
    home: '首页',
    settings: '设置',
    advanced: '高级',
    browserAutomation: '浏览器自动化',
    startDebugBrowser: '启动调试浏览器',
    homeIntro: '选择一个浏览器，打开专用于自动化的独立配置环境。',
    chromeDesc: '以本地调试模式打开 Chrome。',
    edgeDesc: '以本地调试模式打开 Edge。',
    launch: '启动',
    browserAvailable: '已检测到 {browsers}，请选择一个启动。',
    noBrowser: '未检测到支持的浏览器，请在设置中指定浏览器路径。',
    launching: '正在启动 {browser}...',
    launched: '{browser} 已启动：{url}',
    settingsEyebrow: '设置',
    browserPaths: '浏览器路径',
    pathHint: '路径留空时，将使用自动检测结果。',
    chromeExecutable: 'Chrome 程序路径',
    edgeExecutable: 'Edge 程序路径',
    notDetected: '未检测到',
    autoDetect: '自动检测',
    browse: '浏览',
    save: '保存',
    auto: '自动',
    advancedEyebrow: '高级',
    bridgeDetails: 'Bridge 详情',
    advancedHint: '用于网页集成和权限管理的技术信息。',
    language: '语言',
    languageHint: '选择 Browser Bridge 的显示语言。',
    systemLanguage: '跟随系统',
    english: 'English',
    chinese: '简体中文',
    localBridge: '本地 Bridge',
    localEndpoint: '本地地址',
    urlScheme: 'URL 协议',
    lastProtocolUrl: '最近协议 URL',
    none: '无',
    authorizedOrigins: '已授权来源',
    authorizedOriginsHint: '新的网页来源会在发起连接并由你在 Browser Bridge 中同意后出现在这里。',
    authorize: '授权',
    pendingAuthorization: '待处理授权',
    noPendingAuthorization: '暂无待处理授权请求。',
    pendingAuthorizationHint: '有网页应用请求通过 Browser Bridge 控制允许范围内的浏览器页面。',
    authorizationDialogTitle: '允许网页应用访问？',
    authorizationDialogBody: '这个网页应用想通过 Browser Bridge 控制允许范围内的浏览器页面。',
    allowedOrigins: '允许访问的来源',
    allow: '同意',
    deny: '拒绝',
    revoke: '撤销',
    beforeContinue: '继续前确认',
    userAgreement: '用户协议',
    welcomeText: '将可信网页工具连接到你可控的本地浏览器。',
    agreementText1: '本应用可以以调试模式启动 Chrome 或 Edge，并允许已授权的网页应用请求浏览器操作。',
    agreementText2: '它不会绕过登录、验证或网站安全机制。你可以随时断开连接、撤销授权或退出本应用。',
    acceptContinue: '同意并继续'
  }
};

let currentLocale = 'en';

async function getLocalizedStatus() {
  const status = await window.bridgeDesktop.getStatus();
  currentLocale = resolveLocale(status);
  applyI18n();
  renderAuthorizationDialog(status.pendingAuthorization);
  return status;
}

async function requireAgreement() {
  const status = await getLocalizedStatus();
  const badge = document.querySelector('#statusBadge');
  if (!status.consentAccepted) {
    window.location.href = './agreement.html';
    return null;
  }
  if (badge) {
    badge.textContent = t('ready');
    badge.dataset.state = 'ready';
  }
  return status;
}

function resolveLocale(status) {
  const preferred = status.browserPaths?.language ?? 'system';
  const raw = preferred === 'system' ? status.systemLocale : preferred;
  return raw && raw.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
}

function t(key, params = {}) {
  let value = I18N[currentLocale][key] ?? I18N.en[key] ?? key;
  for (const [name, replacement] of Object.entries(params)) {
    value = value.replace(`{${name}}`, replacement);
  }
  return value;
}

function applyI18n(root = document) {
  document.documentElement.lang = currentLocale === 'zh-CN' ? 'zh-CN' : 'en';
  for (const element of root.querySelectorAll('[data-i18n]')) {
    element.textContent = t(element.dataset.i18n);
  }
  for (const element of root.querySelectorAll('[data-i18n-placeholder]')) {
    element.setAttribute('placeholder', t(element.dataset.i18nPlaceholder));
  }
  for (const element of root.querySelectorAll('[data-i18n-title]')) {
    element.setAttribute('title', t(element.dataset.i18nTitle));
  }
}

function browserLabel(browser) {
  return browser === 'chrome' ? 'Chrome' : 'Edge';
}

function compactPath(path) {
  if (!path) return t('notDetected');
  if (path.length <= 58) return path;
  return `...${path.slice(-44)}`;
}

function ensureAuthorizationDialog() {
  let dialog = document.querySelector('#authorizationDialog');
  if (dialog) return dialog;

  dialog = document.createElement('div');
  dialog.id = 'authorizationDialog';
  dialog.className = 'modal-backdrop hidden';
  dialog.innerHTML = `
    <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="authorizationDialogTitle">
      <p class="eyebrow" data-i18n="pendingAuthorization">Pending authorization</p>
      <h2 id="authorizationDialogTitle" data-i18n="authorizationDialogTitle">Allow web app access?</h2>
      <p data-i18n="authorizationDialogBody">This web app wants to control allowed browser pages through Browser Bridge.</p>
      <div class="modal-origin" id="authorizationOrigin"></div>
      <div class="modal-meta">
        <span data-i18n="allowedOrigins">Allowed origins</span>
        <code id="authorizationAllowedOrigins"></code>
      </div>
      <div class="modal-actions">
        <button id="denyAuthorization" type="button" data-i18n="deny">Deny</button>
        <button id="allowAuthorization" class="primary-button" type="button" data-i18n="allow">Allow</button>
      </div>
    </section>
  `;
  document.body.append(dialog);
  applyI18n(dialog);
  dialog.querySelector('#allowAuthorization').addEventListener('click', async () => {
    await window.bridgeDesktop.approvePendingOrigin();
    renderAuthorizationDialog(null);
  });
  dialog.querySelector('#denyAuthorization').addEventListener('click', async () => {
    await window.bridgeDesktop.denyPendingOrigin();
    renderAuthorizationDialog(null);
  });
  return dialog;
}

function renderAuthorizationDialog(request) {
  const dialog = ensureAuthorizationDialog();
  dialog.classList.toggle('hidden', !request);
  if (!request) return;
  dialog.querySelector('#authorizationOrigin').textContent = request.displayName || request.origin;
  dialog.querySelector('#authorizationAllowedOrigins').textContent = request.allowedOrigins?.length
    ? request.allowedOrigins.join(', ')
    : request.origin;
}

if (window.bridgeDesktop?.onAuthorizationRequested) {
  window.bridgeDesktop.onAuthorizationRequested((request) => {
    renderAuthorizationDialog(request);
  });
}

if (window.bridgeDesktop?.onAuthorizationUpdated) {
  window.bridgeDesktop.onAuthorizationUpdated(async () => {
    const status = await window.bridgeDesktop.getStatus();
    renderAuthorizationDialog(status.pendingAuthorization);
  });
}
