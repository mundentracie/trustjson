// scripts/verify.mjs — dependency-free verification harness for TrustJSON.
//
// Verifies WITHOUT a browser or npm install:
//   1. JSON validity of manifest.json / test/sample.json
//   2. manifest privacy posture: permissions == ["storage"], no background,
//      no host_permissions, no web_accessible_resources
//   3. zero-network audit: no network/eval/innerHTML/URL tokens outside comments in src/
//   4. full content-script pipeline against a minimal DOM mock:
//      detection -> parse -> tree build -> Expand all / Collapse all / Raw / Theme /
//      Copy -> batching ("Show more") -> invalid-JSON error UI -> non-JSON pages untouched
//
// Run: node scripts/verify.mjs   (also writes verify-report.txt)

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const results = [];

function check(name, cond, detail = '') {
  results.push({ name, ok: !!cond, detail: cond ? '' : detail });
  return !!cond;
}

// ---------------- minimal DOM mock ----------------
class FakeNode {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.childNodes = [];
    this.parentNode = null;
    this.attrs = {};
    this.listeners = {};
    this._class = '';
    this._text = '';
    this.style = {};
    this.value = '';
  }
  get className() { return this._class; }
  set className(v) { this._class = String(v); }
  get classList() { return this._class.split(/\s+/).filter(Boolean); }
  get children() { return this.childNodes; }
  get firstChild() { return this.childNodes[0] || null; }
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v); this.childNodes = []; }
  appendChild(c) { c.parentNode = this; this.childNodes.push(c); return c; }
  insertBefore(c, ref) {
    if (!ref) return this.appendChild(c);
    const i = this.childNodes.indexOf(ref);
    if (i < 0) return this.appendChild(c);
    c.parentNode = this;
    this.childNodes.splice(i, 0, c);
    return c;
  }
  removeChild(c) {
    const i = this.childNodes.indexOf(c);
    if (i >= 0) this.childNodes.splice(i, 1);
    c.parentNode = null;
    return c;
  }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  hasAttribute(k) { return k in this.attrs; }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
  click() { (this.listeners.click || []).forEach((fn) => fn.call(this, {})); }
  select() { /* textarea helper for the copy fallback */ }
  matchesSimple(sel) {
    if (sel.startsWith('.')) return this.classList.includes(sel.slice(1));
    return false;
  }
  querySelectorAll(sel) {
    if (sel.startsWith(':scope > ')) {
      const rest = sel.slice(':scope > '.length);
      return this.childNodes.filter((c) => c instanceof FakeNode && c.matchesSimple(rest));
    }
    const out = [];
    if (this.matchesSimple(sel)) out.push(this);
    const walk = (n) => {
      for (const c of n.childNodes) {
        if (c instanceof FakeNode) {
          if (c.matchesSimple(sel)) out.push(c);
          walk(c);
        }
      }
    };
    walk(this);
    return out;
  }
}

function runScript({ contentType, bodyChildren = [], bodyText, pathname = '/sample.json' }) {
  const document = {
    readyState: 'complete',
    contentType,
    location: { pathname, search: '' },
    body: new FakeNode('body'),
    createElement: (t) => new FakeNode(t),
    addEventListener: () => {},
    execCommand: () => true,
  };
  for (const c of bodyChildren) document.body.appendChild(c);
  if (bodyText !== undefined) document.body._text = bodyText;

  const window = { setTimeout, clearTimeout }; // browser-like: window.setTimeout exists
  const sandbox = { document, window, navigator: {}, console, setTimeout, clearTimeout };
  vm.createContext(sandbox);
  const src = readFileSync(path.join(ROOT, 'src', 'content.js'), 'utf8');
  vm.runInContext(src, sandbox, { filename: 'content.js' });
  return document;
}

function findByTestId(node, id) {
  if (node instanceof FakeNode) {
    if (node.attrs['data-testid'] === id) return node;
    for (const c of node.childNodes) {
      const hit = findByTestId(c, id);
      if (hit) return hit;
    }
  }
  return null;
}

