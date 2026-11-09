'use strict';

const { SB_CATS } = require('./constants');

const SCRIPT = /* js */ `
(() => {
  if (window.__mh) return;
  const S = { vid: null, segs: [], quality: null, rate: 1, sb: true };

  const player = () => document.querySelector('#movie_player');
  const video = () => document.querySelector('video');
  const vid = () => {
    const u = new URL(location.href);
    if (u.pathname === '/watch') return u.searchParams.get('v');
    const m = u.pathname.match(/^\\/shorts\\/([\\w-]{11})/);
    return m ? m[1] : null;
  };

  async function pullSegments(id) {
    S.segs = [];
    if (!S.sb) return;
    try {
      const q = 'https://sponsor.ajay.app/api/skipSegments?videoID=' + id +
                '&categories=' + encodeURIComponent(JSON.stringify(${JSON.stringify(SB_CATS)}));
      const r = await fetch(q);
      if (r.ok) S.segs = (await r.json()).map(x => x.segment).filter(s => s[1] - s[0] > 1);
    } catch {}
  }

  function tick() {
    const id = vid();
    if (id !== S.vid) { S.vid = id; if (id) pullSegments(id); }

    const v = video();
    if (!v) return;

    if (Math.abs(v.playbackRate - S.rate) > 0.01) v.playbackRate = S.rate;

    if (S.quality && v.dataset.mhq !== S.quality) {
      v.dataset.mhq = S.quality;
      const p = player();
      if (p?.setPlaybackQualityRange) p.setPlaybackQualityRange(S.quality, S.quality);
    }

    if (S.segs.length) {
      const t = v.currentTime;
      for (const s of S.segs) {
        if (t >= s[0] && t < s[1] - 0.35) { v.currentTime = s[1]; break; }
      }
    }
  }

  window.__mh = {
    play:       () => video()?.play(),
    pause:      () => video()?.pause(),
    seek:       t => { const v = video(); if (v) v.currentTime = t; },
    seekBy:     d => { const v = video(); if (v) v.currentTime += d; },
    rate:       r => { S.rate = r; const v = video(); if (v) v.playbackRate = r; },
    quality:    q => { S.quality = q; const v = video(); if (v) delete v.dataset.mhq; },
    muted:      m => { const v = video(); if (v) v.muted = m; },
    pip:        () => video()?.requestPictureInPicture?.(),
    fullscreen: () => player()?.requestFullscreen?.(),
    sponsor:    on => {
      S.sb = on;
      if (!on) S.segs = [];
      else if (S.vid) pullSegments(S.vid);
    },
    state: () => {
      const v = video(), p = player();
      if (!v) return null;
      return {
        paused: v.paused, time: v.currentTime, dur: v.duration,
        rate: v.playbackRate, muted: v.muted,
        quality: p?.getPlaybackQuality?.() ?? null,
        levels: p?.getAvailableQualityLevels?.() ?? [],
        title: document.title,
      };
    },
    dislikes: async id => {
      try {
        const r = await fetch('https://returnyoutubedislikeapi.com/votes?videoId=' + id);
        return r.ok ? await r.json() : null;
      } catch { return null; }
    },
  };

  setInterval(tick, 500);
})();
`;

function install(wc) {
  return wc.executeJavaScript(SCRIPT, true).catch(() => {});
}

function call(wc, fn, ...args) {
  const src = `window.__mh?.${fn}(${args.map(a => JSON.stringify(a)).join(',')})`;
  return wc.executeJavaScript(src, true).catch(() => null);
}

module.exports = { install, call, SCRIPT };
