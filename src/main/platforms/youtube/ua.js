'use strict';

const { UA, ELECTRON_UA } = require('./constants');

const AUTH_HOSTS = new Set(['accounts.google.com', 'accounts.youtube.com']);
const boundSessions = new WeakSet();

function isGoogleAuth(url) {
  try {
    return AUTH_HOSTS.has(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

function bindSession(session) {
  if (boundSessions.has(session)) return;
  boundSessions.add(session);

  session.webRequest.onBeforeSendHeaders(
    { urls: ['*://accounts.google.com/*', '*://accounts.youtube.com/*'] },
    (details, callback) => {
      const headers = details.requestHeaders || {};
      const userAgentKey = Object.keys(headers).find((key) => key.toLowerCase() === 'user-agent');
      if (userAgentKey) headers[userAgentKey] = ELECTRON_UA;
      else headers['User-Agent'] = ELECTRON_UA;
      callback({ requestHeaders: headers });
    },
  );
}

function bindContents(webContents) {
  const applyUserAgent = (url) => {
    webContents.setUserAgent(isGoogleAuth(url) ? ELECTRON_UA : UA);
  };

  applyUserAgent(webContents.getURL());
  webContents.on('did-start-navigation', (_event, url, _inPlace, isMainFrame) => {
    if (isMainFrame) applyUserAgent(url);
  });
  webContents.on('will-redirect', (_event, url) => applyUserAgent(url));
  webContents.on('did-navigate', (_event, url) => applyUserAgent(url));
}

module.exports = { bindSession, bindContents, isGoogleAuth };
