// Generates Chrome Web Store screenshots (1280x800) by running the packed
// extension in headless Chromium against the local sample.json server.
// Outputs: store/screenshots/store-light.png, store-dark.png
import { chromium } from 'playwright-core';
import { spawn } from 'child_process';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXTENSION_DIR = join(ROOT, 'dist');
const OUT_DIR = join(ROOT, 'store', 'screenshots');
mkdirSync(OUT_DIR, { recursive: true });

// start the zero-dependency test server
const server = spawn(process.execPath, [join(ROOT, 'scripts', 'test-server.mjs')], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

try {
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 800 },
    args: [
      `--disable-extensions-except=${EXTENSION_DIR}`,
      `--load-extension=${EXTENSION_DIR}`,
    ],
  });
  const page = await context.newPage();
  await page.goto('http://localhost:8080/sample.json');
  await page.waitForSelector('.trustjson-root', { timeout: 10000 });
  await page.locator('.trustjson-root').getByRole('button', { name: 'Expand all' }).click();
  await page.waitForTimeout(300);

  // light theme (default auto resolves to light in headless)
  await page.screenshot({ path: join(OUT_DIR, 'store-light.png') });

  // dark theme: theme button cycles Auto -> Light -> Dark
  const themeBtn = page.locator('.trustjson-root').getByRole('button', { name: /Theme:/ });
  await themeBtn.click(); // Light
  await themeBtn.click(); // Dark
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT_DIR, 'store-dark.png') });

  await context.close();
  console.log('screenshots written to store/screenshots/');
} finally {
  server.kill();
}
