/**
 * Unfollowers for Instagram - Background Service Worker
 * Manages active tab status detection and dynamic toolbar icon state.
 */

function isInstagramUrl(url) {
  if (!url) return false;
  try {
    const { hostname } = new URL(url);
    return hostname === 'www.instagram.com' || hostname === 'instagram.com';
  } catch {
    return false;
  }
}

async function updateActionIcon(tabId, url) {
  if (!tabId) return;
  const active = isInstagramUrl(url);
  const iconPath = active
    ? { "16": "icon16.png", "48": "icon48.png", "128": "icon128.png" }
    : { "16": "icon16-dark.png", "48": "icon48-dark.png", "128": "icon128-dark.png" };

  try {
    await chrome.action.setIcon({ tabId, path: iconPath });
  } catch (err) {
    // Ignore invalid tab state errors
  }
}

async function syncAllTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id && tab.url) {
        await updateActionIcon(tab.id, tab.url);
      }
    }
  } catch (err) { }
}

// Initial tab icon synchronization on worker startup
syncAllTabs();

chrome.runtime.onInstalled.addListener(syncAllTabs);
chrome.runtime.onStartup.addListener(syncAllTabs);

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab && tab.url) {
      await updateActionIcon(activeInfo.tabId, tab.url);
    }
  } catch (err) { }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const currentUrl = changeInfo.url || tab?.url;
  if (currentUrl) {
    updateActionIcon(tabId, currentUrl);
  }
});
