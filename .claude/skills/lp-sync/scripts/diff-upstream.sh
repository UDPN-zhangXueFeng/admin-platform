#!/usr/bin/env bash
# lp-sync 差量计算：上游 fetch + diff，输出变更文件清单。
# 用法：
#   diff-upstream.sh              # 列出 lastSyncedSha..origin/<branch> 变更
#   diff-upstream.sh --apply SHA  # 同步完成后推进水位线（校验 SHA 是 lastSyncedSha 的后代）
set -euo pipefail

STATE="$(git rev-parse --show-toplevel)/.doc/kissen/project/LP/sync-state.json"
state() { python3 -c "import json,sys;print(json.load(open('$STATE'))$1)"; }

CLONE=$(state "['upstream']['clonePath']")
BRANCH=$(state "['upstream']['branch']")
BASE=$(state "['lastSyncedSha']")
SPEC=$(state "['specBaselineSha']")
CLONE="${CLONE/#\~/$HOME}"

git -C "$CLONE" fetch origin --prune --quiet
TIP=$(git -C "$CLONE" rev-parse --short=7 "origin/$BRANCH")

if [ "${1:-}" = "--apply" ]; then
  SHA="${2:?usage: --apply <sha>}"
  FULL=$(git -C "$CLONE" rev-parse "$SHA")
  BASEFULL=$(git -C "$CLONE" rev-parse "$BASE")
  if [ "$FULL" = "$BASEFULL" ]; then echo "水位线未变化：$SHA"; exit 0; fi
  git -C "$CLONE" merge-base --is-ancestor "$BASEFULL" "$FULL" || {
    echo "拒绝：$SHA 不是 $BASE 的后代（上游可能 force-push，需人工核对）" >&2; exit 1; }
  python3 - "$STATE" "$FULL" <<'EOF'
import json, sys, os
path, sha = sys.argv[1], sys.argv[2]
data = json.load(open(path))
data["lastSyncedSha"] = sha
tmp = path + ".tmp"
json.dump(data, open(tmp, "w"), ensure_ascii=False, indent=2)
os.replace(tmp, path)
EOF
  echo "lastSyncedSha → $FULL"
  exit 0
fi

echo "upstream : $(state "['upstream']['remote']")"
echo "range    : $BASE..$TIP  (branch $BRANCH)"
echo "spec base: $SPEC  (文档 01 行为规格锚点)"
if [ "$BASE" = "$TIP" ]; then
  echo "NO-CHANGE：上游无新提交"
  exit 0
fi
echo "--- changed files ---"
git -C "$CLONE" diff --name-status "$BASE..$TIP"
echo "--- upstream commits ---"
git -C "$CLONE" log --format='%h %ci %s' "$BASE..$TIP"
