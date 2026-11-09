'use strict';

const { app } = require('electron');

const HOME = 'https://www.youtube.com/';
const LOGIN_URL = 'https://accounts.google.com/ServiceLogin?service=youtube';

const CHROME_FULL = process.versions.chrome;
const ELECTRON_UA = app.userAgentFallback;

const UA =
  `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ` +
  `(KHTML, like Gecko) Chrome/${CHROME_FULL} Safari/537.36`;

const ACCEPT_LANGUAGE = 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7';

const SB_CATS = ['sponsor', 'selfpromo', 'interaction', 'intro', 'outro', 'preview', 'music_offtopic'];

const IS_GOOGLEVIDEO = /^https?:\/\/[\w-]+\.googlevideo\.com\//;
const IS_VIDEOPLAYBACK = /googlevideo\.com\/videoplayback/;

const AD_MISC = [
  /^https?:\/\/(www|s)\.youtube\.com\/api\/stats\//,
  /^https?:\/\/(www|s)\.youtube\.com\/(pagead|ptracking)/,
  /^https?:\/\/www\.google\.com\/pagead\//,
  /^https?:\/\/(www|s)\.youtube\.com\/youtubei\/v\d+\/player\/ad_break(?:\?|$)/,
  /^https?:\/\/youtubei\.googleapis\.com\/youtubei\/v\d+\/player\/ad_break(?:\?|$)/,
];

const AD_HOST = /^https?:\/\/(?:[\w-]+\.)*(?:doubleclick\.net|googlesyndication\.com|googleadservices\.com|googletagservices\.com|2mdn\.net|google-analytics\.com)\//;

const ALLOWED_NAV = /^https?:\/\/([\w-]+\.)*(youtube\.com|google\.com|gstatic\.com|ggpht\.com|googleusercontent\.com)\//;

const FETCH_PATTERNS = [
  { urlPattern: '*youtube.com/youtubei/v1/player/ad_break*', requestStage: 'Request' },
  { urlPattern: '*youtubei.googleapis.com/youtubei/v1/player/ad_break*', requestStage: 'Request' },
  { urlPattern: '*youtube.com/api/stats/*', requestStage: 'Request' },
  { urlPattern: '*google.com/pagead*', requestStage: 'Request' },
  { urlPattern: '*doubleclick.net/*', requestStage: 'Request' },
  { urlPattern: '*googlesyndication.com/*', requestStage: 'Request' },
  { urlPattern: '*googleadservices.com/*', requestStage: 'Request' },
  { urlPattern: '*googletagservices.com/*', requestStage: 'Request' },
  { urlPattern: '*2mdn.net/*', requestStage: 'Request' },
  { urlPattern: '*google-analytics.com/*', requestStage: 'Request' },
  { urlPattern: '*googlevideo.com/*', requestStage: 'Request' },
  { urlPattern: '*youtube.com/pagead*', requestStage: 'Request' },
  { urlPattern: '*youtube.com/ptracking*', requestStage: 'Request' },
  { urlPattern: '*youtube.com/youtubei/v1/player*', requestStage: 'Response' },
  { urlPattern: '*youtube.com/youtubei/v1/next*', requestStage: 'Response' },
  { urlPattern: '*youtube.com/youtubei/v1/get_watch*', requestStage: 'Response' },
  { urlPattern: '*youtube.com/*reel_watch_sequence*', requestStage: 'Response' },
  { urlPattern: '*youtubei.googleapis.com/youtubei/v1/player*', requestStage: 'Response' },
  { urlPattern: '*youtubei.googleapis.com/youtubei/v1/next*', requestStage: 'Response' },
  { urlPattern: '*youtubei.googleapis.com/youtubei/v1/get_watch*', requestStage: 'Response' },
  { urlPattern: '*youtubei.googleapis.com/*reel_watch_sequence*', requestStage: 'Response' },
];

const AD_FIELDS = ['adPlacements', 'playerAds', 'adSlots', 'adBreakHeartbeatParams', 'adConfig'];
const AD_CARD = /adSlot|displayAd|promotedSparkles|compactPromoted|promotedVideo|adSlotRenderer/i;

module.exports = {
  HOME, LOGIN_URL,
  UA, ELECTRON_UA, ACCEPT_LANGUAGE,
  SB_CATS,
  IS_GOOGLEVIDEO, IS_VIDEOPLAYBACK, AD_MISC, AD_HOST, ALLOWED_NAV,
  FETCH_PATTERNS, AD_FIELDS, AD_CARD,
};
