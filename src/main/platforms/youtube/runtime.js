'use strict';

const { CdpSession } = require('./cdp');
const fingerprint = require('./fingerprint');
const userAgent = require('./ua');
const { AdBlock } = require('./adblock');
const { LoginFlow } = require('./login');
const inject = require('./inject');
const { HOME, UA, ACCEPT_LANGUAGE } = require('./constants');

class YouTubeRuntime {
  constructor(webContents, session, options = {}) {
    this.webContents = webContents;
    this.session = session;
    this.destroyed = false;
    this.ready = false;
    this.backgroundPlayback = options.backgroundPlayback === true;
    this.blockingEnabled = options.blockingEnabled !== false;
    this.sponsorBlockEnabled = options.sponsorBlockEnabled !== false;
    this.qualityValue = options.quality && options.quality !== 'auto' ? options.quality : null;
    this.onBackgroundPlaybackChange = options.onBackgroundPlaybackChange || (() => {});

    this.session.setUserAgent(UA, ACCEPT_LANGUAGE);
    userAgent.bindSession(this.session);
    userAgent.bindContents(this.webContents);

    this.cdp = new CdpSession(webContents);
    this.blocker = new AdBlock(this.cdp);
    this.login = new LoginFlow(session);
    this.onPageReady = () => this._installPageHelpers();

    this.webContents.on('did-finish-load', this.onPageReady);
    this.webContents.on('did-navigate-in-page', this.onPageReady);

    this.onBackgroundPlaybackChange(this.backgroundPlayback);
    this.readyPromise = this._boot();
  }

  async _boot() {
    await this._seedConsent();
    if (this.destroyed) return false;

    await this.cdp.attach();
    if (this.destroyed) return false;

    await fingerprint.install(this.cdp);
    if (this.destroyed) return false;

    if (this.blockingEnabled) await this.blocker.enable();
    if (this.destroyed) return false;

    this.ready = true;
    return true;
  }

  async _seedConsent() {
    const setConsentCookie = (name, value) => this.session.cookies.set({
      url: HOME,
      name,
      value,
      secure: true,
      sameSite: 'no_restriction',
    }).catch(() => {});

    await Promise.all([
      setConsentCookie('SOCS', 'CAI'),
      setConsentCookie('CONSENT', 'YES+cb.20240101-00-p0.en+FX+000'),
    ]);
  }

  async _installPageHelpers() {
    if (this.destroyed || this.webContents.isDestroyed()) return;

    await inject.install(this.webContents);
    if (this.destroyed || this.webContents.isDestroyed()) return;

    await inject.call(this.webContents, 'sponsor', this.sponsorBlockEnabled);
    if (this.qualityValue) await inject.call(this.webContents, 'quality', this.qualityValue);
  }

  get wc() {
    return this.webContents;
  }

  async getStatus() {
    return {
      ready: this.ready,
      signedIn: await this.login.isSignedIn(),
      blockingEnabled: this.blockingEnabled,
      blockingActive: this.blocker.active && this.cdp.attached,
      sponsorBlockEnabled: this.sponsorBlockEnabled,
      backgroundPlayback: this.backgroundPlayback,
      quality: this.qualityValue || 'auto',
    };
  }

  async setBlocking(enabled) {
    this.blockingEnabled = !!enabled;
    if (this.blockingEnabled) await this.blocker.enable();
    else await this.blocker.disable();
    return this.blockingEnabled;
  }

  async setSponsorBlock(enabled) {
    this.sponsorBlockEnabled = !!enabled;
    await inject.call(this.webContents, 'sponsor', this.sponsorBlockEnabled);
    return this.sponsorBlockEnabled;
  }

  setBackgroundPlayback(enabled) {
    this.backgroundPlayback = !!enabled;
    this.onBackgroundPlaybackChange(this.backgroundPlayback);
    return this.backgroundPlayback;
  }

  async setQuality(quality) {
    this.qualityValue = quality === 'auto' ? null : quality;
    if (this.qualityValue) await inject.call(this.webContents, 'quality', this.qualityValue);
    else await inject.call(this.webContents, 'quality', null);
    return this.qualityValue || 'auto';
  }

  openLogin() {
    return this.login.open();
  }

  async importCookies(cookies) {
    const imported = await this.login.importCookies(cookies);
    if (imported && !this.webContents.isDestroyed()) await this.webContents.reload();
    return imported;
  }

  isSignedIn() {
    return this.login.isSignedIn();
  }

  async signOut() {
    await this.login.signOut();
    if (!this.webContents.isDestroyed()) await this.webContents.reload();
  }

  async stats() {
    const state = await inject.call(this.webContents, 'state');
    if (!state) return null;

    let videoId = null;
    try {
      videoId = new URL(this.webContents.getURL()).searchParams.get('v');
    } catch {}

    const votes = videoId ? await inject.call(this.webContents, 'dislikes', videoId) : null;
    return {
      ...state,
      dislikes: votes?.dislikes ?? null,
      likes: votes?.likes ?? null,
    };
  }

  pip() {
    return inject.call(this.webContents, 'pip');
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.webContents.off('did-finish-load', this.onPageReady);
    this.webContents.off('did-navigate-in-page', this.onPageReady);
    this.cdp.detach();
    this.login.destroy();
  }
}

module.exports = { YouTubeRuntime };
