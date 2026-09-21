#!/usr/bin/env bash
#
# extract-module-meta.sh — 确定性提取老项目模块的结构化元数据
#
# 为什么需要它（Rule 5）：源文件、API、路由、状态枚举、权限码是「事实」，
# wc/grep/awk 能精确得到。交给脚本而非 LLM，避免幻觉，也让迁移率校验有客观分子分母。
#
# 用法：
#   extract-module-meta.sh <module-abs-path> [output-file]
#   不传 output-file 则输出到 stdout
#
# 输出分段（marker 分隔，便于下游 opus Agent 读取）：
#   === MODULE_META ===         模块名 / 文件数 / 总行数 / src 根 / api 模块数
#   === SOURCE_FILES ===        源文件清单（行数 + 相对路径 + 用途线索）
#   === API_ENDPOINTS ===       endpoint，分「页面字面量」与「api 模块封装」两组
#   === PAGES_ROUTES ===        页面/路由文件（index/view/edit/list/detail/create 约定）
#   === SHARED_IMPORTS ===      共享依赖来源（libs/* / @/* / 第三方），分类聚合
#   === I18N_HINTS ===          i18n 命名空间与样例 key
#   === STATUS_ENUMS ===        状态/Tag 颜色映射对象，完整键值 dump（跨行）
#   === LIMIT_PERMISSIONS ===   limit 权限码（按钮可见性）
#   === CROSS_MODULE_ROUTES === 跨模块跳转目标（routerPush / pathname）
#
# 兼容性：macOS 自带 bash 3.2（不用 mapfile）、BSD grep/sed/awk。
#
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <module-abs-path> [output-file]" >&2
  exit 1
fi

MODULE_PATH="$1"
OUT="${2:-/dev/stdout}"

if [[ ! -d "$MODULE_PATH" ]]; then
  echo "Error: module path not found: $MODULE_PATH" >&2
  exit 1
fi

MODULE_NAME="$(basename "$MODULE_PATH")"

# --- 推断老项目 src 根（用于解析 @/ import → 实际文件） ---
# 老项目 @/ 约定映射到 src/，从 MODULE_PATH 向上找含 src/ 的目录
src_root=""
p="$MODULE_PATH"
while [[ "$p" != "/" && "$p" != "." ]]; do
  if [[ -d "$p/src" ]]; then src_root="$p/src"; break; fi
  p="$(dirname "$p")"
done

# --- 收集源文件（.ts/.tsx） ---
# 不用 mapfile（bash 4+），macOS 系统自带 bash 3.2 不支持
SRC_FILES=()
while IFS= read -r f; do
  SRC_FILES+=("$f")
done < <(find "$MODULE_PATH" -type f \( -name '*.ts' -o -name '*.tsx' \) | sort)

# --- 收集页面 import 的 api 模块（@/lib/api/* 等），解析成实际文件 ---
# 修复 v1 缺陷：旧版只抓页面字面量 URL，漏掉封装在 api 模块里的写操作 endpoint
API_MODULE_FILES=()
if [[ -n "$src_root" ]]; then
  while IFS= read -r mod; do
    # mod 形如 @/lib/api/mmf；解析 @/ → src_root（注意补 /，src_root 无尾斜杠）
    cand="${src_root}/${mod#@/}"
    for ext in .ts .tsx ""; do
      f="${cand}${ext}"
      if [[ -f "$f" ]]; then API_MODULE_FILES+=("$f"); break; fi
    done
  done < <(grep -rhoE "from ['\"]@/[^'\"]*api[^'\"]*['\"]" "${SRC_FILES[@]}" 2>/dev/null \
           | grep -oE "@/[^'\"]+" | sort -u)
fi

