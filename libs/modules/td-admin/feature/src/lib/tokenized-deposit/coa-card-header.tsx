'use client';

import { RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { Badge, CardDescription, CardTitle } from '@myorg/shared/ui';

import { COA_STATUS_STYLE } from '@myorg/modules/td-admin/data-access/lib/tokenized-deposit';

import type { CoaSetupStatus } from './coa-setup-types';

/**
 * CoaCardHeader / CoaLinkedMessage — COA 卡片标题行 + 状态徽标 与 关联提示行
 * （原 renderHeader / renderLinkedMessage 渲染辅助函数）。
 * 源: coa-setup-card.tsx 258-259、288-368（纯代码搬移；改为组件后由父组件渲染，输出不变）。
 */
export interface CoaCardHeaderProps {
  embedded: boolean;
  status: CoaSetupStatus;
  headerNote?: string;
}

export function CoaCardHeader({
  embedded,
  status,
  headerNote,
}: CoaCardHeaderProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  // ── 状态徽标配色（COA_STATUS_STYLE：configured/setup_required）──
  const statusStyle = COA_STATUS_STYLE[status];

  // ── 渲染标题行 + 状态徽标（重设计：图标 tile + 标题 + 状态徽标 + 描述）──
  return (
    <div
      className={
        embedded
          ? 'mb-5 flex items-start justify-between gap-4'
          : 'border-b bg-muted/35 px-6 py-5'
      }
    >
      {embedded ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">
              {t('tokenized_deposit_coa_title')}
            </CardTitle>
            <Badge variant="secondary">
              {t(`tokenized_deposit_coa_status_${status}`)}
            </Badge>
          </div>
        </>
      ) : (
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <RefreshCw className="size-4" aria-hidden="true" />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">
                {t('tokenized_deposit_coa_title')}
              </CardTitle>
              <Badge
                variant="secondary"
                style={{
                  backgroundColor: statusStyle?.bg,
                  color: statusStyle?.text,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: 'currentColor' }}
                />
                {t(`tokenized_deposit_coa_status_${status}`)}
              </Badge>
            </div>
            <CardDescription className="leading-relaxed">
              {t('td_section_coa_desc')}
            </CardDescription>
            {headerNote ? (
              <div className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {headerNote}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

export interface CoaLinkedMessageProps {
  linkedMessage?: string;
  isSetupRequired: boolean;
}

export function CoaLinkedMessage({
  linkedMessage,
  isSetupRequired,
}: CoaLinkedMessageProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  // ── 渲染关联提示行 ──
  const message =
    linkedMessage ||
    (isSetupRequired
      ? t('tokenized_deposit_coa_no_coa_found')
      : t('tokenized_deposit_coa_linked_readonly'));
  return (
    <div
      className={`flex items-start gap-3 ${
        isSetupRequired
          ? 'text-primary'
          : 'text-emerald-600 dark:text-emerald-400'
      }`}
    >
      <span
        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: 'currentColor' }}
      />
      <div className="text-sm">{message}</div>
    </div>
  );
}
