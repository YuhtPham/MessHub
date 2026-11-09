const { ipcRenderer } = require('electron');

const profilesList = document.getElementById('profiles-list');
const modalTitle = document.getElementById('modal-title');
const nameInput = document.getElementById('profile-name-input');
const proxyInput = document.getElementById('profile-proxy-input');
const platformInput = document.getElementById('profile-platform-input');
const avatarPreview = document.getElementById('avatar-preview');
const avatarImg = document.getElementById('avatar-img');
const avatarLetter = document.getElementById('avatar-letter');
const avatarInput = document.getElementById('avatar-input');
const youtubeToolsButton = document.getElementById('btn-open-youtube-tools');

const DEFAULT_PLATFORM = 'zalo';
const overlayElements = Array.from(document.querySelectorAll('.overlay'));
const PLATFORM_ICONS = {
  zalo: 'Z',
  telegram: '✈',
  messenger: 'M',
  fanpage: 'F',
  whatsapp: 'W',
  teams: 'T',
  gmail: 'G',
  tiktok: '♪',
  youtube: '▶',
};

const defaultState = {
  profiles: [],
  quickReplies: [],
};

let workspaceState = ipcRenderer.sendSync('workspace-get-state') || {
  currentId: 'default',
  workspaces: [],
  data: defaultState,
};
let workspaceData = normalizeWorkspaceData(workspaceState.data);
let profiles = normalizeProfiles(workspaceData.profiles);
let activeProfileId = profiles[0]?.id || null;
let downloads = [];
let updateState = { status: 'idle', progress: 0, message: '' };
let appLocked = false;
let hasLockPassword = false;
let isDarkMode = true;
let editingProfile = null;
let tempAvatarPath = null;
let draggedProfileId = null;
let suppressProfileClickUntil = 0;

function normalizeWorkspaceData(data = {}) {
  return {
    profiles: Array.isArray(data.profiles) ? data.profiles : [],
    quickReplies: Array.isArray(data.quickReplies) ? data.quickReplies : [],
  };
}
function normalizeProfiles(list) {
  const profileList = Array.isArray(list) ? list : [];
  if (!profileList.length) {
    const id = String(Date.now());
    return [{ id, name: 'Tài khoản 1', partition: `persist:nick_${id}`, platform: DEFAULT_PLATFORM }];
  }
  return profileList.map((profile) => ({
    ...profile,
    platform: profile.platform || DEFAULT_PLATFORM,
    partition: profile.partition || `persist:nick_${profile.id}`,
  }));
}
function persistWorkspace() {
  workspaceData.profiles = profiles;
  workspaceData = normalizeWorkspaceData(workspaceData);
  workspaceState = ipcRenderer.sendSync('workspace-save-data', workspaceData);
  workspaceData = normalizeWorkspaceData(workspaceState.data);
  profiles = normalizeProfiles(workspaceData.profiles);
  if (!profiles.some((profile) => profile.id === activeProfileId)) {
    activeProfileId = profiles[0]?.id || null;
  }
}
function openOverlay(id) {
  const el = document.getElementById(id);
  if (el) {
    ipcRenderer.send('set-browserview-visibility', false);
    el.style.display = 'flex';
  }
}

function closeOverlay(id) {
  const overlay = document.getElementById(id);
  if (overlay) overlay.style.display = 'none';

  const anotherOverlayIsOpen = overlayElements.some(
    (item) => item !== overlay && item.style.display === 'flex'
  );
  if (!anotherOverlayIsOpen) ipcRenderer.send('set-browserview-visibility', true);
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>\"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
  }[character]));
}

function platformIcon(platform) {
  return PLATFORM_ICONS[platform || DEFAULT_PLATFORM] || '•';
}

function formatDate(timestamp) {
  return new Date(timestamp || Date.now()).toLocaleString('vi-VN');
}

function getActiveProfile() {
  return profiles.find((profile) => profile.id === activeProfileId) || profiles[0] || null;
}

