'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { PostingEngineBookDetail } from './posting-engine-book-detail';
import { PostingEngineEventView } from './posting-engine-event-view';

/**
 * PostingEngineDetailPage — 详情页（按 book/view 分支）。
 *
 * catch-all dispatcher 把 slug（非 create/edit）统一映射为 pageKey=`detail`，
 * 故本组件按分支名区分：
 *   `book` → 账本详情（query id=financeBookId）：Basic Information + Matrix-of-events
 *   `view` → 事件详情（query id=postingEventId）：Basic Information + Version History
 *
 * 分组路由 `/accounting/posting-engine/<branch>` 的原始 slug 首段是模块 id
 * （`['posting-engine', <branch>]`）；旧扁平路由 `/posting-engine/<branch>` 的
 * 首段直接是分支名（`[<branch>]`）。两者都兼容。
 *
 * 迁移自 td-manage `detail.tsx`（账本详情）与 `view.tsx`（事件详情）。
 */
export function PostingEngineDetailPage() {
  const params = useParams<{ slug?: string[] }>();
  const searchParams = useSearchParams();
  const slug = params.slug ?? [];
  const branch = slug[0] === 'posting-engine' ? slug[1] : slug[0];
  const id = searchParams.get('id');
  const tab = searchParams.get('tab');

  if (branch === 'book') {
    return <PostingEngineBookDetail key={id} financeBookIdRaw={id} initialTab={tab} />;
  }
  return <PostingEngineEventView key={id} postingEventIdRaw={id} initialTab={tab} />;
}
