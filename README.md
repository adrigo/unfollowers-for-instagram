# Unfollowers for Instagram (UIG)

A beautiful, lightweight (~58KB, ~15KB gzipped), and secure browser-based utility that helps you identify accounts you are following but who do not follow you back.

> [!NOTE]
> This tool runs **completely client-side** in your active browser session. It does not require downloading any apps, sharing your credentials (username/password) with third-party sites, or registering for external services.
>
> **Unfollowers for Instagram is an independent project and is not affiliated with, endorsed by, or associated with Instagram™ or Meta Platforms, Inc. Instagram™ is a trademark of Meta Platforms, Inc.**

Created by [adrigo](https://adrigo.dev).

---

## ⚡ How It Works

1. **Self-Contained Bundle:** The project bundles and minifies the source files into a single self-executing JavaScript snippet using `esbuild` in **~5ms**.
2. **Non-Destructive Overlay:** Unlike destructive scripts that clear the browser viewport, this utility injects a beautiful **glassmorphic card modal** directly on top of your active Instagram tab. Closing the modal immediately restores the background page state.
3. **2-Phase REST API Scanning:** Instagram has deprecated its internal GraphQL endpoints for friendship queries. The utility now queries Instagram's private REST API v1 (`/api/v1/friendships/`) in two sequential phases (Phase 1: Following list, Phase 2: Followers list) using your active session cookies (`ds_user_id` and `csrftoken`).
4. **Stable Pagination:** The following list is requested ordered by follow date (`order=date_followed_latest`). Instagram's default ranking can reshuffle mid-scan, which made its offset-based pagination silently skip accounts. With this order, Instagram currently returns the **entire following list in a single response** (e.g. 1,474 accounts in 1 request), so no page size is sent for it. The followers list has no ordering option and is served in small pages of ~20–25 accounts regardless of the requested size (e.g. 794 followers in 35 requests), so it accounts for nearly all of the scan time.
5. **Local Storage Caching:** Saves the followings list in your browser's local cache. Re-running the script allows you to instantly reuse the cached list ("Use Cache") instead of triggering a full fresh network scan. Comparing a fresh scan against the cache flags **new unfollowers**.

> [!IMPORTANT]
> **GraphQL Endpoint Deprecation & 2-Phase Scanning:** Instagram deprecated its internal GraphQL endpoints for friendship lists. The scanner now operates via Instagram REST API v1 in **2 sequential phases**:
> 1. **Phase 1 (Following List):** Fetches the full list of accounts you follow.
> 2. **Phase 2 (Followers List):** Fetches your followers list to compare and determine followback status (`followsViewer`).
>
> **Note on Speed:** Because both lists must be fetched sequentially with anti-spam rate limiting, full network scans take slightly longer to complete safely than before. However, local storage caching allows instant re-runs without repeating full network scans.

---

## 🚀 Getting Started

### 1. Build Environment & Requirements
- **Supported OS:** Linux, macOS, Windows
- **Node.js Version:** >= 22.12.0 (24 LTS recommended, see `.nvmrc`)
- **Package Manager:** npm >= 9.0.0

```bash
# 1. Install lightweight devDependencies (esbuild, typescript, biome, vitest & @resvg/resvg-js)
npm install

# 2. Build TypeScript bundle & sync index.html / extension/index.min.js
npm run build

# 3. Render PNG icons & package store-ready extension.zip
npm run package:extension
```

* **`npm run package:extension`**: Executes `npm run build`, runs `scripts/create-extension-icons.js` to render PNG icons, bundles `source-code.zip` for Firefox source code review, and packages store-ready `extension.zip` in the root folder.
* **`npm run typecheck`** / **`npm run lint`**: Type-check with `tsc` and check linting, formatting, and import order with [Biome](https://biomejs.dev). Both run automatically before every `npm run build`.
* **`npm test`**: Run the [Vitest](https://vitest.dev) unit tests in `tests/` (cache merging, import validation, ID normalization, progress estimates, filtering, and sorting). Also runs before every `npm run build`.
* **`npm run format`**: Apply Biome lint fixes, formatting, and import sorting.
* **`npm run package:source`**: Generates `source-code.zip` containing all original TypeScript source files and build configurations (excluding `node_modules` and compiled assets) required for store source code reviews.

---

### 2. Open the UI
Open the generated landing page directly in your browser:
*   [public/index.html](./public/index.html)

This page features a modern glassmorphic look, including a CSS-only visual mockup of the modal overlay and direct links to Chrome Web Store and Firefox Add-ons.

### 3. Run on Instagram
Once you open `public/index.html` in your browser:

#### Option A: Official Extension (Chrome, Edge, Brave, Firefox)
- **Chrome / Edge / Brave / Kiwi Browser (Android):** Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/unfollowers-for-instagram/lejidbigpihdfpeomhfjlgnhjjeicdkk) or load unpacked extension from [`extension/`](./extension).
- **Firefox:** Install from [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/unfollowers-for-instagram/) or load temporary add-on via `about:debugging`.

> [!NOTE]
> **Firefox site access:** Firefox lets users turn off an extension's access to `www.instagram.com` (`about:addons` → extension → Permissions). The scanner still launches without it, but the toolbar icon can't detect Instagram tabs. The popup shows an **Allow access to instagram.com** button when access is missing.

#### Option B: Developer Console (Manual Execution)
1. Run `npm run build` and copy the contents of `dist/index.min.js`.
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
* **Randomized Timing Delays (Anti-Spam):** Applies a randomized timing jitter (`300ms`–`600ms` per page for REST API scans, and `2.0s`–`3.5s` per unfollow) to mimic human pacing and prevent automated security checkpoints.
* **Scan Retries with Backoff:** Rate limits (HTTP 429), server errors, and network drops during a scan are retried after waiting 30s, 60s, then 120s, with the wait shown in the scanner.
* **Rescan Cooldown Warning:** Pressing **New Scan** within 15 minutes of the last scan asks for confirmation first, offering the cached results instead, since frequent scans are what get web sessions temporarily blocked.
* **Blocked Scan Detection:** When Instagram refuses a list request by redirecting it (usually after several scans in a short time), the scan stops without retrying and explains that you should wait a few hours, offering your cached results instead.
* **Auto-Pause on Rate Limits:** Intercepts HTTP 429 (Too Many Requests) errors from Instagram, automatically pausing the bulk loop and prompting the user to wait instead of letting subsequent requests fail.
* **Incomplete Scan Warning:** Shows a warning above the list when Instagram stops returning the followers list early, since missing followers would otherwise appear as non-followers.
* **Estimated Scan Progress:** Instagram doesn't expose your follower/following counts to web scripts, so the progress bar estimates them from your previous scan (or an estimate curve on the first scan) and completes each phase when its list actually ends, with a live count of scanned accounts. Because the following list arrives in a single request, it takes the first 5% of the bar and the followers list the remaining 95%.
* **New Unfollower Detection:** Accounts that followed you in the previous scan but no longer do are flagged with a badge and can be filtered.
* **Fans List:** See the accounts that follow you but you don't follow back, built from the already-scanned followers list with no extra requests. Fans are hidden by default, can't be selected for unfollowing, and accounts you unfollow that still follow you move into this list.
* **Network Scan Abort Safety:** Closing the modal immediately calls `abort()` on an active `AbortController`, halting background API calls and avoiding rate limits.
* **Page Exit Protection:** Warns the user if they try to close or refresh the tab during an active bulk unfollow process to prevent accidental progress loss.
* **Custom Layouts:** Toggle between a detailed List View or a compact Grid View.
* **Detailed Statistics Bar:** View live counts of Non-followers, Followers, Verified profiles, and Private accounts at a glance.
* **Sorting & Filtering:** Sort by Recently Unfollowed, Username (A-Z/Z-A), Private First, or Verified First. Filter list by New Unfollowers, Non-followers, Followers, Fans, Verified, and Private tags.
* **Safe Rendering:** All Instagram profile data and imported values are HTML-escaped before rendering, and imported backups are strictly validated (numeric IDs, valid usernames, `https://` avatar URLs).

---

## ⚠️ Safety & Guidelines

> [!WARNING]
> **Use Moderately:** Interacting with private APIs too quickly can flag your account. We recommend running scans no more than once every 10-15 minutes, and unfollowing users in moderation.

> [!TIP]
> **Humanized Request Pacing:** REST API pagination queries automatically apply a 300ms–600ms randomized delay per page (Instagram serves up to 25 users per page). This prevents burst request spikes and protects your account against automated security checkpoints.

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
│   ├── create-source-zip.js # Bundles source-code.zip for store source reviews
│   └── update-html.js     # Post-build script: syncs version and copies bundle to extension/
├── src/
│   ├── assets/            # Master SVG vector assets (icon, badges, filters)
│   ├── api.ts             # REST API scan with retries, cookie readers, unfollow POST actions
│   ├── css.d.ts           # TypeScript module declarations for CSS imports
│   ├── filters.ts         # Pure list filtering and sorting helpers
│   ├── index.ts           # Entry orchestrator, overlay modal builder, scroll locks
│   ├── progress.ts        # Scan progress estimates from the previous scan
│   ├── storage.ts         # LocalStorage cache, import validation, new-unfollower merge
│   ├── styles.css         # CSS style sheet containing the glassmorphism system
│   ├── svg.d.ts           # TypeScript module declarations for SVG imports
│   ├── types.ts           # TypeScript interfaces (UserNode, CacheData, API responses)
│   └── ui.ts              # Core list drawing, event delegation, search/filters, bulk loops
├── tests/                 # Vitest unit tests for storage, filters, and API helpers
├── tsconfig.json          # TypeScript configuration options
└── package.json           # Dev scripts & dependencies (esbuild + typescript + resvg)
```

---

## 💖 Acknowledgements & Inspiration

This project was inspired by the original [InstagramUnfollowers](https://github.com/davidarroyo1234/InstagramUnfollowers) script by [davidarroyo1234](https://github.com/davidarroyo1234). 

This version by [adrigo](https://github.com/adrigo) refactors the entire logic, migrates the project to TypeScript + `esbuild`, replaces the full-page Preact/SCSS layout with a non-destructive glassmorphic modal overlay, and introduces critical anti-spam safety features (timing jitters, rate-limit auto-pausing, and active scan aborting).

---

## ⚖️ License

MIT License. Feel free to customize and redistribute.
