'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { StatementsExportPage, StatementsViewPage } from './statements-detail-content';

/**
 * StatementsDetailPage — detail shell（按 slug[0] 分支，不直接 import data-access
 * 以避免 lazy-loaded 库 static import 违规；data-access 由 content 子组件 import）。
 *
 * dispatcher slug[0]=view → 规则详情（query id=exportRuleId）
 * slug[0]=export → 我的导出（无 id）
 */
export function StatementsDetailPage() {
  const params = useParams<{ slug?: string[] }>();
  const searchParams = useSearchParams();
  const slug0 = params.slug?.[0];
  const id = searchParams.get('id');

  if (slug0 === 'export') return <StatementsExportPage />;
  return <StatementsViewPage exportRuleIdRaw={id} />;
}
