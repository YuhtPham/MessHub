# MessHub

<p align="center">
  <img src="icon.png" width="88" height="88" alt="MessHub" />
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

The application focuses on:

- Multi-account management
- Multi-platform messaging
- Workspace isolation
- Mini CRM
- Quick Replies
- Zalo campaigns
- AI-assisted message rewriting
- Privacy controls
- Downloads management
- Desktop utilities

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

> Some automation features are platform-specific. Zalo currently has the most advanced campaign functionality.

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

Each workspace can maintain its own:

- Profiles
- CRM contacts
- Quick Replies
- Campaigns
- Analytics events
- Workspace data

Example:

```text
Workspace: Sales Team
├── Zalo Account 01
├── Zalo Account 02
├── Messenger Account
└── CRM

Workspace: Personal
├── Zalo Personal
├── Telegram
└── Gmail
