// TrustJSON content script — MVP skeleton
//
// ZERO-NETWORK RULE (enforced by e2e/extension.spec.ts):
//   no fetch / XMLHttpRequest / WebSocket / navigator.sendBeacon / importScripts /
//   new Function / eval / external <script>. Only chrome.storage.local for preferences.
//   Nothing leaves the device.
//
// Architecture (confirmed from andret2344 / arnav-kr source audit, see product spec §12):
//   1. cheap preflight — no storage read, no parse, rules out ordinary HTML pages
//   2. parse locally with JSON.parse
//   3. (MVP build) build collapsible tree off-screen, swap into page atomically,
//      theme SCOPED to the JSON area so dark mode never paints the whole page black

(function () {
  'use strict';

  // --- Stage 1: cheap preflight (side-effect free) ---
  function getPotentialJsonText(doc) {
    var body = doc.body;
    if (!body) return null;
    var ct = (doc.contentType || '').toLowerCase();
    var path = doc.location ? doc.location.pathname + doc.location.search : '';
    var jsonLike = ct.indexOf('json') !== -1 || /\.json(\?|#|$)/i.test(path);
    var children = Array.prototype.slice.call(body.children);
    var text = null;
    if (children.length === 1 && children[0].tagName === 'PRE') text = children[0].textContent;
    else if (children.length === 0) text = body.textContent;
    else if (jsonLike) text = body.textContent;
    if (text === null) return null;
    var trimmed = text.trim();
    if (!trimmed) return null;
    var first = trimmed.charAt(0);
    if (!jsonLike && first !== '{' && first !== '[') return null;
    return trimmed;
  }

  // --- Stage 2: local parse (no network) ---
  function tryParse(rawText) {
    try {
      JSON.parse(rawText);
      return true;
    } catch (e) {
      return false;
    }
  }

  function start() {
    var raw = getPotentialJsonText(document);
    if (raw === null) return;
    if (tryParse(raw)) {
      // MVP build: replace raw <pre> with a formatted, collapsible, themed tree.
      // For now we only prove the architecture: local detection + local parse, zero network.
      console.log('[TrustJSON] JSON detected and parsed locally. Formatter UI lands in the MVP build.');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
