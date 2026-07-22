'use client';

import { useParams, useSearchParams } from 'next/navigation';

import { WalletTypeRegularForm } from './wallet-type-form-regular';
import { WalletTypeMmfForm } from './wallet-type-form-mmf';

/**
 * WalletTypeFormPage — 钱包类型表单入口（无 props，page.tsx 渲染）。
 *
 * 迁移自 td-manage `src/pages/wallet/wallet-type/{edit,mff/mff-add}.tsx`。
 *
 * 路由（wallet 分组模块，realModule=wallet-type，pageKey 均映射 'edit'）：
 * - `/wallet/wallet-type/edit?type=add|edit&id?&stablecoinId&name&symbol&issueType&...`
 *   → params.slug=['wallet-type','edit']，slug[1]='edit' → 常规条件表单。
 * - `/wallet/wallet-type/mff/mff-add?type=add|edit&id?&...`
 *   → params.slug=['wallet-type','mff','mff-add']，slug[1]='mff' → MMF 表单。
 *
 * 分支键 = params.slug?.[1]（'edit' → 常规；'mff' → MMF）。
 * type/id/stablecoinId/name/symbol/issueType 从 useSearchParams 取（client + ssr:false，
 * 无需 Suspense）。
 *
 * slug[1] 既非 'edit' 也非 'mff' 时回落常规表单（防御）。
 */
export function WalletTypeFormPage() {
  const params = useParams<{ slug?: string[] }>();
  const slug1 = params.slug?.[1];

  const searchParams = useSearchParams();
  const idStr = searchParams.get('id') ?? '';
  const ruleId = idStr !== '' ? Number(idStr) : undefined;
  const stablecoinIdStr = searchParams.get('stablecoinId') ?? '';
  const tdId = stablecoinIdStr !== '' ? Number(stablecoinIdStr) : 0;
  const tokenName = searchParams.get('name') ?? undefined;
  const symbol = searchParams.get('symbol') ?? undefined;
  const issueTypeStr = searchParams.get('issueType') ?? '';
  const issueType = issueTypeStr !== '' ? Number(issueTypeStr) : undefined;

  // id 存在即编辑态（与源 query.id 判定一致）。
  const effectiveRuleId =
    ruleId !== undefined && !Number.isNaN(ruleId) ? ruleId : undefined;

  if (slug1 === 'mff') {
    return (
      <WalletTypeMmfForm
        ruleId={effectiveRuleId}
        tdId={tdId}
        tokenName={tokenName}
        symbol={symbol}
      />
    );
  }

  return (
    <WalletTypeRegularForm
      ruleId={effectiveRuleId}
      tdId={tdId}
      tokenName={tokenName}
      symbol={symbol}
      issueType={issueType}
    />
  );
}
