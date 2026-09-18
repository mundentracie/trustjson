# TrustJSON — Chrome Web Store 上架材料（v0.2.1）

> 提交地址：https://chrome.google.com/webstore/devconsole（需先缴 $5 注册费，一次性）
> 上传包：`trustjson/trustjson-v0.2.1-store.zip`（12KB）
> 截图：`trustjson/store/screenshots/store-light.png`、`store-dark.png`（1280×800）

---

## Store listing

**Name**（≤45 字符）
```
TrustJSON — Open Source JSON Formatter
```

**Summary**（≤132 字符）
```
Privacy-first JSON formatter. Open source, no ads, no tracking, zero network requests. A trustworthy JSON Formatter alternative.
```

**Category**: Developer Tools
**Language**: English (United States)

**Description**
```
TrustJSON formats JSON documents directly in your browser — locally, instantly, and with zero network requests.

WHY TRUSTJSON EXISTS
The most popular JSON formatter on the Chrome Web Store turned closed-source in 2026 and started injecting affiliate code and third-party tracking. TrustJSON is the open-source (MIT), auditable alternative: every line of code is on GitHub, and an automated end-to-end test proves the extension makes zero external requests.

FEATURES
• Automatic formatting of any JSON page (by Content-Type or .json URL)
• Collapsible tree view with lazy loading — huge documents stay fast
• Syntax-highlighted, readable colors in light and dark themes
• Dark mode scoped to the JSON area only (never repaints the whole page)
• Expand all / Collapse all / Copy / Raw view toggle
• Remembers your theme preference locally
• Clear error messages with line/column position for invalid JSON
• Batched rendering for large arrays (no freezing)

PRIVACY (the whole point)
• ZERO network requests — verified by an automated test in our repository
• No analytics, no tracking, no affiliate code, no ads
• Your JSON data never leaves your device
• The only stored preference is your theme choice (chrome.storage.local)
• Fully open source under MIT: https://github.com/mundentracie/trustjson

If a page fails to format, the original page is left untouched — the extension fails safe.
```

---

## Privacy tab（提交时的隐私问卷答案）

**Single purpose description**
```
Formats JSON documents locally in the browser for easier reading.
```

**Do you collect or use user data?** → No（全部选 No：不收集个人数据、不用 creditworthiness、不转让数据、不为无关用途、不卖数据）

**Permission justifications**

| 权限 | 理由（英文，可直接粘贴） |
|---|---|
| `storage` | Stores the user's theme preference (light/dark/auto) locally via chrome.storage.local. No other data is stored. |
| Host permission `<all_urls>`（content script） | Required so the content script can detect and format JSON documents on any page the user opens (APIs return JSON on arbitrary domains). All parsing and rendering happens locally on the device; no page content is ever transmitted or collected. |

**Data usage disclosures**: 全部不勾（无身份/医疗/财务/通信/位置/浏览历史等任何收集）

---

## 提交步骤（你本人操作，约 15 分钟 + 审核等待）

1. 打开 https://chrome.google.com/webstore/devconsole → 用 mundentracie 账号登录 → 缴 $5 注册费（一次性，信用卡/Google Pay）
2. **New item** → 上传 `trustjson-v0.2.1-store.zip`
3. **Store listing** 标签：粘贴上面的 Name / Summary / Description；上传 2 张截图（1280×800）+ 图标（zip 内已含，如单独要求就传 `src/icons/icon128.png`）
4. **Privacy** 标签：按上面问卷答案填写 + 权限理由粘贴
5. **Distribution**: Public
6. Submit for review → MV3 纯内容脚本扩展通常 1–3 天过审

## 审核风险预判（低）

- 🟢 权限极简（storage only）、无 background、无远程代码 → 历史上这类扩展过审最快
- 🟡 `<all_urls>` + content script 会让审核员多看一眼，理由已备好；若被问询，回复指向 GitHub 的 e2e 零网络证明测试
- 🔴 绝不在回复审核时承诺"未来加云同步/账号"之类会改变隐私姿态的功能
