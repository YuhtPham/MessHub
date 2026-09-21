// ============================================================
//  Ứng dụng MessHub Desktop
//  Nhân: Chromium (Google Chrome)
//  Tác giả: Nguyễn Đình Thọ
//  [FIXED VERSION] - Loại bỏ lỗi, tối ưu hóa code
// ============================================================

const {
  app,
  BrowserWindow,
  BrowserView,
  shell,
  session,
  Menu,
  MenuItem,
  Tray,
  globalShortcut,
  ipcMain,
  nativeImage,
  nativeTheme,
  dialog,
  Notification,
} = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ZALO_URL = 'https://chat.zalo.me';
const APP_ID = 'com.zalo.desktop';
const SIDEBAR_WIDTH = 70;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) app.quit();
if (process.platform === 'win32') app.setAppUserModelId(APP_ID);

const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');
const DEFAULT_SETTINGS = {
  windowBounds: { width: 1200, height: 800 },
  startMinimized: false,
  autoLaunch: false,
  minimizeToTray: true,
  globalHotkey: 'Ctrl+Shift+M',
  currentTheme: 'default',
  isDarkMode: true,
  alwaysOnTop: false,
  blockSeen: true,
  blockTyping: true,
  zadarkShield: false,
  lockOnStartup: false,
  lockPasswordHash: '',
  lockSalt: '',
  quickReplies: [],
};

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(data) {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[Settings] Lỗi lưu settings:', err.message);
  }
}

const WORKSPACES_DIR = path.join(app.getPath('userData'), 'workspaces');
const WORKSPACE_INDEX_PATH = path.join(WORKSPACES_DIR, 'index.json');
const DEFAULT_WORKSPACE_DATA = {
  profiles: [],
  quickReplies: [],
  analyticsEvents: [],
};

function ensureDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    // Directory already exists
  }
}

function safeJsonRead(file, fallback) {
  try {
    return { ...fallback, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch {
    return { ...fallback };
  }
}

function safeJsonWrite(file, data) {
  ensureDir(path.dirname(file));
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[Workspace] Lỗi lưu workspace:', err.message);
  }
}

function normalizeWorkspaceData(data = {}) {
  return {
    profiles: Array.isArray(data.profiles) ? data.profiles : [],
    quickReplies: Array.isArray(data.quickReplies) ? data.quickReplies : [],
    analyticsEvents: Array.isArray(data.analyticsEvents) ? data.analyticsEvents.slice(-500) : [],
  };
}

function loadWorkspaceIndex() {
  ensureDir(WORKSPACES_DIR);
  let index = safeJsonRead(WORKSPACE_INDEX_PATH, { currentId: 'default', workspaces: [] });

  if (!Array.isArray(index.workspaces) || !index.workspaces.length) {
    index = {
      currentId: 'default',
      workspaces: [{ id: 'default', name: 'Workspace mặc định', createdAt: Date.now() }],
    };
    safeJsonWrite(WORKSPACE_INDEX_PATH, index);
  }

  if (!index.workspaces.some((w) => w.id === index.currentId)) {
    index.currentId = index.workspaces[0].id;
  }

  return index;
}

function getWorkspaceFile(id) {
  return path.join(WORKSPACES_DIR, id, 'data.json');
}

function loadWorkspaceData(id) {
  return normalizeWorkspaceData(safeJsonRead(getWorkspaceFile(id), DEFAULT_WORKSPACE_DATA));
}

function saveWorkspaceData(id, data) {
  safeJsonWrite(getWorkspaceFile(id), normalizeWorkspaceData(data));
}

function getWorkspaceState() {
  const index = loadWorkspaceIndex();
  const data = loadWorkspaceData(index.currentId);
  if (!data.quickReplies.length && settings.quickReplies?.length) {
    data.quickReplies = settings.quickReplies;
  }
  return { ...index, data };
}

function persistWorkspaceState(data) {
  const index = loadWorkspaceIndex();
  saveWorkspaceData(index.currentId, data);
  settings.quickReplies = normalizeWorkspaceData(data).quickReplies;
  saveSettings(settings);
  return getWorkspaceState();
}

function broadcastQuickReplies(replies) {
  for (const id in browserViews) {
    browserViews[id]?.webContents?.send('update-quick-replies', replies || []);
  }
}

let mainWindow = null;
let tray = null;
let settings = loadSettings();
let isQuitting = false;
let unreadCount = 0;
let browserViews = {};
let activeProfileId = null;
let isManualUpdateCheck = false; // ✅ Khai báo trước khi sử dụng

// ============================================================
// PERFORMANCE CONTROL
// ============================================================

const INACTIVE_VIEW_THROTTLE = true;
const NOTIFICATION_COOLDOWN_MS = 5000;
const BADGE_DEBOUNCE_MS = 300;

let badgeDebounceTimer = null;
let lastNativeNotificationAt = 0;
const lastProfileBadgeUpdate = {};

let proxyCredentials = {};
let appLocked = false;
let downloads = [];
let updateState = { status: 'idle', progress: 0, message: 'Sẵn sàng kiểm tra cập nhật.' };

function getBrowserView(id) {
  const view = browserViews[id];
  if (!view) return null;

  try {
    if (view.webContents.isDestroyed()) {
      delete browserViews[id];
      return null;
    }
  } catch {
    delete browserViews[id];
    return null;
  }

  return view;
}

function optimizeBrowserView(view, active = false) {
  if (!view || !view.webContents || view.webContents.isDestroyed()) return;

  try {
    view.webContents.setBackgroundThrottling(!active);
    view.webContents.audioMuted = !active;
  } catch {
    // Ignore errors
  }
}

function optimizeAllBrowserViews(activeId = null) {
  for (const [id, view] of Object.entries(browserViews)) {
    optimizeBrowserView(view, id === activeId);
  }
}

function detachBrowserView(view) {
  if (!mainWindow || !view) return;

  try {
    if (!mainWindow.isDestroyed()) {
      mainWindow.removeBrowserView(view);
    }
  } catch {
    try {
      mainWindow.setBrowserView(null);
    } catch {
      // Ignore
    }
  }
}

// ============================================================
// [FIX] Xóa bản trùng lặp của destroyBrowserView - chỉ giữ bản hoàn chỉnh
// ============================================================
function destroyBrowserView(id) {
  const view = browserViews[id];

  if (!view) return;

  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.removeBrowserView(view);
    }
  } catch (_) {
    // Ignore
  }

  try {
    if (view.webContents && !view.webContents.isDestroyed()) {
      view.webContents.stop();
      view.webContents.destroy();
    }
  } catch (_) {
    // Ignore
  }

  delete browserViews[id];
  delete lastProfileBadgeUpdate[id];
  delete globalProfileBadges[id]; // ✅ Thêm: Xóa badge để tránh memory leak

  if (activeProfileId === id) {
    activeProfileId = null;
  }
}