TOTAL_FILES=${#SRC_FILES[@]}
TOTAL_LINES=0
if [[ $TOTAL_FILES -gt 0 ]]; then
  TOTAL_LINES=$(cat "${SRC_FILES[@]}" | wc -l | tr -d ' ')
fi

{
  echo "=== MODULE_META ==="
  echo "module_path: $MODULE_PATH"
  echo "module_name: $MODULE_NAME"
  if [[ -n "$src_root" ]]; then
    echo "src_root: $src_root"
  else
    echo "src_root: (not detected — @/ imports will not resolve)"
  fi
  echo "total_files: $TOTAL_FILES"
  echo "total_lines: $TOTAL_LINES"
  echo "api_module_files: ${#API_MODULE_FILES[@]}"
  echo ""

  # --- SOURCE_FILES ---
  echo "=== SOURCE_FILES ==="
  if [[ $TOTAL_FILES -eq 0 ]]; then
    echo "(no .ts/.tsx files found)"
  else
    printf '%s\t%s\t%s\n' "lines" "path(relative to module)" "hint"
    for f in "${SRC_FILES[@]}"; do
      rel="${f#$MODULE_PATH/}"
      lines=$(wc -l < "$f" | tr -d ' ')
      hint=$(grep -m1 -oE "(index|view|edit|list|detail|create)\.tsx" <<<"$rel" \
        || grep -m1 -oE "const [A-Z][A-Za-z0-9]+ *(=|:)" "$f" 2>/dev/null | head -1 \
        || echo "-")
      hint="${hint#const }"; hint="${hint%% *}"
      printf '%s\t%s\t%s\n' "$lines" "$rel" "$hint"
    done
  fi
  echo ""

  # --- API_ENDPOINTS（页面字面量 + api 模块封装，分组） ---
  echo "=== API_ENDPOINTS ==="
  page_apis=$(grep -rhE "/api/[A-Za-z0-9._/-]+" "${SRC_FILES[@]}" 2>/dev/null \
    | grep -oE "/api/[A-Za-z0-9._/-]+" | awk -F/ 'NF>=4' | sort -u || true)
  echo "[ from page literals ]"
  if [[ -z "$page_apis" ]]; then
    echo "(none — likely a pure mock/static page)"
  else
    echo "$page_apis"
  fi
  if [[ ${#API_MODULE_FILES[@]} -gt 0 ]]; then
    echo ""
    echo "[ from api modules (封装，页面字面量抓不到; src_root 解析) ]"
    mod_apis=$(grep -rhE "/api/[A-Za-z0-9._/-]+" "${API_MODULE_FILES[@]}" 2>/dev/null \
      | grep -oE "/api/[A-Za-z0-9._/-]+" | awk -F/ 'NF>=4' | sort -u || true)
    if [[ -z "$mod_apis" ]]; then
      echo "(api modules imported but no endpoint literal found)"
    else
      echo "$mod_apis"
      echo ""
      echo "imported api modules:"
      for f in "${API_MODULE_FILES[@]}"; do echo "  $f"; done
    fi
  fi
  echo ""

  # --- PAGES_ROUTES ---
  echo "=== PAGES_ROUTES ==="
  pages=$(printf '%s\n' "${SRC_FILES[@]}" \
    | grep -E "(index|view|edit|list|detail|create|manage)\.tsx$" || true)
  if [[ -z "$pages" ]]; then
    echo "(no conventional page files detected — inspect default exports manually)"
  else
    for f in $pages; do
      rel="${f#$MODULE_PATH/}"
      pagetype=$(grep -oE "(index|view|edit|list|detail|create)\.tsx$" <<<"$rel")
      pagetype="${pagetype%.tsx}"
      printf '%-10s %s\n' "$pagetype" "$rel"
    done
  fi
  echo ""

  # --- SHARED_IMPORTS ---
  echo "=== SHARED_IMPORTS ==="
  froms=$(grep -rhE "from ['\"][^'\"]+['\"]" "${SRC_FILES[@]}" 2>/dev/null \
    | grep -oE "['\"][^'\"]+['\"]" | tr -d "\"'" | sort -u || true)
  if [[ -z "$froms" ]]; then
    echo "(no imports)"
  else
    echo "[ libs/* (项目内共享组件/工具) ]"
    echo "$froms" | grep -E "^libs/" || echo "  (none)"
    echo ""
    echo "[ @/* 或相对路径 (项目内) ]"
    echo "$froms" | grep -E "^(@/|\.\./|\./)" || echo "  (none)"
    echo ""
    echo "[ 第三方包 ]"
    echo "$froms" | grep -vE "^(libs/|@/|\./|\.\./)" || echo "  (none)"
  fi
  echo ""

  # --- I18N_HINTS ---
  echo "=== I18N_HINTS ==="
  namespaces=$(grep -rhE "useHook\(\[?[^]]*\]" "${SRC_FILES[@]}" 2>/dev/null \
    | grep -oE "\[[^]]*\]" | tr -d "[]'\"" | tr ',' '\n' | sed 's/^ *//;s/ *$//' \
    | grep -vE "^$" | sort -u || true)
  if [[ -z "$namespaces" ]]; then
    echo "(no useHook namespace array — check useTranslation usage)"
  else
    echo "namespaces:"
    echo "$namespaces" | sed 's/^/  /'
  fi
  sample_keys=$(grep -rhoE "t\(['\"][A-Za-z0-9_]+['\"]" "${SRC_FILES[@]}" 2>/dev/null \
    | grep -oE "['\"][A-Za-z0-9_]+" | tr -d "\"'" | sort -u | head -30 || true)
  if [[ -n "$sample_keys" ]]; then
    echo ""
    echo "sample_keys (up to 30):"
    echo "$sample_keys" | sed 's/^/  /'
  fi
  echo ""

  # --- STATUS_ENUMS（完整键值 dump，跨行） ---
  echo "=== STATUS_ENUMS ==="
  # 修复 v1 缺陷：旧版只给定义起始行号，要求 Agent 再 Read 源码。
  # 现用 awk 抓跨行 { ... } 块，直接 dump 完整键值（带 file:line 定位）。
  enums_out=$(awk '
    /const [A-Za-z]+(Status|Map|Color|Type)[A-Za-z0-9_]* *(=|:)/ || /: *BCMP\.ANY *= *\{/ { printing = 1 }
    printing {
      print FILENAME ":" FNR ": " $0
      if ($0 ~ /\}/) printing = 0
    }
  ' "${SRC_FILES[@]}" 2>/dev/null || true)
  if [[ -z "$enums_out" ]]; then
    echo "(no obvious status/enum map — check inline ternary tag colors)"
  else
    echo "$enums_out"
    echo ""
    echo "(以上为完整键值；若多处键值相同，迁移时可合并为同一常量)"
  fi
  echo ""

  # --- LIMIT_PERMISSIONS（新增） ---
  echo "=== LIMIT_PERMISSIONS ==="
  # limit: 'hexstring' 是按钮可见性权限码，迁移率校验的硬指标
  limits=$(grep -rhoE "limit: *['\"][0-9a-fA-F]+['\"]" "${SRC_FILES[@]}" 2>/dev/null \
    | grep -oE "['\"][0-9a-fA-F]+['\"]" | tr -d "\"'" | sort -u || true)
  if [[ -z "$limits" ]]; then
    echo "(no limit permission codes)"
  else
    echo "$limits"
  fi
  echo ""

  # --- CROSS_MODULE_ROUTES（新增） ---
  echo "=== CROSS_MODULE_ROUTES ==="
  # routerPush({ pathname: '/x/y' }) 或 pathname: '/x/y'，跨模块跳转是迁移验收的依赖项
  routes=$(grep -rhE "(routerPush|router\.push|pathname:)" "${SRC_FILES[@]}" 2>/dev/null \
    | grep -oE "['\"]/[A-Za-z0-9/_-]+['\"]" | tr -d "\"'" | sort -u || true)
  if [[ -z "$routes" ]]; then
    echo "(no cross-module routes)"
  else
    echo "$routes"
  fi

} > "$OUT"

# 摘要打到 stderr
echo "[extract-module-meta] module=$MODULE_NAME files=$TOTAL_FILES lines=$TOTAL_LINES \
api_modules=${#API_MODULE_FILES[@]} -> $OUT" >&2
