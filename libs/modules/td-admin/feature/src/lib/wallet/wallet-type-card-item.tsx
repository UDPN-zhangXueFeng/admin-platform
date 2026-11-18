'use client';

import * as React from 'react';
import { useRouter } from '@myorg/shared/util-i18n';
import { useTranslations } from 'next-intl';
import { Landmark, Plus, Wallet } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@myorg/shared/ui';
import { cn } from '@myorg/shared/util-classnames';
import { formatDate } from '@myorg/shared/util-dates';
import type { WalletTypeCard } from '@myorg/modules/td-admin/data-access';
import {
  accountTypeMessageKey,
  EMPTY_DISPLAY,
} from './wallet.constants';
import { formatLimitAmount } from './wallet.helpers';
import { WalletStatusBadge } from './wallet-status-badge';
import type { WalletTypeEarningsTarget } from './wallet-type-earnings-dialog';

/** 限额/时间展示格式（与 operational-wallet 一致）。 */
const DATE_FMT = 'YYYY-MM-DD';

export interface WalletTypeCardItemProps {
  card: WalletTypeCard;
  /** MMF（issueType === 20）走基金字段集。 */
  isMmf: boolean;
  /** issueType !== 1 时显示 accountType 副标题。 */
  showAccountType: boolean;
  /** stablecoin.symbol，用于限额单位。 */
  symbol: string;
  /** stablecoin 禁用态：所有写操作置灰。 */
  stablecoinDisabled: boolean;
  canEdit: boolean;
  canOperate: boolean;
  editHref: string;
  detailHref: string;
  onToggleState: (card: WalletTypeCard) => void;
  onOpenEarnings: (target: WalletTypeEarningsTarget) => void;
}

/**
 * WalletTypeCardItem —— 单个钱包类型卡片。
 *
 * 标题行（图标 + 名称 + 状态）→ 指标栅格 → 底栏操作。操作从标题行下移到底栏，
 * 避免名称/状态与多枚按钮在窄列中互相挤压；指标用 label 上/值下的双列栅格，
 * 替代原先 5 行 label-left/value-right 的密集长列表。
 */