function destroyAllBrowserViews() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.setBrowserView(null);
    } catch {
      // Ignore
    }
  }

  for (const id of Object.keys(browserViews)) {
    const view = browserViews[id];

    try {
      if (view.webContents && !view.webContents.isDestroyed()) {
        view.webContents.stop();
        view.webContents.destroy();
      }
    } catch {
      // Ignore
    }
  }

  browserViews = {};
  activeProfileId = null;
}

function suspendBrowserViews() {
  for (const view of Object.values(browserViews)) {
    optimizeBrowserView(view, false);
  }
}

function resumeActiveBrowserView() {
  if (!activeProfileId) return;

  const view = getBrowserView(activeProfileId);

  if (!view) return;

  optimizeAllBrowserViews(activeProfileId);
}

function createBadgeIcon(count) {
  const size = 18;
  const text = count > 9 ? '9+' : String(count);
  const fontSize = count > 9 ? 9 : 11;
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#e74c3c"/><text x="${size / 2}" y="${size / 2 + fontSize / 3}" text-anchor="middle" fill="white" font-size="${fontSize}" font-weight="bold" font-family="Arial">${text}</text></svg>`;
  return nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
  );
}

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function setUpdateState(patch) {
  updateState = { ...updateState, ...patch };
  sendToRenderer('update-state', updateState);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex');
  return { salt, hash };
}

function verifyPassword(password) {
  if (!settings.lockPasswordHash || !settings.lockSalt) return false;
  return hashPassword(password, settings.lockSalt).hash === settings.lockPasswordHash;
}

function createTray() {
  const iconPath = path.join(__dirname, 'icon.png');
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } catch {
    trayIcon = nativeImage.createEmpty();
  }
  tray = new Tray(trayIcon);
  updateTrayMenu();
  tray.setToolTip('MessHub');
  tray.on('click', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    if (mainWindow.isVisible() && mainWindow.isFocused()) {
      suspendBrowserViews();
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
      resumeActiveBrowserView();
      updateBrowserViewBounds();
    }
  });
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function updateTrayMenu() {
  if (!tray) return;
  const contextMenu = Menu.buildFromTemplate([
    { label: '💬 Mở MessHub', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { label: '🔒 Khóa ứng dụng', click: lockApp },
    { type: 'separator' },
    {
      label: '🔄 Tải lại trang',
      click: () => activeProfileId && browserViews[activeProfileId]?.webContents.reload(),
    },
    {
      label: '🚀 Khởi động cùng Windows',
      type: 'checkbox',
      checked: settings.autoLaunch,
      click: (item) => toggleAutoLaunch(item.checked),
    },
    {
      label: '📌 Thu nhỏ xuống Tray khi đóng',
      type: 'checkbox',
      checked: settings.minimizeToTray,
      click: (item) => {
        settings.minimizeToTray = item.checked;
        saveSettings(settings);
      },
    },
    { type: 'separator' },
    {
      label: '🛡️ Bảo mật',
      submenu: [
        {
          label: 'Chặn hiển thị "Đã xem"',
          type: 'checkbox',
          checked: settings.blockSeen,
          click: (item) => toggleBlockSeen(item.checked),
        },
        {
          label: 'Chặn hiển thị "Đang nhập"',
          type: 'checkbox',
          checked: settings.blockTyping,
          click: (item) => toggleBlockTyping(item.checked),
        },
        {
          label: 'ZaDark Shield',
          type: 'checkbox',
          checked: settings.zadarkShield,
          click: (item) => toggleZadarkShield(item.checked),
        },
        {
          label: 'Khóa khi mở ứng dụng',
          type: 'checkbox',
          checked: settings.lockOnStartup,
          click: (item) => {
            settings.lockOnStartup = item.checked;
            saveSettings(settings);
          },
        },
      ],
    },
    { type: 'separator' },
    { label: '⬇️ Kiểm tra cập nhật', click: () => checkForUpdates(true) },
    { type: 'separator' },
    {
      label: '❌ Thoát hoàn toàn',
      click: () => {
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);
}

function broadcastBlockSettings() {
  const newSettings = {
    blockSeen: settings.blockSeen,
    blockTyping: settings.blockTyping,
    zadarkShield: settings.zadarkShield,
  };
  for (const id in browserViews) {
    browserViews[id]?.webContents?.send('update-block-settings', newSettings);
  }
  sendToRenderer('lock-state', {
    locked: appLocked,
    hasPassword: !!settings.lockPasswordHash,
    zadarkShield: settings.zadarkShield,
  });
}

function toggleBlockSeen(enable) {
  settings.blockSeen = enable;
  saveSettings(settings);
  broadcastBlockSettings();
}

function toggleBlockTyping(enable) {
  settings.blockTyping = enable;
  saveSettings(settings);
  broadcastBlockSettings();
}

function toggleZadarkShield(enable) {
  settings.zadarkShield = enable;
  saveSettings(settings);
  broadcastBlockSettings();
  updateTrayMenu();
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.logger = require('electron').app.isPackaged ? null : console;

  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Checking for update...');
    setUpdateState({ status: 'checking', progress: 0, message: 'Đang kiểm tra cập nhật...' });
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Update available:', info.version);
    setUpdateState({
      status: 'available',
      progress: 0,
      info,
      message: `Có bản cập nhật mới v${info.version}.`,
    });

    if (isManualUpdateCheck && mainWindow) {
      dialog
        .showMessageBox(mainWindow, {
          type: 'info',
          title: 'Cập nhật mới',
          message: `Có bản cập nhật mới v${info.version}!`,
          detail: 'Bạn có muốn tải và cài đặt ngay?',
          buttons: ['Tải xuống', 'Để sau'],
          defaultId: 0,
        })
        .then(({ response }) => {
          if (response === 0) {
            autoUpdater.downloadUpdate().catch((err) => {
              dialog.showErrorBox('Lỗi cập nhật', err.message || 'Không thể tải cập nhật.');
            });
            setUpdateState({ status: 'downloading', progress: 0, message: 'Đang tải cập nhật...' });
          }
        });
      isManualUpdateCheck = false;
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('[AutoUpdater] No update available. Current:', info.version);
    setUpdateState({
      status: 'idle',
      progress: 0,
      message: 'Bạn đang sử dụng phiên bản mới nhất.',
    });

    if (isManualUpdateCheck && mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Cập nhật',
        message: 'Bạn đang sử dụng phiên bản mới nhất.',
        detail: `Phiên bản hiện tại: v${app.getVersion()}`,
        buttons: ['OK'],
      });
    }
    isManualUpdateCheck = false;
  });

  autoUpdater.on('download-progress', (p) =>
    setUpdateState({
      status: 'downloading',
      progress: Math.round(p.percent || 0),
      message: `Đang tải cập nhật... ${Math.round(p.percent || 0)}%`,
    })
  );

  autoUpdater.on('update-downloaded', () => {
    console.log('[AutoUpdater] Update downloaded, ready to install.');
    setUpdateState({
      status: 'downloaded',
      progress: 100,
      message: 'Đã tải xong. Sẵn sàng cài đặt và khởi động lại.',
    });

    if (mainWindow) {
      dialog
        .showMessageBox(mainWindow, {
          type: 'info',
          title: 'Cập nhật sẵn sàng',
          message: 'Đã tải xong bản cập nhật.',
          detail: 'Khởi động lại ứng dụng để cài đặt?',
          buttons: ['Khởi động lại', 'Để sau'],
          defaultId: 0,
        })
        .then(({ response }) => {
          if (response === 0) {
            isQuitting = true;
            autoUpdater.quitAndInstall();
          }
        });
    }
  });

  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater] Error:', err);
    const msg =
      err == null
        ? 'Lỗi cập nhật không xác định.'
        : (err.message || err.toString()).split('\n')[0];
    setUpdateState({ status: 'error', message: msg });

    if (isManualUpdateCheck && mainWindow) {
      dialog.showErrorBox('Lỗi cập nhật', msg);
    }
    isManualUpdateCheck = false;
  });

  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 5000);
}

