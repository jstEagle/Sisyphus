# Sisyphus

Sisyphus is a Chrome extension that quietly learns how you use tabs and keeps
them organized. It groups related tabs, moves stale tabs into collapsed cleanup
groups, closes old tabs when allowed, and keeps a sidebar stack of reversible
actions.

## What It Does

- Learns locally from tab behavior, undo, reopen-after-close, switching, manual
  grouping, and protection.
- Dynamically creates short contextual group names and stable colors.
- Keeps confidence internal so the extension feels like Chrome behaving better,
  not a dashboard to manage.
- Provides a first-run onboarding flow with Minimal, Medium, and Maximum
  management levels.
- Stores behavior in `chrome.storage.local` and supports import/export.
- Uses a right-click context menu to protect the current tab or current group.
- Avoids notifications by default.

## Install From The Repo

1. Run `npm install`.
2. Run `npm run build`.
3. Open `chrome://extensions`.
4. Enable Developer mode.
5. Choose **Load unpacked**.
6. Select the `dist` folder.

## Development

```bash
npm install
npm run dev
```

Then reload the unpacked extension from `chrome://extensions`.

## Verification

```bash
npm run check
npm test
npm run build
```

## Configuration

Non-secret extension configuration lives in
`src/config/extension-config.json`. Secrets do not belong in this project unless
a future feature explicitly requires them, and then they should use an
appropriate secret store.

## Architecture

The core tab manager uses a local adaptive scoring engine, not a cloud model or
heavy neural network. Rules handle the browser mechanics, while a small learning
layer updates domain, category, cleanup, and workflow scores from user behavior.
This keeps the system private, debuggable, fast, and reversible.
