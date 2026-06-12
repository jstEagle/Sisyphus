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

## Install The Latest Build

The easiest path is the GitHub-built zip:

1. Download
   [`sisyphus-extension.zip`](https://github.com/jstEagle/Sisyphus/releases/latest/download/sisyphus-extension.zip).
2. Unzip it somewhere you will not delete, such as `~/Applications/Sisyphus`.
3. Open `chrome://extensions` in Chrome, Helium, or another Chromium browser.
4. Enable **Developer mode**.
5. Click **Load unpacked**.
6. Select the unzipped folder.

When a new stable build is pushed to `main`, GitHub rebuilds the extension and
updates that zip.

## Install From Source

1. Run `npm install`.
2. Run `npm run build`.
3. Open `chrome://extensions`.
4. Enable Developer mode.
5. Choose **Load unpacked**.
6. Select the `dist` folder.

## Agent Download Instructions

Agents should use the latest release zip when they only need the built
extension:

```bash
curl -L \
  https://github.com/jstEagle/Sisyphus/releases/latest/download/sisyphus-extension.zip \
  -o sisyphus-extension.zip
unzip -o sisyphus-extension.zip -d sisyphus-extension
```

Agents should use source when they need to edit or rebuild:

```bash
git clone https://github.com/jstEagle/Sisyphus.git
cd Sisyphus
npm ci
npm run build
```

The loadable unpacked extension folder is then `dist`.

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

To create the same zip locally:

```bash
npm run package
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