function checkForUpdates(manual = false) {
  isManualUpdateCheck = manual;
  autoUpdater.checkForUpdates().catch((err) =>
    setUpdateState({ status: 'error', message: (err.message || err.toString()).split('\n')[0] })
  );
}

function toggleAutoLaunch(enable) {
  settings.autoLaunch = enable;
  saveSettings(settings);
  app.setLoginItemSettings({ openAtLogin: enable, path: app.getPath('exe') });
}

// ============================================================
// BROWSER VIEW PERFORMANCE MANAGEMENT
// ============================================================

function throttleInactiveBrowserViews() {
  for (const [id, view] of Object.entries(browserViews)) {
    if (!view || view.webContents.isDestroyed()) continue;

    try {
      const isActive = id === activeProfileId;

      view.webContents.setBackgroundThrottling(isActive ? false : INACTIVE_VIEW_THROTTLE);

      if (!isActive && mainWindow) {
        try {
          if (mainWindow.getBrowserViews().includes(view)) {
            mainWindow.removeBrowserView(view);
          }
        } catch (_) {
          // Ignore
        }
      }
    } catch (err) {
      console.warn(`[Performance] Không thể throttle BrowserView ${id}:`, err.message);
    }
  }
}

function detachAllInactiveBrowserViews() {
  if (!mainWindow) return;

  for (const [id, view] of Object.entries(browserViews)) {
    if (!view || view.webContents.isDestroyed()) continue;
    if (id === activeProfileId) continue;

    try {
      mainWindow.removeBrowserView(view);
    } catch (_) {
      // Ignore
    }

    try {
      view.webContents.setBackgroundThrottling(true);
    } catch (_) {
      // Ignore
    }
  }
}

function destroyInactiveBrowserViewsExcept(keepId) {
  for (const id of Object.keys(browserViews)) {
    if (id === keepId) continue;
    destroyBrowserView(id);
  }
}

function updateBrowserViewBounds() {
  if (!mainWindow || mainWindow.isDestroyed() || !activeProfileId) return;

  const view = getBrowserView(activeProfileId);

  if (!view) return;

  const bounds = mainWindow.getContentBounds();

  view.setBounds({
    x: SIDEBAR_WIDTH,
    y: 0,
    width: Math.max(bounds.width - SIDEBAR_WIDTH, 0),
    height: Math.max(bounds.height, 0),
  });

  view.setAutoResize({
    width: true,
    height: true,
  });
}

function isInternalUrl(url) {
  return [
    'chat.zalo.me',
    'id.zalo.me',
    'messenger.com',
    'facebook.com',
    'web.whatsapp.com',
    'whatsapp.com',
    'teams.microsoft.com',
    'microsoft.com',
    'live.com',
    'office.com',
    'google.com',
    'gmail.com',
    'web.telegram.org',
    'telegram.org',
    't.me',
    'tiktok.com',
  ].some((d) => url.includes(d));
}

