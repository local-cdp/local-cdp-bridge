export type BrowserName = 'chrome' | 'edge';

export type BridgeMethod =
  | 'browser.status'
  | 'browser.launch'
  | 'pages.list'
  | 'pages.open'
  | 'pages.focus'
  | 'pages.reload'
  | 'pages.screenshot'
  | 'dom.text'
  | 'dom.click'
  | 'dom.fill'
  | 'dom.press'
  | 'dom.scroll'
  | 'files.upload';

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

export interface PageOpenParams {
  url: string;
  reuse?: {
    urlIncludes?: string;
  };
}

export interface PageTargetParams {
  pageId: string;
}

export interface SelectorParams extends PageTargetParams {
  selector: string;
  timeoutMs?: number;
}

export interface FillParams extends SelectorParams {
  text: string;
}

export interface PressParams extends PageTargetParams {
  key: string;
}

export interface ScrollParams extends PageTargetParams {
  deltaX?: number;
  deltaY?: number;
}

export interface ScreenshotParams extends PageTargetParams {
  fullPage?: boolean;
}

export interface FileUploadParams extends SelectorParams {
  files: string[];
}
