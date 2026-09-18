import { test, expect, chromium, type BrowserContext, type Page, type Request } from '@playwright/test';
import { join } from 'path';

// Proof test: launching the packed extension and opening a JSON document must make
// ZERO external network requests — even while the formatter UI is being used.
// Adapted from andret2344/free-json-formatter.
const EXTENSION_DIR = join(process.cwd(), 'dist');
const TEST_ORIGIN = 'http://localhost:8080';

test('makes no external requests while formatting', async () => {
  const context: BrowserContext = await chromium.launchPersistentContext('', {
    // Extensions only load in the full Chromium build (new headless mode).
    // If this line errors on your Playwright version, use `headless: false` locally.
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${EXTENSION_DIR}`, `--load-extension=${EXTENSION_DIR}`],
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

  // the formatter replaced the raw JSON page
  const root = page.locator('.trustjson-root');
  await expect(root).toBeVisible();

  const children = root.locator('.tj-children');

  // expand everything
  await root.getByRole('button', { name: 'Expand all' }).click();
  await expect(children.first()).toBeVisible();

  // collapse everything
  await root.getByRole('button', { name: 'Collapse all' }).click();
  await expect(children.first()).toBeHidden();

  // raw view round-trip
  await root.getByRole('button', { name: 'Raw' }).click();
  await expect(root.locator('.tj-raw')).toBeVisible();
  await root.getByRole('button', { name: 'Tree' }).click();
  await expect(root.locator('.tj-raw')).toBeHidden();

  expect(external).toEqual([]);
  await context.close();
});