function setupWebContents(contents, profileId) {
  contents.setWindowOpenHandler(({ url }) => {
    if (url === 'about:blank' || url.startsWith('blob:') || url.startsWith('file:')) {
      return { action: 'allow' };
    }
    if (isInternalUrl(url)) {
      return { action: 'allow' };
    }
    let finalUrl = url;
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://') && !finalUrl.startsWith('mailto:')) {
      finalUrl = 'https://' + finalUrl;
    }
    shell.openExternal(finalUrl).catch((err) => console.error('[Main] Lỗi mở external link:', finalUrl, err));
    return { action: 'deny' };
  });

  contents.on('will-navigate', (event, url) => {
    if (isInternalUrl(url)) return;
    event.preventDefault();
    let finalUrl = url;
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://') && !finalUrl.startsWith('mailto:')) {
      finalUrl = 'https://' + finalUrl;
    }
    shell.openExternal(finalUrl).catch((err) => console.error('[Main] Lỗi mở external link:', finalUrl, err));
  });

  contents.on('context-menu', (event, params) => {
    const menu = new Menu();
    if (params.selectionText) menu.append(new MenuItem({ label: '📋 Sao chép', role: 'copy' }));
    if (params.isEditable) {
      menu.append(new MenuItem({ label: '📋 Dán', role: 'paste' }));
      menu.append(new MenuItem({ label: '✂️ Cắt', role: 'cut' }));
      menu.append(new MenuItem({ label: '📝 Chọn tất cả', role: 'selectAll' }));
    }
    if (params.linkURL) {
      menu.append(new MenuItem({ type: 'separator' }));
      menu.append(new MenuItem({ label: '🔗 Mở liên kết', click: () => shell.openExternal(params.linkURL) }));
      menu.append(new MenuItem({
        label: '📋 Sao chép liên kết',
        click: () => require('electron').clipboard.writeText(params.linkURL),
      }));
    }
    if (params.mediaType === 'image') {
      menu.append(new MenuItem({ type: 'separator' }));

      menu.append(
        new MenuItem({
          label: '📋 Sao chép hình ảnh',
          click: () => {
            contents.copyImageAt(params.x, params.y);
          },
        })
      );

      menu.append(
        new MenuItem({
          label: '💾 Lưu ảnh',
          click: () => {
            contents.downloadURL(params.srcURL);
          },
        })
      );
    }
    menu.append(new MenuItem({ type: 'separator' }));
    menu.append(new MenuItem({ label: '🔄 Tải lại trang', click: () => contents.reload() }));
    menu.append(new MenuItem({
      label: '◀️ Quay lại',
      enabled: contents.canGoBack(),
      click: () => contents.goBack(),
    }));
    if (menu.items.length > 0) menu.popup({ window: mainWindow });
  });

  contents.on('did-finish-load', () => {
    try {
      const currentUrl = contents.getURL();
      const host = new URL(currentUrl).hostname || '';

      // Nhận diện nền tảng
      let platformClass = 'platform-generic';
      if (host.includes('telegram.org')) platformClass = 'platform-telegram';
      else if (host.includes('messenger.com') || host.includes('facebook.com')) platformClass = 'platform-meta';
      else if (host.includes('zalo.me')) platformClass = 'platform-zalo';
      else if (host.includes('whatsapp.com')) platformClass = 'platform-whatsapp';
      else if (host.includes('tiktok.com')) platformClass = 'platform-tiktok';

      contents.insertCSS(`html, body { --nine-meta-platform: ${platformClass}; } html { color-scheme: dark; }`);
      contents.executeJavaScript(`document.documentElement.classList.add('${platformClass}');`, true).catch(() => {});

      // ✅ [FIX] Thêm error handling cho CSS file
      try {
        const customStyles = fs.readFileSync(path.join(__dirname, 'custom_style.css'), 'utf8');
        contents.insertCSS(customStyles);
      } catch (err) {
        console.warn('[Setup] Không thể tải custom_style.css:', err.message);
      }

      // ============================================================
      // ĐOẠN INJECT NÚT CHUYỂN ĐỔI FEED / MESSENGER CHO FACEBOOK
      // ============================================================
      if (platformClass === 'platform-meta') {
        contents
          .executeJavaScript(
            `
          (function() {
            var btnId = '9meta-feed-toggle-btn';
            if (document.getElementById(btnId)) return;

            var btn = document.createElement('div');
            btn.id = btnId;
            
            var isFeed = window.location.hostname.includes('facebook.com');
            btn.innerHTML = isFeed ? '💬 Vào Chat' : '📰 Xem Feed';

            btn.style.cssText = 'position:fixed; bottom:20px; left:85px; z-index:999999; background:linear-gradient(135deg,#7c5cff,#6ea8ff); color:white; padding:10px 18px; border-radius:20px; font-family:sans-serif; font-size:13px; font-weight:bold; cursor:pointer; box-shadow:0 8px 24px rgba(0,0,0,.3); transition:all .2s ease;';
            
            btn.onmouseenter = function() { btn.style.transform = 'scale(1.05)'; };
            btn.onmouseleave = function() { btn.style.transform = 'scale(1)'; };

            btn.onclick = function() {
              if (isFeed) {
                window.location.href = 'https://www.messenger.com/';
              } else {
                window.location.href = 'https://www.facebook.com/';
              }
            };

            document.body.appendChild(btn);
          })();
        `,
            true
          )
          .catch(() => {});
      }
    } catch (e) {
      console.error('[Setup] Lỗi trong did-finish-load:', e.message);
    }
  });

  if (app.isPackaged) {
    contents.on('before-input-event', (event, input) => {
      if (input.key === 'F12' || (input.control && input.shift && input.key === 'I')) event.preventDefault();
    });
    contents.on('devtools-opened', () => contents.closeDevTools());
  } else {
    contents.on('before-input-event', (event, input) => {
      if (input.key === 'F12' || (input.control && input.shift && input.key === 'I')) contents.toggleDevTools();
    });
  }
}

