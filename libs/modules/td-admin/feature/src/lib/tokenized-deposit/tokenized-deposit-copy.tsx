/**
 * Tokenized Deposit Copy — 地址/txHash 复制组件。
 *
 * 源项目 `CustomCopy` / `isHref` 模式：地址文本 + 复制按钮 + 可选浏览器跳转链接。
 * 优先复用 shared/ui 的 CopyableEllipsisText（ellipsis 默认行为），
 * 同时在文本行尾追加一个独立的复制图标按钮 + 可选的跳转图标按钮。
 *
 * 复制逻辑：navigator.clipboard.writeText + shared/ui toast 反馈。
 * 跳转逻辑：window.open(href, '_blank')。
 *
 * i18n namespace: `modules.tokenized-deposit`
 */
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@myorg/shared/ui';
import { CopyableEllipsisText } from '@myorg/shared/ui';

export interface TokenizedDepositCopyProps {
  /** 要显示的文本（地址/txHash）。空/null/undefined 不渲染操作按钮。 */
  text?: string | null;
  /**
   * 浏览器跳转链接（如 `browserUrl + 'tx/' + txHash`）。
   * 有值时行尾渲染一个外链图标按钮，点击 window.open(href, '_blank')。
   */
  href?: string;
  /** 是否启用文本截断省略（委托 shared/ui CopyableEllipsisText）。默认 false（完整展示）。 */
  ellipsis?: boolean;
}

/** 通用复制图标 SVG (heroicons clipboard) */
const CopyIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </svg>
);

/** 外链图标 SVG (heroicons external-link) */
const ExternalLinkIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

/**
 * 地址/txHash 复制组件。
 *
 * 用法：
 * ```tsx
 * // 仅复制
 * <TokenizedDepositCopy text={row.walletAddress} />
 *
 * // 复制 + 浏览器跳转
 * <TokenizedDepositCopy
 *   text={row.txHash}
 *   href={`https://explorer.example.com/tx/${row.txHash}`}
 * />
 *
 * // 超长文本省略
 * <TokenizedDepositCopy text={row.walletAddress} ellipsis />
 * ```
 */
export function TokenizedDepositCopy({
  text,
  href,
  ellipsis = false,
}: TokenizedDepositCopyProps) {
  const toast = useToast();
  const t = useTranslations('modules.tokenized-deposit');

  const handleCopy = React.useCallback(async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${t('PUB_Success').replace('****', 'Copy')}`);
    } catch {
      toast.error('Copy failed');
    }
  }, [text, toast, t]);

  const handleOpen = React.useCallback(() => {
    if (href) {
      window.open(href, '_blank');
    }
  }, [href]);

  // 空值 / 无文本
  if (!text) {
    return <span className="text-sm text-muted-foreground">--</span>;
  }

  // ellipsis 模式：委托 shared/ui CopyableEllipsisText
  if (ellipsis) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <CopyableEllipsisText
          value={text}
          copyable={false}
          className="min-w-0"
        />
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex shrink-0 items-center justify-center rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title={t('PUB_Confirm')}
          aria-label="Copy to clipboard"
        >
          <CopyIcon className="h-3.5 w-3.5" />
        </button>
        {href ? (
          <button
            type="button"
            onClick={handleOpen}
            className="inline-flex shrink-0 items-center justify-center rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={href}
            aria-label="Open in browser"
          >
            <ExternalLinkIcon className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    );
  }

  // 完整展示模式
  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="break-all font-mono text-sm">{text}</span>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex shrink-0 items-center justify-center rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title={t('PUB_Confirm')}
        aria-label="Copy to clipboard"
      >
        <CopyIcon className="h-3.5 w-3.5" />
      </button>
      {href ? (
        <button
          type="button"
          onClick={handleOpen}
          className="inline-flex shrink-0 items-center justify-center rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title={href}
          aria-label="Open in browser"
        >
          <ExternalLinkIcon className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
