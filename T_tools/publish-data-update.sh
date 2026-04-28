#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

DEFAULT_RSSHUB_BASE_URL="https://lesliezh.zeabur.app"
RSSHUB_BASE_URL="${RSSHUB_BASE_URL:-$DEFAULT_RSSHUB_BASE_URL}"
COMMIT_MESSAGE="${1:-Update Explore data sources}"

say() {
  printf "\n==> %s\n" "$1"
}

fail() {
  printf "\nError: %s\n" "$1" >&2
  exit 1
}

retry_git() {
  local label="$1"
  shift
  local attempts=4
  local delay=8
  local attempt=1
  until "$@"; do
    if [ "$attempt" -ge "$attempts" ]; then
      fail "$label failed after $attempt attempts. This is usually a temporary GitHub/network problem. Check your internet/VPN, then rerun this script."
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
  fail "A rebase is already in progress. Finish or abort it before running this script."
fi

branch="$(git branch --show-current)"
if [ "$branch" != "main" ]; then
  fail "Current branch is '$branch'. Switch to main before publishing."
fi

status="$(git status --porcelain)"
if [ -n "$status" ]; then
  unexpected="$(printf "%s\n" "$status" | awk '$2 != "data.json" { print }')"
  if [ -n "$unexpected" ]; then
    printf "%s\n" "$status"
    fail "Only data.json may have local edits when using this one-command publisher."
  fi
fi

say "Validating data.json syntax"
node -e "JSON.parse(require('fs').readFileSync('data.json','utf8'))"

say "Syncing latest GitHub changes"
retry_git "GitHub sync" git -c http.version=HTTP/1.1 pull --rebase --autostash origin main

say "Regenerating Explore data"
RSSHUB_BASE_URL="$RSSHUB_BASE_URL" node T_tools/update-data.mjs

say "Checking generated freshness counts"
node <<'NODE'
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
for (const [key, mod] of Object.entries(data.explore)) {
  const count = key === 'english' ? (mod.podcasts || []).length : (mod.articles || []).length;
  console.log(`${key}: ${count}/${mod.targetItems}; ${mod.freshCountLabel}`);
}
NODE

if git diff --quiet -- data.json; then
  say "No data.json changes to publish"
  exit 0
fi

say "Committing data.json"
git add data.json
git commit -m "$COMMIT_MESSAGE"

say "Pushing to GitHub"
retry_git "GitHub push" git -c http.version=HTTP/1.1 push origin main

say "Done. GitHub Pages should refresh shortly."
