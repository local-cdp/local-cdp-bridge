#!/usr/bin/env node
import { detectBrowsers, launchDefaultBrowser } from '../browser/launcher.js';
import { acceptConsent, hasCurrentConsent } from '../security/consent.js';
import { startHttpServer } from '../server/http-server.js';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.acceptTermsForTest) await acceptConsent('0.1.0-dev');
  const consent = await hasCurrentConsent();
  const browsers = await detectBrowsers();
  const server = await startHttpServer({
    port: args.port,
    cdpUrl: args.cdpUrl,
    requireConsent: !args.noConsentCheck,
    requireAuthorization: !args.noAuthorizationCheck,
    onLaunchDefaultBrowser: (options) => launchDefaultBrowser(options)
  });

  console.log('local-cdp-bridge');
  console.log(`Local:  http://127.0.0.1:${server.port}`);
  console.log(`Session: ws://127.0.0.1:${server.port}/session`);
  console.log(`CDP: ${args.cdpUrl ?? 'not configured'}`);
  console.log(`Consent: ${consent ? 'accepted' : 'required'}`);
  console.log(`Authorization: ${args.noAuthorizationCheck ? 'disabled' : 'required'}`);
  console.log(`Browsers: ${browsers.map((item) => item.browser).join(', ') || 'none detected'}`);
  console.log('');
  console.log('Press Ctrl+C to stop.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

function parseArgs(argv: string[]) {
  const args = {
    port: 17321,
    cdpUrl: undefined as string | undefined,
    acceptTermsForTest: false,
    noConsentCheck: false,
    noAuthorizationCheck: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--port') args.port = Number(argv[++index]);
    else if (arg === '--cdp-url') args.cdpUrl = argv[++index];
    else if (arg === '--accept-terms-for-test') args.acceptTermsForTest = true;
    else if (arg === '--no-consent-check') args.noConsentCheck = true;
    else if (arg === '--no-authorization-check') args.noAuthorizationCheck = true;
  }
  return args;
}
