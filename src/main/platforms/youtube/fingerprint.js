'use strict';

const PATCH = /* js */ `
(() => {
  try { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }); } catch {}
  window.chrome = window.chrome || {};
  if (!window.chrome.runtime) {
    window.chrome.runtime = {
      id: undefined, connect() {}, sendMessage() {}, onMessage: { addListener() {} },
    };
  }
  if (!window.chrome.csi) window.chrome.csi = () => ({});
  if (!window.chrome.loadTimes) window.chrome.loadTimes = () => ({});
})();
`;

function apply(cdp) {
  return cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: PATCH });
}

function install(cdp) {
  cdp.onAttached(() => apply(cdp));
  return apply(cdp);
}

module.exports = { install, apply, PATCH };
