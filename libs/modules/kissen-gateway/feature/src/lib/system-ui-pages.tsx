'use client';

/**
 * UI 设置占位页（源 `views/system/ui.vue`：整页 el-empty，无任何数据依赖；
 * 上游权限键 bank:ui:setting → MENU_ROUTE_MAP 第 11 键 '/system/ui'）。
 * 迁移保持同语义空态：仅 PageHead + EmptyHint，供壳层菜单可达与权限键
 * 折算，后续真实设置项落地前不引入额外状态。
 */
import { PageHead } from './page-head';
import { EmptyHint } from './state-blocks';

/* ================================================================== */
/* 占位页（registry：/system/ui → SystemUiPage，名字不可改）            */
/* ================================================================== */

export function SystemUiPage() {
  return (
    <div className="space-y-4">
      <PageHead title="UI Setting" />
      <EmptyHint text="Nothing to configure yet." />
    </div>
  );
}
