# IG Unfollowers

A beautiful, lightweight (~53KB), and secure browser-based utility that helps you identify Instagram accounts you are following but who do not follow you back.

> [!NOTE]
> This tool runs **completely client-side** in your active browser session. It does not require downloading any apps, sharing your credentials (username/password) with third-party sites, or registering for external services.

Created by [adrigo](https://adrigo.dev).

---

## ⚡ How It Works

1. **Self-Contained Bundle:** The project bundles and minifies the source files into a single self-executing JavaScript snippet using `esbuild` in virtually **~5ms**.
2. **Non-Destructive Overlay:** Unlike destructive scripts that clear the browser viewport, this utility injects a beautiful **glassmorphic card modal** directly on top of your active Instagram tab. Closing the modal immediately restores the background page state.
3. **GraphQL Queries:** The utility queries Instagram's internal GraphQL endpoints using your logged-in browser session cookies (`ds_user_id` and `csrftoken`), scanning your followed users and checking if they follow you back (reading the `follows_viewer` attribute).
4. **Local Storage Caching:** Saves the followings list in your browser's local cache. Re-running the script allows you to instantly reuse the cached list ("Use Cache") instead of triggering a full fresh network scan.
5. **Base64 Encapsulation:** The compiled script is encoded into a Base64 string and decoded at runtime using `atob()`. This encapsulates the script logic, preventing automated crawlers (like Google Safe Browsing) from performing static analysis of Instagram's API keywords on your landing page and triggering false-positive deceptive site warnings.

---

## 🚀 Getting Started

### 1. Build Environment & Requirements
- **Supported OS:** Linux, macOS, Windows
- **Node.js Version:** >= 18.0.0
- **Package Manager:** npm >= 9.0.0

```bash
# 1. Install lightweight devDependencies (esbuild & typescript)
npm install

# 2. Build TypeScript bundle & sync index.html / extension/index.min.js
npm run build

# 3. Render PNG icons & package store-ready extension.zip
npm run package:extension
```

* **`npm run build`**: Compiles and minifies TypeScript source files ([src/](./src/)) into [`extension/index.min.js`](./extension/index.min.js), reads `"version"` from `package.json`, automatically syncs version badges across [`public/index.html`](./public/index.html) and [`extension/manifest.json`](./extension/manifest.json), and injects the Base64 script using `esbuild` and `scripts/update-html.js`.
* **`npm run package:extension`**: Executes `npm run build`, runs `scripts/create-extension-icons.js` to render crisp active & dark PNG icons from [`src/assets/icon.svg`](./src/assets/icon.svg), and zips `extension.zip` in the project root.

---

### 2. Open the UI
Open the generated landing page directly in your browser:
*   [public/index.html](./public/index.html)

This page features a modern glassmorphic look, including a CSS-only visual mockup of the modal overlay, direct links to Chrome Web Store and Firefox Add-ons, and a Code copy panel.

### 3. Run on Instagram
Once you open `public/index.html` in your browser:

#### Option A: Official Extension (Chrome, Edge, Brave, Firefox)
- **Chrome / Edge / Brave / Kiwi Browser (Android):** Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/ig-unfollowers/lejidbigpihdfpeomhfjlgnhjjeicdkk) or load unpacked extension from [`extension/`](./extension).
- **Firefox:** Install from [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/ig-unfollowers/) or load temporary add-on via `about:debugging`.

