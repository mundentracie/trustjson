// Renders the TrustJSON store icon (128x128 PNG) from inline SVG using the
// local Playwright Chromium — no image libraries needed.
// Output: src/icons/icon128.png
import { chromium } from 'playwright-core';
import { spawn } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src', 'icons');
mkdirSync(OUT, { recursive: true });

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#0d1117"/>
  <rect x="4" y="4" width="120" height="120" rx="21" fill="none" stroke="#2ea043" stroke-width="3" opacity="0.55"/>
  <text x="34" y="86" font-family="Consolas, Menlo, monospace" font-size="56" font-weight="bold" fill="#e6edf3" text-anchor="middle">{</text>
  <text x="94" y="86" font-family="Consolas, Menlo, monospace" font-size="56" font-weight="bold" fill="#e6edf3" text-anchor="middle">}</text>
  <circle cx="64" cy="66" r="17" fill="#0d1117" stroke="#2ea043" stroke-width="3"/>
  <path d="M56 66 l6 6 l11 -12" stroke="#2ea043" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const html = `<!doctype html><html><head><style>*{margin:0;padding:0}body{width:128px;height:128px;overflow:hidden}svg{display:block}</style></head><body>${svg}</body></html>`;
const htmlPath = join(OUT, 'icon.html');
writeFileSync(htmlPath, html);

try {
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    viewport: { width: 128, height: 128 },
    args: [],
  });
  const page = await context.newPage();
  await page.goto('file:///' + htmlPath.replace(/\\/g, '/'));
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT, 'icon128.png'), clip: { x: 0, y: 0, width: 128, height: 128 } });
  await context.close();
  console.log('icon written: src/icons/icon128.png');
} finally {
  /* no server to kill */
}