function setupDownloads(sess) {
  if (sess.__depLaoDownloadsHooked) return;
  sess.__depLaoDownloadsHooked = true;

  sess.on('will-download', (event, item) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const filename = item.getFilename();
    const record = {
      id,
      filename,
      url: item.getURL(),
      savePath: item.getSavePath(),
      receivedBytes: 0,
      totalBytes: item.getTotalBytes(),
      status: 'downloading',
      statusText: 'Đang tải',
    };
    downloads.push(record);
    sendToRenderer('download-updated', record);

    item.on('updated', (event, state) => {
      record.receivedBytes = item.getReceivedBytes();
      record.totalBytes = item.getTotalBytes();
      record.savePath = item.getSavePath();
      record.status = state === 'interrupted' ? 'interrupted' : 'downloading';
      record.statusText = state === 'interrupted' ? 'Tạm dừng/lỗi kết nối' : 'Đang tải';
      sendToRenderer('download-updated', { ...record });
    });

    item.once('done', (event, state) => {
      record.receivedBytes = item.getReceivedBytes();
      record.totalBytes = item.getTotalBytes();
      record.savePath = item.getSavePath();
      record.status = state === 'completed' ? 'completed' : state;
      record.statusText = state === 'completed' ? 'Đã tải xong' : `Kết thúc: ${state}`;
      sendToRenderer('download-updated', { ...record });
    });
  });
}

