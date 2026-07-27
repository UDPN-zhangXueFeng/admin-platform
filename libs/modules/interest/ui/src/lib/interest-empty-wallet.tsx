/**
 * walletTypeTable 空态占位组件。
 *
 * 老项目 policy/view.tsx 中 walletTypeTable 的 url=null、dataSource=[]，
 * 是后端未就绪的占位表，不调 API。本组件渲染相同的空态 UI。
 */
'use client';

import { InboxIcon } from 'lucide-react';
import { Card } from '@myorg/shared/ui';

export function InterestEmptyWalletTable() {
  return (
    <Card title="Applied Wallet Types">
      <div className="flex flex-col items-center justify-center py-12">
        <InboxIcon className="w-16 h-16 text-gray-300 mb-4" />
        <p className="text-gray-500">
          No associated wallet types found for this strategy.
        </p>
      </div>
    </Card>
  );
}
