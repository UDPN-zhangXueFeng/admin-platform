'use client';

import * as React from 'react';
import { useRouter } from '@myorg/shared/util-i18n';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from '@myorg/shared/ui';
import { WalletStatusBadge } from '@myorg/modules/wallet/ui';
import {
  useUpdateWalletTypeStateMutation,
  type StablecoinSearchOption,
  type WalletTypeCard,
} from '@myorg/modules/wallet/data-access';
import {
  accountTypeMessageKey,
  EMPTY_DISPLAY,
  formatLimit,
  WALLET_PERMISSIONS,
} from '@myorg/modules/wallet/util';
import { useAuth } from '@myorg/shared/util-auth';
import { formatDate } from '@myorg/shared/util-dates';
import type { WalletTypeEarningsTarget } from './wallet-type-earnings-dialog';

/** 限额/时间展示格式（与 operational-wallet 一致）。 */
const DATE_FMT = 'YYYY-MM-DD';

/**
 * 把扁平卡片数组按 `size` 切片分组，末组不足补 `'new'` 占位（忠实源 getGroup 逻辑）。
 *
 * 源 `libs/utils/get/getGroup.ts`：空数组补三个 'new'；每个切片不足 size 的用 'new' 填满。
 * 返回二维数组，外层按页（每页 1 组）消费。
 */
function groupCards(cards: WalletTypeCard[], size: number): (WalletTypeCard | 'new')[][] {
  if (cards.length === 0) {
    return [['new', 'new', 'new']];
  }
  const groups: (WalletTypeCard | 'new')[][] = [];
  for (let i = 0; i < cards.length; i += size) {
    const slice: (WalletTypeCard | 'new')[] = cards.slice(i, i + size);
    while (slice.length < size) slice.push('new');
    groups.push(slice);
  }
  return groups;
}

export interface WalletTypeCardGridProps {
  /** 当前 stablecoin（提供 issueType / state / name / symbol 等卡片渲染所需上下文）。 */
  stablecoin?: StablecoinSearchOption;
  /** 卡片数据（扁平数组，内部按 3 分页分组）。 */
  cards: WalletTypeCard[];
  /** 是否加载中。 */
  isLoading: boolean;
  /** 当前页（1-based，对应源 `current`，每页 1 组 3 卡片）。 */
  page: number;
  /** 翻页回调。 */
  onPageChange: (page: number) => void;
  /** 打开「收益派发」弹窗（MMF 卡片入口）。 */
  onOpenEarnings: (target: WalletTypeEarningsTarget) => void;
}

/**
 * WalletTypeCardGrid — 钱包类型卡片网格（按 accountType 分组的稳定币维度）。
 *
 * 迁移自 td-manage `src/pages/wallet/wallet-type/index.tsx` 第 483-907 行的卡片网格
 * （业务热点 #1 中段）。
 *
 * 忠实源逻辑：
 * - 扁平卡片数组经 `groupCards`（源 getGroup）按 3 切片，末组补 'new' 占位卡片（新建入口）。
 * - 外层分页：每页展示 1 组（3 卡片），分页器 `total = 组数`（源 Pagination defaultPageSize=1）。
 * - 单卡片：name + 状态 badge（wallet-type-card 族）+ 操作区（编辑/详情/启用禁用）。
 *   - issueType !== 1：显示 accountType（源 `coinData[ativeKey].issueType !== 1`）。
 *   - issueType === 20（MMF）：显示基金类型/风险/净值/成立日/上次派息 + 收益派发入口。
 *   - 否则：显示单笔/日/稳定币/最低余额/最大赎回限额（带 stablecoin.symbol 单位）。
 * - 启用/禁用：state===10 显示禁用（walletState=4），state===15 显示启用（walletState=3），
 *   二次确认 AlertDialog（源 Modal.confirm）→ `useUpdateWalletTypeStateMutation`。
 * - 卡片/操作跳转按 issueType===20 分流 mff/* 路径（task §5）。
 * - `operate !== true` 时仅显示详情按钮（源 `item.operate === true` 门控编辑/启停）。
 * - stablecoin.state === 2（禁用态）时禁用所有写操作按钮（源多处 `coinData[ativeKey].state === 2`）。
 *
 * 占位卡片（'new'）：源用 antd Image 占位图 + 新增按钮；目标用简洁卡片 + 新增按钮（无静态图资源）。
 */
