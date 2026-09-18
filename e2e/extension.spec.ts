import { test, expect, chromium, type BrowserContext, type Page, type Request } from '@playwright/test';

// Proof test: launching the packed extension and opening a JSON document must make
// ZERO external network requests. Adapted from andret2344/free-json-formatter.
const EXTENSION_DIR = 'dist';
const TEST_ORIGIN = 'http://localhost:8080';

test('makes no external requests while formatting', async () => {
  const context: BrowserContext = await chromium.launchPersistentContext('', {
    headless: true,
    args: [`--load-extension=${EXTENSION_DIR}`, `--disable-extensions-except=${EXTENSION_DIR}`],
  });

  const external: string[] = [];
  context.on('request', (request: Request) => {
    const url = request.url();
    // ignore the local test server, the extension bundle itself, and devtools
    if (
      !url.startsWith('chrome-extension://') &&
      !url.startsWith('devtools://') &&
      !url.startsWith(TEST_ORIGIN)
    ) {
      external.push(url);
    }
  });

  const page: Page = await context.newPage();
  await page.goto(`${TEST_ORIGIN}/sample.json`);
  // TODO(MVP build): click "Expand all" once the formatter UI exists.

  expect(external).toEqual([]);
  await context.close();
});