function migrateLegacyProfiles() {
  if (workspaceData.profiles.length) return;
  try {
    const saved = localStorage.getItem('mp_profiles');
    if (saved) {
      const legacyProfiles = JSON.parse(saved);
      if (Array.isArray(legacyProfiles) && legacyProfiles.length) {
        profiles = normalizeProfiles(legacyProfiles);
        workspaceData.profiles = profiles;
      }
    }
  } catch {}
  if (!workspaceData.quickReplies.length) {
    workspaceData.quickReplies = settings.quickReplies || [];
  }
  persistWorkspace();
}

function renderSidebar() {
  profilesList.innerHTML = '';
  profiles.forEach((profile) => {
    const btn = document.createElement('button');
    btn.type = 'button';

    btn.className = `profile-btn ${profile.id === activeProfileId ? 'active' : ''}`;
    btn.title = `${profile.name} (${profile.platform || DEFAULT_PLATFORM})`;
    btn.setAttribute('aria-label', profile.name);
    btn.setAttribute('aria-pressed', String(profile.id === activeProfileId));
    btn.dataset.profileId = profile.id;
    btn.draggable = !appLocked;

    const span = document.createElement('span');
    span.textContent = profile.avatar ? '' : platformIcon(profile.platform);

    if (profile.avatar) {
      const img = document.createElement('img');
      img.alt = '';
      img.src = profile.avatar.startsWith('http')
        ? profile.avatar
        : `file://${String(profile.avatar).replace(/\\/g, '/')}`;
      Object.assign(img.style, {
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: '100%',
        borderRadius: 'inherit',
        objectFit: 'cover',
        pointerEvents: 'none',
      });

      btn.appendChild(img);
    } else {
      btn.appendChild(span);
    }

    const badge = document.createElement('div');

    badge.className = 'badge';
    badge.id = `badge-${profile.id}`;
    badge.textContent = '0';

    btn.appendChild(badge);

    btn.onclick = () => {
      if (Date.now() < suppressProfileClickUntil) return;
      if (!appLocked) switchProfile(profile.id);
    };

    btn.oncontextmenu = (e) => {
      e.preventDefault();
      if (!appLocked) openModal(profile);
    };

    btn.addEventListener('dragstart', (e) => {
      if (appLocked) {
        e.preventDefault();
        return;
      }

      draggedProfileId = profile.id;
      suppressProfileClickUntil = Date.now() + 500;

      btn.classList.add('dragging');

      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', profile.id);
    });

    btn.addEventListener('dragend', () => {
      draggedProfileId = null;
      suppressProfileClickUntil = Date.now() + 300;

      btn.classList.remove('dragging');

      profilesList
        .querySelectorAll('.profile-btn')
        .forEach((item) => item.classList.remove('drag-over'));
    });

    btn.addEventListener('dragover', (e) => {
      if (appLocked || !draggedProfileId || draggedProfileId === profile.id) return;

      e.preventDefault();

      const rect = btn.getBoundingClientRect();
      const insertBefore = e.clientY < rect.top + rect.height / 2;

      const dragged = profilesList.querySelector(
        `[data-profile-id="${CSS.escape(draggedProfileId)}"]`
      );

      if (!dragged || dragged === btn) return;

      profilesList
        .querySelectorAll('.profile-btn')
        .forEach((item) => item.classList.remove('drag-over'));

      btn.classList.add('drag-over');

      if (insertBefore) {
        if (dragged.nextSibling !== btn) {
          profilesList.insertBefore(dragged, btn);
        }
      } else {
        if (btn.nextSibling !== dragged) {
          profilesList.insertBefore(dragged, btn.nextSibling);
        }
      }
    });

    btn.addEventListener('drop', (e) => {
      if (appLocked || !draggedProfileId) return;

      e.preventDefault();

      const orderedIds = Array.from(
        profilesList.querySelectorAll('.profile-btn')
      ).map((item) => item.dataset.profileId);

      const profileMap = new Map(
        profiles.map((profile) => [profile.id, profile])
      );

      profiles = orderedIds
        .map((id) => profileMap.get(id))
        .filter(Boolean);

      persistWorkspace();

      suppressProfileClickUntil = Date.now() + 500;

      profilesList
        .querySelectorAll('.profile-btn')
        .forEach((item) => {
          item.classList.remove('drag-over', 'dragging');
        });
    });

    profilesList.appendChild(btn);
  });
}

