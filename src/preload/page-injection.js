function buildPageInjection(currentSettings) {
  return `
    window.__MessHubZaDarkShield = ${currentSettings.zadarkShield || false};

    (function() {
      if (window.__MessHubInjected) return;
      window.__MessHubInjected = true;
      var host = window.location.hostname || '';
      var isZalo = host === 'chat.zalo.me' || host.includes('zalo.me');
      var isMessenger = host.includes('messenger.com') || host.includes('facebook.com');
      var isWhatsApp = host.includes('whatsapp.com');
      var isTelegram = host.includes('telegram.org') || host.includes('web.telegram.org');
      var isTikTok = host.includes('tiktok.com');
      var platform = isZalo ? 'Zalo' : isMessenger ? 'Messenger' : isWhatsApp ? 'WhatsApp' : isTelegram ? 'Telegram' : isTikTok ? 'TikTok' : 'Unknown';
      if (platform === 'Unknown') return;

      function applyZaDarkShield() {
        if (!window.__MessHubZaDarkShield) return;
        try {
          Object.defineProperty(navigator, 'webdriver', { get: function() { return false; }, configurable: true });
        } catch(e) {}
        try {
          var style = document.getElementById('messhub-zadark-style');
          if (!style) {
            style = document.createElement('style');
            style.id = 'messhub-zadark-style';
            style.textContent = 'html{color-scheme:dark;} body{scrollbar-color:#3b82f6 #111827;} ::selection{background:#2563eb!important;color:#fff!important;}';
            document.documentElement.appendChild(style);
          }
        } catch(e) {}
      }
      applyZaDarkShield();

      var originalWindowOpen = window.open;
      window.open = function(url, target, features) {
        var win = originalWindowOpen.call(window, url, target, features);
        if (!win) return { closed:false, focus:function(){}, close:function(){} };
        return win;
      };

      // Quick Reply Shortcut System - intercepts /1, /2, etc.
      window.__MessHubQuickReplies = ${JSON.stringify(currentSettings.quickReplies || [])};

      function setupQuickReplyShortcuts() {
        if (window.__MessHubShortcutsReady) return;
        window.__MessHubShortcutsReady = true;

        document.addEventListener('keydown', function(e) {
          if (e.key !== 'Enter') return;
          var replies = window.__MessHubQuickReplies;
          if (!replies || !replies.length) return;

          var targetInput = e.target;
          if (!targetInput) return;

          var isEditable = targetInput.isContentEditable || targetInput.tagName === 'TEXTAREA' || targetInput.tagName === 'INPUT' || targetInput.getAttribute('contenteditable') === 'true' || targetInput.getAttribute('role') === 'textbox';
          if (!isEditable) return;

          var text = (targetInput.value !== undefined ? targetInput.value : (targetInput.innerText || targetInput.textContent || '')).trim();
          var match = text.match(/^\\/([0-9]+)$/);
          if (!match) return;

          var idx = parseInt(match[1], 10) - 1;
          if (idx < 0 || idx >= replies.length) return;

          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          // Clear the input and insert the template message
          targetInput.focus();
          document.execCommand('selectAll', false, null);
          document.execCommand('insertText', false, replies[idx].message);
          if (targetInput.value !== undefined) {
            targetInput.dispatchEvent(new Event('input', { bubbles: true }));
          }

          // Trigger send after a short delay
          setTimeout(function() {
            var sendBtn = document.querySelector('[data-translate-title="STR_SEND"]') || document.querySelector('button[class*="send"]') || document.querySelector('.chat-input__send-btn') || document.querySelector('[aria-label="Gửi"]') || document.querySelector('[aria-label="Send"]');
            if (sendBtn) {
              sendBtn.click();
            } else {
              // Simulate Enter key to send
              var enterEvent = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true });
              targetInput.dispatchEvent(enterEvent);
            }
          }, 100);
        }, true);

        // Also show a small hint when user types /
        document.addEventListener('input', function(e) {
          var replies = window.__MessHubQuickReplies;
          if (!replies || !replies.length) return;
          var targetInput = e.target;
          if (!targetInput) return;

          var isEditable = targetInput.isContentEditable || targetInput.tagName === 'TEXTAREA' || targetInput.tagName === 'INPUT' || targetInput.getAttribute('contenteditable') === 'true' || targetInput.getAttribute('role') === 'textbox';
          if (!isEditable) return;

          var text = (targetInput.value !== undefined ? targetInput.value : (targetInput.innerText || targetInput.textContent || '')).trim();
          var existingHint = document.getElementById('messhub-shortcut-hint');

          if (text.match(/^\\/[0-9]*$/)) {
            if (!existingHint) {
              existingHint = document.createElement('div');
              existingHint.id = 'messhub-shortcut-hint';
              existingHint.style.cssText = 'position:absolute;bottom:100%;left:16px;right:16px;background:rgba(20,22,30,.95);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:10px 0;z-index:999;max-height:240px;overflow-y:auto;box-shadow:0 12px 40px rgba(0,0,0,.5);';
              var inputContainer = targetInput.closest('[class*="chat-input"]') || targetInput.closest('[role="presentation"]') || targetInput.parentElement;
              if (inputContainer) { inputContainer.style.position = 'relative'; inputContainer.appendChild(existingHint); }
            }
            existingHint.innerHTML = '';
            replies.forEach(function(r, i) {
              var item = document.createElement('div');
              var shortcut = '/' + (i + 1);
              var isActive = text === shortcut;
              item.style.cssText = 'padding:8px 16px;cursor:pointer;display:flex;align-items:center;gap:10px;transition:background .15s;' + (isActive ? 'background:rgba(10,132,255,.2);' : '');
              var shortcutLabel = document.createElement('span');
              shortcutLabel.textContent = shortcut;
              shortcutLabel.style.cssText = 'background:rgba(10,132,255,.3);color:#65b7ff;padding:3px 8px;border-radius:8px;font-size:12px;font-weight:700;font-family:monospace;flex-shrink:0;';

              var messageLabel = document.createElement('span');
              var message = String(r.message || '');
              messageLabel.textContent = message.length > 60 ? message.substring(0, 60) + '...' : message;
              messageLabel.style.cssText = 'font-size:13px;color:rgba(255,255,255,.85);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';

              item.append(shortcutLabel, messageLabel);
              item.onmouseenter = function() { item.style.background = 'rgba(255,255,255,.08)'; };
              item.onmouseleave = function() { item.style.background = isActive ? 'rgba(10,132,255,.2)' : ''; };
              item.onclick = function(ev) {
                ev.preventDefault(); ev.stopPropagation();
                targetInput.focus();
                document.execCommand('selectAll', false, null);
                document.execCommand('insertText', false, r.message);
                if (targetInput.value !== undefined) targetInput.dispatchEvent(new Event('input', { bubbles: true }));
                if (existingHint) existingHint.remove();
              };
              existingHint.appendChild(item);
            });
            existingHint.style.display = 'block';
          } else {
            if (existingHint) existingHint.style.display = 'none';
          }
        }, true);
      }
      setTimeout(setupQuickReplyShortcuts, 3000);

      function getVisibleText(el) {
        return ((el && (el.innerText || el.textContent)) || '').replace(/\s+/g, ' ').trim();
      }
      function clickElement(el) {
        if (!el || el.__messHubAutoClicked) return false;
        el.__messHubAutoClicked = true;
        try {
          el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
          el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
          el.click();
          return true;
        } catch (e) { return false; }
      }
      function autoHandleZaloPrompts() {
        if (!isZalo) return;
        try {
          var all = Array.from(document.querySelectorAll('.zl-modal button, .zl-modal [role="button"], .zl-dialog button, .zl-dialog [role="button"]'));
          var allowBtn = all.find(function(el) {
            var text = getVisibleText(el);
            return text === 'Cho phép' || text === 'Allow' || text === 'Đồng ý' || text === 'OK';
          });
          if (allowBtn) clickElement(allowBtn);

          var banner = all.find(function(el) {
            var text = getVisibleText(el);
            return text.includes('Sử dụng Zalo PC') || text.includes('Tải ngay') || text.includes('Zalo PC để lưu trữ');
          });
          if (banner) {
            var scope = banner.closest('[class]') || banner.parentElement || document.body;
            var closeBtn = Array.from(scope.querySelectorAll('button, [role="button"], i, svg, span, div')).find(function(el) {
              var text = getVisibleText(el);
              var label = (el.getAttribute('aria-label') || el.getAttribute('title') || '').toLowerCase();
              var cls = (el.className || '').toString().toLowerCase();
              return text === '×' || text === 'x' || label.includes('close') || label.includes('đóng') || cls.includes('close') || cls.includes('dismiss');
            });
            if (closeBtn) clickElement(closeBtn);
          }
        } catch (e) {}
      }
      setTimeout(autoHandleZaloPrompts, 1200);
      // Handle the initial Zalo prompt once. Repeated full-page scans compete
      // with the live conversation renderer when messages arrive.

      // Auto extract profile name & avatar
      function extractProfileInfo() {
        var info = { name: '', avatar: '' };
        try {
          if (isZalo) {
            var nameEl = document.querySelector('.str-name') || document.querySelector('.header-title');
            var avatarEl = document.querySelector('.nav__tabs__avatar img, .zavatar-img, .zavatar img, .avatar-img');
            if (nameEl) info.name = nameEl.innerText.trim();
            if (avatarEl) info.avatar = avatarEl.src;
          } else if (isMessenger) {
            var titleEl = document.querySelector('title');
            if (titleEl && titleEl.innerText) {
              var t = titleEl.innerText;
              if (t.includes('(')) t = t.substring(t.indexOf(')') + 1);
              info.name = t.replace('Messenger', '').trim();
            }
            var avatarEl = document.querySelector('img[role="img"]') || document.querySelector('image[preserveAspectRatio="xMidYMid slice"]');
            if (avatarEl) info.avatar = avatarEl.src || avatarEl.getAttribute('xlink:href');
          } else if (isWhatsApp) {
            var nameEl = document.querySelector('h1.tvf2evcx') || document.querySelector('header span[dir="auto"]');
            var avatarEl = document.querySelector('header img');
            if (nameEl) info.name = nameEl.innerText.trim();
            if (avatarEl) info.avatar = avatarEl.src;
          } else if (isTelegram) {
            var nameEl = document.querySelector('.peer-title');
            var avatarEl = document.querySelector('.Avatar img');
            if (nameEl) info.name = nameEl.innerText.trim();
            if (avatarEl) info.avatar = avatarEl.src;
          } else if (isTikTok) {
            var nameEl = document.querySelector('h1[data-e2e="user-title"]');
            var avatarEl = document.querySelector('span[data-e2e="user-avatar"] img');
            if (nameEl) info.name = nameEl.innerText.trim();
            if (avatarEl) info.avatar = avatarEl.src;
          }
        } catch (e) { console.error('Extracted error', e); }
        if (info.name || info.avatar) {
          try { window.messHub.sendProfileInfo(info); } catch (e) { console.error('sendProfileInfo error', e); }
        }
      }
      extractProfileInfo();
      setInterval(extractProfileInfo, 30000);

      console.log('[MessHub] Page helpers ready:', platform);
    })();
  `;
}


module.exports = { buildPageInjection };
