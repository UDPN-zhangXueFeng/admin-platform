'use client';

/**
 * Source receipt details (receipt) - D1 placeholder page.
 *
 * Source semantics (src/router/index.ts:45 + views/placeholder.vue): the
 * source-receipt route (menuKey lp:receipt, meta.title = receipt details)
 * mounts placeholder.vue; once visible in the post-login menu it renders
 * el-empty "{title} will be available in a later release". This page is the
 * React equivalent of that contract: no API calls, placeholder copy only.
 */
export function ReceiptListPage() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 text-muted-foreground">
      <p className="text-lg font-medium text-foreground">Source Receipt Details</p>
      <p className="text-sm">This feature will be available in a future release</p>
    </div>
  );
}