#### Option B: Developer Console (Manual Execution)
1. Click **Copy Code** on the landing page to copy the script bundle.
2. Go to [instagram.com](https://www.instagram.com) and log into your account.
3. Open your browser console (press `F12` or `Ctrl+Shift+J` on Windows, `Cmd+Option+I` on Mac).
4. Paste the copied code and press **Enter**.

---

## 🎨 Asset Management & Master Icon

All vector assets live in `src/assets/`. **`src/assets/icon.svg`** serves as the single source of truth for the project's logo and favicon.

When you run `npm run package:extension`, the build pipeline automatically:
* Syncs `src/assets/icon.svg` to [`public/favicon.svg`](./public/favicon.svg).
* Renders crisp active (`icon*.png`) and dark (`icon*-dark.png`) PNG icon variants in [`extension/`](./extension) for active browser tab state detection.
* Packages `extension.zip` in your root project folder ready for web store upload.

---

## 🛠️ Features

* **Single-Source Automated Versioning:** Uses `package.json` as the single source of truth, automatically syncing version badges across the extension popup, injected overlay, and landing page during `npm run build`.
* **Mobile Responsive UI:** Includes a collapsible **Filters & Options** drawer, full-width search input, single-line header counts, text ellipsis truncation (`...`), and fixed unfollow button vertical alignment for phone screens.
* **Local Storage Caching & Humanized Age:** Stores scanned results locally in `localStorage` and formats cache age dynamically (e.g. `1 day, 2 hours and 10 mins ago`).
* **Cache Export & Import (Cross-Device Migration):** Export your full cache state as a JSON file (`iu_cache_<user_id>.json`) and import it onto any other browser or computer to move your scan history without re-scanning. Note: Imported files must be a valid JSON file previously exported by this tool (containing `timestamp` and `users`).
* **Sidebar Quick Controls:** Instant **New Scan**, **Grid View**, **Import**, and **Export** actions accessible right from the sidebar.
* **Sequential Bulk Unfollow:** Select multiple users and unfollow them sequentially with a dedicated pause/cancel progress banner.
* **Randomized Timing Delays (Anti-Spam):** Pauses requests with a random timing jitter between `2.0s` and `3.5s` to mimic human pacing and prevent automated bot detection.
* **Auto-Pause on Rate Limits:** Intercepts HTTP 429 (Too Many Requests) errors from Instagram, automatically pausing the bulk loop and prompting the user to wait instead of letting subsequent requests fail.
* **Network Scan Abort Safety:** Closing the modal immediately calls `abort()` on an active `AbortController`, halting background GraphQL calls and avoiding rate limits.
* **Page Exit Protection:** Warns the user if they try to close or refresh the tab during an active bulk unfollow process to prevent accidental progress loss.
* **Custom Layouts:** Toggle between a detailed List View or a compact Grid View.
* **Detailed Statistics Bar:** View live counts of Non-followers, Followers, Verified profiles, and Private accounts at a glance.
* **Sorting & Filtering:** Sort by Username (A-Z/Z-A), Private First, or Verified First. Filter list by Non-followers, Followers, New Unfollowers, and Verified tags.

---

## ⚠️ Safety & Guidelines

> [!WARNING]
> **Use Moderately:** Interacting with private APIs too quickly can flag your account. We recommend running scans no more than once every 10-15 minutes, and unfollowing users in moderation.

> [!TIP]
> **Audit Friendly:** The code contains zero external dependencies or remote script calls. You can easily audit [src/api.ts](./src/api.ts) to verify that no data is ever stored, collected, or transmitted to third-party servers.

> [!NOTE]
> **Console Warnings (Safely Ignore):** When executing this tool on `instagram.com`, you might notice pre-existing warning logs in your browser's developer console (e.g., `ignoring invalid endpoint URL '/security/coop_report/'` or rejected `th_eu_pref` cookies). **These are native Instagram/Meta server messages** (they appear even before this script is executed) caused by their tracking systems or header misconfigurations. They are completely normal and safe to ignore.

---

## 📁 Code Structure

```
├── extension/             # Unpacked Chrome/Firefox browser extension files
│   ├── background.js      # Background service worker for dynamic toolbar icon state
│   ├── manifest.json      # Cross-browser Manifest V3 configuration
│   ├── popup.html         # Extension popup interface
│   └── popup.js           # Extension controller & live tab navigation listener
├── public/
│   ├── favicon.svg        # Synced automatically from src/assets/icon.svg
│   └── index.html         # Redesigned glassmorphic landing page template
├── scripts/
│   ├── create-extension-icons.js # Syncs master SVG and generates active/dark PNGs
│   └── update-html.js     # Post-build script to inject code into index.html
├── src/
│   ├── assets/            # Master SVG vector assets (icon, badges, filters)
│   ├── api.ts             # GraphQL fetches, cookie readers, unfollow POST actions
│   ├── index.ts           # Entry orchestrator, overlay modal builder, scroll locks
│   ├── styles.css         # CSS style sheet containing the glassmorphism system
│   ├── svg.d.ts           # TypeScript module declarations for SVG imports
│   ├── types.ts           # TypeScript interfaces (UserNode, CacheData)
│   └── ui.ts              # Core list drawing, event delegation, search/filters, bulk loops
├── tsconfig.json          # TypeScript configuration options
└── package.json           # Dev scripts & dependencies (esbuild + typescript)
```

---

## 💖 Acknowledgements & Inspiration

This project was inspired by the original [InstagramUnfollowers](https://github.com/davidarroyo1234/InstagramUnfollowers) script by [davidarroyo1234](https://github.com/davidarroyo1234). 

This version by [adrigo](https://github.com/adrigo) refactors the entire logic, migrates the project to TypeScript + `esbuild`, replaces the full-page Preact/SCSS layout with a non-destructive glassmorphic modal overlay, and introduces critical anti-spam safety features (timing jitters, rate-limit auto-pausing, and active scan aborting).

---

## ⚖️ License

MIT License. Feel free to customize and redistribute.
