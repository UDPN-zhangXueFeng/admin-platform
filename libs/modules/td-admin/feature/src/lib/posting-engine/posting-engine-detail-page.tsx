'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { PostingEngineBookDetail } from './posting-engine-book-detail';
import { PostingEngineEventView } from './posting-engine-event-view';

/**
 * PostingEngineDetailPage — 详情页（按 slug[0] 分支）。
 *
 * catch-all dispatcher 把 slug[0]（非 create/edit）统一映射为 pageKey=`detail`，
 * 故本组件按 slug[0] 分支：
 *   `book` → 账本详情（query id=financeBookId）：Basic Information + Matrix-of-events
 *   `view` → 事件详情（query id=postingEventId）：Basic Information + Version History
 *
 * 迁移自 td-manage `detail.tsx`（账本详情）与 `view.tsx`（事件详情）。
 */
export function PostingEngineDetailPage() {
  const params = useParams<{ slug?: string[] }>();
  const searchParams = useSearchParams();
  const slug0 = params.slug?.[0];
  const id = searchParams.get('id');
  const tab = searchParams.get('tab');

  if (slug0 === 'book') {
    return <PostingEngineBookDetail financeBookIdRaw={id} initialTab={tab} />;
  }
  return <PostingEngineEventView postingEventIdRaw={id} />;
}