function switchProfile(profileId) {
  activeProfileId = profileId;

  profilesList.querySelectorAll('.profile-btn').forEach((btn) => {
    const isActive = btn.dataset.profileId === profileId;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });

  const profile = getActiveProfile();
  youtubeToolsButton.hidden = profile?.platform !== 'youtube';
  if (profile) ipcRenderer.send('switch-profile', profile);
}
function openModal(profileToEdit = null) {
  editingProfile = profileToEdit;
  tempAvatarPath = profileToEdit?.avatar || null;
  modalTitle.textContent = profileToEdit ? 'Chỉnh sửa tài khoản' : 'Thêm tài khoản';
  nameInput.value = profileToEdit?.name || '';
  proxyInput.value = profileToEdit?.proxy || '';
  platformInput.value = profileToEdit?.platform || DEFAULT_PLATFORM;
  document.getElementById('modal-delete').hidden = !profileToEdit;
  updateAvatarPreview();
  openOverlay('modal-overlay');
  nameInput.focus();
}
function updateAvatarPreview() {
  if (tempAvatarPath) {
    avatarImg.src = tempAvatarPath.startsWith('http')
      ? tempAvatarPath
      : `file://${String(tempAvatarPath).replace(/\\/g, '/')}`;
    avatarImg.hidden = false;
    avatarLetter.hidden = true;
  } else {
    avatarImg.hidden = true;
    avatarLetter.hidden = false;
    avatarLetter.textContent = platformIcon(platformInput.value || DEFAULT_PLATFORM);
  }
}

function renderWorkspaces() {
  const list = document.getElementById('workspace-list');
  if (!workspaceState.workspaces.length) {
    list.innerHTML = '<div class="empty-state">Chưa có workspace.</div>';
    return;
  }
  list.innerHTML = workspaceState.workspaces.map((workspace) => {
    const isCurrentWorkspace = workspace.id === workspaceState.currentId;
    const buttonLabel = isCurrentWorkspace ? 'Đang dùng' : 'Chuyển';
    const buttonStyle = isCurrentWorkspace ? 'save' : 'cancel';

    return `
      <div class="workspace-item">
        <div class="row">
          <div>
            <div class="title-lg">${escapeHtml(workspace.name)}</div>
            <div class="muted">${escapeHtml(workspace.id)} · ${formatDate(workspace.createdAt)}</div>
          </div>
          <button type="button" class="modal-btn ${buttonStyle}" data-workspace="${escapeHtml(workspace.id)}">
            ${buttonLabel}
          </button>
        </div>
      </div>`;
  }).join('');

  list.querySelectorAll('[data-workspace]').forEach((button) => {
    button.onclick = () => {
      const workspaceId = button.dataset.workspace;
      if (workspaceId === workspaceState.currentId) return;

      workspaceState = ipcRenderer.sendSync('workspace-switch', workspaceId);
      workspaceData = normalizeWorkspaceData(workspaceState.data);
      profiles = normalizeProfiles(workspaceData.profiles);
      activeProfileId = profiles[0]?.id || null;
      renderAll();
      if (activeProfileId) switchProfile(activeProfileId);
    };
  });
}

function renderQuickReplies() {
  const quickReplies = workspaceData.quickReplies || [];
  const list = document.getElementById('quick-replies-list');
  if (!quickReplies.length) {
    list.innerHTML = '<div class="empty-state">Chưa có tin nhắn mẫu nào.</div>';
    return;
  }
  list.innerHTML = quickReplies.map((reply, index) => `
    <div class="download-item">
      <div class="row">
        <div class="title-sm">/${index + 1}</div>
        <div>
          <button type="button" class="modal-btn cancel" data-edit="${index}">Sửa</button>
          <button type="button" class="modal-btn warn" data-delete="${index}">Xóa</button>
        </div>
      </div>
      <div class="muted mt-12">${escapeHtml(reply.message)}</div>
    </div>`).join('');
  list.querySelectorAll('[data-edit]').forEach((button) => {
    button.onclick = () => {
      const index = Number(button.dataset.edit);
      const next = prompt('Sửa tin nhắn mẫu', workspaceData.quickReplies[index].message);
      if (next && next.trim()) {
        workspaceData.quickReplies[index].message = next.trim();
        persistWorkspace();
        renderQuickReplies();
      }
    };
  });
  list.querySelectorAll('[data-delete]').forEach((button) => {
    button.onclick = () => {
      const index = Number(button.dataset.delete);
      workspaceData.quickReplies.splice(index, 1);
      persistWorkspace();
      renderQuickReplies();
    };
  });
}

