'use client';

import { useSearchParams } from 'next/navigation';
import { JournalEntriesForm } from './journal-entries-form-content';

/**
 * JournalEntriesFormPage — form shell（edit/create 共用）。
 *
 * dispatcher slug[0]=edit（query id=ruleId，编辑）或 create（无 id，新增）。
 * shell 读 searchParams 传 ruleIdRaw，不直接 import data-access（避免 nx lazy 误报，
 * 同 detail-content 模式）；表单逻辑在 form-content。
 */
export function JournalEntriesFormPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  return <JournalEntriesForm ruleIdRaw={id} />;
}
