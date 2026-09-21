#!/bin/bash
set -euo pipefail

# =============================================================================
# Claude Code PostToolUse Hook
# 每次 AI 通过 Write/Edit 修改文件后，自动将变更归档到 .doc/YYYY-MM-DD.md
# 无外部依赖，纯 bash + sed/grep 实现
# =============================================================================

# 从 stdin 读取 hook 数据
INPUT=$(cat)

# ---- 简易 JSON 字段提取（无 jq 依赖） ----
extract_field() {
  local json="$1"
  local key="$2"
  # 匹配 "key": "value" 或 "key": "value"（含转义引号）
  echo "$json" | grep -o "\"${key}\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -1 | sed "s/.*\"${key}\"[[:space:]]*:[[:space:]]*\"\(.*\)\"/\\1/"
}

FILE=$(extract_field "$INPUT" "file_path")
TOOL=$(extract_field "$INPUT" "tool_name")

# 无文件路径则跳过
if [ -z "$FILE" ]; then
  exit 0
fi

# 忽略 .doc 自身，避免递归
case "$FILE" in
  */.doc/*) exit 0 ;;
esac

# 只归档项目内的文件
PROJECT_ROOT="/Users/zhangxuefeng/pi-cwd-20260601/admin-platform"
case "$FILE" in
  "$PROJECT_ROOT"/*) ;;
  *) exit 0 ;;
esac

# 计算相对路径
REL_PATH="${FILE#$PROJECT_ROOT/}"

DOC_DIR="${PROJECT_ROOT}/.doc"
TODAY=$(date +%Y-%m-%d)
NOW=$(date +%H:%M)

mkdir -p "$DOC_DIR"

DOC_FILE="${DOC_DIR}/${TODAY}.md"

# 当天文件不存在时，写入 Markdown 头部
if [ ! -f "$DOC_FILE" ]; then
  cat > "$DOC_FILE" <<EOF
# 代码变更归档 - ${TODAY}

> 由 Claude Code \`postToolUse\` hook 自动生成
> 项目: \`admin-platform\`

EOF
fi

# 判断变更类型
case "$TOOL" in
  Write) STATUS="新增/覆写" ;;
  Edit)  STATUS="修改" ;;
  *)     STATUS="$TOOL" ;;
esac

# 提取 Edit 工具的变更摘要（截取 old_string / new_string 前几行）
DIFF_SUMMARY=""
if [ "$TOOL" = "Edit" ]; then
  OLD_STRING=$(extract_field "$INPUT" "old_string")
  NEW_STRING=$(extract_field "$INPUT" "new_string")
  if [ -n "$OLD_STRING" ]; then
    OLD_BRIEF=$(echo "$OLD_STRING" | head -3 | sed 's/^/  - /')
    NEW_BRIEF=$(echo "$NEW_STRING" | head -3 | sed 's/^/  + /')
    DIFF_SUMMARY=$(printf "\n**变更摘要：**\n%s\n%s" "$OLD_BRIEF" "$NEW_BRIEF")
  fi
fi

# 追加归档条目
{
  echo "### ${NOW} - \`${STATUS}\`"
  echo ""
  echo "- **文件：** \`${REL_PATH}\`"
  echo "- **工具：** ${TOOL}"
  echo "- **时间：** ${NOW}"
  if [ -n "$DIFF_SUMMARY" ]; then
    echo ""
    echo "$DIFF_SUMMARY"
  fi
  echo ""
  echo "---"
  echo ""
} >> "$DOC_FILE"
