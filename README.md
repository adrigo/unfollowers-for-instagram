# IG Unfollowers

A beautiful, lightweight (~30KB), and secure browser-based utility that helps you identify Instagram accounts you are following but who do not follow you back. 

> [!NOTE]
> This tool runs **completely client-side** in your active browser session. It does not require downloading any apps, sharing your credentials (username/password) with third-party sites, or registering for external services.

Created by [adrigo](https://adrigo.dev).

---

## ⚡ How It Works

1. **Self-Contained Bundle:** The project bundles and minifies the source files into a single self-executing JavaScript snippet using `esbuild` in virtually **~5ms**.
2. **Non-Destructive Overlay:** Unlike destructive scripts that clear the browser viewport, this utility injects a beautiful **glassmorphic card modal** directly on top of your active Instagram tab. Closing the modal immediately restores the background page state.
3. **GraphQL Queries:** The utility queries Instagram's internal GraphQL endpoints using your logged-in browser session cookies (`ds_user_id` and `csrftoken`), scanning your followed users and checking if they follow you back (reading the `follows_viewer` attribute).
4. **Local Storage Caching:** Saves the followings list in your browser's local cache. Re-running the script allows you to instantly reuse the cached list ("Use Cache") instead of triggering a full fresh network scan.
5. **Base64 Encapsulation:** The compiled script is encoded into a Base64 string and decoded at runtime using `atob()`. This encapsulates the bookmarklet logic, preventing automated crawlers (like Google Safe Browsing) from performing static analysis of Instagram's API keywords on your landing page and triggering false-positive deceptive site warnings.

---

## 🚀 Getting Started

### 1. Build the Code
To compile the source code and generate the final copy-pasteable script, you must have [Node.js](https://nodejs.org) installed.

```bash
# Install lightweight devDependencies
npm install

# Run the production build
npm run build
```

This will:
* Bundle and minify the TypeScript files (`src/`) into `dist/index.min.js`.
* Run [scripts/update-html.js](./scripts/update-html.js) to Base64-encode the bundle and automatically inject the resulting string into the static landing page ([public/index.html](./public/index.html)) to encapsulate the script code.

### 2. Open the UI
Open the generated landing page directly in your browser:
*   [public/index.html](./public/index.html)

This page features a modern glassmorphic look, including a CSS-only visual mockup of the modal overlay, clear execution steps, a draggable Bookmarklet button, and a Code copy panel.

### 3. Run on Instagram
Once you open `public/index.html` in your browser:

> [!IMPORTANT]
> **Mobile Browser Support:** Currently, we have not found a reliable way to execute this utility on mobile devices (due to mobile browser sandbox restrictions on `javascript:` URL execution and Instagram's strict Content Security Policy). We are actively researching a solution. For now, please use a desktop browser.

#### Option A: Bookmarklet (Recommended)
1. **Drag** the **Unfollowers Bookmarklet** button to your browser's Bookmarks Bar (press `Ctrl+Shift+B` or `Cmd+Shift+B` on Mac if hidden).
2. Go to [instagram.com](https://www.instagram.com) and log into your account.
3. **Click** the bookmarklet in your bookmarks bar. The overlay modal will slide in instantly.

#### Option B: Developer Console
1. Click **Copy Code** on the landing page to copy the script bundle.
2. Go to [instagram.com](https://www.instagram.com) and log in.
3. Open your browser console (press `F12` or `Ctrl+Shift+J` on Windows, `Cmd+Option+I` on Mac).
4. Paste the copied code and press **Enter**.

---

## 🛠️ Features

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
* **Sorting & Filtering:** Sort by Username (A-Z/Z-A), Private First, or Verified First. Filter list by Non-followers, Followers, and Verified tags.

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
├── public/
│   └── index.html          # Redesigned glassmorphic landing page template
├── scripts/
│   └── update-html.js      # Post-build script to inject code into index.html
├── src/
│   ├── api.ts              # GraphQL fetches, cookie readers, unfollow POST actions
│   ├── index.ts            # Entry orchestrator, overlay modal builder, scroll locks
│   ├── styles.ts           # CSS style sheet containing the glassmorphism system
│   ├── types.ts            # TypeScript interfaces (UserNode, CacheData)
│   └── ui.ts               # Core list drawing, event delegation, search/filters, bulk loops
├── tsconfig.json           # TypeScript configuration options
└── package.json            # Dev scripts & dependencies (esbuild + typescript)
```

---

## 💖 Acknowledgements & Inspiration

This project was inspired by the original [InstagramUnfollowers](https://github.com/davidarroyo1234/InstagramUnfollowers) script by [davidarroyo1234](https://github.com/davidarroyo1234). 

This version by [adrigo](https://github.com/adrigo) refactors the entire logic, migrates the project to TypeScript + `esbuild`, replaces the full-page Preact/SCSS layout with a non-destructive glassmorphic modal overlay, and introduces critical anti-spam safety features (timing jitters, rate-limit auto-pausing, and active scan aborting).

---

## ⚖️ License

MIT License. Feel free to customize and redistribute.
