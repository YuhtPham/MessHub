# MessHub

<p align="center">
  <img src="assets/icons/app-icon.png" width="88" height="88" alt="MessHub" />
</p>

<p align="center">
  <strong>MessHub</strong> — Desktop workspace for managing multiple messaging accounts in one place.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-29-47848F?style=for-the-badge&logo=electron&logoColor=white" />
  <img src="https://img.shields.io/badge/Chromium-BrowserView-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" />
  <img src="https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" />
</p>

---

## Overview

**MessHub** is a cross-platform desktop application built with **Electron + Chromium** for managing multiple messaging and communication accounts in one place.

Instead of opening multiple browser windows, MessHub provides a unified desktop workspace where each account can run inside an isolated profile/session.

The application currently provides isolated platform sessions, workspaces,
quick replies, app locking, download management, and desktop utilities.

---

## Supported Platforms

MessHub supports web-based communication platforms including:

- Zalo
- Messenger
- Facebook / Fanpage
- Telegram
- WhatsApp
- Microsoft Teams
- Gmail
- TikTok
- YouTube

## Cài đặt cho người dùng

Tải bộ cài phù hợp với hệ điều hành từ [GitHub Releases](https://github.com/YuhtPham/MessHub/releases/latest):

| Hệ điều hành | File cần tải | Cách cài |
| --- | --- | --- |
| Windows | `MessHub Client-Setup-*.exe` | Mở file và làm theo trình cài đặt. |
| macOS | `MessHub-Client-*-mac.dmg` | Mở DMG rồi kéo MessHub vào Applications. |
| Linux x64 | `install.sh` | Chạy script để cài AppImage vào tài khoản hiện tại. |

Trên Linux, `install.sh` tự nhận hệ điều hành và kiến trúc x64. Script dùng AppImage nằm cạnh nó nếu có; nếu không, script tải AppImage từ GitHub Releases. Không cần quyền quản trị. Người dùng có thể nhấp phải vào script và chọn chạy trong Terminal; hoặc mở Terminal tại thư mục tải xuống và chạy `bash install.sh`.

Windows và macOS không chạy `install.sh`; các file `.exe` và `.dmg` là bộ cài giao diện đồ họa dành riêng cho hai hệ điều hành đó. Workflow GitHub Actions tự build cả ba nền tảng và đưa các bộ cài vào cùng một Release khi bạn push tag phiên bản.

Để phát hành phiên bản mới, cập nhật `version` trong `package.json`, push commit lên GitHub, rồi tạo và push tag trùng phiên bản đó. Ví dụ với phiên bản `1.6.1`:

```bash
git tag v1.6.1
git push origin v1.6.1
```

GitHub Actions sẽ build trên runner Windows, Linux và macOS, sau đó tạo Release. Người dùng Windows chỉ cần tải file `.exe` từ Release, nhấp đúp và làm theo trình cài đặt; họ không cần VS Code, Node.js hay npm.

---

# Features

## Multi-Account Management

Manage multiple accounts from a single desktop application.

- Multiple independent profiles
- Isolated browser sessions
- Separate Chromium partitions
- Custom account name
- Custom avatar
- Platform selection
- Proxy configuration
- Fast account switching
- Unread message indicators

Each profile can maintain its own login session without interfering with other profiles.

---

## Workspace

MessHub supports isolated workspaces for different projects, teams or account groups.

Each workspace stores its own account profiles and quick replies.

Example:

```text
Workspace: Sales Team
├── Zalo Account 01
├── Zalo Account 02
├── Messenger Account
└── Quick Replies

Workspace: Personal
├── Zalo Personal
├── Telegram
└── Gmail
```

The desktop app runs locally and does not require a backend service.

## Project structure

```text
src/
├── main/                    Electron process and application lifecycle
│   ├── index.js
│   ├── platforms/
│   │   └── youtube/           YouTube runtime and player integrations
│   │       ├── adblock.js
│   │       ├── cdp.js
│   │       ├── constants.js
│   │       ├── fingerprint.js
│   │       ├── index.js
│   │       ├── inject.js
│   │       ├── login.js
│   │       ├── runtime.js
│   │       └── ua.js
│   └── storage/               Local settings and workspace persistence
│       ├── json-store.js
│       └── workspace-store.js
├── preload/                 Isolated bridge and messaging-site helpers
│   ├── index.js
│   └── page-injection.js
└── renderer/                Desktop interface
    ├── index.html
    ├── renderer.js
    └── styles/
        ├── app.css
        └── platform-overrides.css
assets/
└── icons/                   Application and Windows installer icons
docs/                        Project website
scripts/
└── clean-build-output.js    Remove temporary Linux build files after packaging
```

The repository root also contains `install.sh`, an interactive Linux AppImage installer.

The Electron application entry point is `src/main/index.js`. User settings,
workspaces, and browser session partitions retain their existing locations so
updates preserve account sessions and local data.

`npm run build` places the `MessHub Client` AppImage in the project root. The
post-build cleanup removes the temporary `linux-unpacked` directory and builder
diagnostic files while keeping the AppImage and update metadata. Windows and
macOS builds use their platform-specific scripts above.