function createWindow() {
  const { windowBounds } = settings;
  mainWindow = new BrowserWindow({
    width: windowBounds.width || 1200,
    height: windowBounds.height || 800,
    x: windowBounds.x,
    y: windowBounds.y,
    minWidth: 400,
    minHeight: 300,
    title: 'MessHub',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: settings.isDarkMode ? '#242526' : '#ffffff',
    show: !settings.startMinimized,
    autoHideMenuBar: true,
    titleBarOverlay: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false, spellcheck: false },
  });

  app.on('session-created', (sess) => {
    setupDownloads(sess);

    sess.cookies.on('changed', (event, cookie, cause, removed) => {
      const domainMatch =
        cookie.domain &&
        ['zalo.me', 'messenger.com', 'facebook.com', 'whatsapp.com', 'telegram.org', 'tiktok.com'].some(
          (d) => cookie.domain.includes(d)
        );
      if (!removed && cookie.session && domainMatch) {
        const prefix = cookie.domain.startsWith('.') ? 'www' : '';
        sess.cookies
          .set({
            url: `https://${prefix}${cookie.domain}${cookie.path}`,
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
            secure: cookie.secure,
            httpOnly: cookie.httpOnly,
            expirationDate: Math.floor(Date.now() / 1000) + 31536000,
          })
          .catch(() => {});
      }
    });

    sess.webRequest.onBeforeRequest({ urls: ['*://*.zalo.me/*', '*://*.zadn.vn/*'] }, (details, callback) => {
      let cancel = false;
      const method = (details.method || '').toUpperCase();
      if (method === 'GET') return callback({ cancel: false });

      const syncSafePatterns = ['/sync', '/conversation', '/api/message/list', '/api/message/get', '/api/group'];
      if (syncSafePatterns.some((p) => details.url.includes(p))) return callback({ cancel: false });

      if (
        settings.blockSeen &&
        (details.url.includes('/api/message/read') || details.url.includes('/api/message/seen')) &&
        !details.url.includes('read_status')
      )
        cancel = true;
      if (settings.blockTyping && details.url.includes('/api/message/typing')) cancel = true;

      callback({ cancel });
    });

    sess.webRequest.onBeforeRequest({ urls: ['*://*.messenger.com/*', '*://*.facebook.com/*'] }, (details, callback) => {
      let cancel = false;
      const method = (details.method || '').toUpperCase();
      if (method === 'GET') return callback({ cancel: false });

      if (
        settings.blockSeen &&
        (details.url.includes('change_read_status') ||
          details.url.includes('mark_read') ||
          details.url.includes('read_receipt') ||
          details.url.includes('/ajax/mercury/mark_seen'))
      )
        cancel = true;
      if (settings.blockTyping && (details.url.includes('typ.php') || details.url.includes('typing_indicator') || details.url.includes('send_typing_indicator')))
        cancel = true;

      callback({ cancel });
    });

    sess.webRequest.onBeforeRequest(
      { urls: ['*://*.whatsapp.com/*', '*://web.whatsapp.com/*', '*://web.telegram.org/*', '*://*.telegram.org/*'] },
      (details, callback) => {
        let cancel = false;
        const method = (details.method || '').toUpperCase();
        if (method === 'GET') return callback({ cancel: false });

        if (settings.blockSeen && (details.url.includes('/read') || details.url.includes('receipt'))) cancel = true;
        if (
          settings.blockTyping &&
          (details.url.includes('chatstate') || details.url.includes('composing') || details.url.includes('typing'))
        )
          cancel = true;

        callback({ cancel });
      }
    );

    sess.setPermissionRequestHandler((webContents, permission, callback) => {
      const url = webContents.getURL();
      const isAllowed =
        isInternalUrl(url) || url.includes('fbcdn.net') || url.includes('gstatic.com') || url.includes('googleusercontent.com');
      const allowedPermissions = [
        'notifications',
        'media',
        'mediaKeySystem',
        'microphone',
        'camera',
        'clipboard-read',
        'clipboard-sanitized-write',
        'fileSystem',
        'file-system-access',
        'fileSystemAccess',
      ];
      callback(!!isAllowed && allowedPermissions.includes(permission));
    });

    sess.setPermissionCheckHandler((webContents, permission) => {
      const url = webContents?.getURL() || '';
      if (!isInternalUrl(url)) return false;
      if (!permission) return true;
      return [
        'notifications',
        'media',
        'mediaKeySystem',
        'microphone',
        'camera',
        'clipboard-read',
        'clipboard-sanitized-write',
        'fileSystem',
        'file-system-access',
        'fileSystemAccess',
      ].includes(permission);
    });
  });

  mainWindow.loadFile('index.html');

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (app.isPackaged && (input.key === 'F12' || (input.control && input.shift && input.key === 'I'))) {
      event.preventDefault();
    } else if (!app.isPackaged && (input.key === 'F12' || (input.control && input.shift && input.key === 'I'))) {
      mainWindow.webContents.toggleDevTools();
    }
  });

  mainWindow.on('focus', () => mainWindow.flashFrame(false));
  mainWindow.on('resize', updateBrowserViewBounds);
  mainWindow.on('maximize', updateBrowserViewBounds);
  mainWindow.on('unmaximize', updateBrowserViewBounds);

  mainWindow.on('close', (event) => {
    if (!isQuitting && settings.minimizeToTray) {
      event.preventDefault();
      suspendBrowserViews();
      mainWindow.hide();
      return;
    }

    if (!mainWindow.isDestroyed()) {
      settings.windowBounds = mainWindow.getBounds();
      saveSettings(settings);
    }
  });

  // ============================================================
  // IPC HANDLERS
  // ============================================================

  ipcMain.on('switch-profile', (event, profile) => {
    if (appLocked || !profile || !profile.id) return;

    const previousProfileId = activeProfileId;
    activeProfileId = profile.id;

    if (!getBrowserView(profile.id)) {
      const view = new BrowserView({
        webPreferences: {
          partition: profile.partition,
          preload: path.join(__dirname, 'preload.js'),
          contextIsolation: true,
          nodeIntegration: false,
          backgroundThrottling: true,
        },
      });

      browserViews[profile.id] = view;
      setupWebContents(view.webContents, profile.id);

      const sess = session.fromPartition(profile.partition);
      setupDownloads(sess);

      // ✅ [FIX] Tối ưu xử lý proxy
      if (profile.proxy) {
        let proxyRules = profile.proxy;
        const parts = profile.proxy.trim().split(':');

        if (parts.length === 4) {
          proxyRules = `http://${parts[0]}:${parts[1]}`;
          proxyCredentials[`${parts[0]}:${parts[1]}`] = {
            username: parts[2],
            password: parts[3],
          };
        } else if (parts.length === 2 && !profile.proxy.includes('://')) {
          proxyRules = `http://${parts[0]}:${parts[1]}`;
        }

        sess.setProxy({ proxyRules }).catch(() => {});
      } else {
        sess.setProxy({ proxyRules: 'direct://' }).catch(() => {});
      }

      let url = ZALO_URL;

      if (profile.platform === 'messenger') {
        url = 'https://www.messenger.com/';
      } else if (profile.platform === 'fanpage') {
        url = 'https://www.facebook.com/latest/inbox/';
      } else if (profile.platform === 'whatsapp') {
        url = 'https://web.whatsapp.com/';
      } else if (profile.platform === 'teams') {
        url = 'https://teams.microsoft.com/';
      } else if (profile.platform === 'gmail') {
        url = 'https://mail.google.com/';
      } else if (profile.platform === 'telegram') {
        url = 'https://web.telegram.org/a/';
      } else if (profile.platform === 'tiktok') {
        url = 'https://www.tiktok.com/';
      }

      view.webContents.loadURL(url, { userAgent: USER_AGENT }).catch(() => {});
    }

    const view = getBrowserView(profile.id);

    if (!view || !mainWindow || mainWindow.isDestroyed()) return;

    if (previousProfileId && previousProfileId !== profile.id) {
      const previousView = getBrowserView(previousProfileId);

      if (previousView) {
        optimizeBrowserView(previousView, false);
      }
    }

    optimizeAllBrowserViews(profile.id);
    mainWindow.setBrowserView(view);
    updateBrowserViewBounds();
  });

  ipcMain.on('update-profile-settings', (event, profile) => {
    const sess = session.fromPartition(profile.partition);
    if (profile.proxy) {
      let proxyRules = profile.proxy;
      const parts = profile.proxy.trim().split(':');
      if (parts.length === 4) {
        proxyRules = `http://${parts[0]}:${parts[1]}`;
        proxyCredentials[`${parts[0]}:${parts[1]}`] = { username: parts[2], password: parts[3] };
      } else if (parts.length === 2 && !profile.proxy.includes('://')) {
        proxyRules = `http://${parts[0]}:${parts[1]}`;
      }
      sess.setProxy({ proxyRules });
    } else {
      sess.setProxy({ proxyRules: 'direct://' });
    }
  });

  ipcMain.on('set-browserview-visibility', (event, visible) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    if (visible && !appLocked && activeProfileId && getBrowserView(activeProfileId)) {
      const view = getBrowserView(activeProfileId);
      optimizeAllBrowserViews(activeProfileId);
      mainWindow.setBrowserView(view);
      updateBrowserViewBounds();
    } else {
      mainWindow.setBrowserView(null);
      suspendBrowserViews();
    }
  });

  ipcMain.on('delete-profile', (event, id) => {
    destroyBrowserView(id);
  });

  ipcMain.on('profile-info-extracted', (event, info) => {
    let senderId = null;
    for (const [id, view] of Object.entries(browserViews)) {
      if (view.webContents === event.sender) {
        senderId = id;
        break;
      }
    }
    if (senderId) sendToRenderer('update-profile-info', { id: senderId, name: info.name, avatarUrl: info.avatar });
  });

  ipcMain.on('update-badge', (event, count) => {
    if (count !== unreadCount) {
      const hadNewMessages = count > unreadCount;
      unreadCount = count;
      updateBadge(unreadCount);
      if (hadNewMessages && !mainWindow.isFocused()) mainWindow.flashFrame(true);
    }
  });

  ipcMain.on('set-theme', (event, isDark) => {
    settings.isDarkMode = isDark;
    saveSettings(settings);
    nativeTheme.themeSource = isDark ? 'dark' : 'light';
  });

  ipcMain.on('toggle-always-on-top', () => {
    settings.alwaysOnTop = !settings.alwaysOnTop;
    mainWindow.setAlwaysOnTop(settings.alwaysOnTop);
    saveSettings(settings);
  });

  ipcMain.on('toggle-fullscreen', () => {
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
    setTimeout(updateBrowserViewBounds, 100);
  });

  ipcMain.on('zoom-in', () => {
    const wc = activeProfileId && browserViews[activeProfileId]?.webContents;
    if (wc) wc.setZoomLevel(wc.getZoomLevel() + 0.5);
  });

  ipcMain.on('zoom-out', () => {
    const wc = activeProfileId && browserViews[activeProfileId]?.webContents;
    if (wc) wc.setZoomLevel(wc.getZoomLevel() - 0.5);
  });

  ipcMain.on('reload-page', () => activeProfileId && browserViews[activeProfileId]?.webContents.reload());

  ipcMain.on('go-back-page', () => {
    if (activeProfileId && browserViews[activeProfileId]) {
      const wc = browserViews[activeProfileId].webContents;
      if (wc.canGoBack()) {
        wc.goBack();
      }
    }
  });

  ipcMain.on('get-settings', (event) => {
    const ws = getWorkspaceState();
    event.returnValue = {
      isDarkMode: settings.isDarkMode,
      alwaysOnTop: settings.alwaysOnTop,
      blockSeen: settings.blockSeen,
      blockTyping: settings.blockTyping,
      zadarkShield: settings.zadarkShield,
      lockOnStartup: settings.lockOnStartup,
      hasLockPassword: !!settings.lockPasswordHash,
      quickReplies: ws.data.quickReplies || [],
    };
  });

  ipcMain.on('workspace-get-state', (event) => {
    event.returnValue = getWorkspaceState();
  });

  ipcMain.on('workspace-save-data', (event, data) => {
    const state = persistWorkspaceState(data || {});
    broadcastQuickReplies(state.data.quickReplies);
    event.returnValue = state;
  });

  ipcMain.on('workspace-create', (event, name) => {
    const index = loadWorkspaceIndex();
    const id = `ws_${Date.now()}`;
    index.workspaces.push({
      id,
      name: String(name || 'Workspace mới').trim() || 'Workspace mới',
      createdAt: Date.now(),
    });
    index.currentId = id;
    safeJsonWrite(WORKSPACE_INDEX_PATH, index);
    saveWorkspaceData(id, DEFAULT_WORKSPACE_DATA);
    event.returnValue = getWorkspaceState();
  });

  ipcMain.on('workspace-switch', (event, id) => {
    const index = loadWorkspaceIndex();
    if (index.workspaces.some((w) => w.id === id)) {
      index.currentId = id;
      safeJsonWrite(WORKSPACE_INDEX_PATH, index);
    }
    const state = getWorkspaceState();
    broadcastQuickReplies(state.data.quickReplies);
    event.returnValue = state;
  });

  ipcMain.on('get-quick-replies', (event) => {
    event.returnValue = getWorkspaceState().data.quickReplies || settings.quickReplies || [];
  });

  ipcMain.on('save-quick-replies', (event, replies) => {
    const state = getWorkspaceState();
    state.data.quickReplies = replies || [];
    persistWorkspaceState(state.data);
    broadcastQuickReplies(state.data.quickReplies);
  });

  ipcMain.on('profile-badge-updated', (event, count) => {
    let senderId = null;

    for (const [id, view] of Object.entries(browserViews)) {
      if (view && !view.webContents.isDestroyed() && view.webContents === event.sender) {
        senderId = id;
        break;
      }
    }

    if (!senderId) return;

    count = Number.isFinite(Number(count)) ? Math.max(0, Number(count)) : 0;

    // ✅ [FIX] Tránh xử lý badge không thay đổi
    if (globalProfileBadges[senderId] === count) {
      return;
    }

    globalProfileBadges[senderId] = count;

    sendToRenderer('update-profile-badge', { id: senderId, count });

    // ✅ [FIX] Debounce notification aggregator
    if (badgeDebounceTimer) {
      clearTimeout(badgeDebounceTimer);
    }

    badgeDebounceTimer = setTimeout(() => {
      badgeDebounceTimer = null;

      try {
        checkOmnichannelNotifications();
      } catch (err) {
        console.error('[Notification] checkOmnichannelNotifications error:', err);
      }
    }, BADGE_DEBOUNCE_MS);
  });

  ipcMain.on('renderer-ready', () =>
    sendToRenderer('lock-state', {
      locked: settings.lockOnStartup || appLocked,
      hasPassword: !!settings.lockPasswordHash,
      zadarkShield: settings.zadarkShield,
    })
  );

  ipcMain.on('check-for-updates', () => checkForUpdates(true));
  ipcMain.on('download-update', () =>
    autoUpdater.downloadUpdate().catch((err) =>
      setUpdateState({ status: 'error', message: (err.message || err.toString()).split('\n')[0] })
    )
  );
  ipcMain.on('install-update', () => {
    isQuitting = true;
    autoUpdater.quitAndInstall();
  });
  ipcMain.on('get-update-state', () => sendToRenderer('update-state', updateState));
  ipcMain.on('get-downloads', () => sendToRenderer('downloads-list', downloads));
  ipcMain.on('open-download', (event, id) => {
    const d = downloads.find((x) => x.id === id);
    if (d?.savePath) shell.openPath(d.savePath);
  });
  ipcMain.on('show-download-in-folder', (event, id) => {
    const d = downloads.find((x) => x.id === id);
    if (d?.savePath) shell.showItemInFolder(d.savePath);
  });
  ipcMain.on('remove-download', (event, id) => {
    downloads = downloads.filter((x) => x.id !== id);
    sendToRenderer('downloads-list', downloads);
  });
  ipcMain.on('toggle-zadark-shield', () => toggleZadarkShield(!settings.zadarkShield));

  // ✅ [FIX] Chỉ khai báo lockApp() một lần
  ipcMain.on('set-lock-password', (event, password) => {
    const result = hashPassword(password);
    settings.lockSalt = result.salt;
    settings.lockPasswordHash = result.hash;
    settings.lockOnStartup = true;
    saveSettings(settings);
    unlockApp(true);
    updateTrayMenu();
  });

  ipcMain.on('unlock-app', (event, password) => unlockApp(verifyPassword(password)));
}