export function WalletTypeCardItem({
  card,
  isMmf,
  showAccountType,
  symbol,
  stablecoinDisabled,
  canEdit,
  canOperate,
  editHref,
  detailHref,
  onToggleState,
  onOpenEarnings,
}: WalletTypeCardItemProps): React.JSX.Element {
  const t = useTranslations('modules.wallet');
  const router = useRouter();

  const canAct = card.operate === true;
  const isStateActive = card.state === 10;
  const isStateDisabled = card.state === 15;
  const showEnableDisable =
    canAct && canOperate && (isStateActive || isStateDisabled);
  const accountType = card.accountType === 0
    ? 'accountType.0'
    : accountTypeMessageKey(card.accountType);
  const title = card.name || EMPTY_DISPLAY;

  return (
    <Card
      className={cn('h-full', isStateDisabled && canAct && 'bg-muted/40')}
    >
      <CardHeader className="items-start gap-3 px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
            aria-hidden="true"
          >
            {isMmf ? (
              <Landmark className="h-4 w-4" />
            ) : (
              <Wallet className="h-4 w-4" />
            )}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <CardTitle className="truncate" title={title}>
                {title}
              </CardTitle>
              <WalletStatusBadge family="wallet-type-card" status={canAct ? card.state : -1} />
            </div>
            {showAccountType ? (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {accountType ? t(accountType as never) : EMPTY_DISPLAY}
              </p>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 px-5 pb-5">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          {isMmf ? (
            <>
              <Metric
                label={t('walletType.field.fundType')}
                value={
                  card.fundType
                    ? t(`walletType.mmfFundType.${card.fundType}` as never)
                    : EMPTY_DISPLAY
                }
              />
              <Metric
                label={t('walletType.field.riskLevel')}
                value={
                  card.riskLevel
                    ? t(`walletType.mmfRiskLevel.${card.riskLevel}` as never)
                    : EMPTY_DISPLAY
                }
              />
              <Metric
                label={t('walletType.field.fundAssetValue')}
                value={
                  card.fundAssetValue
                    ? `${card.fundAssetValue} ${card.currencySymbol ?? ''}`.trim()
                    : EMPTY_DISPLAY
                }
              />
              <Metric
                label={t('walletType.field.fundInceptionTime')}
                value={
                  card.fundInceptionTime
                    ? formatDate(Number(card.fundInceptionTime), DATE_FMT)
                    : EMPTY_DISPLAY
                }
              />
              <Metric
                className="col-span-2"
                label={t('walletType.field.fundlastPayoutTime')}
                value={
                  card.fundlastPayoutTime
                    ? formatDate(Number(card.fundlastPayoutTime), DATE_FMT)
                    : EMPTY_DISPLAY
                }
              />
            </>
          ) : (
            <>
              <Metric
                label={t('walletType.field.maxTxCountPer')}
                value={`${formatLimitAmount(Number(card.maxTxCountPer))} ${symbol}`.trim()}
              />
              <Metric
                label={t('walletType.field.maxTxCountDaily')}
                value={`${formatLimitAmount(Number(card.maxTxCountDaily))} ${symbol}`.trim()}
              />
              <Metric
                label={t('walletType.field.stablecoinCount')}
                value={`${formatLimitAmount(Number(card.stablecoinCount))} ${symbol}`.trim()}
              />
              <Metric
                label={t('walletType.field.minimumBalance')}
                value={`${formatLimitAmount(Number(card.minimumBalance))} ${symbol}`.trim()}
              />
              <Metric
                className="col-span-2"
                label={t('walletType.field.maximumRedeemLimit')}
                value={`${formatLimitAmount(Number(card.maximumRedeemLimit))} ${symbol}`.trim()}
              />
            </>
          )}
        </dl>
      </CardContent>

      <CardFooter className="mt-auto flex-wrap gap-2 px-5 py-3">
        {isMmf ? (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            onClick={() =>
              onOpenEarnings({
                ruleId: card.ruleId ?? 0,
                symbol: card.tdSymbol ?? symbol,
                currentSymbol: card.currencySymbol ?? symbol,
              })
            }
          >
            {t('walletType.earnings.distribute')}
          </Button>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(detailHref)}
          >
            {t('walletType.action.detail')}
          </Button>
          {canEdit && canAct && (isStateActive || isStateDisabled) ? (
            <Button
              size="sm"
              variant="outline"
              disabled={stablecoinDisabled}
              onClick={() => router.push(editHref)}
            >
              {t('walletType.action.edit')}
            </Button>
          ) : null}
          {showEnableDisable ? (
            <Button
              size="sm"
              variant={isStateActive ? 'ghost' : 'default'}
              className={
                isStateActive
                  ? 'text-destructive hover:bg-destructive/10 hover:text-destructive'
                  : undefined
              }
              disabled={stablecoinDisabled}
              onClick={() => onToggleState(card)}
            >
              {isStateActive
                ? t('walletType.action.disable')
                : t('walletType.action.enable')}
            </Button>
          ) : null}
        </div>
      </CardFooter>
    </Card>
  );
}

/** 指标：label 上 / 值下的紧凑单元（双列栅格内使用）。 */
function Metric({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}): React.JSX.Element {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className="mt-1 truncate text-sm font-medium tabular-nums"
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

/** 「新增钱包类型」占位卡（源 getGroup 末尾 'new' 项）。 */
export function WalletTypeAddCard({
  disabled,
  canAdd,
  onAdd,
}: {
  disabled: boolean;
  canAdd: boolean;
  onAdd: () => void;
}): React.JSX.Element {
  const t = useTranslations('modules.wallet');
  return (
    <Card className="flex h-full min-h-[17rem] items-center justify-center border-2 border-dashed border-border bg-transparent shadow-none hover:border-primary/40 hover:shadow-none">
      <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <span
          className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground"
          aria-hidden="true"
        >
          <Plus className="h-5 w-5" />
        </span>
        {canAdd ? (
          <Button size="sm" variant="outline" disabled={disabled} onClick={onAdd}>
            {t('walletType.card.newCard')}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
