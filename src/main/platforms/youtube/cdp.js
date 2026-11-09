'use strict';

const RETRY_MS = 2000;
const DIAG = process.env.MH_DIAG === '1';

class CdpSession {
  constructor(wc) {
    this.wc = wc;
    this.closed = false;
    this.listening = false;
    this.ownsDebugger = false;
    this._methods = new Map();
    this._attachFns = [];

    this._onMessage = (_e, method, params) => {
      const fn = this._methods.get(method);
      if (fn) Promise.resolve().then(() => fn(params)).catch(() => {});
    };
    this._onDetach = () => {
      if (this.closed) return;
      this.ownsDebugger = false;
      setTimeout(() => this.attach().catch(() => {}), RETRY_MS);
    };
  }

  get attached() {
    return !this.wc.isDestroyed() && this.wc.debugger.isAttached();
  }

  on(method, fn) { this._methods.set(method, fn); }
  onAttached(fn) { this._attachFns.push(fn); }

  async attach() {
    if (this.closed || this.wc.isDestroyed()) return;

    if (!this.attached) {
      try {
        this.wc.debugger.attach('1.3');
        this.ownsDebugger = true;
      } catch {
        setTimeout(() => this.attach().catch(() => {}), RETRY_MS);
        return;
      }
    }

    if (!this.listening) {
      this.wc.debugger.on('message', this._onMessage);
      this.wc.debugger.on('detach', this._onDetach);
      this.listening = true;
    }

    for (const fn of this._attachFns) {
      try {
        await fn();
      } catch {}
    }
  }

  async send(method, params) {
    if (!this.attached) {
      if (DIAG) console.warn(`[YouTube CDP] ${method} skipped: debugger is detached.`);
      return null;
    }

    try {
      return await this.wc.debugger.sendCommand(method, params);
    } catch (error) {
      if (DIAG) console.warn(`[YouTube CDP] ${method} failed:`, error.message);
      return null;
    }
  }

  detach() {
    this.closed = true;
    if (!this.wc.isDestroyed() && this.listening) {
      this.wc.debugger.off('message', this._onMessage);
      this.wc.debugger.off('detach', this._onDetach);
      this.listening = false;
    }
    if (!this.wc.isDestroyed() && this.ownsDebugger && this.wc.debugger.isAttached()) {
      try { this.wc.debugger.detach(); } catch {}
    }
    this.ownsDebugger = false;
  }
}

module.exports = { CdpSession };
