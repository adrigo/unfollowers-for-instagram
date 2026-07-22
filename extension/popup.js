/**
 * IG Unfollowers - Popup Controller
 * Manages active tab status detection, script injection, and live tab navigation sync.
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

document.addEventListener('DOMContentLoaded', async () => {
  const statusCard = document.getElementById('status-card');
  const launchBtn = document.getElementById('launch-btn');
  let activeTab = null;

  async function checkTabStatus() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      activeTab = tab;

      statusCard.replaceChildren();

      if (tab && isInstagramUrl(tab.url)) {
        statusCard.className = 'status-card on-ig';

        const strong = document.createElement('strong');
        strong.textContent = 'Instagram tab detected!';
        const br = document.createElement('br');
        const textNode = document.createTextNode('Click below to launch overlay.');

        statusCard.appendChild(strong);
        statusCard.appendChild(br);
        statusCard.appendChild(textNode);
        launchBtn.disabled = false;
      } else {
        statusCard.className = 'status-card';

        const textPrefix = document.createTextNode('Please navigate to ');
        const a = document.createElement('a');
        a.id = 'nav-ig-link';
        a.href = 'https://www.instagram.com';
        a.target = '_blank';
        a.textContent = 'instagram.com';
        const textSuffix = document.createTextNode(' in your active tab first, then click this extension.');

        statusCard.appendChild(textPrefix);
        statusCard.appendChild(a);
        statusCard.appendChild(textSuffix);

        launchBtn.disabled = true;

        a.addEventListener('click', async (e) => {
          e.preventDefault();
          if (activeTab && activeTab.id) {
            await chrome.tabs.update(activeTab.id, { url: 'https://www.instagram.com' });
          } else {
            await chrome.tabs.create({ url: 'https://www.instagram.com' });
          }
        });
      }
    } catch (err) {
      console.error('Failed to check tab status:', err);
    }
  }

  // Initial check
  await checkTabStatus();

  // Launch overlay script into active Instagram tab
  launchBtn.addEventListener('click', async () => {
    if (!activeTab || !activeTab.id) return;
    try {
      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ['index.min.js']
      });
      window.close();
    } catch (err) {
      console.error('Failed to inject script:', err);
      alert('Failed to launch scanner. Please refresh instagram.com and try again.');
    }
  });

  // Listen for live tab navigation while popup is open
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url || changeInfo.status === 'complete') {
      checkTabStatus();
    }
  });

  chrome.tabs.onActivated.addListener(() => {
    checkTabStatus();
  });
});
