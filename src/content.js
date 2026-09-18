// TrustJSON content script — MVP formatter (v0.2.0)
//
// ZERO-NETWORK RULE (enforced by e2e/extension.spec.ts):
//   no fetch / XMLHttpRequest / WebSocket / navigator.sendBeacon / importScripts /
//   new Function / eval / external <script>. Only chrome.storage.local for preferences.
//   Nothing leaves the device. No innerHTML is used anywhere (Trusted Types / XSS safe).
//
// Architecture (confirmed from andret2344 / arnav-kr source audit, see product spec §12):
//   1. cheap preflight — no storage read, no parse, rules out ordinary HTML pages
//   2. parse locally with JSON.parse
//   3. build a collapsible tree off-screen and swap it into the page atomically;
//      theme is SCOPED to .trustjson-root so dark mode never paints the whole page black

(function () {
  'use strict';

  // ---------- tunables ----------
  var THEME_KEY = 'theme';            // chrome.storage.local key: 'auto' | 'light' | 'dark'
  var BATCH_SIZE = 300;               // children rendered per batch for large containers
  var AUTO_EXPAND_DEPTH = 2;          // root + its children expanded by default
  var MAX_AUTO_EXPAND_NODES = 2000;   // safety cap for default expansion
  var MAX_EXPAND_ALL_NODES = 50000;   // safety cap for "Expand all"
  var STRING_PREVIEW_LIMIT = 1000;    // truncate gigantic strings in the tree

  // ---------- Stage 1: cheap preflight (side-effect free) ----------
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
    return { text: trimmed, jsonLike: jsonLike };
  }

  // ---------- Stage 2: local parse (no network) ----------
  function parseJson(rawText) {
    var t0 = (typeof performance === 'object' && performance.now) ? performance.now() : 0;
    try {
      var value = JSON.parse(rawText);
      var ms = (typeof performance === 'object' && performance.now) ? performance.now() - t0 : 0;
      return { ok: true, value: value, ms: ms };
    } catch (e) {
      return { ok: false, error: e };
    }
  }

  function findParseErrorPosition(rawText, msg) {
    // classic V8: "Unexpected token x in JSON at position 12"
    var m = msg.match(/position\s+(\d+)/i);
    if (m) return parseInt(m[1], 10);
    // modern V8 (Chrome 120+): "Unexpected token 'x', ... is not valid JSON"
    var m2 = msg.match(/Unexpected token\s*(?:'([^']*)'|"([^"]*)")/i);
    if (m2) {
      var tok = (m2[1] !== undefined) ? m2[1] : m2[2];
      if (tok) {
        var idx = rawText.indexOf(tok);
        if (idx >= 0) return idx;
      }
    }
    // "Unexpected end of JSON input" — the error is at the very end
    if (/end of JSON input/i.test(msg)) return rawText.length;
    return -1;
  }

  function errorPosition(rawText, err) {
    var msg = (err && err.message) ? err.message : String(err);
    var info = { message: msg, line: 0, column: 0, snippet: '' };
    var pos = findParseErrorPosition(rawText, msg);
    if (pos < 0) return info;
    if (pos > rawText.length) pos = rawText.length;
    var line = 1;
    var lastNl = -1;
    for (var i = 0; i < pos; i++) {
      if (rawText.charAt(i) === '\n') { line++; lastNl = i; }
    }
    info.line = line;
    info.column = pos - lastNl;
    var start = Math.max(0, pos - 30);
    info.snippet = rawText.slice(start, Math.min(rawText.length, pos + 30));
    return info;
  }

  // ---------- small helpers ----------
  function el(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function typeOf(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value; // 'object' | 'string' | 'number' | 'boolean'
  }

  function formatNumber(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function collectEntries(value, t) {
    var out = [];
    if (t === 'array') {
      for (var i = 0; i < value.length; i++) out.push({ key: i, value: value[i], isIndex: true });
    } else {
      var keys = Object.keys(value);
      for (var j = 0; j < keys.length; j++) out.push({ key: keys[j], value: value[keys[j]], isIndex: false });
    }
    return out;
  }

  // ---------- tree construction (lazy, batched) ----------
  var autoBudget = MAX_AUTO_EXPAND_NODES;

  function buildNode(key, value, depth) {
    var t = typeOf(value);
    var isContainer = (t === 'object' || t === 'array');
    var childCount = 0;
    if (isContainer) childCount = (t === 'array') ? value.length : Object.keys(value).length;

    var node = el('div', 'tj-node');
    var row = el('div', 'tj-row' + (isContainer ? ' tj-row-container' : ''));
    node.appendChild(row);

    var state = { value: value, depth: depth, built: false, expanded: false, childrenEl: null, toggleEl: null, entries: null };
    node.__tj = state;

    // toggle / spacer
    if (isContainer && childCount > 0) {
      var toggle = el('button', 'tj-toggle');
      toggle.type = 'button';
      toggle.textContent = '▸';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Toggle ' + (key === null ? 'root' : String(key)));
      row.appendChild(toggle);
      state.toggleEl = toggle;
    } else {
      row.appendChild(el('span', 'tj-toggle-spacer'));
    }

    // key ("key":)
    if (key !== null) {
      var keyWrap = el('span', 'tj-key');
      keyWrap.appendChild(el('span', 'tj-punct', '"'));
      keyWrap.appendChild(el('span', 'tj-key-name', String(key)));
      keyWrap.appendChild(el('span', 'tj-punct', '"'));
      row.appendChild(keyWrap);
      row.appendChild(el('span', 'tj-punct', ': '));
    }

    // value / container preview
    if (!isContainer) {
      var val = el('span', 'tj-val tj-val-' + t);
      if (t === 'string') {
        var s = String(value);
        if (s.length > STRING_PREVIEW_LIMIT) {
          val.textContent = '"' + s.slice(0, STRING_PREVIEW_LIMIT) + '" … (' + formatNumber(s.length) + ' chars)';
        } else {
          val.textContent = '"' + s + '"';
        }
      } else {
        val.textContent = String(value);
      }
      row.appendChild(val);
    } else {
      var open = (t === 'array') ? '[' : '{';
      var close = (t === 'array') ? ']' : '}';
      var prev = el('span', 'tj-preview');
      if (childCount === 0) {
        prev.appendChild(el('span', 'tj-punct', open + close));
      } else {
        prev.appendChild(el('span', 'tj-punct', open));
        prev.appendChild(el('span', 'tj-count', formatNumber(childCount) + (childCount === 1 ? ' item' : ' items')));
        prev.appendChild(el('span', 'tj-punct', close));
      }
      row.appendChild(prev);
    }

    // children (lazy)
    if (isContainer && childCount > 0) {
      state.entries = collectEntries(value, t);
      var childrenEl = el('div', 'tj-children');
      childrenEl.setAttribute('hidden', '');
      node.appendChild(childrenEl);
      state.childrenEl = childrenEl;

      state.toggleEl.addEventListener('click', function () {
        if (state.expanded) collapseNode(node);
        else expandNode(node);
      });

      // default expansion with a global node budget (large docs stay responsive)
      if (depth < AUTO_EXPAND_DEPTH && autoBudget > 0) {
        autoBudget -= childCount;
        if (autoBudget < 0) autoBudget = 0;
        expandNode(node);
      }
    }

    return node;
  }

  function expandNode(node) {
    var state = node.__tj;
    if (!state || !state.childrenEl) return;
    if (!state.built) {
      buildChildrenChunk(node, 0);
      state.built = true;
    }
    state.childrenEl.removeAttribute('hidden');
    state.expanded = true;
    if (state.toggleEl) {
      state.toggleEl.textContent = '▾';
      state.toggleEl.setAttribute('aria-expanded', 'true');
    }
  }

  function collapseNode(node) {
    var state = node.__tj;
    if (!state || !state.childrenEl || !state.expanded) return;
    state.childrenEl.setAttribute('hidden', '');
    state.expanded = false;
    if (state.toggleEl) {
      state.toggleEl.textContent = '▸';
      state.toggleEl.setAttribute('aria-expanded', 'false');
    }
  }

  function buildChildrenChunk(node, startIndex) {
    var state = node.__tj;
    var childrenEl = state.childrenEl;
    var entries = state.entries;
    var moreBtn = childrenEl.__tjMoreBtn || null;

    var end = Math.min(entries.length, startIndex + BATCH_SIZE);
    for (var i = startIndex; i < end; i++) {
      var childNode = buildNode(entries[i].key, entries[i].value, state.depth + 1);
      childrenEl.insertBefore(childNode, moreBtn);
    }

    var remaining = entries.length - end;
    if (remaining > 0) {
      if (!moreBtn) {
        moreBtn = el('button', 'tj-more');
        moreBtn.type = 'button';
        moreBtn.setAttribute('data-testid', 'tj-more');
        moreBtn.addEventListener('click', function () {
          buildChildrenChunk(node, childrenEl.__tjNextStart);
        });
        childrenEl.appendChild(moreBtn);
      }
      childrenEl.__tjNextStart = end;
      moreBtn.textContent = 'Show ' + Math.min(BATCH_SIZE, remaining) + ' more of ' + formatNumber(remaining) + ' remaining';
      childrenEl.__tjMoreBtn = moreBtn;
    } else if (moreBtn) {
      childrenEl.removeChild(moreBtn);
      childrenEl.__tjMoreBtn = null;
    }
  }

  function expandAll(rootNode) {
    var budget = MAX_EXPAND_ALL_NODES;
    var capped = false;
    var stack = [rootNode];
    while (stack.length) {
      var current = stack.pop();
      var state = current.__tj;
      if (state && state.childrenEl) {
        if (!state.expanded) {
          if (budget <= 0) { capped = true; break; }
          expandNode(current);
          budget -= state.entries.length;
          if (budget < 0) capped = true;
        }
        if (state.expanded) {
          var kids = state.childrenEl.querySelectorAll(':scope > .tj-node');
          for (var i = 0; i < kids.length; i++) stack.push(kids[i]);
        }
      }
    }
    return capped;
  }

  function collapseAll(rootEl) {
    var nodes = rootEl.querySelectorAll('.tj-node');
    for (var i = 0; i < nodes.length; i++) collapseNode(nodes[i]);
  }

  // ---------- storage (best-effort, local only) ----------
  function storageGet(key, cb) {
    try {
      var api = (typeof chrome !== 'undefined') && chrome.storage && chrome.storage.local;
      if (api && typeof api.get === 'function') {
        var obj = {};
        obj[key] = undefined;
        api.get(obj, function (res) { cb(res ? res[key] : undefined); });
        return;
      }
    } catch (e) { /* fall through to default */ }
    cb(undefined);
  }

  function storageSet(key, value) {
    try {
      var api = (typeof chrome !== 'undefined') && chrome.storage && chrome.storage.local;
      if (api && typeof api.set === 'function') {
        var obj = {};
        obj[key] = value;
        api.set(obj);
      }
    } catch (e) { /* preferences are best-effort */ }
  }

  // ---------- theme (scoped to the JSON area, never the whole page) ----------
  var THEMES = ['auto', 'light', 'dark'];
  var darkMq = (typeof window.matchMedia === 'function') ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function applyTheme(root, setting) {
    var resolved = setting;
    if (resolved !== 'light' && resolved !== 'dark') {
      resolved = (darkMq && darkMq.matches) ? 'dark' : 'light';
    }
    root.setAttribute('data-theme', resolved);
  }

  // ---------- copy (local clipboard only) ----------
  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  function copyText(text, done) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          function () { done(true); },
          function () { done(fallbackCopy(text)); }
        );
        return;
      }
    } catch (e) { /* fall through */ }
    done(fallbackCopy(text));
  }

  // ---------- UI: toolbar + tree + raw ----------
  function buildRoot(rawText, value, parseMs) {
    var root = el('div', 'trustjson-root');
    root.setAttribute('data-testid', 'tj-root');

    var toolbar = el('div', 'tj-toolbar');
    toolbar.setAttribute('data-testid', 'tj-toolbar');
    toolbar.appendChild(el('span', 'tj-title', 'TrustJSON'));
    toolbar.appendChild(el('span', 'tj-meta',
      formatNumber(rawText.length) + ' chars · parsed in ' + (Math.round(parseMs * 10) / 10) + ' ms'));
    var status = el('span', 'tj-status');
    toolbar.appendChild(status);
    toolbar.appendChild(el('span', 'tj-spacer'));

    var treeEl = el('div', 'tj-tree');
    treeEl.setAttribute('data-testid', 'tj-tree');
    var rootNode = buildNode(null, value, 0);
    treeEl.appendChild(rootNode);

    var rawPre = el('pre', 'tj-raw');
    rawPre.setAttribute('data-testid', 'tj-raw-pre');
    rawPre.setAttribute('hidden', '');

    var rawShowing = false;
    var rawBtn = el('button', 'tj-btn', 'Raw');
    rawBtn.type = 'button';
    rawBtn.setAttribute('data-testid', 'tj-raw');
    rawBtn.addEventListener('click', function () {
      rawShowing = !rawShowing;
      if (rawShowing && !rawPre.firstChild) rawPre.textContent = rawText;
      if (rawShowing) {
        treeEl.setAttribute('hidden', '');
        rawPre.removeAttribute('hidden');
        rawBtn.textContent = 'Tree';
      } else {
        rawPre.setAttribute('hidden', '');
        treeEl.removeAttribute('hidden');
        rawBtn.textContent = 'Raw';
      }
    });
    toolbar.appendChild(rawBtn);

    var expandBtn = el('button', 'tj-btn', 'Expand all');
    expandBtn.type = 'button';
    expandBtn.setAttribute('data-testid', 'tj-expand-all');
    expandBtn.addEventListener('click', function () {
      var capped = expandAll(rootNode);
      status.textContent = capped
        ? 'Expansion capped at ' + formatNumber(MAX_EXPAND_ALL_NODES) + ' nodes'
        : '';
    });
    toolbar.appendChild(expandBtn);

    var collapseBtn = el('button', 'tj-btn', 'Collapse all');
    collapseBtn.type = 'button';
    collapseBtn.setAttribute('data-testid', 'tj-collapse-all');
    collapseBtn.addEventListener('click', function () {
      collapseAll(root);
      status.textContent = '';
    });
    toolbar.appendChild(collapseBtn);

    var copyBtn = el('button', 'tj-btn', 'Copy');
    copyBtn.type = 'button';
    copyBtn.setAttribute('data-testid', 'tj-copy');
    copyBtn.addEventListener('click', function () {
      copyText(rawText, function (ok) {
        status.textContent = ok ? 'Copied ✓' : 'Copy failed';
        if (ok) {
          window.setTimeout(function () {
            if (status.textContent === 'Copied ✓') status.textContent = '';
          }, 1500);
        }
      });
    });
    toolbar.appendChild(copyBtn);

    var themeSetting = 'auto';
    var themeBtn = el('button', 'tj-btn', 'Theme: Auto');
    themeBtn.type = 'button';
    themeBtn.setAttribute('data-testid', 'tj-theme');
    themeBtn.addEventListener('click', function () {
      var idx = THEMES.indexOf(themeSetting);
      if (idx < 0) idx = 0;
      themeSetting = THEMES[(idx + 1) % THEMES.length];
      themeBtn.textContent = 'Theme: ' + themeSetting.charAt(0).toUpperCase() + themeSetting.slice(1);
      applyTheme(root, themeSetting);
      storageSet(THEME_KEY, themeSetting);
    });
    toolbar.appendChild(themeBtn);

    root.appendChild(toolbar);
    root.appendChild(treeEl);
    root.appendChild(rawPre);

    // resolve 'auto' immediately (no theme flash), then honor any saved preference
    applyTheme(root, 'auto');
    storageGet(THEME_KEY, function (saved) {
      if (saved === 'light' || saved === 'dark' || saved === 'auto') {
        themeSetting = saved;
        themeBtn.textContent = 'Theme: ' + saved.charAt(0).toUpperCase() + saved.slice(1);
        applyTheme(root, themeSetting);
      }
    });

    if (darkMq && typeof darkMq.addEventListener === 'function') {
      darkMq.addEventListener('change', function () {
        if (themeSetting === 'auto') applyTheme(root, 'auto');
      });
    }

    return root;
  }

  // ---------- error UI (only shown when the document is clearly JSON) ----------
  function buildErrorRoot(rawText, info) {
    var root = el('div', 'trustjson-root trustjson-error-root');
    root.setAttribute('data-testid', 'tj-root');
    root.setAttribute('data-theme', (darkMq && darkMq.matches) ? 'dark' : 'light');

    var banner = el('div', 'tj-error-banner');
    banner.appendChild(el('strong', 'tj-error-title', 'TrustJSON: this page looks like JSON but is not valid JSON.'));
    banner.appendChild(el('div', 'tj-error-msg', info.message));
    if (info.line) {
      banner.appendChild(el('div', 'tj-error-pos', 'Line ' + info.line + ', column ' + info.column));
    }
    if (info.snippet) {
      banner.appendChild(el('pre', 'tj-error-snippet', info.snippet));
    }

    var details = el('details', 'tj-error-raw');
    details.appendChild(el('summary', null, 'Show raw content'));
    details.appendChild(el('pre', 'tj-raw', rawText));
    banner.appendChild(details);

    root.appendChild(banner);
    return root;
  }

  // ---------- Stage 3: atomic swap-in ----------
  function swapIn(root) {
    var body = document.body;
    while (body.firstChild) body.removeChild(body.firstChild);
    body.appendChild(root);
  }

  function start() {
    var pre;
    try {
      pre = getPotentialJsonText(document);
    } catch (e) {
      return;
    }
    if (!pre) return;

    var parsed = parseJson(pre.text);
    if (parsed.ok) {
      try {
        swapIn(buildRoot(pre.text, parsed.value, parsed.ms));
      } catch (e) {
        // Never break the user's page because of a formatter bug.
        try { console.warn('[TrustJSON] render failed, leaving page untouched:', e); } catch (_) { /* noop */ }
      }
      return;
    }

    if (pre.jsonLike) {
      try {
        swapIn(buildErrorRoot(pre.text, errorPosition(pre.text, parsed.error)));
      } catch (e) { /* leave page untouched */ }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
