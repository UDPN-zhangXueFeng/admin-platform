'use client';

import { useParams } from 'next/navigation';
import { TxEventMappingRuleListPage } from './tx-event-mapping-rule-list-page';
import { TxEventMappingRuleDetailPage } from './tx-event-mapping-rule-detail-page';
import { TxEventMappingRuleEditPage } from './tx-event-mapping-rule-edit-page';

/**
 * TxEventConfigDetailPage — 统一详情页（按 slug[1] 分支）。
 *
 * catch-all dispatcher 把 slug[0]='mapping-rule' 映射为 pageKey=`detail`，
 * 故本组件按 slug[1] 分支：
 *   无 slug[1]（query id=financeBookId）                       → Mapping Rule 列表
 *   slug[1]='edit'（query id=normalizationEventId, bookId=）→ Mapping Rule 编辑
 *   slug[1]='view'（query id=normalizationEventId, bookId=）→ Mapping Rule 详情
 */
export function TxEventConfigDetailPage() {
  const params = useParams<{ slug?: string[] }>();
  const slug1 = params.slug?.[1];

  if (slug1 === 'edit') return <TxEventMappingRuleEditPage />;
  if (slug1 === 'view') return <TxEventMappingRuleDetailPage />;
  return <TxEventMappingRuleListPage />;
}
