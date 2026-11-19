'use client';

import { useParams } from 'next/navigation';
import { TxEventMappingRuleListPage } from './tx-event-mapping-rule-list-page';
import { TxEventMappingRuleDetailPage } from './tx-event-mapping-rule-detail-page';
import { TxEventMappingRuleEditPage } from './tx-event-mapping-rule-edit-page';

/**
 * TxEventConfigDetailPage — 统一详情页（按 mapping-rule 后的动作分支）。
 *
 * catch-all dispatcher 把 `mapping-rule` 段映射为 pageKey=`detail`，故本组件按
 * `mapping-rule` 之后的动作区分：
 *   无动作（query id=financeBookId）                       → Mapping Rule 列表
 *   `edit`（query id=normalizationEventId, bookId=）      → Mapping Rule 编辑
 *   `view`（query id=normalizationEventId, bookId=）      → Mapping Rule 详情
 *
 * 分组路由 `/accounting/transaction-event-configuration/mapping-rule/...` 的原始
 * slug 首段是模块 id（`['transaction-event-configuration','mapping-rule',<action>?]`）；
 * 旧扁平路由的 slug 首段直接是 `mapping-rule`（`['mapping-rule',<action>?]`）。
 * 两者都兼容。
 */
export function TxEventConfigDetailPage() {
  const params = useParams<{ slug?: string[] }>();
  const slug = params.slug ?? [];
  const mappingRuleIndex =
    slug[0] === 'transaction-event-configuration' ? 1 : 0;
  const action = slug[mappingRuleIndex + 1];

  if (action === 'edit') return <TxEventMappingRuleEditPage />;
  if (action === 'view') return <TxEventMappingRuleDetailPage />;
  return <TxEventMappingRuleListPage />;
}