export function WalletTypeCardGrid({
  stablecoin,
  cards,
  isLoading,
  page,
  onPageChange,
  onOpenEarnings,
}: WalletTypeCardGridProps): React.JSX.Element {
  const t = useTranslations('modules.wallet');
  const router = useRouter();
  const updateStateMutation = useUpdateWalletTypeStateMutation();
  const authPermissions = useAuth().permissions ?? new Set<string>();

  // 权限空集全放行（posting-engine 模式）。
  const canEdit =
    authPermissions.size === 0 || authPermissions.has(WALLET_PERMISSIONS.WalletTypeEdit);
  const canOperate =
    authPermissions.size === 0 ||
    authPermissions.has(WALLET_PERMISSIONS.WalletTypeOperate);

  const issueType = stablecoin?.issueType;
  const isMmf = issueType === 20;
  const stablecoinDisabled = stablecoin?.state === 2;
  const symbol = stablecoin?.symbol ?? '';

  const groups = React.useMemo(() => groupCards(cards, 3), [cards]);
  const totalPages = groups.length;
  const currentGroup = groups[Math.min(page - 1, totalPages - 1)] ?? [];

  // 启用/禁用二次确认上下文。
  const [confirmTarget, setConfirmTarget] =
    React.useState<WalletTypeCard | null>(null);

  // ── 跳转路径构造（按 issueType 分流，task §5）──
  const buildAddPath = React.useCallback((): string => {
    if (!stablecoin) return '';
    const base = isMmf
      ? '/wallet/wallet-type/mff/mff-add'
      : '/wallet/wallet-type/edit';
    const params = new URLSearchParams({
      type: 'add',
      stablecoinId: String(stablecoin.stablecoinId),
      name: `${stablecoin.name ?? ''} (${stablecoin.blockchainNameAbbreviation ?? ''})`,
      symbol: isMmf
        ? stablecoin.currencySymbol ?? ''
        : stablecoin.symbol ?? '',
      issueType: String(stablecoin.issueType ?? ''),
    });
    return `${base}?${params.toString()}`;
  }, [stablecoin, isMmf]);

  const buildEditPath = React.useCallback(
    (card: WalletTypeCard): string => {
      if (!stablecoin) return '';
      const base = isMmf
        ? '/wallet/wallet-type/mff/mff-add'
        : '/wallet/wallet-type/edit';
      const params = new URLSearchParams({
        type: 'edit',
        id: String(card.ruleId ?? ''),
        stablecoinId: String(stablecoin.stablecoinId),
        name: `${stablecoin.name ?? ''} (${stablecoin.blockchainNameAbbreviation ?? ''})`,
        symbol: isMmf
          ? stablecoin.currencySymbol ?? ''
          : stablecoin.symbol ?? '',
        issueType: String(stablecoin.issueType ?? ''),
      });
      return `${base}?${params.toString()}`;
    },
    [stablecoin, isMmf]
  );

  const buildDetailPath = React.useCallback(
    (card: WalletTypeCard): string => {
      const base = isMmf ? '/wallet/wallet-type/mff/view' : '/wallet/wallet-type/view';
      const params = new URLSearchParams({
        id: String(card.ruleId ?? ''),
        stablecoinId: String(card.stablecoinId ?? stablecoin?.stablecoinId ?? ''),
        name: stablecoin?.name ?? '',
        symbol: stablecoin?.symbol ?? '',
        issueType: String(stablecoin?.issueType ?? ''),
      });
      return `${base}?${params.toString()}`;
    },
    [stablecoin, isMmf]
  );

  const handleConfirmState = React.useCallback(() => {
    if (!confirmTarget) return;
    const card = confirmTarget;
    updateStateMutation.mutate(
      {
        ruleId: card.ruleId ?? 0,
        walletState: card.state === 10 ? 4 : 3,
      },
      {
        onSuccess: () => {
          toast.success(t('common.submit') + ' ' + t('common.success'));
          setConfirmTarget(null);
        },
        onError: () => {
          setConfirmTarget(null);
        },
      }
    );
  }, [confirmTarget, updateStateMutation, t]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-48 animate-pulse rounded-lg border bg-muted/40"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {currentGroup.map((item, idx) => {
          // 占位「新建」卡片（源 getGroup 末尾 'new'）。
          if (item === 'new') {
            return (
              <div
                key={`new-${idx}`}
                className="flex min-h-[12rem] flex-col items-center justify-center rounded-lg border border-dashed p-6"
              >
                <Button
                  disabled={stablecoinDisabled || !canEdit}
                  onClick={() => router.push(buildAddPath())}
                >
                  {t('walletType.card.newCard')}
                </Button>
              </div>
            );
          }
          const card = item;
          // 源 `item.operate === true`：运行时为布尔，model 标 number 宽松兜底，
          // 此处以 Boolean 兼容（数字非 0 或 true 均视为可操作）。
          const canAct = Boolean(card.operate);
          const dimmed = card.state === 15 && canAct;
          const isStateActive = card.state === 10;
          const isStateDisabled = card.state === 15;
          const showEnableDisable =
            canAct && canOperate && (isStateActive || isStateDisabled);
          return (
            <div
              key={`card-${card.ruleId ?? idx}`}
              className={`flex flex-col rounded-lg border p-4 ${
                dimmed ? 'bg-muted/40' : 'bg-card'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-base font-medium">
                    {card.name || EMPTY_DISPLAY}
                  </span>
                  {canAct ? (
                    <WalletStatusBadge
                      family="wallet-type-card"
                      status={card.state}
                    />
                  ) : null}
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {canEdit && canAct && (isStateActive || isStateDisabled) ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={stablecoinDisabled}
                      onClick={() => router.push(buildEditPath(card))}
                    >
                      {t('walletType.action.edit')}
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(buildDetailPath(card))}
                  >
                    {t('walletType.action.detail')}
                  </Button>
                  {showEnableDisable ? (
                    <Button
                      size="sm"
                      variant={isStateActive ? 'destructive' : 'default'}
                      disabled={stablecoinDisabled}
                      onClick={() => setConfirmTarget(card)}
                    >
                      {isStateActive
                        ? t('walletType.action.disable')
                        : t('walletType.action.enable')}
                    </Button>
                  ) : null}
                </div>
              </div>

              {/* accountType：源 issueType !== 1 时显示。 */}
              {issueType !== 1 ? (
                <CardRow
                  label={t('walletType.field.accountType')}
                  value={
                    accountTypeMessageKey(card.accountType)
                      ? t(accountTypeMessageKey(card.accountType) as never)
                      : EMPTY_DISPLAY
                  }
                />
              ) : null}

              {isMmf ? (
                <>
                  <CardRow
                    label={t('walletType.field.fundType')}
                    value={
                      card.fundType
                        ? t(
                            `walletType.mmfFundType.${card.fundType}` as never
                          )
                        : EMPTY_DISPLAY
                    }
                  />
                  <CardRow
                    label={t('walletType.field.riskLevel')}
                    value={
                      card.riskLevel
                        ? t(
                            `walletType.mmfRiskLevel.${card.riskLevel}` as never
                          )
                        : EMPTY_DISPLAY
                    }
                  />
                  <CardRow
                    label={t('walletType.field.fundAssetValue')}
                    value={
                      card.fundAssetValue
                        ? `${card.fundAssetValue} ${card.currencySymbol ?? ''}`.trim()
                        : EMPTY_DISPLAY
                    }
                  />
                  <CardRow
                    label={t('walletType.field.fundInceptionTime')}
                    value={
                      card.fundInceptionTime
                        ? formatDate(Number(card.fundInceptionTime), DATE_FMT)
                        : EMPTY_DISPLAY
                    }
                  />
                  <CardRow
                    label={t('walletType.field.fundlastPayoutTime')}
                    value={
                      card.fundlastPayoutTime
                        ? formatDate(Number(card.fundlastPayoutTime), DATE_FMT)
                        : EMPTY_DISPLAY
                    }
                  />
                  <div className="mt-2 flex justify-end">
                    <Button
                      variant="link"
                      className="h-auto p-0"
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
                  </div>
                </>
              ) : (
                <>
                  <CardRow
                    label={t('walletType.field.maxTxCountPer')}
                    value={`${formatLimit(Number(card.maxTxCountPer))} ${symbol}`.trim()}
                  />
                  <CardRow
                    label={t('walletType.field.maxTxCountDaily')}
                    value={`${formatLimit(Number(card.maxTxCountDaily))} ${symbol}`.trim()}
                  />
                  <CardRow
                    label={t('walletType.field.stablecoinCount')}
                    value={`${formatLimit(Number(card.stablecoinCount))} ${symbol}`.trim()}
                  />
                  <CardRow
                    label={t('walletType.field.minimumBalance')}
                    value={`${formatLimit(Number(card.minimumBalance))} ${symbol}`.trim()}
                  />
                  <CardRow
                    label={t('walletType.field.maximumRedeemLimit')}
                    value={`${formatLimit(Number(card.maximumRedeemLimit))} ${symbol}`.trim()}
                  />
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* 外层分页（每页 1 组，源 Pagination defaultPageSize=1） */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            ‹
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            ›
          </Button>
        </div>
      ) : null}

      {/* 启用/禁用二次确认（源 Modal.confirm） */}
      <AlertDialog
        open={Boolean(confirmTarget)}
        onOpenChange={(next) => !next && setConfirmTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmTarget?.state === 10
                ? t('walletType.confirm.disableTitle')
                : t('walletType.confirm.enableTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTarget?.state === 10
                ? t('walletType.confirm.disableContent')
                : t('walletType.confirm.enableContent')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateStateMutation.isPending}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={updateStateMutation.isPending}
              onClick={handleConfirmState}
            >
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** 卡片内单行 label/value（源 mt-4 flex justify-between）。 */
function CardRow({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div className="mt-3 flex items-baseline justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
