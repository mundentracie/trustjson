// Generates GitHub repo social preview (1280x640) and avatar image (500x500)
// from inline SVG/HTML using the local Playwright Chromium — no image libraries.
// Outputs: store/social-preview.png, store/avatar500.png
import { chromium } from 'playwright-core';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'store');
mkdirSync(OUT, { recursive: true });

const ICON_SVG = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#0d1117"/>
  <rect x="4" y="4" width="120" height="120" rx="21" fill="none" stroke="#2ea043" stroke-width="3" opacity="0.55"/>
  <text x="34" y="86" font-family="Consolas, Menlo, monospace" font-size="56" font-weight="bold" fill="#e6edf3" text-anchor="middle">{</text>
  <text x="94" y="86" font-family="Consolas, Menlo, monospace" font-size="56" font-weight="bold" fill="#e6edf3" text-anchor="middle">}</text>
  <circle cx="64" cy="66" r="17" fill="#0d1117" stroke="#2ea043" stroke-width="3"/>
  <path d="M56 66 l6 6 l11 -12" stroke="#2ea043" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const socialHtml = `<!doctype html><html><head><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1280px;height:640px;overflow:hidden;background:#0d1117;
  display:flex;align-items:center;justify-content:center;gap:72px;
  font-family:'Segoe UI',Arial,sans-serif}
.left{display:flex;flex-direction:column;align-items:center;gap:28px}
.badge{font-family:Consolas,Menlo,monospace;font-size:26px;color:#8b949e;
  border:1px solid #30363d;border-radius:999px;padding:8px 26px;letter-spacing:1px}
h1{font-size:110px;font-weight:700;color:#e6edf3;letter-spacing:-2px}
h1 span{color:#2ea043}
.tagline{font-size:34px;color:#8b949e}
.checks{display:flex;flex-direction:column;gap:14px;margin-top:26px}
.checks div{font-size:29px;color:#e6edf3}
.checks b{color:#2ea043;font-weight:700;margin-right:14px}
.code{align-self:flex-start;background:#161b22;border:1px solid #30363d;border-radius:18px;
  padding:34px 40px;font-family:Consolas,Menlo,monospace;font-size:26px;line-height:1.7;color:#8b949e}
.code .k{color:#79c0ff}.code .s{color:#a5d6ff}.code .g{color:#2ea043}
</style></head><body>
<div class="left">
  <div class="badge">&lt;chrome-extension/&gt;</div>
  <h1>Trust<span>JSON</span></h1>
  <div class="tagline">Privacy-first JSON formatter</div>
  <div class="checks">
    <div><b>&#10003;</b>Zero network requests — proven by e2e tests</div>
    <div><b>&#10003;</b>No ads &middot; No tracking &middot; No telemetry</div>
    <div><b>&#10003;</b>Open source (MIT) &middot; ~18KB</div>
  </div>
</div>
<div class="code">
  <div><span class="k">"tracking"</span>: <span class="s">"none"</span>,</div>
  <div><span class="k">"network_requests"</span>: <span class="s">"zero"</span>,</div>
  <div><span class="k">"your_data"</span>: <span class="s">"stays_local"</span>,</div>
  <div><span class="k">"verified_by"</span>: <span class="g">"automated_tests"</span></div>
</div>
</body></html>`;

const avatarHtml = `<!doctype html><html><head><style>*{margin:0;padding:0}body{width:500px;height:500px;overflow:hidden}svg{display:block}</style></head><body>${ICON_SVG(500)}</body></html>`;

try {
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    viewport: { width: 400, height: 400 },
    args: [],
  });
  const page = await context.newPage();

  // social preview 1280x640
  await page.setViewportSize({ width: 1280, height: 640 });
  await page.setContent(socialHtml, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, 'social-preview.png'), clip: { x: 0, y: 0, width: 1280, height: 640 } });
  console.log('written: store/social-preview.png');

  // avatar 500x500
  await page.setViewportSize({ width: 500, height: 500 });
  await page.setContent(avatarHtml, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT, 'avatar500.png'), clip: { x: 0, y: 0, width: 500, height: 500 } });
  console.log('written: store/avatar500.png');

  await context.close();
} catch (e) {
  console.error('FAILED:', e.message);
  process.exit(1);
}
