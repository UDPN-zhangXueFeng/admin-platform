/**
 * TokenSelector 展示原语：代币标记 / 网络徽标 / 状态图标 + 网络配色表。
 * 源: token-selector.tsx 84-144
 */
'use client';

import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import type {
  TokenSelectorOption,
  TokenSelectorStatus,
} from './token-selector';


const NETWORK_COLOURS: Record<
  string,
  { background: string; foreground: string }
> = {
  Besu: { background: '#d1fae5', foreground: '#047857' },
  CFLR: { background: '#cffafe', foreground: '#0e7490' },
  SEPOLIA: { background: '#ede9fe', foreground: '#7c3aed' },
  Polygon: { background: '#f3e8ff', foreground: '#9333ea' },
  BNB: { background: '#fef3c7', foreground: '#b45309' },
  TRON: { background: '#fee2e2', foreground: '#dc2626' },
  AVAX: { background: '#fce7f3', foreground: '#db2777' },
};

export function getNetworkColours(network: string) {
  return (
    NETWORK_COLOURS[network] ?? { background: '#e2e8f0', foreground: '#475569' }
  );
}

export function TokenMark({
  option,
  large = false,
}: {
  option: TokenSelectorOption;
  large?: boolean;
}) {
  const colour =
    option.type === 'M'
      ? '#14b8a6'
      : option.type === 'TD'
        ? '#8b5cf6'
        : '#f59e0b';
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-white ${large ? 'h-10 w-10 text-sm' : 'h-5 w-5 text-[9px]'}`}
      style={{ backgroundColor: colour }}
    >
      {option.type === 'R-CBDC' ? 'R' : option.type === 'W-CBDC' ? 'W' : option.type}
    </span>
  );
}

export function NetworkBadge({ network }: { network: string }) {
  const colours = getNetworkColours(network);
  return (
    <span
      className="inline-flex max-w-24 shrink-0 truncate rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none"
      style={{ backgroundColor: colours.background, color: colours.foreground }}
    >
      {network}
    </span>
  );
}

export function StatusIcon({ status }: { status: TokenSelectorStatus }) {
  if (status === 'pending')
    return <Clock className="h-3 w-3 shrink-0 text-amber-500" />;
  if (status === 'inactive')
    return <XCircle className="h-3 w-3 shrink-0 text-red-500" />;
  return <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />;
}
