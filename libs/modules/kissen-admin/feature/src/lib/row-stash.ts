/**
 * 行数据暂存（row stash）。
 *
 * 源项目「查看/编辑」直接把当前行对象传给 dialog（openDetail(row)）。目标
 * 侧 list/edit/detail 拆为独立路由，且部分域后端无 GET detail 端点，详情页
 * 只能反查列表（首屏 N 条）。本 helper 在列表页跳转前把行写入
 * sessionStorage，详情/编辑页优先读取暂存行、缺失时再回退列表扫描——与源
 * 行为等价且不受列表规模限制。数据仅存活于当前标签页会话。
 */
const PREFIX = 'kissen_row_stash:';

function key(scope: string, id: string | number): string {
  return `${PREFIX}${scope}:${id}`;
}

/** 列表页跳转前暂存当前行。写入失败（隐私模式/容量满）静默忽略，详情页回退扫描。 */
export function stashRow(scope: string, id: string | number, row: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(key(scope, id), JSON.stringify(row));
  } catch {
    // 非关键路径：详情页回退列表扫描。
  }
}

/** 详情/编辑页读取暂存行；无暂存或解析失败返回 null（调用方回退列表扫描）。 */
export function peekRow<T>(scope: string, id: string | number): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key(scope, id));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
