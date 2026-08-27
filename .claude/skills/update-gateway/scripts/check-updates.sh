#!/usr/bin/env bash
# update-gateway 阶段一：确定性检查上游 GitLab 仓库是否有更新。
# 用法: check-updates.sh [old-sha]
# 输出 KEY=VALUE 事实段；old-sha 与远端 HEAD 不同时追加 COMMITS/DIFF_STAT/CHANGED_FILES。
# 禁止改用 GitLab API（匿名 404 已实证），统一走 git + 本机凭证。
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
REPO_URL='http://10.0.6.203:8088/udpn-kissen/source-code/kissen-bank-gateway-frontend.git'
TOKEN_FILE="$ROOT/.doc/kissen/.gitlab-token"
# 令牌存放在 gitignore 的 .doc/ 下（.claude/ 被 git 跟踪，禁止把令牌写进仓库）
if [ -s "$TOKEN_FILE" ]; then
  TOKEN="$(tr -d '[:space:]' < "$TOKEN_FILE")"
  REPO_URL="http://oauth2:${TOKEN}@10.0.6.203:8088/udpn-kissen/source-code/kissen-bank-gateway-frontend.git"
fi
CACHE="$ROOT/.doc/kissen/.cache/kissen-bank-gateway-frontend"

if [ ! -d "$CACHE/.git" ]; then
  echo "ACTION=cloned" >&2
  git clone --quiet "$REPO_URL" "$CACHE"
else
  git -C "$CACHE" fetch --quiet origin
fi
BRANCH="$(git -C "$CACHE" ls-remote --symref origin HEAD \
  | awk '/^ref:/ {sub(/^refs\/heads\//, "", $2); print $2; exit}')"
[ -n "$BRANCH" ] || BRANCH=master

NEW_SHA="$(git -C "$CACHE" rev-parse "origin/$BRANCH")"
OLD_SHA="${1:-}"

echo "BRANCH=$BRANCH"
echo "NEW_SHA=$NEW_SHA"
echo "OLD_SHA=$OLD_SHA"

[ -n "$OLD_SHA" ] || exit 0
[ "$OLD_SHA" != "$NEW_SHA" ] || exit 0

if ! git -C "$CACHE" merge-base --is-ancestor "$OLD_SHA" "origin/$BRANCH" 2>/dev/null; then
  # force push / rebase：历史被重写，交由上层决定处理方式
  echo "HISTORY_REWRITTEN=1"
  OLD_SHA="$(git -C "$CACHE" merge-base "$OLD_SHA" "origin/$BRANCH")"
  echo "MERGE_BASE=$OLD_SHA"
fi

echo "=== COMMITS ==="
git -C "$CACHE" log --no-merges --date=iso --pretty=format:'%h|%ad|%an|%s' \
  "$OLD_SHA..origin/$BRANCH"
echo
echo "=== DIFF_STAT ==="
git -C "$CACHE" diff --stat "$OLD_SHA" "origin/$BRANCH"
echo "=== CHANGED_FILES ==="
git -C "$CACHE" diff --name-status "$OLD_SHA" "origin/$BRANCH"
