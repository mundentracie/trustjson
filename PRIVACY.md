# Privacy Policy — TrustJSON

TrustJSON processes your JSON **entirely on your device**. It makes **no network requests** and sends
**nothing** to any server.

## What we store

TrustJSON uses the `storage` permission **only** to remember your own display preferences on your
device via `chrome.storage.local`. As features land, every key is listed here:

| Key            | Purpose                  | Shared with anyone? |
|----------------|--------------------------|----------------------|
| `theme`        | Remembers your toolbar theme choice (`auto` / `light` / `dark`) | No — never leaves your device |

No JSON content you view is ever read by us, stored remotely, or transmitted.

## What we NEVER do

- Never collect, upload, or transmit the JSON you view.
- Never inject ads, affiliate links, or third-party scripts into any page.
- Never use analytics, telemetry, or tracking of any kind.
- Never contact a remote server (the e2e test asserts this, and CI runs it on every push).

This is a checkable claim: the source is open (MIT) and the zero-network test runs in CI.
