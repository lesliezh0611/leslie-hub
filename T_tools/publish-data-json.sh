#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

COMMIT_MESSAGE="${1:-Update site data}"

say() {
  printf "\n==> %s\n" "$1"
}

fail() {
  printf "\nError: %s\n" "$1" >&2
  exit 1
}

proxy_args() {
  if [ -n "${GIT_PROXY:-}" ]; then
    printf '%s\n' "-c" "http.proxy=$GIT_PROXY" "-c" "https.proxy=$GIT_PROXY"
    return
  fi

  if command -v scutil >/dev/null 2>&1; then
    local host port enabled
    enabled="$(scutil --proxy | awk '/HTTPSEnable/ { print $3; exit }')"
    host="$(scutil --proxy | awk '/HTTPSProxy/ { print $3; exit }')"
    port="$(scutil --proxy | awk '/HTTPSPort/ { print $3; exit }')"
    if [ "$enabled" = "1" ] && [ -n "$host" ] && [ -n "$port" ]; then
      printf '%s\n' "-c" "http.proxy=http://$host:$port" "-c" "https.proxy=http://$host:$port"
    fi
  fi
}

git_net() {
  local args=()
  while IFS= read -r arg; do
    args+=("$arg")
  done < <(proxy_args)
  git -c http.version=HTTP/1.1 "${args[@]}" "$@"
}

retry_git() {
  local label="$1"
  shift
  local attempts=4
  local delay=6
  local attempt=1
  until git_net "$@"; do
    if [ "$attempt" -ge "$attempts" ]; then
      fail "$label failed after $attempt attempts. Check your proxy/VPN, then rerun this script."
    fi
    printf "\nWarning: %s failed, retrying in %ss (%s/%s)...\n" "$label" "$delay" "$attempt" "$attempts" >&2
    sleep "$delay"
    attempt=$((attempt + 1))
    delay=$((delay * 2))
  done
}

if [ ! -d .git ]; then
  fail "Run this from the D_deliverables repository."
fi

if [ -d .git/rebase-merge ] || [ -d .git/rebase-apply ]; then
  fail "A rebase is already in progress. Finish or abort it before publishing."
fi

branch="$(git branch --show-current)"
if [ "$branch" != "main" ]; then
  fail "Current branch is '$branch'. Switch to main before publishing."
fi

status="$(git status --porcelain --untracked-files=all)"
if [ -z "$status" ]; then
  say "No local changes to publish"
  exit 0
fi

unexpected="$(printf "%s\n" "$status" | awk 'substr($0, 4) != "data.json" { print }')"

if [ -n "$unexpected" ]; then
  printf "%s\n" "$status"
  fail "This publisher only accepts data.json edits. Commit, stash, or remove other changes first."
fi

say "Validating data.json syntax"
node -e "JSON.parse(require('fs').readFileSync('data.json','utf8')); console.log('data.json is valid JSON.')"

say "Syncing latest GitHub changes"
retry_git "GitHub sync" pull --rebase --autostash origin main

say "Re-validating data.json after sync"
node -e "JSON.parse(require('fs').readFileSync('data.json','utf8')); console.log('data.json is valid JSON.')"

if git diff --quiet -- data.json && git diff --cached --quiet -- data.json; then
  say "No data.json changes to publish after syncing"
  exit 0
fi

say "Committing data.json"
git add data.json
git commit -m "$COMMIT_MESSAGE"

say "Pushing to GitHub"
retry_git "GitHub push" push origin main

say "Done. GitHub Pages should refresh shortly."
