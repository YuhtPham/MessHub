'use strict';

const { BrowserWindow, shell } = require('electron');
const { ELECTRON_UA, LOGIN_URL, ALLOWED_NAV } = require('./constants');

const REJECTED = /\/signin\/rejected|browser.*not.*secure|ServiceLogin.*rejected/i;
const GOOGLE_COOKIE = /(^|\.)(google\.com|youtube\.com)$/;
const DIAG = process.env.MH_DIAG === '1';

class LoginFlow {
  constructor(ses) {
    this.ses = ses;
    this.rejected = false;
    this.win = null;
    this.loginPromise = null;
  }

  async open() {
    if (this.win && !this.win.isDestroyed()) {
      this.win.focus();
      return this.loginPromise || { rejected: this.rejected };
    }

    this.rejected = false;
    const w = new BrowserWindow({
      width: 540, height: 740,
      title: 'Đăng nhập YouTube',
      autoHideMenuBar: true,
      backgroundColor: '#ffffff',
      webPreferences: {
        session: this.ses,
        contextIsolation: true,
        sandbox: true,
        spellcheck: false,
      },
    });
    this.win = w;

    // The auth window uses its profile session and Electron's native browser identity.
    w.webContents.setUserAgent(ELECTRON_UA);
    w.webContents.setWindowOpenHandler(({ url }) => {
      if (ALLOWED_NAV.test(url)) { w.webContents.loadURL(url); return { action: 'deny' }; }
      shell.openExternal(url);
      return { action: 'deny' };
    });

    this.loginPromise = new Promise((resolve) => {
      w.once('closed', () => {
        this.win = null;
        this.loginPromise = null;
        resolve({ rejected: this.rejected });
      });
    });

    w.webContents.on('did-navigate', (_e, url) => {
      if (REJECTED.test(url)) this.rejected = true;
    });

    w.webContents.on('did-fail-load', (_event, errorCode, errorDescription, failedUrl, isMainFrame) => {
      if (!isMainFrame || errorCode === -3 || w.webContents.isDestroyed()) return;

      console.error(`[YouTube] Google sign-in failed (${errorCode}): ${errorDescription} — ${failedUrl}`);
      const safeDescription = String(errorDescription).replace(/[&<>"']/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[character]));
      const errorPage = `<!doctype html><meta charset="utf-8"><title>Không tải được đăng nhập</title>
        <body style="margin:0;background:#f7f8fa;color:#202124;font:15px Arial,sans-serif">
          <main style="max-width:520px;margin:15vh auto;padding:32px">
            <h2>Không tải được trang đăng nhập Google</h2>
            <p>${safeDescription}</p>
            <p>Kiểm tra kết nối mạng hoặc proxy, sau đó đóng cửa sổ này và thử lại.</p>
          </main>
        </body>`;
      w.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorPage)}`).catch(() => {});
    });

    w.webContents.on('did-finish-load', () => {
      if (!DIAG || w.webContents.isDestroyed()) return;
      w.webContents.executeJavaScript(
        'document.body ? document.body.innerText.slice(0, 120) : ""',
        true,
      ).then((text) => this._log('loaded', JSON.stringify(text))).catch(() => {});
    });
    w.webContents.on('render-process-gone', (_event, details) => this._log('renderer gone', details.reason));
    w.webContents.on('unresponsive', () => this._log('unresponsive'));
    w.webContents.on('console-message', (_event, level, message) => {
      if (DIAG || level >= 2) this._log('console', message);
    });

    w.webContents.loadURL(LOGIN_URL)
      .catch((error) => console.error('[YouTube] Could not open Google sign-in:', error.message));
    return this.loginPromise;
  }

  _log(...args) {
    if (DIAG) console.log('[YouTube login]', ...args);
  }

  // list: [{ name, value, domain, path, secure, httpOnly, expirationDate }]
  async importCookies(list) {
    let n = 0;
    for (const c of list) {
      const domain = (c.domain || '').replace(/^\./, '');
      if (!domain || !c.name) continue;
      if (!GOOGLE_COOKIE.test(domain)) continue;

      const ok = await this.ses.cookies.set({
        url: `https://${domain}${c.path || '/'}`,
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path || '/',
        secure: c.secure ?? true,
        httpOnly: c.httpOnly ?? true,
        sameSite: 'no_restriction',
        ...(c.expirationDate ? { expirationDate: c.expirationDate } : {}),
      }).then(() => true).catch(() => false);

      if (ok) n++;
    }
    await this.ses.cookies.flushStore().catch(() => {});
    return n;
  }

  async isSignedIn() {
    const c = await this.ses.cookies.get({ url: 'https://www.youtube.com' }).catch(() => []);
    return c.some(x => /^(SID|__Secure-3PSID)$/.test(x.name));
  }

  async signOut() {
    await Promise.all([
      this.ses.clearStorageData({
        origin: 'https://www.youtube.com',
        storages: ['cookies', 'localstorage', 'indexdb', 'cachestorage'],
      }).catch(() => {}),
      this.ses.clearStorageData({
        origin: 'https://accounts.google.com',
        storages: ['cookies'],
      }).catch(() => {}),
    ]);
  }

  destroy() {
    if (this.win && !this.win.isDestroyed()) this.win.close();
  }
}

module.exports = { LoginFlow };
