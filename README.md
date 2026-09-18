# TrustJSON — Open Source JSON Formatter (No Ads · No Tracking · Zero Network Requests)

> A privacy-first, fully open-source alternative to JSON Formatter.
> Born because the popular JSON Formatter went closed-source in 2026 and started injecting affiliate popups and tracking into the pages you visit.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Zero Network Requests](https://img.shields.io/badge/network%20requests-0-brightgreen.svg)](e2e/extension.spec.ts)
[![Privacy: verifiable](https://img.shields.io/badge/privacy-verifiable-green.svg)](PRIVACY.md)

## Why this exists

In early 2026, the widely-used **JSON Formatter** (2M+ users) went closed-source and began injecting
affiliate / donation popups and third-party tracking into the pages you visit. Thousands of developers
started looking for a replacement they could *trust*.

**TrustJSON is that replacement.** It does one thing — turn a raw JSON page into a readable,
collapsible tree — and it does it **entirely on your device**.

## Trust, by design (not by promise)

These are checkable claims. Read the source; the test proves it.

- 🚫 **No ads.** Nothing is ever injected into any page you visit.
- 🚫 **No affiliate code.** We have nothing to sell you.
- 🚫 **No telemetry, no analytics, no tracking.** There is no server to talk to.
- 🚫 **Zero network requests.** The extension makes **no** outbound request, ever.
- 🔒 **One permission:** `storage`, used only to remember *your* settings.
- 📜 **Open source (MIT).** Every line is on GitHub.

### How we prove "zero network requests"

We don't ask you to trust a sentence. The end-to-end test
[`e2e/extension.spec.ts`](e2e/extension.spec.ts) launches the packed extension in a real browser,
opens a JSON document, and asserts that **no external request was made**:

```ts
context.on('request', (request) => {
  const url = request.url();
  if (!url.startsWith('chrome-extension://') && !url.startsWith('devtools://')) external.push(url);
});
// ... open a JSON page ...
expect(external).toEqual([]);
```

Run it yourself:

```bash
npm install
npm run build
npm run test:e2e
```

## Install

- **Now (free, instant):** clone the repo, run `npm run build`, and *Load unpacked* the `dist/`
  folder at `chrome://extensions` (enable Developer mode).
- **Soon:** Chrome Web Store listing (one-time $5 fee). Search "TrustJSON" or
  *"JSON Formatter alternative — no ads, no tracking"*.

## Privacy

Everything the extension knows stays on your device. See [PRIVACY.md](PRIVACY.md) for the exact list
of keys it writes to `chrome.storage.local`. Spoiler: only your display preferences.

## Status

MVP in progress. The current skeleton detects JSON pages and parses them locally with **zero network
calls** — verified by the e2e test above. The formatter UI (collapsible tree, scoped dark mode,
themes, search) is the next build step.

## License

[MIT](LICENSE).
