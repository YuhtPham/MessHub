'use strict';

const {
  IS_GOOGLEVIDEO, IS_VIDEOPLAYBACK, AD_MISC, AD_HOST,
  FETCH_PATTERNS, AD_FIELDS, AD_CARD,
} = require('./constants');

const DROP_HEADERS = /^(content-encoding|content-length|transfer-encoding)$/i;
const DIAG = process.env.MH_DIAG === '1';

function removeQueryParameter(url, parameterName) {
  const hashIndex = url.indexOf('#');
  const fragment = hashIndex >= 0 ? url.slice(hashIndex) : '';
  const withoutFragment = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const queryIndex = withoutFragment.indexOf('?');
  if (queryIndex < 0) return url;

  const base = withoutFragment.slice(0, queryIndex);
  const query = withoutFragment.slice(queryIndex + 1).split('&');
  const remaining = query.filter((part) => part.split('=', 1)[0] !== parameterName);
  return `${base}${remaining.length ? `?${remaining.join('&')}` : ''}${fragment}`;
}

class AdBlock {
  constructor(cdp) {
    this.cdp = cdp;
    this.on = false;
    this.active = false;
    cdp.on('Fetch.requestPaused', p => this._paused(p));
    cdp.onAttached(() => (this.on ? this._enable() : null));
  }

  async enable() {
    this.on = true;
    await this._enable();
  }

  async disable() {
    this.on = false;
    const result = await this.cdp.send('Fetch.disable');
    this.active = false;
    return result !== null;
  }

  async _enable() {
    const networkResult = await this.cdp.send('Network.enable');
    const serviceWorkerResult = await this.cdp.send('Network.setBypassServiceWorker', { bypass: true });
    const result = await this.cdp.send('Fetch.enable', { patterns: FETCH_PATTERNS });
    this.active = result !== null && this.cdp.attached;
    if (networkResult === null) this._log('Network.enable failed');
    if (serviceWorkerResult === null) this._log('Could not bypass service workers');
    if (!this.active) console.warn('[YouTube] Request filtering could not be enabled.');
    return this.active;
  }

  async _paused(p) {
    try {
      if (DIAG) this._log('paused', p.responseStatusCode === undefined ? 'request' : 'response', p.request.url);
      if (!this.on) return await this._go(p.requestId);
      if (p.responseStatusCode !== undefined) return await this._payload(p);
      if (p.responseErrorReason) return await this._go(p.requestId);
      return await this._request(p);
    } catch {
      return this._go(p.requestId);
    }
  }

  async _payload(p) {
    if (p.responseStatusCode !== 200) return this._go(p.requestId);

    const responseHeaders = Array.isArray(p.responseHeaders) ? p.responseHeaders : [];
    const ctype = (responseHeaders.find(h => h.name.toLowerCase() === 'content-type') || {}).value || '';
    if (!/json/i.test(ctype)) return this._go(p.requestId);

    const r = await this.cdp.send('Fetch.getResponseBody', { requestId: p.requestId });
    if (!r) return this._go(p.requestId);

    let body;
    try {
      const text = Buffer.from(r.body, r.base64Encoded ? 'base64' : 'utf8').toString('utf8');
      body = Buffer.from(JSON.stringify(this._strip(JSON.parse(text), p.request.url)), 'utf8');
    } catch {
      return this._go(p.requestId);
    }

    const headers = responseHeaders
      .filter(h => !DROP_HEADERS.test(h.name))
      .concat([{ name: 'content-length', value: String(body.length) }]);

    await this.cdp.send('Fetch.fulfillRequest', {
      requestId: p.requestId,
      responseCode: p.responseStatusCode,
      responseHeaders: headers,
      body: body.toString('base64'),
    });
  }

  _strip(j, requestUrl = '') {
    const isAdRenderer = (value) =>
      value && typeof value === 'object' && Object.keys(value).some((key) => AD_CARD.test(key));
    const isShortsFeed = /\/reel_watch_sequence(?:\?|$)/.test(requestUrl);

    const walk = (value) => {
      if (Array.isArray(value)) {
        return value.filter((entry) => !isAdRenderer(entry)).map(walk);
      }
      if (!value || typeof value !== 'object') return value;

      for (const field of AD_FIELDS) delete value[field];
      for (const [key, child] of Object.entries(value)) {
        if (AD_CARD.test(key)) delete value[key];
        else {
          if (isShortsFeed && key === 'adClientParams' && child && typeof child === 'object') {
            delete child.isAd;
          }
          value[key] = walk(child);
        }
      }
      return value;
    };
    return walk(j);
  }

  async _request(p) {
    const url = p.request.url;

    if (IS_GOOGLEVIDEO.test(url)) {
      let parsedUrl;
      try {
        parsedUrl = new URL(url);
      } catch {
        return this._go(p.requestId);
      }

      const isAd = parsedUrl.searchParams.has('oad') ||
        parsedUrl.searchParams.get('source') === 'dclk_video_ads' ||
        parsedUrl.pathname.startsWith('/dclk_video_ads');

      if (isAd) {
        this._log('blocking ad media', url);
        const headers = p.request.headers || {};
        const hasRange = Object.keys(headers).some((name) => name.toLowerCase() === 'range');
        if (hasRange) {
          return this.cdp.send('Fetch.failRequest', {
            requestId: p.requestId,
            errorReason: 'BlockedByClient',
          });
        }
        return this.cdp.send('Fetch.fulfillRequest', {
          requestId: p.requestId,
          responseCode: 200,
          responseHeaders: [{ name: 'content-type', value: 'text/plain' }],
          body: '',
        });
      }

      if (IS_VIDEOPLAYBACK.test(url) && parsedUrl.searchParams.get('ctier') === 'L') {
        return this.cdp.send('Fetch.continueRequest', {
          requestId: p.requestId,
          url: removeQueryParameter(url, 'ctier'),
        });
      }

      return this._go(p.requestId);
    }

    if (AD_MISC.some(r => r.test(url)) || AD_HOST.test(url)) {
      return this.cdp.send('Fetch.failRequest', {
        requestId: p.requestId,
        errorReason: 'BlockedByClient',
      });
    }

    return this._go(p.requestId);
  }

  _go(id) {
    return this.cdp.send('Fetch.continueRequest', { requestId: id });
  }

  _log(...args) {
    if (DIAG) console.log('[YouTube AdBlock]', ...args);
  }
}

module.exports = { AdBlock };