function addQuickReplyFromInput() {
  const input = document.getElementById('quick-reply-input');
  const message = input.value.trim();
  if (!message) return;
  workspaceData.quickReplies.push({ message });
  persistWorkspace();
  input.value = '';
  renderQuickReplies();
}

function renderDownloads() {
  const list = document.getElementById('downloads-list');
  if (!list) return;
  if (!downloads.length) {
    list.innerHTML = '<div class="empty-state">Chưa có tệp tải xuống.</div>';
    return;
  }
  list.innerHTML = downloads.slice().reverse().map((download) => {
    const percentage = download.totalBytes
      ? Math.round((download.receivedBytes / download.totalBytes) * 100)
      : (download.status === 'completed' ? 100 : 0);

    return `
      <div class="download-item">
        <div class="title-sm">${escapeHtml(download.filename || 'download')}</div>
        <div class="download-meta">
          ${escapeHtml(download.statusText || download.status || '')}
          ${percentage ? ` · ${percentage}%` : ''}
        </div>
        <div class="progress mt-12"><span style="width: ${percentage}%"></span></div>
        <div class="row mt-12">
          <button type="button" class="modal-btn cancel" data-folder="${escapeHtml(download.id)}">Thư mục</button>
          <div>
            <button type="button" class="modal-btn cancel" data-open="${escapeHtml(download.id)}">Mở</button>
            <button type="button" class="modal-btn warn" data-remove="${escapeHtml(download.id)}">Xóa</button>
          </div>
        </div>
      </div>`;
  }).join('');

  list.querySelectorAll('[data-open]').forEach((button) => {
    button.onclick = () => ipcRenderer.send('open-download', button.dataset.open);
  });
  list.querySelectorAll('[data-folder]').forEach((button) => {
    button.onclick = () => ipcRenderer.send('show-download-in-folder', button.dataset.folder);
  });
  list.querySelectorAll('[data-remove]').forEach((button) => {
    button.onclick = () => {
      ipcRenderer.send('remove-download', button.dataset.remove);
      downloads = downloads.filter((download) => download.id !== button.dataset.remove);
      renderDownloads();
    };
  });
}
function renderUpdate() {
  document.getElementById('update-status').textContent = updateState.message || 'Sẵn sàng kiểm tra cập nhật.';
  document.getElementById('update-progress').style.width = `${updateState.progress || 0}%`;
  document.getElementById('update-download').hidden = updateState.status !== 'available';
  document.getElementById('update-install').hidden = updateState.status !== 'downloaded';
}

function getActiveYoutubeProfile() {
  const profile = getActiveProfile();
  return profile?.platform === 'youtube' ? profile : null;
}

