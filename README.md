# MessHub

[![MessHub](https://github.com/YuhtPham/MessHub/raw/main/icon.png)](./icon.png)

**MessHub** — ứng dụng desktop quản lý đa tài khoản Zalo, Messenger, Fanpage, Telegram, WhatsApp và các nền tảng chat phổ biến.

---

## Giới thiệu

**MessHub** là ứng dụng Electron cho phép quản lý nhiều tài khoản chat trên một giao diện duy nhất. Dùng Chromium BrowserView để tách dữ liệu session của từng profile, tránh trộn thông tin đăng nhập. Tập trung vào năng suất cho người dùng nhiều tài khoản: workspace riêng biệt, quick replies thông minh, badge thông báo theo platform, khóa ứng dụng, và các tiện ích hữu ích khác.

[![MessHub Preview](https://github.com/YuhtPham/MessHub/raw/main/preview.png)](./preview.png)

---

## Tính năng chính

### 1. Quản lý đa tài khoản

- **Tạo profile riêng biệt**: Mỗi tài khoản có session/partition riêng, tránh trộn dữ liệu.
- **Đặt tên & avatar**: Hiển thị tên tùy chỉnh hoặc icon nền tảng trên sidebar.
- **Cấu hình proxy**: Hỗ trợ proxy cho mỗi profile (định dạng: `ip:port` hoặc `ip:port:user:pass`).
- **Chuyển nhanh**: Click trên sidebar bên trái để chuyển profile al chóp.
- **Badge thông báo**: Hiển thị số tin nhắn chưa đọc trên mỗi profile.
- **Chỉnh sửa / Xóa**: Click chuột phải trên profile để sửa hoặc xóa (phải có ≥2 profile).

### 2. Hỗ trợ nhiều nền tảng

MessHub có thể quản lý các nền tảng:

- 💬 **Zalo**
- 💙 **Messenger**
- 🚩 **Facebook Fanpage**
- ✈️ **Telegram**
- 💚 **WhatsApp**
- 🟣 **Microsoft Teams**
- 📧 **Gmail**
- 📍 **TikTok**

---

### 3. Workspace — Tách dữ liệu theo dự án

- **Tạo workspace**: Mỗi workspace lưu riêng danh sách profile và quick replies.
- **Chuyển workspace**: Click "Workspace" để xem danh sách và chuyển đổi.
- **Dữ liệu tách biệt**: Profile của workspace A không hiển thị ở workspace B.
- **Use case**: Tách dữ liệu theo khách hàng, dự án, hoặc nhóm tài khoản.

---

### 4. Quick Replies — Mẫu tin nhắn nhanh

- **Lưu mẫu**: Mở "Quick Replies" → thêm nội dung cần lưu.
- **Sử dụng**: Gõ `/1`, `/2`, `/3`... trong ô chat rồi nhấn Enter.
- **Chỉnh sửa**: Click nút "Sửa" để cập nhật hoặc "Xóa" để loại bỏ.
- **Lưu theo workspace**: Mỗi workspace có bộ quick replies riêng.

---

### 5. Analytics — Theo dõi sự kiện

- **Lưu lịch sử**: Mỗi hành động (thêm profile, tạo workspace, thêm quick reply...) được ghi lại.
- **Giới hạn 500 events**: Giữ 500 event gần nhất để tiết kiệm tài nguyên.
- **Dùng nội bộ**: Dữ liệu dùng để tracking và debugging.

---

### 6. Chống seen / Chặn typing

- **Block seen**: Tùy chọn để không báo đã xem tin nhắn.
- **Block typing**: Tùy chọn để không hiển thị trạng thái "đang gõ".
- **Bật/tắt**: Trong Settings để kích hoạt/tắt cho tất cả session.

---

### 7. Tự xử lý popup Zalo

- **Cho phép quyền tự động**: Khi Zalo Web hỏi quyền thư mục tải, ứng dụng tự ấn "Cho phép".
- **Đóng banner**: Tự động đóng banner "Sử dụng Zalo PC... Tải ngay".
- **Chỉ cho Zalo**: Logic này áp dụng riêng cho nền tảng Zalo.

---

### 8. Downloads Manager

- **Theo dõi tải xuống**: Xem danh sách file đang tải.
- **Mở file**: Click để mở file sau khi tải xong.
- **Mở thư mục**: Dễ dàng truy cập thư mục chứa file.
- **Xóa từ danh sách**: Loại bỏ item khỏi lịch sử.

---

### 9. Khóa ứng dụng (Lock App)

- **Bảo mật**: Khóa ứng dụng bằng mật khẩu.
- **Tạo lần đầu**: Lần đầu bấm khóa, bạn sẽ tạo mật khẩu.
- **Lock on startup**: Tùy chọn để khóa app khi khởi động.
- **Phím tắt**: `Ctrl/Cmd + L` để khóa nhanh.
- **Unlocking**: Nhập mật khẩu để mở khóa.

---

### 10. Dark/Light Mode

- **Dark mode**: Giao diện tối (mặc định).
- **Light mode**: Giao diện sáng.
- **Chuyển đổi**: Click nút Sun/Moon ở sidebar để đổi.
- **Lưu trữ**: Cài đặt được lưu và khôi phục khi khởi động lại.

---

### 11. Tiện ích cửa sổ

- **Zoom in / out**: Phóng to/thu nhỏ giao diện.
- **Fullscreen**: Toàn màn hình.
- **Always on top**: Giữ cửa sổ luôn ở trên cùng.
- **Reload tab**: Làm tươi lại trang web.
- **Go back**: Lùi lại trang trước.
- **System tray**: Giảm xuống khay hệ thống.
- **Global hotkey**: `Ctrl+Shift+M` để bật/tắt app (có thể tùy chỉnh).

---

### 12. Auto-update

- **Kiểm tra cập nhật**: Mở "Update" để xem phiên bản mới.
- **Tải xuống**: Nút "Tải xuống" để download update.
- **Cài đặt**: Nút "Cài đặt" để cài đặt và khởi động lại app.
- **GitHub releases**: Dùng electron-updater để pull từ GitHub.

---

## Cài đặt & Chạy

### Yêu cầu

- **Node.js**: v14+ (khuyên dùng v18+)
- **npm**: v6+

### Chạy ở môi trường dev

```bash
npm install
npm start
```

### Build ứng dụng

**Windows:**
```bash
npm run build:win
```

**macOS:**
```bash
npm run build:mac
```

**Linux:**
```bash
npm run build
```

**Windows Portable:**
```bash
npm run build:portable
```

---

## Hướng dẫn sử dụng

### Thêm tài khoản mới

1. Bấm nút **+** ở sidebar bên trái.
2. Điền thông tin:
   - **Tên**: Hiển thị trên sidebar (nếu để trống sẽ lấy tên từ nền tảng).
   - **Platform**: Chọn Zalo, Messenger, Telegram, v.v.
   - **Proxy** (tùy chọn): `ip:port` hoặc `ip:port:user:pass`.
   - **Avatar** (tùy chọn): Click ảnh để chọn avatar tùy chỉnh.
3. Bấm **Lưu**.
4. Đăng nhập tài khoản trong tab BrowserView vừa tạo.

### Chuyển đổi giữa các tài khoản

- Bấm vào profile button trên sidebar để chuyển sang profile đó.
- BrowserView sẽ chuyển sang session của profile được chọn.

### Sửa hoặc xóa tài khoản

- **Click chuột phải** trên profile button.
- Cửa sổ modal mở lên với tùy chọn chỉnh sửa.
- Bấm **Xóa** để loại bỏ profile (cần có ≥2 profile).

### Tạo Workspace mới

1. Bấm nút **Workspace** (icon 🗂️).
2. Nhập tên workspace.
3. Bấm **Tạo mới**.
4. App chuyển sang workspace mới với danh sách profile riêng.

### Sử dụng Quick Replies

1. Bấm **Quick Replies** (💬).
2. Thêm nội dung mẫu tin nhắn.
3. Trong ô chat, gõ:
   - `/1` → Tin nhắn mẫu thứ 1
   - `/2` → Tin nhắn mẫu thứ 2
   - `/3` → Tin nhắn mẫu thứ 3
4. Nhấn **Enter** để gửi.

### Khóa ứng dụng

- **Lần đầu**: Bấm khóa → tạo mật khẩu.
- **Khóa nhanh**: `Ctrl/Cmd + L` hoặc click nút khóa trên UI.
- **Mở khóa**: Nhập mật khẩu.
- **Lock on startup**: Bật trong Settings để khóa tự động khi khởi động.

### Cấu hình cài đặt

Click **Settings** để:
- **Dark/Light Mode**: Chuyển giao diện.
- **Always On Top**: Giữ cửa sổ luôn ở trên.
- **Block Seen/Typing**: Tắt trạng thái xem và gõ (nếu nền tảng hỗ trợ).
- **Lock on Startup**: Khóa app khi khởi động.

---

## Tech Stack

- **Framework**: Electron 29.0.0
- **Render Engine**: Chromium (BrowserView)
- **Frontend**: HTML, CSS, JavaScript
- **Build**: electron-builder 24.13.3
- **Update**: electron-updater 6.8.3

---

## Cấu trúc dự án

```
MessHub/
├── main.js           # Process chính (Electron)
├── preload.js        # Preload script (IPC setup)
├── renderer.js       # Logic UI frontend
├── index.html        # HTML chính
├── custom_style.css  # CSS tùy chỉnh
├── package.json      # Metadata & scripts
├── backend/          # Backend (tùy chọn, chưa dùng)
└── docs/             # Tài liệu
```

---

## Tác giả

**YuhtPham** - Nhà phát triển chính

---

## License

**MIT License** - Tự do sử dụng, sửa đổi, và phân phối.

---

## Liên hệ & Hỗ trợ

Nếu gặp lỗi hoặc có đề xuất tính năng:
- Tạo **Issue** trên [GitHub repository](https://github.com/YuhtPham/MessHub/issues)
- Mô tả chi tiết vấn đề và bước tái hiện

---

## Lưu ý bảo mật

- **Mật khẩu lock app**: Được mã hóa bằng PBKDF2 (120,000 iterations, SHA256).
- **Session riêng biệt**: Mỗi profile dùng partition riêng, tránh chia sẻ cookies/cache.
- **Proxy**: Hỗ trợ proxy với xác thực username/password.
- **Không lưu mật khẩu**: App không lưu trữ mật khẩu nền tảng (chỉ session browser).

---

## Roadmap & TODO

- [ ] Tối ưu hiệu suất cho 50+ profiles
- [ ] Hỗ trợ database backend (Prisma + SQLite)
- [ ] Campaign automation cho Zalo
- [ ] CRM đơn giản
- [ ] AI rewrite tin nhắn
- [ ] Webhooks & integrations
- [ ] Mobile app (React Native)

---

## Credits

Được xây dựng với ❤️ bằng Electron & Chromium
