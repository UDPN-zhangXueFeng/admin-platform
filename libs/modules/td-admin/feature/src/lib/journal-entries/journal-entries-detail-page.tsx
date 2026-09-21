'use client';

import { useSearchParams } from 'next/navigation';
import { JournalEntriesView } from './journal-entries-detail-content';

/**
 * JournalEntriesDetailPage — detail shell。
 *
 * dispatcher slug[0]=view → 规则详情（query id=ruleId, type=tokenType）。
 * shell 读 searchParams 传 props，不直接 import data-access（避免 nx lazy-loaded 误报，
 * 同 statements 模式）；view 逻辑在 detail-content。
 */
export function JournalEntriesDetailPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const type = searchParams.get('type');
  return <JournalEntriesView ruleIdRaw={id} tokenTypeRaw={type} />;
}