function renderYoutubeStats(stats) {
  const output = document.getElementById('youtube-stats');
  if (!stats) {
    output.textContent = 'Không phát hiện video đang chạy.';
    return;
  }

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds)) return '—';
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${minutes}:${remainder}`;
  };

  output.textContent = [
    stats.title || 'YouTube',
    `Thời lượng: ${formatTime(stats.time)} / ${formatTime(stats.dur)}`,
    `Tốc độ: ${stats.rate || 1}× · Chất lượng: ${stats.quality || 'tự động'}`,
    `Thích: ${stats.likes ?? '—'} · Không thích: ${stats.dislikes ?? '—'}`,
  ].join('\n');
}

async function refreshYoutubeStatus() {
  const profile = getActiveYoutubeProfile();
  if (!profile) return;

  const statusElement = document.getElementById('youtube-status');
  statusElement.textContent = 'Đang kiểm tra trạng thái YouTube…';

  try {
    const state = await ipcRenderer.invoke('youtube:get-status', profile.id);
    if (getActiveYoutubeProfile()?.id !== profile.id) return;
    if (!state) {
      statusElement.textContent = 'Phiên YouTube chưa sẵn sàng.';
      return;
    }

    const signInStatus = state.ready
      ? state.signedIn ? 'Đã đăng nhập Google.' : 'Chưa đăng nhập Google.'
      : 'Đang khởi tạo phiên YouTube…';
    const adBlockStatus = !state.blockingEnabled
      ? 'Bộ lọc quảng cáo đang tắt.'
      : state.blockingActive
        ? 'Bộ lọc quảng cáo đang hoạt động.'
        : 'Bộ lọc quảng cáo chưa kích hoạt.';
    statusElement.textContent = `${signInStatus} ${adBlockStatus}`;
    document.getElementById('youtube-blocking').checked = state.blockingEnabled;
    document.getElementById('youtube-sponsor-block').checked = state.sponsorBlockEnabled;
    document.getElementById('youtube-background-playback').checked = state.backgroundPlayback;
    document.getElementById('youtube-quality').value = state.quality || 'auto';
  } catch (error) {
    if (getActiveYoutubeProfile()?.id !== profile.id) return;
    statusElement.textContent = error.message || 'Không đọc được trạng thái YouTube.';
  }
}

async function runYoutubeAction(action, value) {
  const profile = getActiveYoutubeProfile();
  if (!profile) return null;

  const statusElement = document.getElementById('youtube-status');
  try {
    const result = await ipcRenderer.invoke('youtube:run-action', profile.id, action, value);
    const settingKeys = {
      'set-blocking': 'blockingEnabled',
      'set-sponsor-block': 'sponsorBlockEnabled',
      'set-background-playback': 'backgroundPlayback',
      'set-quality': 'quality',
    };
    const settingKey = settingKeys[action];
    const currentProfile = profiles.find((entry) => entry.id === profile.id);
    if (settingKey && currentProfile) {
      currentProfile.youtubeSettings = { ...currentProfile.youtubeSettings, [settingKey]: result };
      persistWorkspace();
    }
    if (getActiveYoutubeProfile()?.id !== profile.id) return result;

    if (action === 'stats') renderYoutubeStats(result);
    await refreshYoutubeStatus();
    if (action === 'import-cookies') statusElement.textContent = `Đã nạp ${result} cookie hợp lệ.`;
    return result;
  } catch (error) {
    if (getActiveYoutubeProfile()?.id !== profile.id) return null;
    statusElement.textContent = error.message || 'Không thực hiện được thao tác YouTube.';
    return null;
  }
}

function renderAll() {
  renderSidebar();
  renderWorkspaces();
  renderQuickReplies();
  renderDownloads();
  renderUpdate();
}

avatarPreview.onclick = () => avatarInput.click();
avatarInput.addEventListener('change', (event) => {
  const selectedFile = event.target.files?.[0];
  if (!selectedFile) return;

  tempAvatarPath = selectedFile.path;
  updateAvatarPreview();
});
platformInput.addEventListener('change', updateAvatarPreview);

document.querySelectorAll('[data-close]').forEach((button) => {
  button.onclick = () => closeOverlay(button.dataset.close);
});

document.getElementById('btn-add-profile').onclick = () => openModal();
document.getElementById('modal-cancel').onclick = () => closeOverlay('modal-overlay');
document.getElementById('modal-delete').onclick = () => {
  if (!editingProfile) return;
  if (profiles.length <= 1) return alert('Phải có ít nhất 1 tài khoản.');
  if (!confirm(`Xóa tài khoản ${editingProfile.name}?`)) return;
  profiles = profiles.filter((profile) => profile.id !== editingProfile.id);
  ipcRenderer.send('delete-profile', editingProfile.id);
  activeProfileId = profiles[0]?.id || null;
  persistWorkspace();
  closeOverlay('modal-overlay');
  renderAll();
  if (activeProfileId) switchProfile(activeProfileId);
};

document.getElementById('modal-save').onclick = () => {
  const name = nameInput.value.trim() || `Tài khoản ${profiles.length + 1}`;
  if (editingProfile) {
    editingProfile.name = name;
    editingProfile.proxy = proxyInput.value.trim();
    editingProfile.platform = platformInput.value;
    editingProfile.avatar = tempAvatarPath;
    ipcRenderer.send('update-profile-settings', editingProfile);
  } else {
    const id = String(Date.now());
    profiles.push({
      id,
      name,
      avatar: tempAvatarPath,
      partition: `persist:nick_${id}`,
      platform: platformInput.value,
      proxy: proxyInput.value.trim(),
    });
    activeProfileId = id;
  }
  persistWorkspace();
  closeOverlay('modal-overlay');
  renderAll();
  if (activeProfileId) switchProfile(activeProfileId);
};

const backButton = document.getElementById('btn-sidebar-back');
backButton.onclick = () => {
  backButton.style.transform = 'translateX(-4px)';
  setTimeout(() => { backButton.style.transform = ''; }, 150);
  ipcRenderer.send('go-back-page');
};

const reloadButton = document.getElementById('btn-sidebar-reload');
reloadButton.onclick = () => {
  reloadButton.style.transform = 'rotate(180deg)';
  setTimeout(() => { reloadButton.style.transform = ''; }, 300);
  ipcRenderer.send('reload-page');
};

document.getElementById('btn-open-downloads').onclick = () => openOverlay('downloads-overlay');
document.getElementById('btn-open-workspaces').onclick = () => openOverlay('workspace-overlay');
document.getElementById('btn-open-quick-replies').onclick = () => openOverlay('quick-replies-overlay');
youtubeToolsButton.onclick = () => {
  openOverlay('youtube-tools-overlay');
  refreshYoutubeStatus();
};

document.getElementById('youtube-login').onclick = () => {
  const profile = getActiveYoutubeProfile();
  if (profile) ipcRenderer.send('youtube:open-login', profile.id);
};
document.getElementById('youtube-sign-out').onclick = () => {
  if (confirm('Đăng xuất khỏi YouTube trên profile này?')) runYoutubeAction('sign-out');
};
document.getElementById('youtube-blocking').addEventListener('change', (event) => {
  runYoutubeAction('set-blocking', event.target.checked);
});
document.getElementById('youtube-sponsor-block').addEventListener('change', (event) => {
  runYoutubeAction('set-sponsor-block', event.target.checked);
});
document.getElementById('youtube-background-playback').addEventListener('change', (event) => {
  runYoutubeAction('set-background-playback', event.target.checked);
});
document.getElementById('youtube-quality-apply').onclick = () => {
  runYoutubeAction('set-quality', document.getElementById('youtube-quality').value);
};
document.getElementById('youtube-pip').onclick = () => runYoutubeAction('pip');
document.getElementById('youtube-refresh-stats').onclick = () => runYoutubeAction('stats');
document.getElementById('youtube-cookie-file').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const parsed = JSON.parse(await file.text());
    const cookies = Array.isArray(parsed) ? parsed : parsed.cookies;
    if (!Array.isArray(cookies)) throw new Error('File JSON không chứa danh sách cookie.');
    await runYoutubeAction('import-cookies', cookies);
  } catch (error) {
    document.getElementById('youtube-status').textContent = error.message || 'Không đọc được file cookie.';
  } finally {
    event.target.value = '';
  }
});

ipcRenderer.on('youtube:login-result', (_event, result) => {
  if (result.profileId !== activeProfileId) return;
  document.getElementById('youtube-status').textContent = result.rejected
    ? 'Google từ chối đăng nhập trong cửa sổ này.'
    : 'Đã đóng cửa sổ đăng nhập.';
  refreshYoutubeStatus();
});

ipcRenderer.on('youtube:runtime-ready', (_event, profileId) => {
  if (profileId === activeProfileId) refreshYoutubeStatus();
});

document.getElementById('workspace-create-btn').onclick = () => {
  const input = document.getElementById('workspace-name-input');
  const name = input.value.trim() || 'Workspace mới';
  workspaceState = ipcRenderer.sendSync('workspace-create', name);
  workspaceData = normalizeWorkspaceData(workspaceState.data);
  profiles = normalizeProfiles(workspaceData.profiles);
  activeProfileId = profiles[0]?.id || null;
  input.value = '';
  persistWorkspace();
  renderAll();
  if (activeProfileId) switchProfile(activeProfileId);
};

document.getElementById('quick-reply-add').onclick = addQuickReplyFromInput;
document.getElementById('quick-reply-input').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    addQuickReplyFromInput();
  }
});

document.getElementById('update-check').onclick = () => ipcRenderer.send('check-for-updates');
document.getElementById('update-download').onclick = () => ipcRenderer.send('download-update');
document.getElementById('update-install').onclick = () => ipcRenderer.send('install-update');

function showLockOverlay(setupMode = false) {
  appLocked = true;
  openOverlay('lock-overlay');
  const confirmInput = document.getElementById('lock-password-confirm');
  confirmInput.hidden = !setupMode;
  document.getElementById('lock-hint').textContent = setupMode
    ? 'Tạo mật khẩu khóa ứng dụng.'
    : 'Nhập mật khẩu để mở khóa.';
  document.getElementById('lock-submit').textContent = setupMode ? 'Tạo khóa' : 'Mở khóa';
  document.getElementById('lock-password').value = '';
  confirmInput.value = '';
}
function hideLockOverlay() {
  appLocked = false;
  closeOverlay('lock-overlay');
}
document.getElementById('lock-submit').onclick = () => {
  const password = document.getElementById('lock-password').value;
  const confirmPassword = document.getElementById('lock-password-confirm').value;
  if (!hasLockPassword) {
    if (!password || password !== confirmPassword) return alert('Mật khẩu không khớp.');
    ipcRenderer.send('set-lock-password', password);
  } else {
    ipcRenderer.send('unlock-app', password);
  }
};
const lockSubmit = document.getElementById('lock-submit');
document.getElementById('lock-password').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') lockSubmit.click();
});
document.getElementById('lock-password-confirm').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') lockSubmit.click();
});

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
    e.preventDefault();
    ipcRenderer.send('lock-app');
  }
});

ipcRenderer.on('downloads-list', (_event, list) => {
  downloads = list || [];
  renderDownloads();
});

ipcRenderer.on('download-updated', (_event, updatedDownload) => {
  downloads = downloads
    .filter((download) => download.id !== updatedDownload.id)
    .concat(updatedDownload);
  renderDownloads();
});

ipcRenderer.on('update-state', (_event, nextState) => {
  updateState = nextState;
  renderUpdate();
  if (['available', 'downloaded'].includes(nextState.status)) {
    openOverlay('update-overlay');
  }
});
ipcRenderer.on('theme-changed', (_, darkModeEnabled) => {
  isDarkMode = darkModeEnabled;
  document.body.className = isDarkMode ? 'dark-mode' : 'light-mode';
});
ipcRenderer.on('lock-state', (_, state) => {
  hasLockPassword = !!state.hasPassword;
  if (state.locked) showLockOverlay(!hasLockPassword);
});
ipcRenderer.on('unlock-result', (_event, result) => {
  if (result.ok) {
    hasLockPassword = true;
    hideLockOverlay();
  } else {
    alert(result.message || 'Sai mật khẩu.');
  }
});

ipcRenderer.on('update-profile-badge', (_event, { id, count }) => {
  const badgeElement = document.getElementById(`badge-${id}`);
  if (badgeElement) {
    badgeElement.textContent = count > 9 ? '9+' : String(count);
    badgeElement.style.display = count > 0 ? 'flex' : 'none';
  }
});

ipcRenderer.on('update-profile-info', (_event, payload) => {
  const profile = profiles.find((entry) => entry.id === payload.id);
  if (!profile) return;

  let changed = false;
  if (payload.name && profile.name.startsWith('Tài khoản')) {
    profile.name = payload.name;
    changed = true;
  }
  if (payload.avatarUrl && !profile.avatar) {
    profile.avatar = payload.avatarUrl;
    changed = true;
  }
  if (changed) {
    persistWorkspace();
    renderSidebar();
  }
});

const settings = ipcRenderer.sendSync('get-settings');
isDarkMode = settings.isDarkMode;
hasLockPassword = !!settings.hasLockPassword;
document.body.className = isDarkMode ? 'dark-mode' : 'light-mode';

migrateLegacyProfiles();
renderAll();
if (activeProfileId) switchProfile(activeProfileId);
ipcRenderer.send('renderer-ready');
ipcRenderer.send('get-downloads');
if (settings.lockOnStartup) showLockOverlay(!hasLockPassword);
