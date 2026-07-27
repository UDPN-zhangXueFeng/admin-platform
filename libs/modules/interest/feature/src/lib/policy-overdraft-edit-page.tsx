/**
 * 透支策略编辑/新建页 — page shell（lazy load content）。
 *
 * 迁移自 td-manage `src/pages/interest/policy/overdraft/edit.tsx`（382 行）。
 * interestType=1，interestCalculationMethod 固定为 1（全额）。
 */
'use client';

import dynamic from 'next/dynamic';

const OverdraftEditContent = dynamic(
  () => import('./policy-overdraft-edit-content').then((m) => ({ default: m.OverdraftEditContent })),
  { ssr: false },
);

export function PolicyOverdraftEditPage() {
  return <OverdraftEditContent />;
}
