# YouTube profile integration

YouTube runs inside the same profile `BrowserView` and persistent session as the other platforms. `YouTubeRuntime` attaches the YouTube helpers to the profile's existing `webContents`; it does not create a second player view or shared cookie partition.

The runtime enables request and ad-payload filtering, SponsorBlock skipping, playback quality controls, picture-in-picture, Google sign-in, and cookie import. Background audio is an opt-in profile setting.

Google sign-in uses Electron's native user agent on `accounts.google.com` and `accounts.youtube.com`. YouTube pages keep their existing profile user agent. The login window receives the profile's `Session` object directly, so it shares that profile's cookies without a fixed shared partition.

The implementation targets the Electron 29 `BrowserView` architecture used by MessHub Client. Keep YouTube-specific CDP, network interception, fingerprinting, and page injection in this directory.