let globalProfileBadges = {};
let lastNotificationSummary = '';

function checkOmnichannelNotifications() {
  let platformCounts = {};
  let totalCount = 0;

  const ws = getWorkspaceState();
  const currentProfiles = ws.data.profiles || [];

  for (const [profileId, rawCount] of Object.entries(globalProfileBadges)) {
    const count = Number(rawCount) || 0;

    if (count <= 0) continue;

    const profile = currentProfiles.find((p) => p.id === profileId);

    let platformName = profile ? profile.platform : 'zalo';

    platformName = String(platformName).charAt(0).toUpperCase() + String(platformName).slice(1);

    if (platformName === 'Fanpage') {
      platformName = 'Facebook Fanpage';
    }

    platformCounts[platformName] = (platformCounts[platformName] || 0) + count;

    totalCount += count;
  }

  updateBadge(totalCount);

  if (totalCount === 0) {
    lastNotificationSummary = '';
    return;
  }

  const summaryParts = Object.entries(platformCounts).map(([platform, count]) => `${count} tin ${platform}`);

  if (!summaryParts.length) return;

  const currentSummary = summaryParts.join(', ');

  if (currentSummary === lastNotificationSummary) {
    return;
  }

  lastNotificationSummary = currentSummary;

  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused()) {
    return;
  }

  const now = Date.now();

  if (now - lastNativeNotificationAt < NOTIFICATION_COOLDOWN_MS) {
    return;
  }

  lastNativeNotificationAt = now;

  if (!Notification.isSupported()) {
    return;
  }

  try {
    const notification = new Notification({
      title: '📥 MessHub — Gộp thông báo',
      body: `Bạn có ${currentSummary} chưa đọc cần xử lý.`,
      silent: false,
      icon: path.join(__dirname, 'icon.png'),
    });

    notification.on('click', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
      }
    });

    notification.show();
  } catch (err) {
    console.error('[Notification] Không thể hiển thị notification:', err.message);
  }
}

