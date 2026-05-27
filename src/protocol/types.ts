export type BrowserName = 'chrome' | 'edge';

export type BridgeMethod =
  | 'browser.status'
  | 'browser.launch'
  | 'browser.launchDefault'
  | 'browser.ensureReady'
  | 'browser.close'
  | 'pages.list'
  | 'pages.open'
  | 'pages.focus'
  | 'pages.focusByUrl'
  | 'pages.reload'
  | 'pages.screenshot'
  | 'dom.text'
  | 'dom.attribute'
  | 'dom.list'
  | 'dom.waitText'
  | 'dom.waitSelector'
  | 'dom.click'
  | 'dom.clickText'
  | 'dom.clickSelectorText'
  | 'dom.scrollIntoView'
  | 'dom.hover'
  | 'dom.fill'
  | 'dom.press'
  | 'dom.scroll'
  | 'dom.scrollState'
  | 'network.fetch'
  | 'network.waitResponse'
  | 'files.upload'
  | 'files.uploadData';

export interface BridgeCommand<TParams = unknown> {
  id: string;
  method: BridgeMethod;
  params?: TParams;
}

export interface BridgeError {
  code: string;
  message: string;
  recoverable: boolean;
}

export interface BridgeSuccess<TResult = unknown> {
  id: string;
  ok: true;
  result: TResult;
}

export interface BridgeFailure {
  id: string;
  ok: false;
  error: BridgeError;
}

export type BridgeResponse<TResult = unknown> = BridgeSuccess<TResult> | BridgeFailure;

export interface BrowserLaunchOptions {
  browser: BrowserName;
  startUrl?: string;
  cdpPort?: number;
  profileDir?: string;
  browserPath?: string;
}

export interface PageRef {
  pageId: string;
  url: string;
  title?: string;
}

export interface BridgeHello {
  type: 'hello';
  client: {
    name: string;
    origin: string;
    displayName?: string;
    version?: string;
  };
  nonce?: string;
  session?: string;
  allowedOrigins?: string[];
  requestedCapabilities?: BridgeMethod[];
  pairingCode?: string;
}

export interface BrowserStatusResult {
  connected: boolean;
  pages: PageRef[];
}

export interface BrowserEnsureReadyParams {
  startUrl?: string;
  cdpPort?: number;
  profileDir?: string;
  browserPath?: string;
  timeoutMs?: number;
}

export interface BrowserEnsureReadyResult extends BrowserStatusResult {
  launched: boolean;
  browser?: BrowserName;
  cdpUrl?: string;
  pid?: number;
}

export interface PageOpenParams {
  url: string;
  reuse?: {
    urlIncludes?: string;
  };
}

export interface PageTargetParams {
  pageId: string;
}

export interface PageUrlTargetParams {
  urlIncludes: string;
  timeoutMs?: number;
}

export interface SelectorParams extends PageTargetParams {
  selector: string;
  nth?: number;
  last?: boolean;
  timeoutMs?: number;
}

export interface FillParams extends SelectorParams {
  text: string;
}

export interface AttributeParams extends SelectorParams {
  name: string;
}

export interface ListParams extends SelectorParams {
  attributes?: string[];
  limit?: number;
}

export interface TextTargetParams extends PageTargetParams {
  text: string;
  exact?: boolean;
  timeoutMs?: number;
}

export interface SelectorTextParams extends SelectorParams {
  text: string;
  exact?: boolean;
}

export interface PressParams extends PageTargetParams {
  key: string;
}

export interface ScrollParams extends PageTargetParams {
  selector?: string;
  deltaX?: number;
  deltaY?: number;
}

export interface ScrollStateParams extends PageTargetParams {
  selector?: string;
}

export interface ScreenshotParams extends PageTargetParams {
  fullPage?: boolean;
}

export interface NetworkFetchParams extends PageTargetParams {
  url: string;
  method?: string;
  body?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export interface WaitResponseParams extends PageTargetParams {
  urlIncludes: string;
  timeoutMs?: number;
}

export interface FileUploadParams extends SelectorParams {
  files: string[];
}

export interface BrowserMediaFile {
  name: string;
  type: string;
  size?: number;
  dataUrl: string;
}

export interface FileUploadDataParams extends SelectorParams {
  files: BrowserMediaFile[];
}
