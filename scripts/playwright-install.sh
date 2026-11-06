#!/usr/bin/env bash
# Installs Playwright browsers and, on Linux, their system packages, with
# every attempt bounded. Seen on ubuntu-latest: apt stalled mid-download of
# 139 MB; timeout(1) killed npx, but the apt-get it had started under sudo
# kept the dpkg lock, so a plain retry failed at once with "Could not get
# lock /var/lib/dpkg/lock-frontend". So: apt gets its own network timeouts,
# packages and browsers are separate bounded steps, and a failed attempt
# kills the leftover apt, waits for the lock and repairs dpkg before retrying.
# Usage: bash scripts/playwright-install.sh [browser ...]   (default: all three)
set -uo pipefail

browsers=("$@")
[ ${#browsers[@]} -gt 0 ] || browsers=(chromium webkit firefox)
bound=""
command -v timeout >/dev/null && bound="timeout -k 10 300"   # macOS has no timeout(1)
linux=false
[ "$(uname -s)" = Linux ] && linux=true

export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a
if $linux; then
  printf 'Acquire::http::Timeout "30";\nAcquire::https::Timeout "30";\nAcquire::Retries "5";\n' |
    sudo tee /etc/apt/apt.conf.d/99playwright-timeouts >/dev/null
fi

release_apt() {
  $linux || return 0
  sudo pkill -9 -x apt-get 2>/dev/null || true
  sudo pkill -9 -x dpkg 2>/dev/null || true
  for _ in $(seq 1 30); do
    sudo fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || break
    sleep 2
  done
  sudo dpkg --configure -a || true
}

for attempt in 1 2 3; do
  ok=true
  if $linux; then
    $bound npx playwright install-deps "${browsers[@]}" || ok=false
  fi
  if $ok; then
    $bound npx playwright install "${browsers[@]}" || ok=false
  fi
  $ok && exit 0
  echo "attempt $attempt failed or stalled; releasing apt and retrying"
  release_apt
done
exit 1