// ✅ [FIX] Chỉ khai báo một lần, không trùng lặp
function lockApp() {
  appLocked = true;

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setBrowserView(null);
  }

  suspendBrowserViews();
  destroyInactiveBrowserViewsExcept(null); // ✅ Thêm: Xóa views không cần thiết

  sendToRenderer('lock-state', {
    locked: true,
    hasPassword: !!settings.lockPasswordHash,
    zadarkShield: settings.zadarkShield,
  });
}

function unlockApp(ok) {
  if (!ok) {
    sendToRenderer('unlock-result', {
      ok: false,
      message: 'Sai mật khẩu.',
    });
    return;
  }

  appLocked = false;

  sendToRenderer('unlock-result', {
    ok: true,
  });

  if (mainWindow && !mainWindow.isDestroyed() && activeProfileId && getBrowserView(activeProfileId)) {
    optimizeAllBrowserViews(activeProfileId);

    mainWindow.setBrowserView(getBrowserView(activeProfileId));

    updateBrowserViewBounds();
  }
}

function updateBadge(count) {
  if (!mainWindow) return;

  if (process.platform === 'win32') {
    if (count > 0) {
      try {
        mainWindow.setOverlayIcon(createBadgeIcon(count), `${count} tin nhắn chưa đọc`);
      } catch {
        mainWindow.setOverlayIcon(null, '');
      }
    } else {
      mainWindow.setOverlayIcon(null, '');
    }
  }

  if (tray) {
    tray.setToolTip(count > 0 ? `MessHub — ${count} tin nhắn chưa đọc` : 'MessHub');
  }
}

function registerGlobalShortcuts() {
  const hotkey = settings.globalHotkey || 'Ctrl+Shift+M';
  try {
    globalShortcut.register(hotkey, () => {
      if (!mainWindow) return;
      if (mainWindow.isVisible() && mainWindow.isFocused()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch (err) {
    console.error('[Shortcuts] Lỗi đăng ký global hotkey:', err.message);
  }
}

// ============================================================
// APP LIFECYCLE
// ============================================================

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  nativeTheme.themeSource = settings.isDarkMode ? 'dark' : 'light';
  createWindow();
  createTray();
  registerGlobalShortcuts();
  setupAutoUpdater();

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('login', (event, webContents, details, authInfo, callback) => {
  if (authInfo.isProxy) {
    const hostPort = `${authInfo.host}:${authInfo.port}`;
    if (proxyCredentials[hostPort]) {
      event.preventDefault();
      callback(proxyCredentials[hostPort].username, proxyCredentials[hostPort].password);
    }
  }
});

app.on('before-quit', () => {
  if (isQuitting) return;

  isQuitting = true;

  if (mainWindow && !mainWindow.isDestroyed()) {
    settings.windowBounds = mainWindow.getBounds();
    saveSettings(settings);

    try {
      mainWindow.setBrowserView(null);
    } catch {
      // Ignore
    }
  }

  destroyAllBrowserViews();

  if (tray) {
    try {
      tray.destroy();
    } catch {
      // Ignore
    }

    tray = null;
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();

  proxyCredentials = {};
  downloads = [];
  globalProfileBadges = {};
  lastNotificationSummary = '';
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});