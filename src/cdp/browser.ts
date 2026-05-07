import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';
import { resolve } from 'node:path';
import type {
  FileUploadParams,
  FillParams,
  PageOpenParams,
  PageRef,
  PageTargetParams,
  PressParams,
  ScreenshotParams,
  ScrollParams,
  SelectorParams
} from '../protocol/types.js';

export class CdpBrowser {
  private browser: Browser | null = null;
  private pageIds = new Map<string, Page>();

  async connect(cdpUrl: string): Promise<void> {
    this.browser = await chromium.connectOverCDP(cdpUrl, { timeout: 10000 });
    this.refreshPageIds();
  }

  isConnected(): boolean {
    return this.browser !== null && this.browser.isConnected();
  }

  pages(): Page[] {
    if (!this.browser) return [];
    return this.browser.contexts().flatMap((context) => context.pages());
  }

  pageRefs(): PageRef[] {
    this.refreshPageIds();
    return Array.from(this.pageIds.entries()).map(([pageId, page]) => ({
      pageId,
      url: page.url(),
      title: undefined
    }));
  }

  async browserStatus() {
    return {
      connected: this.isConnected(),
      pages: this.pageRefs()
    };
  }

  async openPage(params: PageOpenParams): Promise<PageRef> {
    const reusable = params.reuse?.urlIncludes
      ? this.pages().find((page) => page.url().includes(params.reuse?.urlIncludes ?? ''))
      : null;
    const page = reusable ?? (await this.context().newPage());
    await page.goto(params.url, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.bringToFront();
    return this.refForPage(page);
  }

  async focusPage(params: PageTargetParams): Promise<PageRef> {
    const page = this.pageById(params.pageId);
    await page.bringToFront();
    return this.refForPage(page);
  }

  async reloadPage(params: PageTargetParams): Promise<PageRef> {
    const page = this.pageById(params.pageId);
    await page.reload({ waitUntil: 'domcontentloaded' });
    return this.refForPage(page);
  }

  async text(params: SelectorParams): Promise<{ text: string }> {
    const locator = this.pageById(params.pageId).locator(params.selector).first();
    return { text: await locator.innerText({ timeout: params.timeoutMs ?? 5000 }) };
  }

  async click(params: SelectorParams): Promise<{ clicked: true }> {
    const locator = this.pageById(params.pageId).locator(params.selector).first();
    const timeout = params.timeoutMs ?? 5000;
    await locator.waitFor({ state: 'attached', timeout });
    await locator.scrollIntoViewIfNeeded({ timeout }).catch(() => {});
    await locator.click({ timeout }).catch(async () => {
      await locator.click({ timeout, force: true }).catch(async () => {
        await locator.evaluate((element) => {
          if (element instanceof HTMLElement) element.click();
        }, undefined, { timeout });
      });
    });
    return { clicked: true };
  }

  async fill(params: FillParams): Promise<{ filled: true }> {
    await this.pageById(params.pageId).locator(params.selector).first().fill(params.text, {
      timeout: params.timeoutMs ?? 5000
    });
    return { filled: true };
  }

  async press(params: PressParams): Promise<{ pressed: true }> {
    await this.pageById(params.pageId).keyboard.press(params.key);
    return { pressed: true };
  }

  async scroll(params: ScrollParams): Promise<{ scrolled: true }> {
    await this.pageById(params.pageId).mouse.wheel(params.deltaX ?? 0, params.deltaY ?? 0);
    return { scrolled: true };
  }

  async screenshot(params: ScreenshotParams): Promise<{ mimeType: 'image/png'; base64: string }> {
    const buffer = await this.pageById(params.pageId).screenshot({ fullPage: params.fullPage ?? false });
    return { mimeType: 'image/png', base64: buffer.toString('base64') };
  }

  async uploadFiles(params: FileUploadParams): Promise<{ uploaded: true; count: number }> {
    const files = params.files.map((file) => resolve(file));
    await this.pageById(params.pageId).locator(params.selector).first().setInputFiles(files, {
      timeout: params.timeoutMs ?? 5000
    });
    return { uploaded: true, count: files.length };
  }

  context(): BrowserContext {
    if (!this.browser) throw new Error('Browser is not connected.');
    const existing = this.browser.contexts()[0];
    if (!existing) throw new Error('Connected browser has no default context.');
    return existing;
  }

  pageById(pageId: string): Page {
    this.refreshPageIds();
    const page = this.pageIds.get(pageId);
    if (!page) throw new Error(`Unknown pageId: ${pageId}`);
    return page;
  }

  private refForPage(page: Page): PageRef {
    this.refreshPageIds();
    for (const [pageId, existing] of this.pageIds.entries()) {
      if (existing === page) return { pageId, url: page.url() };
    }
    const pageId = this.nextPageId();
    this.pageIds.set(pageId, page);
    return { pageId, url: page.url() };
  }

  private refreshPageIds(): void {
    const pages = this.pages();
    for (const [pageId, page] of this.pageIds.entries()) {
      if (!pages.includes(page) || page.isClosed()) this.pageIds.delete(pageId);
    }
    for (const page of pages) {
      if (![...this.pageIds.values()].includes(page)) {
        this.pageIds.set(this.nextPageId(), page);
      }
    }
  }

  private nextPageId(): string {
    let index = this.pageIds.size + 1;
    while (this.pageIds.has(`page_${index}`)) index += 1;
    return `page_${index}`;
  }
}