// ---------------- 1. static checks ----------------
try {
  const manifest = JSON.parse(readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  check('manifest.json is valid JSON', true);
  check('manifest: permissions is exactly ["storage"]', JSON.stringify(manifest.permissions) === '["storage"]', JSON.stringify(manifest.permissions));
  check('manifest: no host_permissions', !('host_permissions' in manifest));
  check('manifest: no background service worker', !('background' in manifest));
  check('manifest: no web_accessible_resources', !('web_accessible_resources' in manifest));
} catch (e) {
  check('manifest.json is valid JSON', false, e.message);
}

try {
  const sample = readFileSync(path.join(ROOT, 'test', 'sample.json'), 'utf8');
  JSON.parse(sample);
  check('test/sample.json is valid JSON', true);
} catch (e) {
  check('test/sample.json is valid JSON', false, e.message);
}

// ---------------- 3. zero-network audit (comments stripped) ----------------
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const bannedTokens = ['fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'importScripts', 'new Function', 'eval(', 'innerHTML', 'document.write'];
for (const file of ['src/content.js', 'src/content.css']) {
  const stripped = strip(readFileSync(path.join(ROOT, file), 'utf8'));
  for (const tok of bannedTokens) {
    check(`zero-network audit: "${tok}" absent in ${file}`, !stripped.includes(tok));
  }
  check(`zero-network audit: no http(s) URLs in ${file}`, !/https?:\/\//i.test(stripped));
}

// ---------------- 4. behavior scenarios ----------------
const sampleText = readFileSync(path.join(ROOT, 'test', 'sample.json'), 'utf8');

// --- scenario 1: sample.json full interaction ---
try {
  const pre = new FakeNode('pre');
  pre._text = sampleText;
  const doc = runScript({ contentType: 'application/json', bodyChildren: [pre] });
  const root = doc.body.childNodes[0];
  check('s1: formatter root mounted', root instanceof FakeNode && root.classList.includes('trustjson-root'));

  const btn = (id) => findByTestId(root, id);
  check('s1: all toolbar buttons present', ['tj-expand-all', 'tj-collapse-all', 'tj-copy', 'tj-raw', 'tj-theme'].every((id) => !!btn(id)));

  const tree = btn('tj-tree');
  const rootNode = tree.childNodes.find((c) => c instanceof FakeNode && c.classList.includes('tj-node'));
  check('s1: root tree node rendered', !!rootNode);

  const rootChildrenEl = rootNode.childNodes.find((c) => c instanceof FakeNode && c.classList.includes('tj-children'));
  let allChildren = root.querySelectorAll('.tj-children');
  check('s1: default auto-expansion (root + its children visible)',
    !!rootChildrenEl && !rootChildrenEl.hasAttribute('hidden') && allChildren.some((c) => !c.hasAttribute('hidden')));

  const strings = root.querySelectorAll('.tj-val-string');
  check('s1: string values rendered with quotes', strings.some((s) => s._text === '"TrustJSON"'));

  btn('tj-expand-all').click();
  allChildren = root.querySelectorAll('.tj-children');
  check('s1: Expand all expands every container', allChildren.length > 0 && allChildren.every((c) => !c.hasAttribute('hidden')));

  btn('tj-collapse-all').click();
  allChildren = root.querySelectorAll('.tj-children');
  check('s1: Collapse all hides every container', allChildren.length > 0 && allChildren.every((c) => c.hasAttribute('hidden')));

  btn('tj-raw').click();
  const rawPre = btn('tj-raw-pre');
  check('s1: Raw view shows the original document', !rawPre.hasAttribute('hidden') && rawPre._text === sampleText.trim());
  check('s1: Raw mode hides the tree', tree.hasAttribute('hidden'));

  btn('tj-raw').click();
  check('s1: Tree mode restored', !tree.hasAttribute('hidden') && rawPre.hasAttribute('hidden'));

  const themeBtn = btn('tj-theme');
  themeBtn.click();
  check('s1: theme click 1 -> Light', themeBtn._text === 'Theme: Light' && root.attrs['data-theme'] === 'light');
  themeBtn.click();
  check('s1: theme click 2 -> Dark', themeBtn._text === 'Theme: Dark' && root.attrs['data-theme'] === 'dark');
  themeBtn.click();
  check('s1: theme click 3 -> Auto (resolves light without matchMedia)', themeBtn._text === 'Theme: Auto' && root.attrs['data-theme'] === 'light');

  const status = root.querySelectorAll('.tj-status')[0];
  btn('tj-copy').click();
  check('s1: Copy shows feedback', !!status && status._text === 'Copied ✓');
} catch (e) {
  check('s1: sample.json scenario completed', false, e.stack || e.message);
}

// --- scenario 2: batching for large containers ---
try {
  const big = JSON.stringify({ big: Array.from({ length: 750 }, (_, i) => i) });
  const pre = new FakeNode('pre');
  pre._text = big;
  const doc = runScript({ contentType: 'application/json', bodyChildren: [pre] });
  const root = doc.body.childNodes[0];
  const tree = findByTestId(root, 'tj-tree');
  const rootNode = tree.childNodes.find((c) => c instanceof FakeNode && c.classList.includes('tj-node'));
  // the 300-item batch lives in the "big" node's children container — locate the
  // container that currently shows a "Show more" button
  const kids = root.querySelectorAll('.tj-children')
    .find((c) => c.childNodes.some((x) => x instanceof FakeNode && x.attrs['data-testid'] === 'tj-more'));
  check('s2: located the batched container', !!kids);
  const directCount = () => kids.childNodes.filter((c) => c instanceof FakeNode && c.classList.includes('tj-node')).length;
  const moreBtn = () => kids.childNodes.find((c) => c instanceof FakeNode && c.attrs['data-testid'] === 'tj-more');

  check('s2: first chunk renders 300 + Show more', directCount() === 300 && !!moreBtn());
  moreBtn().click();
  check('s2: second chunk reaches 600', directCount() === 600 && !!moreBtn());
  moreBtn().click();
  check('s2: final chunk reaches 750, button removed', directCount() === 750 && !moreBtn());
} catch (e) {
  check('s2: batching scenario completed', false, e.stack || e.message);
}

// --- scenario 3: invalid JSON with json content-type -> error UI ---
try {
  const bad = '{"broken": tru}';
  const pre = new FakeNode('pre');
  pre._text = bad;
  const doc = runScript({ contentType: 'application/json', bodyChildren: [pre] });
  const root = doc.body.childNodes[0];
  check('s3: error UI shown for invalid JSON', root.classList.includes('trustjson-error-root'));
  check('s3: parse error message rendered', root.querySelectorAll('.tj-error-msg').length === 1);
  check('s3: line/column position rendered', root.querySelectorAll('.tj-error-pos').length === 1);
  check('s3: raw content preserved in <details>', root.querySelectorAll('.tj-raw').length === 1);
} catch (e) {
  check('s3: invalid-JSON scenario completed', false, e.stack || e.message);
}

// --- scenario 3b: invalid text on a plain HTML page -> page left untouched ---
try {
  const pre = new FakeNode('pre');
  pre._text = '{"oops this is not json';
  const doc = runScript({ contentType: 'text/html', bodyChildren: [pre], pathname: '/page.html' });
  check('s3b: non-JSON page left untouched', doc.body.childNodes.length === 1 && doc.body.childNodes[0] === pre && !findByTestId(doc.body, 'tj-root'));
} catch (e) {
  check('s3b: untouched-page scenario completed', false, e.stack || e.message);
}

// --- scenario 4: ordinary HTML page -> no swap ---
try {
  const d1 = new FakeNode('div');
  d1._class = 'app';
  const d2 = new FakeNode('div');
  const doc = runScript({ contentType: 'text/html', bodyChildren: [d1, d2], pathname: '/page.html' });
  check('s4: ordinary page untouched', doc.body.childNodes.length === 2 && !findByTestId(doc.body, 'tj-root'));
} catch (e) {
  check('s4: ordinary-page scenario completed', false, e.stack || e.message);
}

// ---------------- report ----------------
const passed = results.filter((r) => r.ok).length;
const failed = results.length - passed;
const lines = results.map((r) => `${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '  -- ' + r.detail : ''}`);
const report = [
  'TrustJSON verification report — ' + new Date().toISOString(),
  ...lines,
  '',
  `${passed} passed, ${failed} failed`,
].join('\n');
console.log(report);
writeFileSync(path.join(ROOT, 'verify-report.txt'), report + '\n');
process.exitCode = failed ? 1 : 0;
