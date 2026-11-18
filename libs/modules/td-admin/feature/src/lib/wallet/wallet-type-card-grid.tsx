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
  Card,
} from '@myorg/shared/ui';
import {
  useUpdateWalletTypeStateMutation,
  type StablecoinSearchOption,
  type WalletTypeCard,
} from '@myorg/modules/td-admin/data-access';
import { WALLET_TYPE_ACTION_PERMISSIONS } from './wallet.constants';
import { groupWalletTypeCards } from './wallet.helpers';
import { useAuth } from '@myorg/shared/util-auth';
import {
  WalletTypeAddCard,
  WalletTypeCardItem,
} from './wallet-type-card-item';
import type { WalletTypeEarningsTarget } from './wallet-type-earnings-dialog';

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
 * 卡片视觉走 shared/ui Card（shadow-float + rounded-xl），单卡结构拆到
 * `wallet-type-card-item.tsx`：标题/状态在头部，指标双列栅格在主体，操作收进底栏。
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
  const { permissions } = useAuth();
  const canAdd = permissions.has(WALLET_TYPE_ACTION_PERMISSIONS.add);
  const canEdit = permissions.has(WALLET_TYPE_ACTION_PERMISSIONS.edit);
  const canToggle = (card: WalletTypeCard) => canEdit && permissions.has(
    card.state === 10 ? WALLET_TYPE_ACTION_PERMISSIONS.disable : WALLET_TYPE_ACTION_PERMISSIONS.enable
  );
  const submitting = React.useRef(false);

  const issueType = stablecoin?.issueType;
  const isMmf = issueType === 20;
  const stablecoinDisabled = stablecoin?.state === 2;
  const symbol = stablecoin?.symbol ?? '';

  const groups = React.useMemo(() => groupWalletTypeCards(cards, 3), [cards]);
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

  const handleConfirmState = async () => {
    if (!confirmTarget?.ruleId || stablecoinDisabled || !canToggle(confirmTarget) || submitting.current) return;
    submitting.current = true;
    try {
      await updateStateMutation.mutateAsync({
        ruleId: confirmTarget.ruleId,
        walletState: confirmTarget.state === 10 ? 4 : 3,
      });
      toast.success(t('common.submit') + ' ' + t('common.success'));
      setConfirmTarget(null);
    } catch {
      // API client reports the business error. Keep the confirmation available.
    } finally {
      submitting.current = false;
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="h-full min-h-[17rem] animate-pulse p-5" aria-hidden="true">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 shrink-0 rounded-lg bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/2 rounded bg-muted" />
                <div className="h-3 w-1/3 rounded bg-muted" />
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4">
              {[0, 1, 2, 3, 4].map((j) => (
                <div key={j} className="space-y-2">
                  <div className="h-3 w-2/3 rounded bg-muted" />
                  <div className="h-4 w-1/2 rounded bg-muted" />
                </div>
              ))}
            </div>
          </Card>
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
              <WalletTypeAddCard
                key={`new-${idx}`}
                disabled={stablecoinDisabled}
                canAdd={canAdd}
                onAdd={() => router.push(buildAddPath())}
              />
            );
          }
          const card = item;
          return (
            <WalletTypeCardItem
              key={`card-${card.ruleId ?? idx}`}
              card={card}
              isMmf={isMmf}
              showAccountType={issueType !== 1}
              symbol={symbol}
              stablecoinDisabled={stablecoinDisabled}
              canEdit={canEdit}
              canOperate={canToggle(card)}
              editHref={buildEditPath(card)}
              detailHref={buildDetailPath(card)}
              onToggleState={setConfirmTarget}
              onOpenEarnings={onOpenEarnings}
            />
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
        onOpenChange={(next) => !next && !submitting.current && setConfirmTarget(null)}
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
              onClick={(event) => { event.preventDefault(); void handleConfirmState(); }}
            >
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
