'use client';

import { Hourglass } from 'lucide-react';

/**
 * 「功能将在后续版本开放」占位页（源 `views/placeholder.vue`）。
 *
 * 源 MainLayout 把没有注册路由的菜单 key 统一送到 /placeholder?name=...，
 * 渲染 el-empty `${name} 功能将在后续版本开放`。目标侧等价物：registry 未
 * 注册（或暂无后端端点）的菜单项指向本组件，不渲染任何伪造数据行。
 */
export function KissenPlaceholderPage() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <Hourglass className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground" role="status">
        This feature will be available in a future release
      </p>
    </div>
  );
}
