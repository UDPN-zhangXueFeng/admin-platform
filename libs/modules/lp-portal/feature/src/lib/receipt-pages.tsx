'use client';

/**
 * 源端收款明细（receipt）—— D1 占位页。
 *
 * 源语义（src/router/index.ts:45 + views/placeholder.vue）：路由
 * source-receipt（menuKey lp:receipt，meta.title 源端收款明细）挂
 * placeholder.vue，登录后菜单可见即渲染 el-empty「{title} 功能将在后续版本开放」。
 * 本页为该语义的 React 等价：无接口调用，仅渲染占位文案。
 */
export function ReceiptListPage() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 text-muted-foreground">
      <p className="text-lg font-medium text-foreground">源端收款明细</p>
      <p className="text-sm">功能将在后续版本开放</p>
    </div>
  );
}
