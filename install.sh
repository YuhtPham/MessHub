#!/usr/bin/env bash

set -Eeuo pipefail

APP_NAME="MessHub Client"
APP_REPOSITORY="YuhtPham/MessHub"
APP_INSTALL_DIR="${HOME}/.local/opt/messhub-client"
APPLICATIONS_DIR="${XDG_DATA_HOME:-${HOME}/.local/share}/applications"
APPIMAGE_NAME="MessHubClient.AppImage"
APPIMAGE_PATH="${APP_INSTALL_DIR}/${APPIMAGE_NAME}"
DESKTOP_FILE="${APPLICATIONS_DIR}/messhub-client.desktop"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
TEMP_DIR=""

cleanup() {
  if [[ -n "${TEMP_DIR}" && -d "${TEMP_DIR}" ]]; then
    rm -rf -- "${TEMP_DIR}"
  fi
}
trap cleanup EXIT

fail() {
  printf 'Lỗi: %s\n' "$1" >&2
  exit 1
}

case "$(uname -s)" in
  Linux) ;;
  Darwin)
    printf '%s chỉ cài bản Linux. Trên macOS, hãy tải file .dmg tại:\n' "${APP_NAME}"
    printf 'https://github.com/%s/releases/latest\n' "${APP_REPOSITORY}"
    exit 1
    ;;
  MINGW*|MSYS*|CYGWIN*)
    printf 'Windows không chạy được install.sh. Hãy tải bộ cài .exe tại:\n'
    printf 'https://github.com/%s/releases/latest\n' "${APP_REPOSITORY}"
    exit 1
    ;;
  *)
    fail 'Hệ điều hành này chưa được hỗ trợ bởi install.sh.'
    ;;
esac

case "$(uname -m)" in
  x86_64|amd64) APP_ARCH="x64" ;;
  aarch64|arm64)
    fail 'Bản Linux hiện chỉ được đóng gói cho máy Intel/AMD 64-bit (x64).'
    ;;
  *)
    fail "Kiến trúc $(uname -m) chưa được hỗ trợ."
    ;;
esac

printf '%s — trình cài đặt Linux\n' "${APP_NAME}"
printf 'Hệ thống: Linux x64\n'
printf 'Cài cho tài khoản hiện tại tại: %s\n\n' "${APP_INSTALL_DIR}"

read -r -p 'Tiếp tục cài đặt hoặc cập nhật? [Y/n] ' answer || true
case "${answer:-}" in
  [nN]|[nN][oO])
    printf 'Đã hủy.\n'
    exit 0
    ;;
esac

APPIMAGE_SOURCE=""
for candidate in "${SCRIPT_DIR}"/MessHub\ Client-*-linux-"${APP_ARCH}".AppImage; do
  [[ -f "${candidate}" ]] || continue
  if [[ -z "${APPIMAGE_SOURCE}" || "${candidate}" -nt "${APPIMAGE_SOURCE}" ]]; then
    APPIMAGE_SOURCE="${candidate}"
  fi
done

if [[ -n "${APPIMAGE_SOURCE}" ]]; then
  printf 'Tìm thấy bộ cài bên cạnh install.sh; đang dùng file đó.\n'
else
  command -v python3 >/dev/null 2>&1 || fail 'Cần Python 3 để tìm bản phát hành mới nhất. Hãy cài Python 3 hoặc đặt file AppImage cạnh install.sh.'
  if ! command -v curl >/dev/null 2>&1 && ! command -v wget >/dev/null 2>&1; then
    fail 'Cần curl hoặc wget để tải MessHub. Hãy cài một trong hai hoặc đặt file AppImage cạnh install.sh.'
  fi

  printf 'Không thấy AppImage cạnh script; đang tìm bản phát hành mới nhất trên GitHub...\n'
  ASSET_URL="$(python3 - "${APP_REPOSITORY}" "${APP_ARCH}" <<'PY'
import json
import sys
import urllib.error
import urllib.request

repository, architecture = sys.argv[1:]
api_url = f"https://api.github.com/repos/{repository}/releases/latest"
request = urllib.request.Request(
    api_url,
    headers={
        "Accept": "application/vnd.github+json",
        "User-Agent": "MessHub-Installer",
    },
)

try:
    with urllib.request.urlopen(request, timeout=25) as response:
        release = json.load(response)
except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as error:
    print(f"Không truy cập được GitHub Releases: {error}", file=sys.stderr)
    sys.exit(1)

suffix = f"-linux-{architecture}.AppImage"
assets = [asset for asset in release.get("assets", []) if asset.get("name", "").startswith("MessHub Client-") and asset["name"].endswith(suffix)]
if not assets:
    print("Release mới nhất chưa có AppImage Linux x64.", file=sys.stderr)
    sys.exit(1)

print(assets[0]["browser_download_url"])
PY
)" || fail 'Không tìm được AppImage. Hãy tải file AppImage từ trang Releases và đặt cạnh install.sh rồi chạy lại.'

  TEMP_DIR="$(mktemp -d)"
  APPIMAGE_SOURCE="${TEMP_DIR}/${APPIMAGE_NAME}"
  printf 'Đang tải MessHub...\n'
  if command -v curl >/dev/null 2>&1; then
    curl --fail --location --show-error --progress-bar "${ASSET_URL}" --output "${APPIMAGE_SOURCE}" \
      || fail 'Tải xuống thất bại. Kiểm tra kết nối Internet rồi thử lại.'
  else
    wget --show-progress --output-document="${APPIMAGE_SOURCE}" "${ASSET_URL}" \
      || fail 'Tải xuống thất bại. Kiểm tra kết nối Internet rồi thử lại.'
  fi
fi

mkdir -p -- "${APP_INSTALL_DIR}" "${APPLICATIONS_DIR}"
install -m 755 -- "${APPIMAGE_SOURCE}" "${APPIMAGE_PATH}"

cat > "${DESKTOP_FILE}" <<EOF
[Desktop Entry]
Type=Application
Name=MessHub Client
Comment=Không gian làm việc cho các tài khoản nhắn tin
Exec="${APPIMAGE_PATH}" %U
Icon=applications-internet
Terminal=false
Categories=Network;InstantMessaging;
StartupWMClass=com.tiodev.meta9
EOF
chmod 644 -- "${DESKTOP_FILE}"

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "${APPLICATIONS_DIR}" >/dev/null 2>&1 || true
fi

printf '\nCài đặt hoàn tất. Mở MessHub Client từ menu ứng dụng.\n'
printf 'Dữ liệu và phiên đăng nhập hiện có của bạn không bị xóa.\n'
