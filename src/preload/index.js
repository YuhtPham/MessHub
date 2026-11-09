const { contextBridge, ipcRenderer, webFrame } = require('electron');
const { buildPageInjection } = require('./page-injection');

contextBridge.exposeInMainWorld('messHub', {
  sendProfileInfo: (info) => ipcRenderer.send('profile-info-extracted', info),
});

const settings = ipcRenderer.sendSync('get-settings');

webFrame.executeJavaScript(buildPageInjection(settings));

ipcRenderer.on('update-shield-setting', (event, newSettings) => {
  webFrame.executeJavaScript(`
    window.__MessHubZaDarkShield = ${!!newSettings.zadarkShield};
    var style = document.getElementById('messhub-zadark-style');
    if (!window.__MessHubZaDarkShield && style) style.remove();
    console.log('[MessHub] Cập nhật giao diện bảo vệ:', window.__MessHubZaDarkShield);
  `);
});

ipcRenderer.on('update-quick-replies', (event, replies) => {
  webFrame.executeJavaScript(`
    window.__MessHubQuickReplies = ${JSON.stringify(replies)};
    console.log('[MessHub] Cập nhật tin nhắn mẫu:', window.__MessHubQuickReplies.length, 'mẫu');
  `);
});

let lastUnreadCount = -1;
let badgeUpdateTimer = null;

function readUnreadCount() {
  const titleMatch = (document.title || '').match(/\((\d+)\)/);
  if (titleMatch) return Number(titleMatch[1]);

  const hostname = window.location.hostname || '';
  const unreadSelector = hostname.includes('zalo.me')
    ? '.tab-unread, .nav__tabs__item .badge'
    : hostname.includes('messenger.com') || hostname.includes('facebook.com')
      ? 'a[href*="messages"] span, [role="navigation"] em, ._51th'
      : '';
  const unreadElement = unreadSelector && document.querySelector(unreadSelector);
  const count = Number.parseInt(unreadElement?.textContent?.trim() || '0', 10);

  return Number.isFinite(count) ? Math.max(0, count) : 0;
}

function sendUnreadCountIfChanged() {
  const count = readUnreadCount();
  if (count === lastUnreadCount) return;

  lastUnreadCount = count;
  ipcRenderer.send('profile-badge-updated', count);
}

function scheduleUnreadCountUpdate() {
  clearTimeout(badgeUpdateTimer);
  badgeUpdateTimer = setTimeout(sendUnreadCountIfChanged, 500);
}

sendUnreadCountIfChanged();
setInterval(sendUnreadCountIfChanged, 6000);

const titleElement = document.querySelector('title');
if (titleElement) {
  new MutationObserver(scheduleUnreadCountUpdate).observe(titleElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}
