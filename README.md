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
npm run verify     # no-browser checks: manifest privacy posture, zero-network audit, formatter logic (DOM mock)
npm run test:e2e   # real-browser proof test (Playwright)
```

## Install

- **Chrome:** [install from Chrome Web Store](https://chromewebstore.google.com/detail/trustjson-%E2%80%94-open-source-j/edmdgmpjnbemfonpedfljogkifkcmbej) ✅ live
- **Microsoft Edge:** [install from Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/fiophogpceceglngoidlplgeiehmgefb) ✅ live
- **Any Chromium browser (free, instant):** clone the repo, run `npm run build`, and *Load unpacked*
  the `dist/` folder at `chrome://extensions` (enable Developer mode).

## Privacy

Everything the extension knows stays on your device. See [PRIVACY.md](PRIVACY.md) for the exact list
of keys it writes to `chrome.storage.local`. Spoiler: only your display preferences.

## Status

**v0.2.0 — the formatter works.** Open any JSON page and TrustJSON replaces it with a collapsible
tree, entirely on your device:

- **Expand / Collapse all**, per-node toggling, lazy rendering with batched children so large
  documents stay responsive
- **Scoped dark mode** — only the JSON area is themed. Your page is never painted black
  (the head product's #1 complaint, fixed by construction)
- **Auto / Light / Dark** themes, remembered on your device (`chrome.storage.local`, nothing else)
- **Raw view + one-click Copy** of the original document
- **Parse errors** shown with line/column position and a snippet — invalid JSON never breaks the page
- Zero network requests while doing all of the above — proven by the e2e test, which now also
  clicks through Expand all / Collapse all / Raw before asserting `expect(external).toEqual([])`

Roadmap: key sorting, custom fonts, in-tree search, worker-based parsing for 10 MB+ documents.

## License

[MIT](LICENSE).
